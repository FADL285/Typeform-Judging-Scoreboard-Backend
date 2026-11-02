import { createClient } from '@typeform/api-client';
import dotenv from 'dotenv';
dotenv.config();

export function validateTypeformConfig(env) {
  const token = env.TYPEFORM_PERSONAL_TOKEN?.trim();
  const workspaceId = env.TYPEFORM_WORKSPACE_ID?.trim();
  if (!token || !workspaceId) throw new Error('TYPEFORM_PERSONAL_TOKEN and TYPEFORM_WORKSPACE_ID are required');
  return { token, workspaceId };
}
const failure = (message, statusCode) => Object.assign(new Error(message), { statusCode });
export function createHandlers(api, workspaceId, now = Date.now, limits = {}) {
  if (typeof workspaceId !== 'string' || !workspaceId.trim()) throw new Error('A Typeform workspace ID is required');
  const { timeoutMs = 8000, intervalMs = 500, maxResponses = 10000, maxForms = 1000, maxResponseBytes = 8 * 1024 * 1024 } = limits;
  let listRefresh;
  const details = new Map();
  let cachedBytes = 0;
  let activeRequests = 0;
  let activeCalls = 0;
  let nextStart = 0;
  const waiters = [];
  async function upstream(fn) {
    if (activeCalls >= 2) {
      if (waiters.length >= 20) throw failure('Typeform is busy; try again later', 503);
      await new Promise(resolve => waiters.push(resolve));
    } else { activeCalls++; }
    let timer;
    try {
      const delay = Math.max(0, nextStart - Date.now());
      nextStart = Date.now() + delay + intervalMs;
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      return await Promise.race([
        Promise.resolve().then(fn),
        new Promise((_, reject) => { timer = setTimeout(() => reject(failure('Typeform request timed out', 504)), timeoutMs); }),
      ]);
    } finally {
      clearTimeout(timer);
      const next = waiters.shift();
      if (next) next(); else activeCalls--;
    }
  }
  async function request(fn) {
    if (activeRequests >= 2) throw failure('Scoreboard is busy; try again later', 429);
    activeRequests++;
    try { return await fn(); } finally { activeRequests--; }
  }
  function forget(id) {
    const entry = details.get(id);
    if (entry) { cachedBytes -= entry.bytes || 0; details.delete(id); }
  }
  async function getForms() {
    // Membership is never authorized from a five-minute cache. Coalesce only
    // an in-flight snapshot, so older refreshes cannot overwrite newer data.
    if (listRefresh) return listRefresh;
    const pending = (async () => {
      const forms = [];
      for (let page = 1; ; page++) {
        const result = await upstream(() => api.forms.list({ page, pageSize: 100, workspaceId }));
        forms.push(...result.items);
        if (forms.length > maxForms) throw failure('Workspace exceeds the supported form limit', 413);
        if (page >= result.page_count || result.items.length < 100) break;
      }
      const ids = new Set(forms.map(form => form.id));
      for (const id of details.keys()) if (!ids.has(id)) forget(id);
      return forms;
    })();
    listRefresh = pending;
    try { return await pending; } finally { if (listRefresh === pending) listRefresh = undefined; }
  }
  async function getDetails(id) {
    const existing = details.get(id);
    if (existing && existing.expires > now()) return existing.promise;
    forget(id);
    const entry = { expires: now() + 5 * 60_000, bytes: 0, promise: null };
    entry.promise = upstream(() => api.forms.get({ uid: id })).then(form => {
      const bytes = Buffer.byteLength(JSON.stringify(form));
      if (bytes > 1024 * 1024) throw failure('Form metadata exceeds the supported size limit', 413);
      if (details.get(id) === entry) {
        while (cachedBytes + bytes > 8 * 1024 * 1024 && details.size > 1) {
          const oldest = [...details.keys()].find(key => key !== id);
          if (!oldest) break;
          forget(oldest);
        }
        entry.bytes = bytes; cachedBytes += bytes; entry.expires = now() + 5 * 60_000;
      }
      return form;
    }).catch(error => { if (details.get(id) === entry) forget(id); throw error; });
    details.set(id, entry);
    return entry.promise;
  }
  function metadata(form) {
    const choice = form.fields.find(field => ['multiple_choice', 'picture_choice'].includes(field.type));
    if (!choice?.id || !choice?.properties?.choices) throw new Error('Form has no team-choice question');
    return { id: form.id, title: form.title, teams: choice.properties.choices.map(team => ({ id: team.id, title: team.label })), variables: form.variables, teamFieldId: choice.id };
  }
  function ratingQuestions(fields) {
    return fields.flatMap(field => field.type === 'group'
      ? ratingQuestions(field.properties.fields)
      : field.type === 'rating' ? [{ id: field.id, title: field.title, max: field.properties?.steps }] : []);
  }
  async function authorizedForm(id) {
    const forms = await getForms();
    if (!forms.some(form => form.id === id)) throw failure('Form not found', 404);
    return getDetails(id);
  }
  async function getAllFormsDetails() {
    return request(async () => {
      const forms = await getForms();
      const result = new Array(forms.length);
      let cursor = 0;
      await Promise.all(Array.from({ length: Math.min(2, forms.length) }, async () => {
        while (cursor < forms.length) { const index = cursor++; result[index] = metadata(await getDetails(forms[index].id)); }
      }));
      return result;
    });
  }
  async function getFormPref(formId) { return request(async () => metadata(await authorizedForm(formId))); }
  async function getFormResponsesById(formId) {
    return request(async () => {
      const form = await authorizedForm(formId);
      const result = { ...metadata(form), ratingQuestions: ratingQuestions(form.fields) };
      const teams = new Map(result.teams.map(team => [team.id, team]));
      const cursors = new Set(); const responseIds = new Set();
      let before; let count = 0; let bytes = 0;
      for (;;) {
        const page = await upstream(() => api.responses.list({ uid: formId, pageSize: 750, ...(before ? { before } : {}) }));
        count += page.items.length; bytes += Buffer.byteLength(JSON.stringify(page.items));
        if (count > maxResponses || bytes > maxResponseBytes) throw failure('Form exceeds the supported response volume; no partial ranking was returned', 413);
        for (const response of page.items) {
          const key = response.token || response.response_id;
          if (key && responseIds.has(key)) continue;
          if (key) responseIds.add(key);
          const teamId = response.answers?.find(answer => answer.type === 'choice' && answer.field?.id === result.teamFieldId)?.choice?.id;
          const team = teams.get(teamId);
          if (!team) continue;
          team.responses ??= [];
          team.responses.push({ judge: response.hidden?.judge, answers: (response.answers || [])
            .filter(answer => answer.field?.type === 'rating')
            .map(answer => ({ id: answer.field.id, rating: answer.number })) });
        }
        if (page.items.length < 750) break;
        const cursor = page.items.at(-1)?.token;
        if (!cursor || cursors.has(cursor)) throw new Error('Unable to paginate Typeform responses');
        cursors.add(cursor); before = cursor;
      }
      return result;
    });
  }
  return { getAllFormsDetails, getFormResponsesById, getFormPref };
}
let productionHandlers;
function getProductionHandlers() {
  if (!productionHandlers) {
    const { token, workspaceId } = validateTypeformConfig(process.env);
    // The SDK forwards these options to Axios, which aborts the actual socket.
    const api = createClient({ token, timeout: 8000, maxContentLength: 4 * 1024 * 1024 });
    productionHandlers = createHandlers(api, workspaceId);
  }
  return productionHandlers;
}
export const getAllFormsDetails = (...args) => getProductionHandlers().getAllFormsDetails(...args);
export const getFormResponsesById = (...args) => getProductionHandlers().getFormResponsesById(...args);
export const getFormPref = (...args) => getProductionHandlers().getFormPref(...args);
