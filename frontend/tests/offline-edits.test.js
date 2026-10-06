const test = require('node:test');
const assert = require('node:assert');
const { build, install, fakeAsyncStorage, fakeSupabase, NET_ERROR, settle } = require('./_mocks');

const storage = fakeAsyncStorage();
let behavior = () => ({});
const sb = fakeSupabase(c => behavior(c));
let online = true;
install({
  '@react-native-async-storage/async-storage': storage.module,
  './supabase': sb.module,
  './liveSync': { emitResync() {} },
  '@react-native-community/netinfo': { __esModule: true, default: { fetch: async () => ({ isConnected: online, isInternetReachable: online }) } },
  'expo-crypto': { randomUUID: (() => { let n = 0; return () => `uuid-${++n}`; })() },
  './reminders': { scheduleAfterLog: () => {}, cancelRemindersFor: async () => {} },
});
const ob = build('outbox.js');
const logs = build('logs.js');
const actions = build('logActions.js');
const mia = { id: 'b1', name: 'Mia' };

async function reset() {
  await settle();
  sb.calls.length = 0; online = true; behavior = () => ({});
  for (const k of Object.keys(storage.store)) delete storage.store[k];
  await ob.clearOutbox();
  await ob.initOutbox('u1');
}
const serverRow = (id, at, data = {}) => ({ id, type: 'feeding', logged_at: at, data, baby_id: 'b1', babies: { name: 'Mia' }, profiles: { name: 'Alex' } });
const ops = (op, table = 'logs') => sb.calls.filter(c => c.table === table && c.op === op);

test('online: edit and delete go straight to the server', async () => {
  await reset();
  assert.deepStrictEqual(await logs.updateLog('s1', { a: 1 }, '2026-01-01T00:00:00Z'), { queued: false });
  assert.deepStrictEqual(ops('update')[0].payload, { data: { a: 1 }, logged_at: '2026-01-01T00:00:00Z' });
  assert.deepStrictEqual(await logs.deleteLog('s1'), { queued: false });
  assert.strictEqual(ops('delete')[0].filters.eq[1], 's1');
  assert.strictEqual(ob.getPendingCount(), 0);
});

test('offline: edit and delete are queued, nothing is sent, and the list shows the result at once', async () => {
  await reset();
  behavior = c => (c.table === 'logs' && c.op === 'select' ? { data: [serverRow('s1', '2026-02-01T10:00:00Z', { method: 'breast' }), serverRow('s2', '2026-02-01T09:00:00Z'), serverRow('s3', '2026-02-01T08:00:00Z')] } : {});
  await logs.fetchLogs('feeding', 50);
  await settle();
  online = false;
  sb.calls.length = 0;
  assert.deepStrictEqual(await logs.updateLog('s1', { method: 'formula' }), { queued: true });
  assert.deepStrictEqual(await logs.deleteLog('s2'), { queued: true });
  assert.strictEqual(sb.calls.length, 0, 'no request while offline');
  assert.strictEqual(ob.getPendingCount(), 2);

  behavior = () => ({ error: NET_ERROR });
  const rows = await logs.fetchLogs('feeding', 50);   // no signal: cached rows + the offline changes
  assert.deepStrictEqual(rows.map(r => r.id), ['s1', 's3'], 'the deleted entry is gone');
  assert.strictEqual(rows[0].data.method, 'formula');
  assert.strictEqual(rows[0].pending, true);
  assert.strictEqual(rows[1].pending, undefined);
});

test('coming back online sends the edit and the delete once, in order', async () => {
  await reset();
  online = false;
  await logs.updateLog('s1', { v: 1 });
  await logs.updateLog('s1', { v: 2 });
  await logs.deleteLog('s2', 'house/p.jpg');
  online = true;
  await settle();
  assert.strictEqual(await ob.flush(), 3);
  assert.deepStrictEqual(ops('update').map(c => c.payload.data.v), [1, 2], 'later edit wins');
  assert.strictEqual(ops('delete')[0].filters.eq[1], 's2');
  assert.deepStrictEqual(ops('remove', 'storage:milestone-photos')[0].payload, ['house/p.jpg'], 'its photo file is removed too');
  assert.strictEqual(ob.getPendingCount(), 0);
});

