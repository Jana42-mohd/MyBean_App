const test = require('node:test');
const assert = require('node:assert');
const { build, install } = require('./_mocks');

const calls = [];
let result = { data: 0, error: null };
install({
  './supabase': { supabase: { rpc: async (name, args) => { calls.push([name, args]); if (result.throw) throw new Error('offline'); return result; } } },
  react: { useState: v => [v, () => {}], useEffect: () => {} },
  'react-native': { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
});
const unread = build('unread.js');

test('refreshUnread keeps the number from the server, and keeps the old one when the call fails', async () => {
  calls.length = 0;
  result = { data: 7, error: null };
  assert.strictEqual(await unread.refreshUnread(), 7);
  result = { data: null, error: new Error('nope') };
  assert.strictEqual(await unread.refreshUnread(), 7, 'an error does not zero the badge');
  result = { throw: true };
  assert.strictEqual(await unread.refreshUnread(), 7, 'no signal does not either');
  result = { data: '12', error: null };
  assert.strictEqual(await unread.refreshUnread(), 12, 'a number sent as text is read as a number');
  unread.clearUnread();
  result = { data: 0, error: null };
  assert.strictEqual(await unread.refreshUnread(), 0);
});

test('markChatRead tells the server how far the chat was read, then refreshes the badge', async () => {
  calls.length = 0;
  result = { data: 3, error: null };
  await unread.markChatRead('conn-1', '2026-10-06T10:00:00+00:00');
  assert.deepStrictEqual(calls[0], ['mark_chat_read', { ref: 'conn-1', upto: '2026-10-06T10:00:00+00:00' }]);
  await new Promise(r => setTimeout(r, 10));
  assert(calls.some(c => c[0] === 'unread_total'), 'the badge is reloaded afterwards');
});

test('markChatRead never throws (a failure is retried the next time the chat is opened)', async () => {
  result = { throw: true };
  await unread.markChatRead('conn-1', '2026-10-06T10:00:00+00:00');
  result = { data: null, error: new Error('Not found') };
  await unread.markChatRead('conn-2', '2026-10-06T10:00:00+00:00');
});
