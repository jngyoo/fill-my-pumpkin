// Storage: Supabase in production (when SUPABASE_URL is set), local SQLite otherwise.
const path = require('node:path');

// Only this many candy kinds are sent for drawing the pile; the count is always exact.
const MAX_PILE = 31;

function supabaseStore(url, key) {
  const base = `${url.replace(/\/$/, '')}/rest/v1`;
  // New-style secret keys (sb_secret_…) go in `apikey` only; legacy service_role JWTs also need Authorization.
  const auth = key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };

  async function call(pathAndQuery, { method = 'GET', body, prefer } = {}) {
    const res = await fetch(`${base}/${pathAndQuery}`, {
      method,
      headers: { ...auth, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Supabase ${method} ${pathAndQuery.split('?')[0]} failed: ${res.status} ${await res.text()}`);
    return res;
  }

  const eq = (v) => `eq.${encodeURIComponent(v)}`;

  return {
    async createPumpkin({ id, name, ownerToken }) {
      await call('pumpkins', { method: 'POST', body: { id, name, owner_token: ownerToken, created_at: Date.now() }, prefer: 'return=minimal' });
    },
    async getPumpkin(id) {
      const rows = await (await call(`pumpkins?id=${eq(id)}&select=id,name,owner_token`)).json();
      return rows[0] || null;
    },
    async candySummary(id) {
      const res = await call(`candies?pumpkin_id=${eq(id)}&select=candy&order=id.asc&limit=${MAX_PILE}`, { prefer: 'count=exact' });
      const kinds = (await res.json()).map((r) => r.candy);
      const total = Number((res.headers.get('content-range') || '').split('/')[1]);
      return { count: Number.isFinite(total) ? total : kinds.length, kinds };
    },
    async listCandies(id) {
      return (await call(`candies?pumpkin_id=${eq(id)}&select=candy,sender,text,created_at&order=id.asc`)).json();
    },
    async addCandy({ pumpkinId, candy, sender, text }) {
      await call('candies', { method: 'POST', body: { pumpkin_id: pumpkinId, candy, sender, text, created_at: Date.now() }, prefer: 'return=minimal' });
    },
  };
}

function sqliteStore(dbPath) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(dbPath);
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
    getPumpkin: db.prepare('SELECT id, name, owner_token FROM pumpkins WHERE id = ?'),
    countCandies: db.prepare('SELECT COUNT(*) AS n FROM candies WHERE pumpkin_id = ?'),
    candyKinds: db.prepare(`SELECT candy FROM candies WHERE pumpkin_id = ? ORDER BY id LIMIT ${MAX_PILE}`),
    listCandies: db.prepare('SELECT candy, sender, text, created_at FROM candies WHERE pumpkin_id = ? ORDER BY id'),
    insertCandy: db.prepare('INSERT INTO candies (pumpkin_id, candy, sender, text, created_at) VALUES (?, ?, ?, ?, ?)'),
  };
  return {
    async createPumpkin({ id, name, ownerToken }) { q.insertPumpkin.run(id, name, ownerToken, Date.now()); },
    async getPumpkin(id) { return q.getPumpkin.get(id) || null; },
    async candySummary(id) {
      return { count: q.countCandies.get(id).n, kinds: q.candyKinds.all(id).map((r) => r.candy) };
    },
    async listCandies(id) { return q.listCandies.all(id); },
    async addCandy({ pumpkinId, candy, sender, text }) { q.insertCandy.run(pumpkinId, candy, sender, text, Date.now()); },
  };
}

let store;
function getStore() {
  if (!store) {
    const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
    store = SUPABASE_URL && SUPABASE_SECRET_KEY
      ? supabaseStore(SUPABASE_URL, SUPABASE_SECRET_KEY)
      : sqliteStore(process.env.DB_PATH || path.join(__dirname, '..', 'pumpkins.db'));
  }
  return store;
}

module.exports = { getStore };
