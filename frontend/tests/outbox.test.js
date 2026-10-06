const test = require('node:test');
const assert = require('node:assert');
const { build, install, fakeAsyncStorage, fakeSupabase, NET_ERROR, settle } = require('./_mocks');

const storage = fakeAsyncStorage();
let behavior = () => ({});
const sb = fakeSupabase(call => behavior(call));
let resyncs = 0;
let online = true;
install({
  '@react-native-community/netinfo': { __esModule: true, default: { fetch: async () => ({ isConnected: online, isInternetReachable: online }) } },
  '@react-native-async-storage/async-storage': storage.module,
  './supabase': sb.module,
  './liveSync': { emitResync: () => { resyncs++; } },
});
const ob = build('outbox.js');
const { isTransientError } = build('netError.js');

const RLS = { message: 'new row violates row-level security policy', code: '42501' };
const FK = { message: 'insert violates foreign key', code: '23503' };
const row = (id, baby = 'b1') => ({ id, baby_id: baby, type: 'feeding', data: { method: 'breast' }, logged_at: '2026-01-01T10:00:00Z', baby_name: 'Mia' });
const failures = [];
ob.onOutboxFailure(m => failures.push(m));

// queuing also triggers an automatic send: wait for it to finish before measuring
const enq = async op => { await ob.enqueue(op); await settle(); };
async function reset(user) {
  await settle();
  sb.calls.length = 0; resyncs = 0; failures.length = 0; online = true;
  for (const k of Object.keys(storage.store)) delete storage.store[k];
  behavior = () => ({});
  await ob.clearOutbox();
  await ob.initOutbox(user);
}

test('error classification: no signal is retried, a refusal is not', () => {
  assert(isTransientError(new TypeError('Network request failed')));
  assert(isTransientError(Object.assign(new Error('x'), { name: 'AbortError' })));
  assert(isTransientError({ message: 'fetch failed' }));
  assert(isTransientError({ status: 503 }));
  assert(isTransientError({ status: 429 }));
  assert(isTransientError({ fromSupabase: true, message: 'whatever' }));
  assert(isTransientError({ code: 'PGRST301', message: 'JWT expired' }));
  assert(!isTransientError({ code: '42501', message: 'rls' }));
  assert(!isTransientError({ code: '23503', message: 'fk' }));
  assert(!isTransientError({ status: 400, code: '22P02', message: 'bad input' }));
  assert(!isTransientError(new Error('Pick a baby first')), 'plain validation errors are not network problems');
});

test('offline entries stay queued; once online they are sent with their ids, the helper field stripped', async () => {
  await reset('u1');
  behavior = () => ({ error: NET_ERROR });
  await enq({ kind: 'log', rows: [row('r1')] });
  assert.strictEqual(await ob.flush(), 0);
  assert.strictEqual(ob.getPendingCount(), 1);

  behavior = () => ({});
  assert.strictEqual(await ob.flush(), 1);
  assert.strictEqual(ob.getPendingCount(), 0);
  const sent = sb.calls[sb.calls.length - 1];
  assert.strictEqual(sent.table, 'logs');
  assert.deepStrictEqual(sent.opts, { onConflict: 'id', ignoreDuplicates: true }, 'a retry can never create a duplicate');
  assert.deepStrictEqual(sent.payload, [{ id: 'r1', baby_id: 'b1', type: 'feeding', data: { method: 'breast' }, logged_at: '2026-01-01T10:00:00Z', user_id: 'u1' }]);
  assert(resyncs >= 1, 'screens are told to reload after something was sent');
});

test('entries are sent in order and a connection failure stops the line', async () => {
  await reset('u1');
  behavior = () => ({ error: NET_ERROR });
  await enq({ kind: 'log', rows: [row('a')] });
  await enq({ kind: 'log', rows: [row('b')] });
  const before = sb.calls.length;
  await ob.flush();
  assert.strictEqual(sb.calls.length - before, 1, 'only the first was attempted');
  assert.strictEqual(ob.getPendingCount(), 2);
  behavior = () => ({});
  sb.calls.length = 0;
  await ob.flush();
  assert.deepStrictEqual(sb.calls.map(c => c.payload[0].id), ['a', 'b']);
});

