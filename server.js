// App server: static files + the API. Vercel runs this same file as the production entrypoint.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { handleApi, UNLOCK_AT } = require('./lib/api');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };

function serveFile(res, file) {
  fs.readFile(path.join(PUBLIC_DIR, file), (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url.pathname);
  if (url.pathname === '/') return serveFile(res, 'index.html');
  if (/^\/p\/[a-z0-9]{8}$/.test(url.pathname)) return serveFile(res, 'pumpkin.html');
  if (/^\/[\w.-]+$/.test(url.pathname)) return serveFile(res, url.pathname.slice(1));
  res.writeHead(404);
  res.end('Not found');
}).listen(PORT, () => {
  console.log(`🎃 Fill My Pumpkin running at http://localhost:${PORT}`);
  console.log(`   Storage: ${process.env.SUPABASE_URL ? 'Supabase' : 'local SQLite'}`);
  console.log(`   Messages unlock at ${new Date(UNLOCK_AT).toISOString()}`);
});
