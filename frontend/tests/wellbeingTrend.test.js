const test = require('node:test');
const assert = require('node:assert');
const { build } = require('./_mocks');
const t = build('wellbeingTrend.js');

const NOW = new Date('2026-10-06T12:00:00Z').getTime();
const DAY = 86400000;
const ago = d => new Date(NOW - d * DAY).toISOString();
const mood = (d, score) => ({ kind: 'checkin', score, created_at: ago(d) });
const epds = (d, score) => ({ kind: 'epds', score, created_at: ago(d) });

test('weekly averages: 8 windows, oldest first, check-ins only', () => {
  const w = t.weeklyMood([mood(1, 4), mood(3, 2), mood(9, 5), epds(2, 20)], NOW);
  assert.strictEqual(w.length, 8);
  assert.deepStrictEqual([w[7].average, w[7].count], [3, 2]);   // this week: (4+2)/2, the EPDS score is not a mood
  assert.deepStrictEqual([w[6].average, w[6].count], [5, 1]);   // last week
  assert.strictEqual(w[0].average, null);
  assert(w[0].start < w[7].start);
});

test('a check-in made right now counts in this week', () => {
  const w = t.weeklyMood([{ kind: 'checkin', score: 1, created_at: new Date(NOW).toISOString() }], NOW);
  assert.strictEqual(w[7].count, 1);
});

test('two low weeks in a row prompt a gentle nudge', () => {
  const e = [mood(1, 2), mood(2, 1), mood(8, 2), mood(10, 2)];
  assert.strictEqual(t.nudgeFor(e, NOW), 'low-mood');
});

test('one low week is not enough, and neither is a thin week', () => {
  assert.strictEqual(t.nudgeFor([mood(1, 1), mood(2, 1), mood(8, 4), mood(10, 4)], NOW), null);
  assert.strictEqual(t.nudgeFor([mood(1, 1), mood(8, 1)], NOW), null, 'one check-in a week says too little');
});

test('the line between low and okay', () => {
  assert.strictEqual(t.nudgeFor([mood(1, 3), mood(2, 2), mood(8, 3), mood(10, 2)], NOW), 'low-mood', 'averages of 2.5 count as low');
  assert.strictEqual(t.nudgeFor([mood(1, 3), mood(2, 3), mood(8, 3), mood(10, 3)], NOW), null, 'Okay is not low');
});

test('two screenings in the range worth a chat prompt a nudge; one does not; old ones do not', () => {
  assert.strictEqual(t.nudgeFor([epds(3, 12), epds(20, 10)], NOW), 'epds');
  assert.strictEqual(t.nudgeFor([epds(3, 12), epds(20, 6)], NOW), null);
  assert.strictEqual(t.nudgeFor([epds(3, 12)], NOW), null);
  assert.strictEqual(t.nudgeFor([epds(3, 12), epds(90, 15)], NOW), null, 'a screening from 90 days ago is too old');
});

test('no entries, no nudge', () => {
  assert.strictEqual(t.nudgeFor([], NOW), null);
  assert(t.weeklyMood([], NOW).every(w => w.average === null && w.count === 0));
});
