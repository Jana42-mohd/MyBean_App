const test = require('node:test');
const assert = require('node:assert');
const { build } = require('./_mocks');
const r = build('rightNow.js');

const NOW = new Date('2026-10-06T12:00:00Z');
const at = (minAgo) => new Date(NOW.getTime() - minAgo * 60000).toISOString();
const feed = (baby, minAgo, extra = {}) => ({ id: `f${baby}${minAgo}`, type: 'feeding', logged_at: at(minAgo), baby_id: baby, data: { time: at(minAgo), method: 'breast', ...extra }, author: 'Blake' });
const diaper = (baby, minAgo, type = 'pee') => ({ id: `d${baby}${minAgo}`, type: 'diaper', logged_at: at(minAgo), baby_id: baby, data: { time: at(minAgo), type } });
const nap = (baby, startAgo, endAgo) => ({ id: `n${baby}${startAgo}`, type: 'nap', logged_at: at(startAgo), baby_id: baby, data: { start: at(startAgo), end: at(endAgo) } });
const mia = { id: 'b1', name: 'Mia' }, leo = { id: 'b2', name: 'Leo' };

test('the usual gap is the middle of the recent gaps, ignoring top-ups and nights', () => {
  const t = m => new Date(NOW.getTime() - m * 60000);
  assert.strictEqual(r.usualFeedGap([t(540), t(360), t(180), t(0)]), 180);
  assert.strictEqual(r.usualFeedGap([t(600), t(590), t(400), t(220), t(0)]), 190, 'the 10-minute gap is a top-up, left out: gaps 190, 180, 220 -> middle 190');
  assert.strictEqual(r.usualFeedGap([t(1200), t(600), t(400), t(200), t(0)]), 200, 'a 10-hour night gap is ignored');
  assert.strictEqual(r.usualFeedGap([t(360), t(180), t(0)]), null, 'two gaps are not enough to call a pattern');
  assert.strictEqual(r.usualFeedGap([]), null);
});

test('last feeding and diaper, awake time, and the next feeding estimate', () => {
  const rows = [feed('b1', 360), feed('b1', 180 + 90), feed('b1', 180), feed('b1', 100, { amount: '4 oz' }), diaper('b1', 50, 'poop'), diaper('b1', 200), nap('b1', 200, 70)];
  const s = r.computeStatus(mia, rows, [], NOW);
  assert.strictEqual(s.lastFeeding.method, 'breast');
  assert.strictEqual(s.lastFeeding.amount, '4 oz');
  assert.strictEqual(s.lastFeeding.by, 'Blake');
  assert.strictEqual(NOW - s.lastFeeding.at, 100 * 60000);
  assert.strictEqual(s.lastDiaper.type, 'poop');
  assert.strictEqual(NOW - s.awakeSince, 70 * 60000, 'awake since the last nap ended');
  assert.strictEqual(s.asleepSince, null);
  assert(s.feedGapMinutes > 0);
  assert.strictEqual(s.nextFeedAt.getTime(), s.lastFeeding.at.getTime() + s.feedGapMinutes * 60000);
});

test('asleep: from the shared timer, and then there is no awake time', () => {
  const s = r.computeStatus(mia, [nap('b1', 200, 70)], [{ baby_id: 'b1', started_at: at(35) }], NOW);
  assert.strictEqual(NOW - s.asleepSince, 35 * 60000);
  assert.strictEqual(s.awakeSince, null);
});

test('twins are kept apart, and a baby with no entries has nothing to show', () => {
  const rows = [feed('b1', 30), diaper('b2', 10)];
  const [a, b] = [mia, leo].map(x => r.computeStatus(x, rows, [], NOW));
  assert(a.lastFeeding && !a.lastDiaper);
  assert(!b.lastFeeding && b.lastDiaper);
  const none = r.computeStatus({ id: 'b9', name: 'Zed' }, rows, [], NOW);
  assert.deepStrictEqual([none.lastFeeding, none.lastDiaper, none.awakeSince, none.nextFeedAt, none.feedGapMinutes], [null, null, null, null, null]);
});

test('entries in the future and broken times are ignored', () => {
  const rows = [feed('b1', -60), { ...feed('b1', 20), data: { time: 'not a date' }, logged_at: 'also not' }, feed('b1', 45)];
  const s = r.computeStatus(mia, rows, [], NOW);
  assert.strictEqual(NOW - s.lastFeeding.at, 45 * 60000);
});

test('"next feeding in X hours" typed by the parent beats the pattern', () => {
  const rows = [feed('b1', 360), feed('b1', 180), feed('b1', 0, { nextInHours: '2' }), feed('b1', 540)];
  const s = r.computeStatus(mia, rows, [], NOW);
  assert.strictEqual(s.nextFeedAt.getTime() - s.lastFeeding.at.getTime(), 2 * 3600_000);
  const wild = r.computeStatus(mia, [feed('b1', 10, { nextInHours: '99' })], [], NOW);
  assert.strictEqual(wild.nextFeedAt, null, 'an absurd value is ignored');
});
