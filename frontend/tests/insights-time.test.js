const test = require('node:test');
const assert = require('node:assert');
const { build } = require('./_mocks');
const { buildDays, computeStats } = build('insights.js');
const time = build('time.js');

const now = new Date(2025, 2, 14, 12, 0); // 14 Mar 2025, local noon
const L = (d, h, m = 0) => new Date(2025, 2, d, h, m).toISOString();
const rows = [
  { type: 'nap', logged_at: L(12, 22), baby_id: 'a', data: { start: L(12, 22), end: L(13, 6) } },        // 22:00 -> 06:00, crosses midnight
  { type: 'nap', logged_at: L(13, 13), baby_id: 'a', data: { start: L(13, 13), end: L(13, 14) } },
  { type: 'nap', logged_at: L(14, 9), baby_id: 'a', data: { start: '2025-03-14 09:00', end: '2025-03-14 10:30' } }, // old UTC text format
  { type: 'feeding', logged_at: L(13, 8), baby_id: 'a', data: {} },
  { type: 'feeding', logged_at: L(13, 11), baby_id: 'a', data: {} },
  { type: 'feeding', logged_at: L(13, 14), baby_id: 'a', data: {} },
  { type: 'feeding', logged_at: L(14, 8), baby_id: 'a', data: {} },   // 18 h after the last one: overnight gap
  { type: 'diaper', logged_at: L(13, 9), baby_id: 'a', data: { type: 'pee' } },
  { type: 'diaper', logged_at: L(13, 10), baby_id: 'a', data: { type: 'poop' } },
  { type: 'diaper', logged_at: L(2, 10), baby_id: 'a', data: { type: 'poop' } },   // outside the 7-day window
];

test('buckets cover the last N days, oldest first, ending today', () => {
  const days = buildDays(rows, 7, now);
  assert.strictEqual(days.length, 7);
  assert.strictEqual(days[0].key, '2025-03-08');
  assert.strictEqual(days[6].key, '2025-03-14');
});

test('sleep that crosses midnight is split across both days', () => {
  const days = buildDays(rows, 7, now);
  const d = k => days.find(x => x.key === k);
  assert.strictEqual(Math.round(d('2025-03-12').sleepMin), 120);
  assert.strictEqual(Math.round(d('2025-03-13').sleepMin), 6 * 60 + 60);
  assert.strictEqual(Math.round(d('2025-03-14').sleepMin), 90); // the old-format entry still counts
});

test('feedings and diapers are counted per day and out-of-window rows are ignored', () => {
  const days = buildDays(rows, 7, now);
  const d13 = days.find(x => x.key === '2025-03-13');
  assert.strictEqual(d13.feedings, 3);
  assert.strictEqual(d13.wet, 1);
  assert.strictEqual(d13.dirty, 1);
  assert.strictEqual(days.reduce((a, d) => a + d.dirty, 0), 1);
});

test('stats: longest stretch, average feeding gap ignores overnight gaps', () => {
  const s = computeStats(rows, buildDays(rows, 7, now));
  assert.strictEqual(Math.round(s.longestSleepMin), 480);
  assert.strictEqual(s.avgFeedGapHours, 3);
  assert.strictEqual(s.avgFeedings, 2);
});

test('time helpers: local input <-> instant round trip, and impossible dates are rejected', () => {
  const iso = time.localInputToIso('2025-03-14 08:30');
  assert.strictEqual(time.toLocalInput(iso), '2025-03-14 08:30');
  assert.strictEqual(time.localInputToIso('2025-02-30 08:30'), null);
  assert.strictEqual(time.localInputToIso('2025-03-14 25:00'), null);
  assert.strictEqual(time.localInputToIso('garbage'), null);
  assert.strictEqual(time.formatDateTimeInput('202503140830'), '2025-03-14 08:30');
  assert.strictEqual(time.formatDateTimeInput('2025-03-1'), '2025-03-1');
  assert.strictEqual(time.formatDuration(0), '0m');
  assert.strictEqual(time.formatDuration(135), '2h 15m');
  assert.strictEqual(time.formatDuration(120), '2h');
  assert.strictEqual(time.toDate('2025-03-14 09:00').toISOString(), '2025-03-14T09:00:00.000Z', 'old text format means UTC');
  assert.strictEqual(time.timeAgo(new Date(2025, 0, 1, 10, 0), new Date(2025, 0, 1, 10, 25)), '25 min ago');
  assert.strictEqual(time.timeAgo(new Date(2025, 0, 1, 10, 0), new Date(2025, 0, 1, 13, 5)), '3 h 5 min ago');
});