test('an entry the server refuses is reported once and dropped; later entries still go', async () => {
  await reset('u1');
  let n = 0;
  behavior = () => (n++ === 0 ? { error: FK } : {});
  await enq({ kind: 'log', rows: [row('x')] });
  await enq({ kind: 'log', rows: [row('y')] });
  await ob.flush(); await ob.flush();
  assert.strictEqual(ob.getPendingCount(), 0);
  assert.strictEqual(failures.length, 1);
  assert(/baby it belonged to was removed/.test(failures[0]), failures[0]);
  assert.deepStrictEqual(sb.calls.map(c => c.payload[0].id), ['x', 'y']);
});

test('sleep stop: the nap is queued BEFORE saving, so a dropped connection cannot lose it', async () => {
  await reset('u1');
  const start = new Date(Date.now() - 90 * 60000).toISOString(), end = new Date().toISOString();
  let saveFails = true;
  behavior = c => {
    if (c.op === 'delete') return { data: [{ started_at: start }] };
    if (c.table === 'logs') return saveFails ? { error: NET_ERROR } : {};
    return {};
  };
  await enq({ kind: 'sleep_stop', baby_id: 'b1', baby_name: 'Mia', ended_at: end, log_id: 'nap-1' });
  await ob.flush();
  assert.strictEqual(ob.getPendingCount(), 1, 'nap is still queued');
  const stored = JSON.parse(storage.store['outbox:v1'])[0].op;
  assert.strictEqual(stored.kind, 'log');
  assert.strictEqual(stored.rows[0].id, 'nap-1');
  assert.deepStrictEqual(stored.rows[0].data, { start, end });

  saveFails = false;
  sb.calls.length = 0;
  await ob.flush();
  assert.strictEqual(ob.getPendingCount(), 0);
  assert(sb.calls.every(c => c.table === 'logs'), 'the second attempt does not claim the timer again');
  assert.strictEqual(sb.calls[0].payload[0].id, 'nap-1');
  assert.strictEqual(sb.calls[0].payload[0].type, 'nap');
  assert.strictEqual(sb.calls[0].payload[0].logged_at, start);
});

test('sleep stop: nothing is saved if the partner already stopped it, or it ran under a minute', async () => {
  await reset('u1');
  const end = new Date().toISOString();
  behavior = c => (c.op === 'delete' ? { data: [] } : {});
  await enq({ kind: 'sleep_stop', baby_id: 'b1', baby_name: 'Mia', ended_at: end, log_id: 'n2' });
  await ob.flush();
  assert.strictEqual(ob.getPendingCount(), 0);
  assert(!sb.calls.some(c => c.table === 'logs'), 'no second nap');

  await reset('u1');
  const justNow = new Date(Date.now() - 20000).toISOString();
  behavior = c => (c.op === 'delete' ? { data: [{ started_at: justNow }] } : {});
  await enq({ kind: 'sleep_stop', baby_id: 'b1', baby_name: 'Mia', ended_at: new Date().toISOString(), log_id: 'n3' });
  await ob.flush();
  assert.strictEqual(ob.getPendingCount(), 0);
  assert(!sb.calls.some(c => c.table === 'logs'));
});

test('a sleep started and stopped offline arrives start, claim, nap', async () => {
  await reset('u1');
  const start = new Date(Date.now() - 90 * 60000).toISOString(), end = new Date().toISOString();
  behavior = c => (c.op === 'delete' ? { data: [{ started_at: start }] } : {});
  await enq({ kind: 'sleep_start', baby_ids: ['b1'], names: ['Mia'], started_at: start });
  await enq({ kind: 'sleep_stop', baby_id: 'b1', baby_name: 'Mia', ended_at: end, log_id: 'n4' });
  await ob.flush();
  assert.deepStrictEqual(sb.calls.map(c => `${c.table}:${c.op}`), ['active_sleeps:upsert', 'active_sleeps:delete', 'logs:upsert']);
  assert.deepStrictEqual(sb.calls[0].payload, [{ baby_id: 'b1', started_at: start }]);
});

