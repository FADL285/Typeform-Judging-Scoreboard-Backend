import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
let server, runtime, auth, competitions;
const original = { document: globalThis.document, sessionStorage: globalThis.sessionStorage, fetch: globalThis.fetch };
const reply = data => ({ ok: true, status: 200, json: async () => data });
const session = (token, duration = 60000) => ({ token, expires: Date.now() + duration });
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), server: { middlewareMode: true },
    define: { 'import.meta.env.VITE_BASE_URL': JSON.stringify('http://localhost:3300') } });
  runtime = await server.ssrLoadModule('/test/store-runtime.js');
});
after(async () => { await server?.close(); Object.assign(globalThis, original); });
beforeEach(() => {
  const storage = new Map();
  globalThis.sessionStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  globalThis.document = new EventTarget(); document.visibilityState = 'visible';
  runtime.setActivePinia(runtime.createPinia());
});
afterEach(() => { competitions?.$dispose(); auth?.$dispose(); competitions = auth = undefined; });
test('real router checks while signed out do not cancel an in-flight store login', async () => {
  auth = runtime.useAuthStore(); let finish;
  globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
  const router = runtime.createRouter({ history: runtime.createMemoryHistory(), routes: [
    { path: '/', name: 'home', component: {}, meta: { requiresAuth: true } },
    { path: '/authentication', name: 'authentication', component: {} },
  ] });
  router.beforeEach(runtime.requireSession);
  await router.push('/authentication');
  const pending = auth.login('user', 'password');
  await router.push('/');
  assert.equal(router.currentRoute.value.name, 'authentication');
  finish(reply(session('signed')));
  assert.equal(await pending, true);
  await router.push('/');
  assert.equal(router.currentRoute.value.name, 'home');
});
test('real store refreshes mixed panel lists and ignores navigation/logout races', async () => {
  sessionStorage.setItem('scoreboard-session', JSON.stringify(session('signed')));
  auth = runtime.useAuthStore(); competitions = runtime.useCompetitionStore();
  const items = [
    { id: 'z', title: 'Zulu' }, { id: 'b', title: 'Bravo', variables: { panel: 2 } },
    { id: 'a', title: 'Alpha', variables: { panel: '2' } }, { id: 'c', variables: { panel: {} } },
  ];
  globalThis.fetch = async () => reply({ data: items });
  await competitions.fetchCompetitions();
  assert.deepEqual(competitions.competitions.map(c => c.id), ['c', 'a', 'b', 'z']);
  globalThis.fetch = async () => reply({ data: [{ id: 'new', title: 'New' }] });
  await competitions.fetchCompetitions();
  assert.deepEqual(competitions.competitions.map(c => c.id), ['new']);
  let finish; globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
  const navigation = competitions.fetchCompetitions(() => false);
  finish(reply({ data: items })); await navigation;
  assert.deepEqual(competitions.competitions.map(c => c.id), ['new']);
  const pending = competitions.fetchCompetitions();
  auth.logout(); finish(reply({ data: items }));
  await assert.rejects(pending, /expired/);
  assert.deepEqual(competitions.competitions.map(c => c.id), ['new']);
});
test('session expiry clears auth; old timers cannot clear newer login; disposal cleans listeners', async () => {
  sessionStorage.setItem('scoreboard-session', JSON.stringify(session('old', 25)));
  auth = runtime.useAuthStore();
  globalThis.fetch = async () => reply(session('new'));
  assert.equal(await auth.login('user', 'password'), true);
  await new Promise(resolve => setTimeout(resolve, 45));
  assert.equal(auth.token, 'new');
  globalThis.fetch = async () => reply(session('expires', 20));
  await auth.login('user', 'password');
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(auth.token, '');
  globalThis.fetch = async () => reply(session('disposed', 20));
  await auth.login('user', 'password'); auth.$dispose();
  await new Promise(resolve => setTimeout(resolve, 40));
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(auth.token, 'disposed');
});
test('visibility rechecks wall-clock expiry without navigation or API access', async () => {
  sessionStorage.setItem('scoreboard-session', JSON.stringify(session('signed')));
  auth = runtime.useAuthStore();
  auth.expires = Date.now() - 1;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(auth.token, '');
});
