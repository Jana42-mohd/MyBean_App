const test = require('node:test');
const assert = require('node:assert');
const { build, install } = require('./_mocks');

const calls = [];
let rpcResult = { data: [], error: null };
const supabase = {
  auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
  rpc: async (name, args) => { calls.push(['rpc', name, args]); return rpcResult; },
  from: table => ({
    upsert: async (row, opts) => { calls.push(['upsert', table, row, opts]); return { error: null }; },
    insert: row => { calls.push(['insert', table, row]); return { select: () => ({ single: async () => ({ data: { id: 'm1', ...row }, error: null }) }), then: r => r({ error: null }) }; },
  }),
};
install({ './supabase': { supabase } });
const n = build('neighbors.js');
const { COUNTRIES, countryName } = build('countries.js');

test('countries: unique 2-letter codes, sorted names, lookups', () => {
  const codes = COUNTRIES.map(c => c.code);
  assert.strictEqual(new Set(codes).size, codes.length);
  assert(codes.every(c => /^[A-Z]{2}$/.test(c)));
  assert(COUNTRIES.length > 200);
  assert.strictEqual(countryName('CA'), 'Canada');
  assert.strictEqual(countryName(null), '');
  const names = COUNTRIES.map(c => c.name);
  assert.deepStrictEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
});

test('savePlace: visible needs a country and a city; text is trimmed; empty becomes null', async () => {
  calls.length = 0;
  await assert.rejects(() => n.savePlace({ country: null, city: 'Toronto', area: '', discoverable: true }), /country/);
  await assert.rejects(() => n.savePlace({ country: 'CA', city: '   ', area: '', discoverable: true }), /city/);
  await assert.rejects(() => n.savePlace({ country: 'CA', city: 'x'.repeat(61), area: '', discoverable: false }), /60/);
  assert.strictEqual(calls.length, 0, 'nothing is sent when the input is wrong');
  await n.savePlace({ country: 'CA', city: '  Toronto ', area: '  ', discoverable: true });
  assert.deepStrictEqual(calls[0].slice(0, 3), ['upsert', 'neighbor_profiles', { user_id: 'u1', country: 'CA', city: 'Toronto', region: null, area: null, discoverable: true }]);
  await n.savePlace({ country: null, city: '', area: '', discoverable: false });  // hiding never needs a place
});

test('requests and messages go through the server functions with trimmed text', async () => {
  calls.length = 0;
  await n.requestConnection('p2', '  hello  ');
  await n.requestConnection('p3', '   ');
  await n.respondToRequest('c1', true);
  await n.reportParent('p2', 'spam', ' nope ', 'm9');
  assert.deepStrictEqual(calls.map(c => c[1]), ['request_connection', 'request_connection', 'respond_connection', 'report_user']);
  assert.deepStrictEqual(calls[0][2], { target: 'p2', intro: 'hello' });
  assert.deepStrictEqual(calls[1][2], { target: 'p3', intro: null });
  assert.deepStrictEqual(calls[3][2], { target: 'p2', reason: 'spam', details: 'nope', message: 'm9' });
  await assert.rejects(() => n.sendMessage('c1', '   '), /Type a message/);
  await assert.rejects(() => n.sendMessage('c1', 'x'.repeat(1001)), /1000/);
  const m = await n.sendMessage('c1', ' hi ');
  assert.strictEqual(m.body, 'hi');
});

test('incomingRequestCount counts only pending requests addressed to me', async () => {
  rpcResult = { data: [
    { status: 'pending', direction: 'incoming' }, { status: 'pending', direction: 'incoming' },
    { status: 'pending', direction: 'outgoing' }, { status: 'accepted', direction: 'incoming' },
  ], error: null };
  assert.strictEqual(await n.incomingRequestCount(), 2);
});
