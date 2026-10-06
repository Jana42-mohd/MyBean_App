const test = require('node:test');
const assert = require('node:assert');
const { build } = require('./_mocks');
const { fold, searchCities, cityLabel } = build('cities.js');
const real = require('../assets/data/cities.json');

const data = {
  r: ['Ontario', 'Quebec', ''],
  c: [['Toronto', 0], ['Montréal', 1], ['Ottawa', 0], ['North York', 0], ['Port Toronto', 2], ['Sainte-Anne-de-Bellevue', 1], ['Tor Bay', 2]],
};

test('fold ignores case, accents and punctuation', () => {
  assert.strictEqual(fold('Montréal'), 'montreal');
  assert.strictEqual(fold("St. John's"), 'st john s');
  assert.strictEqual(fold('Zürich'), 'zurich');
  assert.strictEqual(fold('Łódź'), 'lodz');
  assert.strictEqual(fold('  São   Paulo '), 'sao paulo');
});

test('search: prefix first, then a word that starts with it; names that only contain it are the last resort; bigger cities first', () => {
  assert.deepStrictEqual(searchCities(data, 'tor').map(c => c.name), ['Toronto', 'Tor Bay', 'Port Toronto']);
  assert.deepStrictEqual(searchCities(data, 'montreal').map(c => c.name), ['Montréal']);
  assert.deepStrictEqual(searchCities(data, 'MONTRÉAL').map(c => c.name), ['Montréal']);
  assert.deepStrictEqual(searchCities(data, 'anne').map(c => c.name), ['Sainte-Anne-de-Bellevue'], 'found inside a name when nothing better exists');
  assert.deepStrictEqual(searchCities({ r: [''], c: [['Victoria', 0], ['Toronto', 0]] }, 'tor').map(c => c.name), ['Toronto'], 'a name that only contains it is left out when there is a real match');
  assert.deepStrictEqual(searchCities(data, 'zzz'), []);
});

test('an empty search lists the biggest cities, the limit is respected, missing data is empty', () => {
  assert.deepStrictEqual(searchCities(data, '', 2).map(c => c.name), ['Toronto', 'Montréal']);
  assert.strictEqual(searchCities(data, 'o', 3).length, 3);
  assert.deepStrictEqual(searchCities(null, 'x'), []);
});

test('the label includes the region when there is one', () => {
  assert.strictEqual(cityLabel({ name: 'Toronto', region: 'Ontario' }), 'Toronto, Ontario');
  assert.strictEqual(cityLabel({ name: 'Tor Bay', region: '' }), 'Tor Bay');
});

test('the real city list: every country has regions and cities, and the usual places are found', () => {
  assert(Object.keys(real).length > 200);
  for (const [cc, d] of Object.entries(real)) {
    assert(/^[A-Z]{2}$/.test(cc), cc);
    assert(d.c.length > 0 && d.c.every(([n, r]) => typeof n === 'string' && n.length > 0 && r >= 0 && r < d.r.length), cc);
  }
  const names = (cc, q) => searchCities(real[cc], q, 10).map(cityLabel);
  assert(names('CA', 'toronto').includes('Toronto, Ontario'));
  assert(names('CA', 'montreal').includes('Montréal, Quebec'));
  assert(names('US', 'springfield').length >= 3, 'several Springfields to choose from');
  assert(names('US', 'springfield').every(l => l.includes(',')), 'each one has its state');
  assert(names('DE', 'munchen').length > 0 || names('DE', 'munich').length > 0, 'Munich is found');
  assert(real.CA.c.length > 300 && real.US.c.length > 3000);
});
