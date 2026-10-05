const test = require('node:test');
const assert = require('node:assert');
const { build } = require('./_mocks');
const g = build('growth.js');
const { WHO_LMS } = build('whoGrowthData.js');
const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('WHO tables: every metric and sex has one row per month, 0 to 60', () => {
  for (const m of ['wfa', 'lhfa', 'hcfa']) for (const s of ['boys', 'girls']) assert.strictEqual(WHO_LMS[m][s].length, 61, `${m} ${s}`);
});

test('the WHO median is the 50th percentile; published SD lines come out right', () => {
  near(g.percentile('wfa', 'boys', 0, 3.3464), 50, 0.1, 'boys birth median');
  near(g.percentile('wfa', 'girls', 0, 3.2322), 50, 0.1, 'girls birth median');
  near(g.valueAtZ('wfa', 'boys', 0, 2), 4.4, 0.06, '+2SD weight');
  near(g.valueAtZ('wfa', 'boys', 0, -2), 2.5, 0.06, '-2SD weight');
  near(g.percentile('wfa', 'boys', 0, 4.4), 97.7, 0.6, 'P97.7');
  near(g.valueAtZ('hcfa', 'boys', 0, 0), 34.5, 0.06, 'head median');
  near(g.valueAtZ('hcfa', 'boys', 0, -2), 31.9, 0.06, 'head -2SD');
  near(g.valueAtZ('lhfa', 'boys', 0, 0), 49.9, 0.06, 'length median');
  near(g.valueAtZ('wfa', 'boys', 12, 0), 9.6479, 0.01, '12-month median weight');
});

test('value -> z -> value round-trips at fractional ages', () => {
  for (const m of [0, 0.5, 3.3, 9.9, 24, 47.2]) for (const z of [-2.5, -1, 0, 1.2, 2.8]) {
    near(g.zScore('wfa', 'girls', m, g.valueAtZ('wfa', 'girls', m, z)), z, 1e-9, `round trip m=${m} z=${z}`);
  }
});

test('ages between table months are interpolated; outside the table they are clamped', () => {
  const a = g.valueAtZ('wfa', 'boys', 5, 0), b = g.valueAtZ('wfa', 'boys', 6, 0), mid = g.valueAtZ('wfa', 'boys', 5.5, 0);
  assert(mid > a && mid < b);
  assert.strictEqual(g.valueAtZ('wfa', 'boys', -3, 0), g.valueAtZ('wfa', 'boys', 0, 0));
  assert.strictEqual(g.valueAtZ('wfa', 'boys', 90, 0), g.valueAtZ('wfa', 'boys', 60, 0));
});

test('percentile curves are ordered', () => {
  for (const m of [0, 6, 18, 36]) {
    const vs = g.STANDARD_PERCENTILES.map(p => g.valueAtZ('wfa', 'boys', m, p.z));
    assert.deepStrictEqual([...vs].sort((x, y) => x - y), vs);
  }
});

test('age maths and labels', () => {
  near(g.ageMonths('2025-01-01', '2025-07-02'), 6.0, 0.05, 'six months');
  assert.strictEqual(g.ageMonths('2025-03-14', '2025-03-14'), 0);
  assert.strictEqual(g.ageAtLabel('2025-03-14', '2025-03-15'), '1 day old');
  assert.strictEqual(g.ageAtLabel('2025-03-14', '2025-03-20'), '6 days old');
  assert.strictEqual(g.ageAtLabel('2025-03-14', '2025-04-14'), '4 weeks old');
  assert.strictEqual(g.ageAtLabel('2025-03-14', '2025-09-14'), '6 months old');
  assert.strictEqual(g.ageAtLabel('2025-03-14', '2027-05-14'), '2 years 2 months old');
  assert.strictEqual(g.ageAtLabel('2025-03-14', '2027-05-13'), '2 years 1 month old', 'one day short of the boundary');
  assert.strictEqual(g.ageAtLabel('2025-01-31', '2025-05-30'), '3 months old', 'the day of the month decides whether the month is complete');
  assert.strictEqual(g.ageAtLabel('2025-01-31', '2025-05-31'), '4 months old');
  assert.strictEqual(g.ageAtLabel('2025-03-14', '2025-03-01'), 'before birth');
});

test('ordinals and the normal CDF', () => {
  assert.deepStrictEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 50, 97].map(g.ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '50th', '97th']);
  assert.strictEqual(g.ordinal(0.4), 'below the 1st');
  assert.strictEqual(g.ordinal(99.5), 'above the 99th');
  near(g.normalCdf(0), 0.5, 1e-7, 'cdf(0)');
  near(g.normalCdf(1.96), 0.975, 1e-4, 'cdf(1.96)');
  near(g.normalCdf(-1.0364), 0.15, 5e-4, 'cdf(-1.0364)');
});

test('units: stored in kg/cm, shown in either system', () => {
  const w = g.kgToLbOz(3.5);
  near(w.lb * 16 + w.oz, 3.5 * 35.27396, 0.1, 'lb/oz');
  near(g.lbOzToKg(7, 11), 123 / 35.27396195, 1e-9, '7 lb 11 oz');
  assert.strictEqual(g.formatWeight(3.5, 'metric'), '3.5 kg');
  assert.strictEqual(g.formatLength(50, 'imperial'), '19.7 in');
  assert.strictEqual(g.formatLength(50, 'metric'), '50 cm');
  assert.strictEqual(g.sexFromGender('boy'), 'boys');
  assert.strictEqual(g.sexFromGender('girl'), 'girls');
  assert.strictEqual(g.sexFromGender('prefer not to say'), null);
});