test('deleting an entry also forgets its queued edits', async () => {
  await reset();
  online = false;
  await logs.updateLog('s1', { v: 1 });
  await logs.deleteLog('s1');
  online = true;
  await settle();
  await ob.flush();
  assert.strictEqual(ops('update').length, 0);
  assert.strictEqual(ops('delete').length, 1);
});

test('editing or deleting something that was never sent just changes the queue', async () => {
  await reset();
  online = false;
  const { ids } = await actions.logEntryEx('feeding', { method: 'breast' }, [mia]);
  assert.deepStrictEqual(await logs.updateLog(ids[0], { method: 'formula' }, '2026-03-03T03:03:00Z'), { queued: true });
  assert.strictEqual(ob.getPendingCount(), 1, 'still one entry: the edit was folded into it');
  assert.strictEqual(ob.pendingLogRows()[0].data.method, 'formula');
  assert.strictEqual(ob.pendingLogRows()[0].logged_at, '2026-03-03T03:03:00Z');
  await logs.deleteLog(ids[0]);
  assert.strictEqual(ob.getPendingCount(), 0);
  online = true;
  await ob.flush();
  assert.strictEqual(sb.calls.filter(c => c.op === 'upsert' || c.op === 'update' || c.op === 'delete').length, 0, 'nothing ever reaches the server');
});

test('online but the connection drops mid-request: queued, not lost; a refusal is still an error', async () => {
  await reset();
  behavior = () => ({ error: NET_ERROR });
  assert.deepStrictEqual(await logs.updateLog('s1', { a: 1 }), { queued: true });
  assert.deepStrictEqual(await logs.deleteLog('s2'), { queued: true });
  assert.strictEqual(ob.getPendingCount(), 2);
  await reset();
  behavior = () => ({ error: { message: 'permission denied', code: '42501' } });
  await assert.rejects(() => logs.updateLog('s1', {}), /permission denied/);
  await assert.rejects(() => logs.deleteLog('s2'), /permission denied/);
  assert.strictEqual(ob.getPendingCount(), 0);
});

test('a queued edit the server refuses is reported once and dropped; the rest still go', async () => {
  await reset();
  online = false;
  await logs.updateLog('s1', { v: 1 });
  await logs.updateLog('s2', { v: 2 });
  online = true;
  await settle();
  const messages = [];
  const off = ob.onOutboxFailure(m => messages.push(m));
  behavior = c => (c.op === 'update' && c.filters.eq[1] === 's1' ? { error: { message: 'permission denied', code: '42501' } } : {});
  assert.strictEqual(await ob.flush(), 1);
  off();
  assert.strictEqual(messages.length, 1);
  assert.strictEqual(ob.getPendingCount(), 0);
});

test('an edit made while that entry is being sent waits for the send (no lost edit, no orphan)', async () => {
  await reset();
  online = false;
  const { ids } = await actions.logEntryEx('feeding', { method: 'breast' }, [mia]);
  online = true;
  await settle();
  let release;
  const gate = new Promise(r => { release = r; });
  behavior = () => ({});
  const realUpsert = sb.module.supabase.from;
  sb.module.supabase.from = table => {
    const q = realUpsert(table);
    if (table !== 'logs') return q;
    return { ...q, upsert: (p, o) => ({ then: (res, rej) => gate.then(() => q.upsert(p, o)).then(res, rej) }) };
  };
  const sending = ob.flush();
  const edit = logs.updateLog(ids[0], { method: 'formula' });
  await settle();
  assert.strictEqual(ops('update').length, 0, 'the edit holds back while the send is in progress');
  release();
  await sending; await edit;
  sb.module.supabase.from = realUpsert;
  const inserted = sb.calls.find(c => c.op === 'upsert');
  assert(inserted, 'the entry was sent');
  assert(ops('update').some(c => c.payload.data.method === 'formula'), 'and the edit followed it to the server');
});
