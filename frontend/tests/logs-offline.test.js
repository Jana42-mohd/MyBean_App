const test = require('node:test');
const assert = require('node:assert');
const { build, install, fakeAsyncStorage, fakeSupabase, NET_ERROR, settle } = require('./_mocks');

const storage = fakeAsyncStorage();
let behavior = () => ({});
let session = { user: { id: 'u1' } };
const sb = fakeSupabase(c => behavior(c));
// the session can change between tests
const supabaseProxy = { supabase: { ...sb.module.supabase, auth: { getSession: async () => ({ data: { session } }) } } };
let online = true;
let reminders = [];
install({
  '@react-native-async-storage/async-storage': storage.module,
  './supabase': supabaseProxy,
  './liveSync': { emitResync() {} },
  '@react-native-community/netinfo': { __esModule: true, default: { fetch: async () => ({ isConnected: online, isInternetReachable: online }) } },
  'expo-crypto': { randomUUID: (() => { let n = 0; return () => `uuid-${++n}`; })() },
  './reminders': { scheduleAfterLog: (...a) => { reminders.push(a); }, cancelRemindersFor: async () => {} },
});
const ob = build('outbox.js');
const logs = build('logs.js');
const actions = build('logActions.js');
const timer = build('timer.js');

const mia = { id: 'b1', name: 'Mia' }, leo = { id: 'b2', name: 'Leo' };
async function reset() {
  await settle();
  sb.calls.length = 0; reminders = []; online = true; session = { user: { id: 'u1' } };
  for (const k of Object.keys(storage.store)) delete storage.store[k];
  behavior = () => ({});
  await ob.clearOutbox();
  await ob.initOutbox('u1');
}

test('online: the entry is saved right away, with ids made on the phone, one row per baby (twins)', async () => {
  await reset();
  const r = await actions.logEntryEx('feeding', { method: 'breast' }, [mia, leo]);
  assert.strictEqual(r.queued, false);
  assert.deepStrictEqual(r.ids, ['uuid-1', 'uuid-2'].map(x => r.ids[['uuid-1', 'uuid-2'].indexOf(x)]));
  const call = sb.calls.find(c => c.table === 'logs');
  assert.strictEqual(call.payload.length, 2);
  assert.deepStrictEqual(call.payload.map(p => p.baby_id), ['b1', 'b2']);
  assert(call.payload.every(p => p.user_id === 'u1' && p.id && !('baby_name' in p)));
  assert.strictEqual(ob.getPendingCount(), 0);
  assert.strictEqual(reminders.length, 1, 'reminders are still scheduled');
});

test('offline: nothing is sent, the entry is queued and still shows up in reads as pending', async () => {
  await reset();
  online = false;
  const r = await actions.logEntryEx('diaper', { type: 'pee' }, [mia]);
  assert.strictEqual(r.queued, true);
  assert.strictEqual(sb.calls.length, 0, 'no request is even attempted while offline');
  assert.strictEqual(ob.getPendingCount(), 1);
  const pending = ob.pendingLogRows()[0];
  assert.strictEqual(pending.baby_name, 'Mia');
});

test('online but the connection dies mid-request: queued, not lost', async () => {
  await reset();
  behavior = () => ({ error: NET_ERROR });
  const r = await actions.logEntryEx('feeding', {}, [mia]);
  assert.strictEqual(r.queued, true);
  assert.strictEqual(ob.getPendingCount(), 1);
});

test('the server refusing an entry is an error for the person, not a silent queue', async () => {
  await reset();
  behavior = () => ({ error: { message: 'row-level security', code: '42501' } });
  await assert.rejects(() => actions.logEntryEx('feeding', {}, [mia]), /row-level security/);
  assert.strictEqual(ob.getPendingCount(), 0);
});

test('input checks: a baby is required (except pumping, which belongs to the parent), and you must be signed in', async () => {
  await reset();
  await assert.rejects(() => actions.logEntryEx('feeding', {}, []), /Add a baby first/);
  await actions.logEntryEx('pumping', { volumeOz: '3' }, []);
  const call = sb.calls.find(c => c.table === 'logs');
  assert.deepStrictEqual(call.payload.map(p => p.baby_id), [null]);
  session = null;
  await assert.rejects(() => actions.logEntryEx('feeding', {}, [mia]), /Not signed in/);
});

