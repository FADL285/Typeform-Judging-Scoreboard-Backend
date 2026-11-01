import { createClient } from '@typeform/api-client';
import dotenv from 'dotenv';
dotenv.config();

export function createHandlers(api, workspaceId, now = Date.now) {
  let formsCache;
  let cachedAt = 0;
  async function getForms() {
    if (formsCache && now() - cachedAt < 5 * 60_000) return formsCache;
    const forms = [];
    for (let page = 1; ; page++) {
      const result = await api.forms.list({ page, pageSize: 100, workspaceId });
      forms.push(...result.items);
      if (page >= result.page_count || result.items.length < 100) break;
    }
    formsCache = forms;
    cachedAt = now();
    return forms;
  }
  function metadata(form) {
    const choice = form.fields.find(field => ['multiple_choice', 'picture_choice'].includes(field.type));
    if (!choice?.properties?.choices) throw new Error('Form has no team-choice question');
    return {
      id: form.id,
      title: form.title,
      teams: choice.properties.choices.map(team => ({ id: team.id, title: team.label })),
      variables: form.variables,
    };
  }
  function ratingQuestions(fields) {
    return fields.flatMap(field => field.type === 'group'
      ? ratingQuestions(field.properties.fields)
      : field.type === 'rating' ? [{ id: field.id, title: field.title, max: field.properties?.steps }] : []);
  }
  async function getAllFormsDetails() {
    const forms = await getForms();
    return Promise.all(forms.map(async form => metadata(await api.forms.get({ uid: form.id }))));
  }
  async function getFormResponsesById(formId) {
    // Only expose forms from the configured workspace, even with a broad Typeform token.
    const forms = await getForms();
    if (!forms.some(form => form.id === formId)) throw new Error('Form not found');
    const form = await api.forms.get({ uid: formId });
    const result = { ...metadata(form), ratingQuestions: ratingQuestions(form.fields) };
    const teams = new Map(result.teams.map(team => [team.id, team]));
    const cursors = new Set();
    const responseIds = new Set();
    let before;
    for (;;) {
      const page = await api.responses.list({ uid: formId, pageSize: 750, ...(before ? { before } : {}) });
      for (const response of page.items) {
        const key = response.token || response.response_id;
        if (key && responseIds.has(key)) continue;
        if (key) responseIds.add(key);
        const teamId = response.answers?.find(answer => answer.type === 'choice')?.choice?.id;
        const team = teams.get(teamId);
        if (!team) continue;
        team.responses ??= [];
        team.responses.push({
          judge: response.hidden?.judge,
          answers: (response.answers || [])
            .filter(answer => answer.field?.type === 'rating' && Number.isFinite(answer.number))
            .map(answer => ({ id: answer.field.id, rating: answer.number })),
        });
      }
      if (page.items.length < 750) break;
      const cursor = page.items.at(-1)?.token;
      if (!cursor || cursors.has(cursor)) throw new Error('Unable to paginate Typeform responses');
      cursors.add(cursor);
      before = cursor;
    }
    return result;
  }
  return { getAllFormsDetails, getFormResponsesById };
}

const api = createClient({ token: process.env.TYPEFORM_PERSONAL_TOKEN });
const { getAllFormsDetails, getFormResponsesById } = createHandlers(api, process.env.TYPEFORM_WORKSPACE_ID);
export { getAllFormsDetails, getFormResponsesById };
