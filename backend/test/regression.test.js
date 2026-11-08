import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trustedProxies } from '../proxy-config.js';
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
  { id: 'team-question', type: 'multiple_choice', properties: { choices: [{ id: id + '-team', label: 'Team' }] } },
  { type: 'rating', id: 'score', title: 'Impact', properties: { steps: 10 } },
] });
test('response pagination and concurrent requests retain their own data', async () => {
  const calls = [];
  const api = {
    forms: { list: async () => ({ items: [{ id: 'a' }, { id: 'b' }] }), get: async ({ uid }) => form(uid) },
    responses: { list: async ({ uid, before }) => {
      calls.push({ uid, before }); await new Promise(resolve => setImmediate(resolve));
      if (before) assert.equal(before, `${uid}-749`);
      const count = before ? 1 : 750;
      return { items: Array.from({ length: count }, (_, i) => ({ token: `${uid}-${before ? 750 : i}`, answers: [
        { type: 'choice', field: { id: 'unrelated-consent' }, choice: { id: 'yes' } },
        { type: 'choice', field: { id: 'team-question' }, choice: { id: uid + '-team' } }, { field: { type: 'rating', id: 'score' }, number: 8 },
      ] })) };
    } },
  };
  const handlers = createHandlers(api, 'workspace', Date.now, { intervalMs: 0 });
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
  const result = await createHandlers(api, 'workspace', Date.now, { intervalMs: 0 }).getAllFormsDetails();
  assert.equal(result.length, 101); assert.deepEqual(calls, [1, 2]);
});

test('Typeform token and workspace scope are mandatory before client access', () => {
  assert.throws(() => validateTypeformConfig({}));
  assert.throws(() => validateTypeformConfig({ TYPEFORM_PERSONAL_TOKEN: 'token' }));
  assert.throws(() => validateTypeformConfig({ TYPEFORM_PERSONAL_TOKEN: 'token', TYPEFORM_WORKSPACE_ID: '  ' }));
  assert.throws(() => createHandlers({}, undefined));
  assert.deepEqual(validateTypeformConfig({ TYPEFORM_PERSONAL_TOKEN: ' token ', TYPEFORM_WORKSPACE_ID: ' workspace ' }), { token: 'token', workspaceId: 'workspace' });
});

test('proxy trust is disabled by default and accepts only explicit IP/CIDR configuration', () => {
  assert.equal(trustedProxies(undefined), false);
  assert.deepEqual(trustedProxies('127.0.0.1/32,::1/128'), ['127.0.0.1/32', '::1/128']);
  for (const value of ['true', '*', '1', '127.0.0.1/999', '0.0.0.0/0', '::/0']) assert.throws(() => trustedProxies(value));
});

test('membership is fresh while cached form details are reused and removed forms are denied', async () => {
  let member = true; let listCalls = 0; let detailsCalls = 0;
  const api = { forms: { list: async () => { listCalls++; return { items: member ? [{ id: 'a' }] : [] }; }, get: async () => { detailsCalls++; return form('a'); } }, responses: { list: async () => ({ items: [] }) } };
  const handlers = createHandlers(api, 'workspace', Date.now, { intervalMs: 0 });
  await handlers.getFormResponsesById('a'); await handlers.getFormResponsesById('a');
  assert.equal(listCalls, 2); assert.equal(detailsCalls, 1);
  member = false;
  await assert.rejects(handlers.getFormResponsesById('a'), error => error.statusCode === 404);
  assert.equal(detailsCalls, 1);
});
test('cold concurrent requests share membership and metadata refreshes', async () => {
  let release; let listCalls = 0; let detailsCalls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const api = { forms: { list: async () => { listCalls++; await gate; return { items: [{ id: 'a' }] }; }, get: async () => { detailsCalls++; return form('a'); } } };
  const handlers = createHandlers(api, 'workspace', Date.now, { intervalMs: 0 });
  const a = handlers.getAllFormsDetails(); const b = handlers.getAllFormsDetails();
  await assert.rejects(handlers.getAllFormsDetails(), error => error.statusCode === 429);
  release(); await Promise.all([a, b]);
  assert.equal(listCalls, 1); assert.equal(detailsCalls, 1);
});
test('stalled upstream calls have deadlines and do not keep aggregation slots occupied', async () => {
  let stall = true;
  const api = { forms: { list: () => stall ? new Promise(() => {}) : Promise.resolve({ items: [] }) } };
  const handlers = createHandlers(api, 'workspace', Date.now, { intervalMs: 0, timeoutMs: 10 });
  await assert.rejects(handlers.getAllFormsDetails(), error => error.statusCode === 504);
  stall = false; assert.deepEqual(await handlers.getAllFormsDetails(), []);
});
test('response volume and payload bounds fail explicitly without partial rankings', async () => {
  const api = { forms: { list: async () => ({ items: [{ id: 'a' }] }), get: async () => form('a') }, responses: { list: async () => ({ items: [{ token: 'a' }, { token: 'b' }] }) } };
  await assert.rejects(createHandlers(api, 'workspace', Date.now, { intervalMs: 0, maxResponses: 1 }).getFormResponsesById('a'), error => error.statusCode === 413);
  await assert.rejects(createHandlers(api, 'workspace', Date.now, { intervalMs: 0, maxResponseBytes: 1 }).getFormResponsesById('a'), error => error.statusCode === 413);
});
test('workspace form limit and metadata fanout are bounded', async () => {
  let active = 0; let peak = 0;
  const api = { forms: { list: async () => ({ items: Array.from({ length: 5 }, (_, i) => ({ id: String(i) })) }), get: async ({ uid }) => {
    active++; peak = Math.max(peak, active); await new Promise(resolve => setImmediate(resolve)); active--; return form(uid);
  } } };
  await assert.rejects(createHandlers(api, 'workspace', Date.now, { intervalMs: 0, maxForms: 2 }).getAllFormsDetails(), error => error.statusCode === 413);
  const result = await createHandlers(api, 'workspace', Date.now, { intervalMs: 0 }).getAllFormsDetails();
  assert.equal(result.length, 5); assert.ok(peak <= 2);
});
test('legacy getFormPref remains available with current workspace authorization', async () => {
  const api = { forms: { list: async () => ({ items: [{ id: 'a' }] }), get: async () => form('a') } };
  const handlers = createHandlers(api, 'workspace', Date.now, { intervalMs: 0 });
  assert.equal((await handlers.getFormPref('a')).id, 'a');
  await assert.rejects(handlers.getFormPref('outside'), error => error.statusCode === 404);
});

