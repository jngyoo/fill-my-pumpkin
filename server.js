// Fill My Pumpkin — zero-dependency server (Node 22.5+ for node:sqlite)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT) || 3000;
// Messages open at midnight Pacific on Halloween. Override for testing: UNLOCK_AT=2020-01-01T00:00:00Z
const UNLOCK_AT = new Date(process.env.UNLOCK_AT || '2026-10-31T00:00:00-07:00').getTime();
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'pumpkins.db');
const PUBLIC_DIR = path.join(__dirname, 'public');

const CANDIES = ['candy', 'lollipop', 'chocolate', 'donut', 'cookie', 'cupcake'];

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS pumpkins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_token TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS candies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pumpkin_id TEXT NOT NULL REFERENCES pumpkins(id),
    candy TEXT NOT NULL,
    sender TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS candies_pumpkin ON candies(pumpkin_id);
`);

const q = {
  insertPumpkin: db.prepare('INSERT INTO pumpkins (id, name, owner_token, created_at) VALUES (?, ?, ?, ?)'),
  getPumpkin: db.prepare('SELECT * FROM pumpkins WHERE id = ?'),
  countCandies: db.prepare('SELECT COUNT(*) AS n FROM candies WHERE pumpkin_id = ?'),
  candyKinds: db.prepare('SELECT candy FROM candies WHERE pumpkin_id = ? ORDER BY id'),
  listCandies: db.prepare('SELECT candy, sender, text, created_at FROM candies WHERE pumpkin_id = ? ORDER BY id'),
  insertCandy: db.prepare('INSERT INTO candies (pumpkin_id, candy, sender, text, created_at) VALUES (?, ?, ?, ?, ?)'),
};

// --- tiny in-memory rate limiter: `limit` hits per `windowMs` per key ---
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
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readJson(req) {
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

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };

function serveFile(res, file) {
  fs.readFile(path.join(PUBLIC_DIR, file), (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

async function handleApi(req, res, url) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

  // POST /api/pumpkins — create a pumpkin
  if (req.method === 'POST' && url.pathname === '/api/pumpkins') {
    if (rateLimited(`create:${ip}`, 10, 60 * 60 * 1000)) return send(res, 429, { error: 'Too many pumpkins! Try again later.' });
    const body = await readJson(req);
    const name = clean(body.name, 30);
    if (!name) return send(res, 400, { error: 'Give your pumpkin a name.' });
    const id = newId();
    const ownerToken = crypto.randomBytes(24).toString('hex');
    q.insertPumpkin.run(id, name, ownerToken, Date.now());
    return send(res, 201, { id, ownerToken });
  }

  const match = url.pathname.match(/^\/api\/pumpkins\/([a-z0-9]{8})(\/candies)?$/);
  if (!match) return send(res, 404, { error: 'Not found' });
  const pumpkin = q.getPumpkin.get(match[1]);
  if (!pumpkin) return send(res, 404, { error: 'This pumpkin rolled away 🎃' });

  // GET /api/pumpkins/:id — public info; owner also gets messages once unlocked
  if (req.method === 'GET' && !match[2]) {
    const isOwner = safeEqual(req.headers['x-owner-token'] || '', pumpkin.owner_token);
    const unlocked = Date.now() >= UNLOCK_AT;
    return send(res, 200, {
      name: pumpkin.name,
      count: q.countCandies.get(pumpkin.id).n,
      kinds: q.candyKinds.all(pumpkin.id).map((r) => r.candy),
      unlockAt: UNLOCK_AT,
      unlocked,
      isOwner,
      messages: isOwner && unlocked ? q.listCandies.all(pumpkin.id) : null,
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
    q.insertCandy.run(pumpkin.id, candy, sender, text, Date.now());
    return send(res, 201, { count: q.countCandies.get(pumpkin.id).n });
  }

  return send(res, 405, { error: 'Method not allowed' });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  if (url.pathname === '/') return serveFile(res, 'index.html');
  if (/^\/p\/[a-z0-9]{8}$/.test(url.pathname)) return serveFile(res, 'pumpkin.html');
  if (/^\/[\w.-]+$/.test(url.pathname)) return serveFile(res, url.pathname.slice(1));
  res.writeHead(404);
  res.end('Not found');
}).listen(PORT, () => {
  console.log(`🎃 Fill My Pumpkin running at http://localhost:${PORT}`);
  console.log(`   Messages unlock at ${new Date(UNLOCK_AT).toISOString()}`);
});