test('accounts never mix on a shared phone, and entries survive a restart', async () => {
  await reset('u1');
  behavior = () => ({ error: NET_ERROR });
  await enq({ kind: 'log', rows: [row('mine')] });
  await ob.initOutbox('u2');
  assert.strictEqual(ob.getPendingCount(), 0, 'u2 sees nothing of u1');
  behavior = () => ({});
  sb.calls.length = 0;
  await ob.flush();
  assert.strictEqual(sb.calls.length, 0, 'nothing of u1 is sent while u2 is signed in');
  await ob.initOutbox('u1');
  assert.strictEqual(ob.getPendingCount(), 1, 'back as u1: still there, loaded from storage');
  await ob.flush();
  assert.strictEqual(sb.calls[0].payload[0].user_id, 'u1');
});

test('undo of an unsent entry removes it; emptied entries disappear', async () => {
  await reset('u1');
  behavior = () => ({ error: NET_ERROR });
  await enq({ kind: 'log', rows: [row('t1'), row('t2', 'b2')] });
  await enq({ kind: 'log', rows: [row('t3')] });
  assert.deepStrictEqual(await ob.removePendingLogs(['t1', 't3', 'nope']), ['t1', 't3']);
  assert.strictEqual(ob.getPendingCount(), 1);
  assert.deepStrictEqual(ob.pendingLogRows().map(r => r.id), ['t2']);
});

test('discarding a sleep start that never reached the server', async () => {
  await reset('u1');
  behavior = () => ({ error: NET_ERROR });
  await enq({ kind: 'sleep_start', baby_ids: ['b1', 'b2'], names: ['Mia', 'Leo'], started_at: new Date().toISOString() });
  assert.strictEqual(await ob.removePendingSleepStart('b1'), true);
  assert.deepStrictEqual(ob.pendingSleepOps()[0].baby_ids, ['b2']);
  assert.strictEqual(await ob.removePendingSleepStart('b2'), true);
  assert.strictEqual(ob.getPendingCount(), 0);
  assert.strictEqual(await ob.removePendingSleepStart('b9'), false);
});

test('two flushes at once share one run (nothing is sent twice)', async () => {
  await reset('u1');
  behavior = () => ({ error: NET_ERROR });
  await enq({ kind: 'log', rows: [row('c1')] });
  behavior = () => ({});
  sb.calls.length = 0;
  const p1 = ob.flush(), p2 = ob.flush();
  assert.strictEqual(p1, p2);
  await p1;
  assert.strictEqual(sb.calls.filter(c => c.table === 'logs').length, 1);
});

test('clearing one account\'s outbox leaves the others', async () => {
  await reset('u1');
  behavior = () => ({ error: NET_ERROR });
  await enq({ kind: 'log', rows: [row('keep-me-not')] });
  await ob.initOutbox('u2');
  await enq({ kind: 'log', rows: [row('u2-entry')] });
  await ob.clearOutbox('u2');
  await ob.initOutbox('u1');
  assert.strictEqual(ob.getPendingCount(), 1);
  await ob.initOutbox('u2');
  assert.strictEqual(ob.getPendingCount(), 0);
});

test('while the phone is offline nothing is even attempted; the moment it is online the queue is sent', async () => {
  await reset('u1');
  online = false;
  await enq({ kind: 'log', rows: [row('o1')] });
  assert.strictEqual(sb.calls.length, 0, 'no request while offline');
  assert.strictEqual(await ob.flush(), 0);
  assert.strictEqual(sb.calls.length, 0);
  assert.strictEqual(ob.getPendingCount(), 1);
  online = true;
  assert.strictEqual(await ob.flush(), 1);
  assert.strictEqual(ob.getPendingCount(), 0);
});
