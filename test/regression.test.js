import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuth } from '../auth.js';
import { createHandlers, validateTypeformConfig } from '../handlers/index.js';

const config = { username: 'admin', password: 'private-test-password', secret: 'test-session-secret-of-at-least-32-characters' };
const response = () => ({ code: 200, data: null, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; }, set() { return this; } });
test('authentication fails closed; tokens cannot be forged or used after expiry', () => {
  assert.throws(() => createAuth({}));
  let now = 1000;
  const auth = createAuth({ ...config, now: () => now });
  const denied = response(); auth.login({ ip: 'test', body: { username: 'admin', password: 'wrong' } }, denied);
  assert.equal(denied.code, 401);
  const accepted = response(); auth.login({ ip: 'test', body: { username: config.username, password: config.password } }, accepted);
  assert.equal(auth.verify(accepted.data.token), true);
  assert.equal(auth.verify(accepted.data.token + 'tamper'), false);
  let passed = false;
  const deniedApi = response(); auth.requireAuth({ get: () => undefined }, deniedApi, () => { passed = true; });
  assert.equal(deniedApi.code, 401); assert.equal(passed, false);
  auth.requireAuth({ get: () => 'Bearer ' + accepted.data.token }, response(), () => { passed = true; });
  assert.equal(passed, true);
  now += 8 * 60 * 60_000; assert.equal(auth.verify(accepted.data.token), false);
});
test('login attempts are bounded', () => {
  const auth = createAuth(config);
  for (let i = 0; i < 10; i++) auth.login({ ip: 'same', body: {} }, response());
  const blocked = response(); auth.login({ ip: 'same', body: config }, blocked);
  assert.equal(blocked.code, 429);
});
const form = id => ({ id, title: id, fields: [
  { type: 'multiple_choice', properties: { choices: [{ id: id + '-team', label: 'Team' }] } },
  { type: 'rating', id: 'score', title: 'Impact', properties: { steps: 10 } },
] });
test('response pagination and concurrent requests retain their own data', async () => {
  const calls = [];
  const api = {
    forms: { list: async () => ({ items: [{ id: 'a' }, { id: 'b' }] }), get: async ({ uid }) => form(uid) },
    responses: { list: async ({ uid, before }) => {
      calls.push({ uid, before }); await new Promise(resolve => setImmediate(resolve));
      const count = before ? 1 : 750;
      return { items: Array.from({ length: count }, (_, i) => ({ token: `${uid}-${before ? 750 : i}`, answers: [
        { type: 'choice', choice: { id: uid + '-team' } }, { field: { type: 'rating', id: 'score' }, number: 8 },
      ] })) };
    } },
  };
  const handlers = createHandlers(api, 'workspace');
  const [a, b] = await Promise.all([handlers.getFormResponsesById('a'), handlers.getFormResponsesById('b')]);
  assert.equal(a.id, 'a'); assert.equal(b.id, 'b');
  assert.equal(a.teams[0].responses.length, 751); assert.equal(b.teams[0].responses.length, 751);
  assert.equal(a.ratingQuestions[0].id, 'score'); assert.equal(calls.filter(c => c.before).length, 2);
  await assert.rejects(() => handlers.getFormResponsesById('outside-workspace'));
});
test('form metadata list fetches all pages', async () => {
  const calls = [];
  const api = { forms: {
    list: async ({ page }) => { calls.push(page); return { page_count: 2, items: Array.from({ length: page === 1 ? 100 : 1 }, (_, i) => ({ id: `${page}-${i}` })) }; },
    get: async ({ uid }) => form(uid),
  } };
  const result = await createHandlers(api, 'workspace').getAllFormsDetails();
  assert.equal(result.length, 101); assert.deepEqual(calls, [1, 2]);
});

test('Typeform token and workspace scope are mandatory before client access', () => {
  assert.throws(() => validateTypeformConfig({}));
  assert.throws(() => validateTypeformConfig({ TYPEFORM_PERSONAL_TOKEN: 'token' }));
  assert.throws(() => validateTypeformConfig({ TYPEFORM_PERSONAL_TOKEN: 'token', TYPEFORM_WORKSPACE_ID: '  ' }));
  assert.throws(() => createHandlers({}, undefined));
  assert.deepEqual(validateTypeformConfig({ TYPEFORM_PERSONAL_TOKEN: ' token ', TYPEFORM_WORKSPACE_ID: ' workspace ' }), { token: 'token', workspaceId: 'workspace' });
});