test('scoped IPv6 proxy addresses are rejected', () => {
  assert.throws(() => trustedProxies('fe80::1%eth0'));
  assert.throws(() => trustedProxies('fe80::1%eth0/64'));
});

test('shipped authentication examples fail closed, including legacy example values', async () => {
  const { readFile } = await import('node:fs/promises');
  const example = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  const { parse } = await import('dotenv');
  const env = parse(example);
  assert.throws(() => createAuth({ username: env.SCOREBOARD_USER, password: env.SCOREBOARD_PASSWORD, secret: env.SCOREBOARD_SESSION_SECRET }));
  assert.throws(() => createAuth({ ...config, password: 'replace-with-a-long-private-password' }));
  assert.throws(() => createAuth({ ...config, secret: 'replace-with-at-least-32-random-characters' }));
  assert.throws(() => createAuth({ ...config, username: '   ' }));
});

test('cold workspace listing respects its total budget and stops dispatch after timeout', async () => {
  let calls = 0;
  const api = { forms: {
    list: async () => ({ items: Array.from({ length: 40 }, (_, i) => ({ id: String(i) })) }),
    get: async ({ uid }) => { calls++; return form(uid); },
  } };
  const fast = createHandlers(api, 'fixture', Date.now, { intervalMs: 1, requestTimeoutMs: 1000 });
  assert.equal((await fast.getAllFormsDetails()).length, 40);
  const bounded = createHandlers(api, 'fixture', Date.now, { intervalMs: 20, requestTimeoutMs: 35 });
  await assert.rejects(bounded.getAllFormsDetails(), error => error.statusCode === 504);
  const stopped = calls;
  await new Promise(resolve => setTimeout(resolve, 65));
  assert.equal(calls, stopped, 'expired workers must not dispatch more detail requests');
});
test('paginated aggregation has one total deadline, cancels calls, and releases slots for retry', async () => {
  let pages = 0, aborted = 0, slow = true;
  const api = {
    forms: { list: async () => ({ items: [{ id: 'a' }] }), get: async () => form('a') },
    responses: { list: async (_params, { signal }) => {
      const page = ++pages;
      if (!slow) return { items: [] };
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 12);
        signal.addEventListener('abort', () => { clearTimeout(timer); aborted++; reject(signal.reason); }, { once: true });
      });
      return { items: Array.from({ length: 750 }, (_, i) => ({ token: `${page}-${i}`, answers: [] })) };
    } },
  };
  const handlers = createHandlers(api, 'fixture', Date.now, { intervalMs: 0, timeoutMs: 100, requestTimeoutMs: 35 });
  await assert.rejects(handlers.getFormResponsesById('a'), error => error.statusCode === 504);
  const stopped = pages; await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(pages, stopped); assert.ok(aborted > 0);
  slow = false;
  assert.equal((await handlers.getFormResponsesById('a')).id, 'a');
});
test('production SDK forwards AbortSignal to a real loopback HTTP connection', async () => {
  const { createServer } = await import('node:http');
  const { createClient } = await import('@typeform/api-client');
  let received;
  const started = new Promise(resolve => { received = resolve; });
  const server = createServer((req) => { received(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const controller = new AbortController();
  try {
    const client = createClient({ token: 'fixture-only', apiBaseUrl: `http://127.0.0.1:${server.address().port}`, signal: controller.signal, timeout: 1000, proxy: false });
    const result = client.forms.list({ workspaceId: 'fixture' });
    await Promise.race([started, result.then(() => { throw new Error('SDK request completed before reaching server'); })]);
    controller.abort();
    await assert.rejects(result);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('patched proxy matching does not trust arbitrary IPv4 through broad mapped IPv6 subnets', async () => {
  const { default: proxyaddr } = await import('proxy-addr');
  assert.equal(proxyaddr.compile(['::ffff:10.0.0.0/8'])('203.0.113.9', 0), false);
  assert.equal(proxyaddr.compile(['::/1'])('203.0.113.9', 0), false);
  assert.equal(proxyaddr.compile(['10.0.0.0/8'])('10.1.2.3', 0), true);
});