test('undo: unsent entries are just removed from the queue; sent ones are deleted on the server', async () => {
  await reset();
  online = false;
  const queued = await actions.logEntryEx('diaper', { type: 'pee' }, [mia]);
  sb.calls.length = 0;
  await actions.undoEntry('diaper', queued.ids, [mia]);
  assert.strictEqual(ob.getPendingCount(), 0);
  assert.strictEqual(sb.calls.length, 0, 'no network needed to undo something never sent');
  online = true;
  await actions.undoEntry('diaper', ['already-saved-id'], [mia]);
  const del = sb.calls.find(c => c.op === 'delete');
  assert(del && del.filters.eq[1] === 'already-saved-id');
});

const serverRow = (id, type, at, extra = {}) => ({ id, type, logged_at: at, data: {}, baby_id: 'b1', babies: { name: 'Mia' }, profiles: { name: 'Alex' }, ...extra });

test('reading: server rows plus anything saved on this phone, newest first, no duplicates', async () => {
  await reset();
  online = false;
  await actions.logEntryEx('feeding', { m: 1 }, [mia], '2026-02-02T10:00:00Z');
  const pendingId = ob.pendingLogRows()[0].id;
  behavior = c => (c.table === 'logs' ? { data: [serverRow('s1', 'feeding', '2026-02-01T10:00:00Z'), serverRow(pendingId, 'feeding', '2026-02-02T10:00:00Z')] } : {});
  const rows = await logs.fetchLogs('feeding', 50);
  assert.deepStrictEqual(rows.map(r => r.id), [pendingId, 's1'], 'the pending entry the server already has is not shown twice');
  const mine = await logs.fetchLogs(undefined, 50);
  assert(mine.length >= 2);
  const pend = rows.find(r => r.id === pendingId);
  assert.strictEqual(pend.pending, undefined, 'server copy wins once it exists');
});

test('reading: a pending entry is marked pending, with author "You" and the baby\'s name', async () => {
  await reset();
  online = false;
  await actions.logEntryEx('diaper', { type: 'poop' }, [leo]);
  behavior = c => (c.table === 'logs' ? { data: [] } : {});
  const rows = await logs.fetchLogs(['diaper'], 50);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].pending, true);
  assert.strictEqual(rows[0].author, 'You');
  assert.strictEqual(rows[0].baby, 'Leo');
  const other = await logs.fetchLogs(['feeding'], 50);
  assert.strictEqual(other.length, 0, 'type filter applies to pending entries too');
  const future = await logs.fetchLogs(['diaper'], 50, '2999-01-01T00:00:00Z');
  assert.strictEqual(future.length, 0, '"since" applies to pending entries too');
});

test('reading with no signal falls back to what was seen last time (plus pending), else fails clearly', async () => {
  await reset();
  behavior = c => (c.table === 'logs' ? { data: [serverRow('s1', 'feeding', '2026-02-01T10:00:00Z')] } : {});
  const first = await logs.fetchLogs('feeding', 50);
  assert.strictEqual(first.length, 1);
  await settle(); // the cache is written in the background

  behavior = () => ({ error: NET_ERROR });
  online = false;
  await actions.logEntryEx('feeding', {}, [mia], '2026-02-03T10:00:00Z');
  const offline = await logs.fetchLogs('feeding', 50);
  assert.deepStrictEqual(offline.map(r => r.pending ?? false), [true, false], 'new pending entry on top, cached server row below');

  await assert.rejects(() => logs.fetchLogs('mood', 50), /network/i, 'nothing cached for this query: the error surfaces');
  await assert.rejects(() => logs.fetchLogs('feeding', 700), /network/i, 'big queries (charts) are not cached');
});

test('sleep timers: starts and stops waiting on the phone are applied to the list', async () => {
  await reset();
  const server = [{ baby_id: 'b2', baby_name: 'Leo', started_at: '2026-01-01T01:00:00Z', started_by: 'partner', started_by_name: 'Blake' }];
  online = false;
  await timer.startSleeps([mia]);                // offline: queued
  await timer.queueSleepStop('b2', 'Leo');       // stopped Leo's timer (started by partner) while offline
  const list = timer.withPendingSleeps(server, 'u1');
  assert.deepStrictEqual(list.map(s => s.baby_id), ['b1'], 'Mia shows as asleep, Leo no longer does');
  assert.strictEqual(list[0].started_by_name, 'You');
  await timer.discardSleep('b1');                // never reached the server: simply forgotten
  assert.deepStrictEqual(timer.withPendingSleeps([], 'u1').map(s => s.baby_id), []);
});
