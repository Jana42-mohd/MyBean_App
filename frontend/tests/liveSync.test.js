const test = require('node:test');
const assert = require('node:assert');
const { build, install, settle } = require('./_mocks');

let appStateCb = null;
const channels = [];
let householdId = 'H1', signedIn = true, removed = 0;
install({
  'react-native': { AppState: { addEventListener: (_e, cb) => { appStateCb = cb; return { remove() {} }; } } },
  './supabase': {
    supabase: {
      auth: { getSession: async () => ({ data: { session: signedIn ? { user: { id: 'me' } } : null } }) },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: householdId ? { household_id: householdId } : null }) }) }) }),
      channel: name => {
        const ch = { name, handlers: [], statusCb: null, on(type, cfg, cb) { ch.handlers.push({ cfg, cb }); return ch; }, subscribe(cb) { ch.statusCb = cb; return ch; } };
        channels.push(ch);
        return ch;
      },
      removeChannel: async () => { removed++; },
    },
  },
});
const live = build('liveSync.js');
const events = [];
live.onLiveChange(e => events.push(e));
const handler = (ch, table, event) => ch.handlers.find(h => h.cfg.table === table && h.cfg.event === event).cb;

test('subscribes to the household only: changes are filtered, deletes are checked on arrival', async () => {
  await live.startLiveSync();
  const ch = channels[0];
  assert.strictEqual(ch.name, 'household-H1');
  const f = ch.handlers.map(h => `${h.cfg.event}:${h.cfg.table}:${h.cfg.filter ?? '-'}`);
  for (const t of ['logs', 'babies', 'profiles', 'active_sleeps']) assert(f.includes(`*:${t}:household_id=eq.H1`), t);
  for (const t of ['logs', 'babies', 'active_sleeps']) assert(f.includes(`DELETE:${t}:-`), t);
  assert.strictEqual(live.getMyId(), 'me');
  assert.strictEqual(live.getLiveStatus(), 'connecting');
});

test('first connection is live and does not trigger a reload', () => {
  channels[0].statusCb('SUBSCRIBED');
  assert.strictEqual(live.getLiveStatus(), 'live');
  assert.strictEqual(events.length, 0);
});

test('a partner\'s insert reaches the screens', () => {
  handler(channels[0], 'logs', '*')({ eventType: 'INSERT', new: { id: 1, user_id: 'partner' }, old: {} });
  assert.deepStrictEqual(events.pop(), { table: 'logs', type: 'INSERT', record: { id: 1, user_id: 'partner' }, old: {} });
});

test('deletes from other households are ignored; ours pass', () => {
  const del = handler(channels[0], 'logs', 'DELETE');
  del({ old: { id: 9, household_id: 'OTHER' } });
  assert.strictEqual(events.length, 0);
  del({ old: { id: 10, household_id: 'H1' } });
  assert.strictEqual(events.length, 1);
  events.length = 0;
});

test('after a dropped connection comes back, screens reload (changes may have been missed)', () => {
  channels[0].statusCb('CLOSED');
  assert.strictEqual(live.getLiveStatus(), 'offline');
  channels[0].statusCb('SUBSCRIBED');
  assert.deepStrictEqual(events.map(e => e.type), ['RESYNC']);
  events.length = 0;
});

test('returning to the app reloads; going to the background does nothing', () => {
  appStateCb('active');
  assert.deepStrictEqual(events.map(e => e.type), ['RESYNC']);
  events.length = 0;
  appStateCb('background');
  assert.strictEqual(events.length, 0);
});

test('returning to the app while NOT live reconnects with a new channel', async () => {
  channels[0].statusCb('TIMED_OUT');
  const before = channels.length;
  appStateCb('active');
  await settle();
  assert.strictEqual(channels.length, before + 1);
});

test('joining another household moves the filter; old channels are removed', async () => {
  householdId = 'H2';
  await live.restartLiveSync();
  const last = channels[channels.length - 1];
  assert.strictEqual(last.name, 'household-H2');
  assert(last.handlers.some(h => h.cfg.filter === 'household_id=eq.H2'));
  assert(removed >= 2);
});

test('signed out: nothing runs. Signed in without a household: not live.', async () => {
  signedIn = false;
  await live.stopLiveSync();
  assert.strictEqual(live.getLiveStatus(), 'off');
  await live.startLiveSync();
  assert.strictEqual(live.getLiveStatus(), 'off');
  signedIn = true; householdId = null;
  await live.startLiveSync();
  assert.strictEqual(live.getLiveStatus(), 'offline');
});
