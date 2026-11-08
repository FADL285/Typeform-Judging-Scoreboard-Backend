import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const digest = value => createHash('sha256').update(String(value)).digest();
const equal = (a, b) => timingSafeEqual(digest(a), digest(b));

export function createAuth({ username, password, secret, now = Date.now }) {
  const configured = typeof username === 'string' && username.trim()
    && typeof password === 'string' && password.trim().length >= 12
    && typeof secret === 'string' && secret.trim().length >= 32;
  if (!configured || password === 'replace-with-a-long-private-password' || secret === 'replace-with-at-least-32-random-characters') {
    throw new Error('Set SCOREBOARD_USER, SCOREBOARD_PASSWORD (12+ characters), and SCOREBOARD_SESSION_SECRET (32+ characters)');
  }
  const attempts = new Map();
  const signature = payload => createHmac('sha256', secret).update(payload).digest('base64url');
  function verify(token) {
    if (typeof token !== 'string' || token.length > 2048) return false;
    const [payload, sig, extra] = token.split('.');
    if (!payload || !sig || extra || !equal(signature(payload), sig)) return false;
    try {
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
      return data.user === username && Number.isFinite(data.expires) && data.expires > now();
    } catch { return false; }
  }
  function login(req, res) {
    const key = req.ip;
    const time = now();
    for (const [ip, entry] of attempts) if (entry.until <= time) attempts.delete(ip);
    const attempt = attempts.get(key) || { count: 0, until: time + 15 * 60_000 };
    if (attempt.count >= 10 || (!attempts.has(key) && attempts.size >= 10000)) {
      return res.status(429).json({ message: 'Too many login attempts; try again later' });
    }
    attempt.count += 1; attempts.set(key, attempt);
    if (!equal(req.body?.username ?? '', username) || !equal(req.body?.password ?? '', password)) {
      return res.status(401).json({ message: 'Username or password incorrect' });
    }
    attempts.delete(key);
    const expires = time + 8 * 60 * 60_000;
    const payload = Buffer.from(JSON.stringify({ user: username, expires, nonce: randomBytes(16).toString('hex') })).toString('base64url');
    res.set('Cache-Control', 'no-store');
    return res.json({ token: `${payload}.${signature(payload)}`, expires });
  }
  function requireAuth(req, res, next) {
    const token = req.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
    if (!verify(token)) return res.status(401).json({ message: 'Authentication required' });
    res.set('Cache-Control', 'no-store');
    next();
  }
  return { login, requireAuth, verify };
}
