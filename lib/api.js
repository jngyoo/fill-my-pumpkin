// JSON API for server.js, which runs both locally and on Vercel.
const crypto = require('node:crypto');
const { getStore } = require('./store');

// Messages open at midnight Pacific on Halloween. Override for testing: UNLOCK_AT=2020-01-01T00:00:00Z
const UNLOCK_AT = new Date(process.env.UNLOCK_AT || '2026-10-31T00:00:00-07:00').getTime();
const CANDIES = ['candy', 'lollipop', 'chocolate', 'donut', 'cookie', 'cupcake'];

// --- tiny in-memory rate limiter: `limit` hits per `windowMs` per key ---
// Best effort only: on Vercel each warm function instance keeps its own counts.
const hits = new Map();
function rateLimited(key, limit, windowMs) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > limit;
}

function newId() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  let id = '';
  for (const b of crypto.randomBytes(8)) id += alphabet[b % alphabet.length];
  return id;
}

function clean(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readJson(req) {
  // Vercel pre-parses the body into req.body; plain Node leaves the stream for us.
  if (req.body !== undefined) {
    if (typeof req.body === 'string') { try { return Promise.resolve(JSON.parse(req.body)); } catch { return Promise.resolve({}); } }
    return Promise.resolve(req.body || {});
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 10_000) req.destroy();
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); }
    });
  });
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function route(req, res, pathname) {
  const store = getStore();
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress;

  // POST /api/pumpkins — create a pumpkin
  if (req.method === 'POST' && pathname === '/api/pumpkins') {
    if (rateLimited(`create:${ip}`, 10, 60 * 60 * 1000)) return send(res, 429, { error: 'Too many pumpkins! Try again later.' });
    const body = await readJson(req);
    const name = clean(body.name, 30);
    if (!name) return send(res, 400, { error: 'Give your pumpkin a name.' });
    const id = newId();
    const ownerToken = crypto.randomBytes(24).toString('hex');
    await store.createPumpkin({ id, name, ownerToken });
    return send(res, 201, { id, ownerToken });
  }

  const match = pathname.match(/^\/api\/pumpkins\/([a-z0-9]{8})(\/candies)?$/);
  if (!match) return send(res, 404, { error: 'Not found' });
  const pumpkin = await store.getPumpkin(match[1]);
  if (!pumpkin) return send(res, 404, { error: 'This pumpkin rolled away 🎃' });

  // GET /api/pumpkins/:id — public info; owner also gets messages once unlocked
  if (req.method === 'GET' && !match[2]) {
    const isOwner = safeEqual(req.headers['x-owner-token'] || '', pumpkin.owner_token);
    const unlocked = Date.now() >= UNLOCK_AT;
    const { count, kinds } = await store.candySummary(pumpkin.id);
    return send(res, 200, {
      name: pumpkin.name,
      count,
      kinds,
      unlockAt: UNLOCK_AT,
      unlocked,
      isOwner,
      messages: isOwner && unlocked ? await store.listCandies(pumpkin.id) : null,
    });
  }

  // POST /api/pumpkins/:id/candies — drop an anonymous candy
  if (req.method === 'POST' && match[2]) {
    if (rateLimited(`candy:${ip}`, 20, 10 * 60 * 1000)) return send(res, 429, { error: 'Whoa, sugar rush! Slow down a bit.' });
    const body = await readJson(req);
    const text = clean(body.text, 300);
    const sender = clean(body.sender, 30) || 'Anonymous ghost';
    const candy = CANDIES.includes(body.candy) ? body.candy : 'candy';
    if (!text) return send(res, 400, { error: 'Write a little something first.' });
    await store.addCandy({ pumpkinId: pumpkin.id, candy, sender, text });
    const { count } = await store.candySummary(pumpkin.id);
    return send(res, 201, { count });
  }

  return send(res, 405, { error: 'Method not allowed' });
}

async function handleApi(req, res, pathname) {
  try {
    await route(req, res, pathname);
  } catch (err) {
    console.error(err);
    send(res, 500, { error: 'The pumpkin patch is spooked 👻 Try again in a moment.' });
  }
}

module.exports = { handleApi, UNLOCK_AT };
