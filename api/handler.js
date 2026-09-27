// Vercel serverless entry. vercel.json rewrites /api/<anything> here as /api/handler?p=<anything>.
const { handleApi } = require('../lib/api');

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.searchParams.get('p') ?? req.query?.p;
  const rest = Array.isArray(p) ? p.join('/') : p;
  const pathname = rest ? `/api/${rest.replace(/^\/+/, '')}` : url.pathname;
  await handleApi(req, res, pathname);
};
