const test = require('node:test');
const assert = require('node:assert');
const { build, install } = require('./_mocks');

const log = [];
let failUploadAt = -1, failPost = false, failAttach = false, uploads = 0;
const supabase = {
  auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
  storage: { from: bucket => ({
    upload: async (path, body, opts) => { log.push(['upload', bucket, path, opts.contentType]); return uploads++ === failUploadAt ? { error: new Error('upload failed') } : { error: null }; },
    remove: async paths => { log.push(['remove', bucket, paths]); return { error: null }; },
    createSignedUrls: async paths => ({ data: paths.map(p => ({ path: p, signedUrl: `https://signed/${p}` })), error: null }),
  }) },
  from: table => ({
    insert: row => {
      log.push(['insert', table, row]);
      const bad = (table === 'posts' && failPost) || (table === 'post_media' && failAttach);
      const result = { data: table === 'posts' ? { id: 'p1' } : null, error: bad ? new Error(`${table} refused`) : null };
      return { select: () => ({ single: async () => result }), then: (res, rej) => Promise.resolve(result).then(res, rej) };
    },
    delete: () => ({ eq: (c, v) => { log.push(['delete', table, v]); return Promise.resolve({ error: null }); } }),
    select: () => ({ in: () => ({ order: async () => ({ data: [
      { post_id: 'p1', path: 'u1/b.jpg', kind: 'image', position: 1 }, { post_id: 'p1', path: 'u1/a.mp4', kind: 'video', position: 0 }, { post_id: 'p2', path: 'u2/c.jpg', kind: 'image', position: 0 },
    ], error: null }) }) }),
  }),
};
let n = 0;
global.fetch = async () => ({ arrayBuffer: async () => new ArrayBuffer(4) });
install({ './supabase': { supabase }, 'expo-crypto': { randomUUID: () => `id-${++n}` }, 'react-native': { Platform: { OS: 'web' } } });
const store = build('postMediaStore.js');
const img = (i) => ({ uri: `file://${i}.jpg`, kind: 'image', ext: 'jpg', mime: 'image/jpeg' });
const vid = { uri: 'file://v.mp4', kind: 'video', ext: 'mp4', mime: 'video/mp4', duration: 12 };
const post = { title: 't', excerpt: 'e', tags: ['sleep'] };
const reset = () => { log.length = 0; failUploadAt = -1; failPost = false; failAttach = false; uploads = 0; };

test('a post without files is just inserted', async () => {
  reset();
  await store.createPostWithMedia(post, []);
  assert.deepStrictEqual(log.map(l => l[0] + ':' + l[1]), ['insert:posts']);
});

test('files go up first, then the post, then the attachments, in order, inside the person\'s folder', async () => {
  reset();
  const progress = [];
  await store.createPostWithMedia(post, [img(1), vid, img(2)], (d, t) => progress.push([d, t]));
  assert.deepStrictEqual(log.map(l => l[0] + ':' + l[1]), ['upload:post-media', 'upload:post-media', 'upload:post-media', 'insert:posts', 'insert:post_media']);
  assert(log.filter(l => l[0] === 'upload').every(l => l[2].startsWith('u1/')));
  assert.deepStrictEqual(log[1].slice(3), ['video/mp4']);
  const rows = log[4][2];
  assert.deepStrictEqual(rows.map(r => [r.post_id, r.kind, r.position]), [['p1', 'image', 0], ['p1', 'video', 1], ['p1', 'image', 2]]);
  assert.deepStrictEqual(progress[progress.length - 1], [3, 3]);
});

test('limits are checked before anything is uploaded', async () => {
  reset();
  await assert.rejects(() => store.createPostWithMedia(post, [img(1), img(2), img(3), img(4), img(5)]), /at most 4/);
  await assert.rejects(() => store.createPostWithMedia(post, [vid, vid]), /only one video/);
  assert.strictEqual(log.length, 0);
});

test('if an upload fails, the files already uploaded are removed and no post is made', async () => {
  reset(); failUploadAt = 2;
  await assert.rejects(() => store.createPostWithMedia(post, [img(1), img(2), img(3)]), /upload failed/);
  const removed = log.find(l => l[0] === 'remove');
  assert.strictEqual(removed[2].length, 2);
  assert(!log.some(l => l[0] === 'insert'));
});

test('if the post is refused, the uploaded files are removed', async () => {
  reset(); failPost = true;
  await assert.rejects(() => store.createPostWithMedia(post, [img(1)]), /posts refused/);
  assert.strictEqual(log.find(l => l[0] === 'remove')[2].length, 1);
});

test('if the attachments are refused, the post is deleted again and the files removed', async () => {
  reset(); failAttach = true;
  await assert.rejects(() => store.createPostWithMedia(post, [img(1)]), /post_media refused/);
  assert(log.some(l => l[0] === 'delete' && l[1] === 'posts' && l[2] === 'p1'));
  assert.strictEqual(log.find(l => l[0] === 'remove')[2].length, 1);
});

test('files are grouped by post in display order, and deleting a post removes its files too', async () => {
  reset();
  const m = await store.fetchPostMedia(['p1', 'p2']);
  assert.deepStrictEqual(Object.keys(m).sort(), ['p1', 'p2']);
  assert.strictEqual(m.p1.length, 2);
  assert.deepStrictEqual(await store.fetchPostMedia([]), {});
  reset();
  await store.deletePostWithMedia('p1');
  assert.deepStrictEqual(log.map(l => l[0] + ':' + l[1]), ['delete:posts', 'remove:post-media']);
  assert.deepStrictEqual(log[1][2].sort(), ['u1/a.mp4', 'u1/b.jpg']);
});
