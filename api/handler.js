// Vercel serverless entry. vercel.json rewrites /api/<anything> here as /api/handler?p=<anything>.
const { handleApi } = require('../lib/api');

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname === '/api/handler' ? `/api/${url.searchParams.get('p') || ''}` : url.pathname;
  await handleApi(req, res, pathname);
};
