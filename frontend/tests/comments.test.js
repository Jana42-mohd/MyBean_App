const test = require('node:test');
const assert = require('node:assert');
const { build, install } = require('./_mocks');

const calls = [];
let result = { data: null, error: null };
install({
  './supabase': { supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    rpc: async (name, args) => { calls.push(['rpc', name, args]); return result; },
    from: table => ({
      insert: async row => { calls.push(['insert', table, row]); return result; },
      delete: () => ({ eq: () => ({ eq: async () => { calls.push(['delete', table]); return result; } }) }),
    }),
  } },
});
const c = build('comments.js');

const row = (id, parent, at, likes = 0, extra = {}) => ({ id, parent_id: parent, user_id: 'u', author: 'A', avatar_url: null, body: id, created_at: at, likes, liked: false, mine: false, hidden: false, deleted: false, ...extra });
const rows = [
  row('a', null, '2026-01-01T10:00:00Z', 1),
  row('b', null, '2026-01-01T11:00:00Z', 5),
  row('a1', 'a', '2026-01-01T12:00:00Z', 9),
  row('a2', 'a', '2026-01-01T10:30:00Z', 0),
  row('a1x', 'a1', '2026-01-01T13:00:00Z'),
  row('orphan', 'gone', '2026-01-01T09:00:00Z'),
];
const ids = nodes => nodes.map(n => n.row.id);

test('threads: replies sit under their parent, a reply with a missing parent becomes top-level', () => {
  const t = c.buildThread(rows, 'old');
  assert.deepStrictEqual(ids(t), ['orphan', 'a', 'b']);
  assert.deepStrictEqual(ids(t[1].children), ['a2', 'a1'], 'replies are oldest first');
  assert.deepStrictEqual(ids(t[1].children[1].children), ['a1x']);
});

test('sorting applies to top-level comments: top = most liked first, new = newest first', () => {
  assert.deepStrictEqual(ids(c.buildThread(rows, 'top')), ['b', 'a', 'orphan']);
  assert.deepStrictEqual(ids(c.buildThread(rows, 'new')), ['b', 'a', 'orphan']);
  assert.deepStrictEqual(ids(c.buildThread(rows, 'top')[1].children), ['a2', 'a1'], 'replies stay oldest first even when sorted by top');
});

test('flattening: indent grows with depth up to a limit, collapsing hides everything below', () => {
  const t = c.buildThread(rows, 'old');
  const flat = c.flattenThread(t, new Set());
  assert.deepStrictEqual(flat.map(f => [f.row.id, f.indent, f.replies]), [['orphan', 0, 0], ['a', 0, 3], ['a2', 1, 0], ['a1', 1, 1], ['a1x', 2, 0], ['b', 0, 0]]);
  const folded = c.flattenThread(t, new Set(['a']));
  assert.deepStrictEqual(folded.map(f => f.row.id), ['orphan', 'a', 'b']);
  assert.strictEqual(folded[1].collapsed, true);
  // a very deep chain stops indenting
  const chain = Array.from({ length: 8 }, (_, i) => row('c' + i, i ? 'c' + (i - 1) : null, `2026-01-02T0${i}:00:00Z`));
  const deep = c.flattenThread(c.buildThread(chain, 'old'), new Set());
  assert.strictEqual(Math.max(...deep.map(f => f.indent)), c.MAX_INDENT);
});

test('adding a comment checks the text first and sends it trimmed', async () => {
  calls.length = 0;
  result = { data: null, error: null };
  await assert.rejects(() => c.addComment('p1', null, '   '), /Write something/);
  await assert.rejects(() => c.addComment('p1', null, 'x'.repeat(2001)), /2000/);
  assert.strictEqual(calls.length, 0);
  await c.addComment('p1', 'parent', '  hello ');
  assert.deepStrictEqual(calls[0], ['insert', 'post_comments', { post_id: 'p1', parent_id: 'parent', body: 'hello' }]);
});

test('likes and reports tolerate "already done", real errors surface', async () => {
  result = { data: null, error: Object.assign(new Error('duplicate'), { code: '23505' }) };
  await c.setCommentLike('c1', true);
  await c.reportComment('c1', 'spam');
  result = { data: null, error: Object.assign(new Error('permission denied'), { code: '42501' }) };
  await assert.rejects(() => c.setCommentLike('c1', true), /permission denied/);
  await assert.rejects(() => c.reportComment('c1', 'spam'), /permission denied/);
  await assert.rejects(() => c.deleteComment('c1'), /permission denied/);
});
