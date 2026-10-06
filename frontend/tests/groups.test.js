const test = require('node:test');
const assert = require('node:assert');
const { build, install } = require('./_mocks');

const calls = [];
let rpcResult = { data: null, error: null };
const supabase = {
  rpc: async (name, args) => { calls.push([name, args]); return rpcResult; },
  from: () => ({ insert: row => ({ select: () => ({ single: async () => ({ data: { id: 'm1', ...row }, error: null }) }) }) }),
};
install({ './supabase': { supabase } });
const g = build('groups.js');

test('createGroup checks the name and the number of people before asking the server', async () => {
  calls.length = 0;
  await assert.rejects(() => g.createGroup('  ', ['a']), /name/);
  await assert.rejects(() => g.createGroup('x'.repeat(41), ['a']), /40/);
  await assert.rejects(() => g.createGroup('Group', []), /at least one/);
  await assert.rejects(() => g.createGroup('Group', ['1', '2', '3', '4', '5', '6', '7', '8']), /at most 8/);
  assert.strictEqual(calls.length, 0);
  rpcResult = { data: 'group-1', error: null };
  assert.strictEqual(await g.createGroup('  Playgroup ', ['a', 'b']), 'group-1');
  assert.deepStrictEqual(calls[0], ['create_group', { group_name: 'Playgroup', invitees: ['a', 'b'] }]);
});

test('group actions call the matching server functions and surface refusals', async () => {
  calls.length = 0;
  rpcResult = { data: null, error: null };
  await g.inviteToGroup('g1', 'u2');
  await g.respondGroupInvite('g1', false);
  await g.leaveGroup('g1');
  await g.removeFromGroup('g1', 'u3');
  await g.deleteGroup('g1');
  await g.muteGroup('g1', true);
  await g.reportGroupMessage('m1', 'spam', ' x ');
  assert.deepStrictEqual(calls.map(c => c[0]), ['invite_to_group', 'respond_group_invite', 'leave_group', 'remove_from_group', 'delete_group', 'mute_group', 'report_group_message']);
  assert.deepStrictEqual(calls[6][1], { msg: 'm1', reason: 'spam', details: 'x' });
  rpcResult = { data: null, error: new Error('A group can have at most 8 people') };
  await assert.rejects(() => g.inviteToGroup('g1', 'u9'), /at most 8/);
});

test('sending validates the text and returns the saved message', async () => {
  await assert.rejects(() => g.sendGroupMessage('g1', '   '), /Type a message/);
  await assert.rejects(() => g.sendGroupMessage('g1', 'x'.repeat(1001)), /1000/);
  const m = await g.sendGroupMessage('g1', ' hello ');
  assert.strictEqual(m.body, 'hello');
});
