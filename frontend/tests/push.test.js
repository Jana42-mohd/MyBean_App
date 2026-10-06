const test = require('node:test');
const assert = require('node:assert');
const { build, install, fakeAsyncStorage } = require('./_mocks');

const storage = fakeAsyncStorage();
const rpcCalls = [];
const updates = [];
let rpcError = null;
let granted = true;
let askResult = true;
let tokenResult = { data: 'ExponentPushToken[abc123]' };
let profile = { notify_partner: true };
let tokenThrows = false;
const supabase = {
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  rpc: async (name, args) => { rpcCalls.push([name, args]); return { error: rpcError }; },
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }),
    update: p => ({ eq: async () => { updates.push(p); return { error: null }; } }),
  }),
};
install({
  '@react-native-async-storage/async-storage': storage.module,
  'expo-constants': { __esModule: true, default: { expoConfig: { extra: { eas: { projectId: 'proj-1' } } } } },
  'expo-notifications': {
    getPermissionsAsync: async () => ({ granted }),
    getExpoPushTokenAsync: async () => { if (tokenThrows) throw new Error('not supported'); return tokenResult; },
  },
  'react-native': { Platform: { OS: 'ios' } },
  './reminders': { ensurePermission: async () => askResult },
  './supabase': { supabase },
});
const push = build('push.js');

function reset() {
  rpcCalls.length = 0; updates.length = 0; rpcError = null; granted = true; askResult = true; profile = { notify_partner: true }; tokenThrows = false;
  for (const k of Object.keys(storage.store)) delete storage.store[k];
}

test('after sign-in the phone registers its address, but only if notifications are already allowed', async () => {
  reset();
  await push.syncPushToken();
  assert.deepStrictEqual(rpcCalls, [['register_push_token', { t: 'ExponentPushToken[abc123]', p: 'ios' }]]);
  assert.strictEqual(storage.store.pushToken, 'ExponentPushToken[abc123]');
  reset(); granted = false;
  await push.syncPushToken();
  assert.strictEqual(rpcCalls.length, 0, 'never asks for permission on its own');
  reset(); profile = { notify_partner: false };
  await push.syncPushToken();
  assert.strictEqual(rpcCalls.length, 0, 'switched off: nothing registered');
});

test('turning the switch on asks permission; refusal leaves it off', async () => {
  reset(); askResult = false;
  assert.strictEqual(await push.setPartnerNotifications(true), false);
  assert.strictEqual(updates.length, 0);
  reset();
  assert.strictEqual(await push.setPartnerNotifications(true), true);
  assert.deepStrictEqual(updates, [{ notify_partner: true }]);
  assert.strictEqual(rpcCalls[0][0], 'register_push_token');
});

test('turning it off only changes the preference', async () => {
  reset();
  assert.strictEqual(await push.setPartnerNotifications(false), true);
  assert.deepStrictEqual(updates, [{ notify_partner: false }]);
  assert.strictEqual(rpcCalls.length, 0);
});

test('a phone that cannot get a token (e.g. Expo Go on Android) fails quietly', async () => {
  reset(); tokenThrows = true;
  await push.syncPushToken();
  assert.strictEqual(rpcCalls.length, 0);
  assert.strictEqual(await push.setPartnerNotifications(true), true, 'the preference is still saved');
});

test('logging out gives the address back and forgets it', async () => {
  reset();
  await push.syncPushToken();
  rpcCalls.length = 0;
  await push.forgetPushToken();
  assert.deepStrictEqual(rpcCalls, [['unregister_push_token', { t: 'ExponentPushToken[abc123]' }]]);
  assert.strictEqual(storage.store.pushToken, undefined);
  await push.forgetPushToken(); // nothing stored: no call
  assert.strictEqual(rpcCalls.length, 1);
});
