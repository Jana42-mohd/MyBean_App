const test = require('node:test');
const assert = require('node:assert');
const { build, install, fakeAsyncStorage } = require('./_mocks');
const fake = fakeAsyncStorage();
install({ '@react-native-async-storage/async-storage': fake.module });
const h = build('helplines.js');
const { COUNTRIES } = build('countries.js');

test('every country with help is a real country code, and every number is dialable', () => {
  const codes = new Set(COUNTRIES.map(c => c.code));
  for (const code of h.helpCountries()) {
    assert(codes.has(code), `${code} is not in the country list`);
    const help = h.helpFor(code);
    assert.match(help.emergency.phone, /^\d{2,5}$/, `${code} emergency number`);
    assert(help.emergency.display, `${code} emergency display`);
    for (const l of help.lines) {
      assert.match(l.phone, /^\+?\d{3,15}$/, `${code} ${l.name}: digits only`);
      assert(l.name.trim() && l.display.trim(), `${code}: name and display text`);
    }
    assert.strictEqual(new Set(help.lines.map(l => l.phone)).size, help.lines.length, `${code}: no number listed twice`);
  }
});

test('the countries the app is used in have their own real lines', () => {
  const phones = code => h.helpFor(code).lines.map(l => l.phone);
  assert(phones('CA').includes('988'));
  assert(phones('US').includes('988') && phones('US').includes('18338526262'));
  assert(phones('GB').includes('116123') && phones('GB').includes('08081961776'));
  assert(phones('IE').includes('116123'));
  assert(phones('AU').includes('1300726306'));
  assert(phones('NZ').includes('1737'));
  assert.strictEqual(h.helpFor('GB').emergency.phone, '999');
  assert.strictEqual(h.helpFor('AU').emergency.phone, '000');
});

test('the US 9-8-8 line is not shown to someone in the UK, and 112 is offered across the EU', () => {
  assert(!h.helpFor('GB').lines.some(l => l.phone === '988'));
  assert.strictEqual(h.helpFor('DE').emergency.phone, '112');
  assert.strictEqual(h.helpFor('de').emergency.phone, '112', 'lower case is fine');
});

test('a country we have nothing reliable for gets null (the screen then shows the directory), never a guess', () => {
  assert.strictEqual(h.helpFor('JP'), null);
  assert.strictEqual(h.helpFor(null), null);
  assert.strictEqual(h.helpFor(''), null);
});

test('the phone-only country choice: saved, wins over the place, can be cleared, and junk is ignored', async () => {
  assert.strictEqual(await h.getHelpCountryChoice(), null);
  await h.setHelpCountryChoice('AU');
  assert.strictEqual(await h.getHelpCountryChoice(), 'AU');
  assert.strictEqual(h.pickHelpCountry('AU', 'CA'), 'AU');
  assert.strictEqual(h.pickHelpCountry(null, 'CA'), 'CA');
  assert.strictEqual(h.pickHelpCountry(null, null), null);
  fake.store.helpCountry = 'not a code';
  assert.strictEqual(await h.getHelpCountryChoice(), null);
  await h.setHelpCountryChoice(null);
  assert(!('helpCountry' in fake.store));
});
