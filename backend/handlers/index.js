import { createClient } from '@typeform/api-client';
import dotenv from 'dotenv';
import { setTimeout as sleep } from 'node:timers/promises';
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
  const { timeoutMs = 8000, intervalMs = 500, maxResponses = 10000, maxForms = 1000, maxResponseBytes = 8 * 1024 * 1024, requestTimeoutMs = 30000 } = limits;
  let listRefresh;
  const details = new Map();
  let cachedBytes = 0;
  let activeRequests = 0;
  let activeCalls = 0;
  let nextStart = 0;
  const waiters = [];
  function untilAbort(operation, signal) {
    if (signal.aborted) return Promise.reject(signal.reason);
    let aborted;
    const cancelled = new Promise((_, reject) => {
      aborted = () => reject(signal.reason);
      signal.addEventListener('abort', aborted, { once: true });
    });
    return Promise.race([operation, cancelled]).finally(() => signal.removeEventListener('abort', aborted));
  }
  async function upstream(fn, context) {
    const signal = context.signal;
    signal.throwIfAborted();
    if (activeCalls >= 2) {
      if (waiters.length >= 20) throw failure('Typeform is busy; try again later', 503);
      let wake;
      const ready = new Promise(resolve => { wake = resolve; waiters.push(resolve); });
      try { await untilAbort(ready, signal); }
      catch (error) {
        const index = waiters.indexOf(wake);
        if (index >= 0) waiters.splice(index, 1);
        else releaseCall(); // The slot was handed over just as the request expired.
        throw error;
      }
    } else { activeCalls++; }
    const call = new AbortController();
    const abort = () => call.abort(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    let timer;
    try {
      signal.throwIfAborted();
      const delay = Math.max(0, nextStart - Date.now());
      nextStart = Date.now() + delay + intervalMs;
      if (delay) await sleep(delay, undefined, { signal });
      signal.throwIfAborted();
      const timeout = Math.min(timeoutMs, context.deadline - Date.now());
      if (timeout <= 0) throw failure('Scoreboard request timed out; no partial result was returned', 504);
      timer = setTimeout(() => call.abort(failure('Typeform request timed out', 504)), timeout);
      return await untilAbort(Promise.resolve().then(() => fn({ signal: call.signal, timeout })), call.signal);
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      throw error;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      call.abort();
      releaseCall();
    }
  }
  function releaseCall() {
    const next = waiters.shift();
    if (next) next(); else activeCalls--;
  }
  async function request(fn) {
    if (activeRequests >= 2) throw failure('Scoreboard is busy; try again later', 429);
    activeRequests++;
    const controller = new AbortController();
    const timeoutError = failure('Scoreboard request timed out; no partial result was returned', 504);
    const context = { signal: controller.signal, deadline: Date.now() + requestTimeoutMs };
    const timer = setTimeout(() => controller.abort(timeoutError), requestTimeoutMs);
    try { return await untilAbort(Promise.resolve().then(() => fn(context)), controller.signal); }
    finally {
      clearTimeout(timer);
      controller.abort(timeoutError);
      activeRequests--;
    }
  }
  function forget(id) {
    const entry = details.get(id);
    if (entry) { cachedBytes -= entry.bytes || 0; details.delete(id); }
  }
  async function getForms(context) {
    // Membership is never authorized from a five-minute cache. Coalesce only
    // an in-flight snapshot, so older refreshes cannot overwrite newer data.
    if (listRefresh) return listRefresh;
    const pending = (async () => {
      const forms = [];
      for (let page = 1; ; page++) {
        const result = await upstream(options => api.forms.list({ page, pageSize: 100, workspaceId }, options), context);
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
  async function getDetails(id, context) {
    const existing = details.get(id);
    if (existing && existing.expires > now()) return existing.promise;
    forget(id);
    const entry = { expires: now() + 5 * 60_000, bytes: 0, promise: null };
    entry.promise = upstream(options => api.forms.get({ uid: id }, options), context).then(form => {
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
  async function authorizedForm(id, context) {
    const forms = await getForms(context);
    if (!forms.some(form => form.id === id)) throw failure('Form not found', 404);
    return getDetails(id, context);
  }
  async function getAllFormsDetails() {
    return request(async context => {
      const forms = await getForms(context);
      const result = new Array(forms.length);
      let cursor = 0;
      await Promise.all(Array.from({ length: Math.min(2, forms.length) }, async () => {
        while (cursor < forms.length) { const index = cursor++; result[index] = metadata(await getDetails(forms[index].id, context)); }
      }));
      return result;
    });
  }
  async function getFormPref(formId) { return request(async context => metadata(await authorizedForm(formId, context))); }
  async function getFormResponsesById(formId) {
    return request(async context => {
      const form = await authorizedForm(formId, context);
      const result = { ...metadata(form), ratingQuestions: ratingQuestions(form.fields) };
      const teams = new Map(result.teams.map(team => [team.id, team]));
      const cursors = new Set(); const responseIds = new Set();
      let before; let count = 0; let bytes = 0;
      for (;;) {
        const page = await upstream(options => api.responses.list({ uid: formId, pageSize: 750, ...(before ? { before } : {}) }, options), context);
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
    // A per-call SDK client passes cancellation and the remaining budget to Axios.
    const client = options => createClient({ token, ...options, maxContentLength: 4 * 1024 * 1024 });
    const api = {
      forms: {
        list: (params, options) => client(options).forms.list(params),
        get: (params, options) => client(options).forms.get(params),
      },
      responses: { list: (params, options) => client(options).responses.list(params) },
    };
    productionHandlers = createHandlers(api, workspaceId);
  }
  return productionHandlers;
}
export const getAllFormsDetails = (...args) => getProductionHandlers().getAllFormsDetails(...args);
export const getFormResponsesById = (...args) => getProductionHandlers().getFormResponsesById(...args);
export const getFormPref = (...args) => getProductionHandlers().getFormPref(...args);
