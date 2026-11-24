const test = require('node:test');
const assert = require('node:assert/strict');
const { getStore } = require('../lib/store');

test('owner messages include every page in ID order, even with a lower server row cap', async (t) => {
  const ids = ['9007199254740992', '9007199254740993', '9007199254740995'];
  const pages = new Map([[null, ids.slice(0, 2)], ['gt.' + ids[1], ids.slice(2)], ['gt.' + ids[2], []]]);
  const message = id => ({ text: 'message ' + id, sender: 'fixture', candy: 'cookie', created_at: 0 });
  const cursors = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    const params = new URL(url).searchParams;
    assert.equal(params.get('pumpkin_id'), 'eq.fixture');
    assert.match(params.get('select'), /cursor:id::text/);
    assert.equal(params.get('order'), 'id.asc');
    const after = params.get('id');
    const page = pages.get(after);
    assert.ok(page, 'unexpected cursor');
    cursors.push(after);
    return Response.json(page.map((id) => ({ cursor: id, ...message(id) })));
  });
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SECRET_KEY;
  try {
    process.env.SUPABASE_URL = 'https://fixture.invalid';
    process.env.SUPABASE_SECRET_KEY = 'fixture';
    assert.deepEqual(await getStore().listCandies('fixture'), ids.map(message));
    assert.deepEqual(cursors, [...pages.keys()]);
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = previousKey;
  }
});
