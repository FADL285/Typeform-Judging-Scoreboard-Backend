// Loopback-only browser fixture. Never deploy this server; it uses no Typeform credentials.
import express from 'express';
import { randomBytes } from 'node:crypto';
import { createAuth } from '../auth.js';
import { createHandlers } from '../handlers/index.js';
const app = express();
app.use(express.json()); app.use((req, res, next) => { res.set('Access-Control-Allow-Origin', 'http://127.0.0.1:5173'); res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization'); if (req.method === 'OPTIONS') return res.sendStatus(204); next(); });
const auth = createAuth({ username: 'fixture', password: 'local-fixture-password', secret: randomBytes(32).toString('hex') });
let removed = false;
const forms = {
  a: { id: 'a', title: 'Alpha', variables: { panel: '2' } },
  b: { id: 'b', title: 'Bravo' },
};
const api = {
  forms: {
    list: async () => ({ items: Object.values(forms).filter(form => !removed || form.id !== 'a') }),
    get: async ({ uid }) => ({ ...forms[uid], fields: [
      { id: 'team', type: 'multiple_choice', properties: { choices: [{ id: 'one', label: 'Fixture Team' }] } },
      { id: 'rating', type: 'rating', title: 'Impact', properties: { steps: 10 } },
    ] }),
  },
  responses: { list: async () => ({ items: [{ token: 'fixture-response', hidden: { judge: 'Fixture judge' }, answers: [
    { type: 'choice', field: { id: 'team' }, choice: { id: 'one' } },
    { field: { type: 'rating', id: 'rating' }, number: 8 },
  ] }] }) },
};
const handlers = createHandlers(api, 'fixture-workspace', Date.now, { intervalMs: 0 });
app.post('/__fixture/remove-a', (req, res) => { removed = true; res.sendStatus(204); });
app.post('/api/auth', auth.login);
app.use('/api', auth.requireAuth);
app.get('/api', async (req, res, next) => { try { res.json({ data: await handlers.getAllFormsDetails() }); } catch (error) { next(error); } });
app.get('/api/:id', async (req, res, next) => { try { res.json({ data: await handlers.getFormResponsesById(req.params.id) }); } catch (error) { next(error); } });
app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
app.listen(3300, '127.0.0.1', () => console.log('Loopback fixture ready on 3300; no Typeform traffic'));
