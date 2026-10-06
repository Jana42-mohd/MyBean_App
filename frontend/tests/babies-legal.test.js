const test = require('node:test');
const assert = require('node:assert');
const { build, install } = require('./_mocks');
install({ './supabase': { supabase: {} } });
const babies = build('babies.js');
const legal = build('legal.js');
const info = build('appInfo.js');

test('date typing: digits only, dashes inserted, real dates only', () => {
  assert.strictEqual(babies.formatDateInput('20250314'), '2025-03-14');
  assert.strictEqual(babies.formatDateInput('2025-03-1x4'), '2025-03-14');
  assert.strictEqual(babies.formatDateInput('2025031499999'), '2025-03-14');
  assert.strictEqual(babies.formatDateInput('2025'), '2025');
  assert.strictEqual(babies.isValidDate('2025-03-14'), true);
  assert.strictEqual(babies.isValidDate('2024-02-29'), true);
  assert.strictEqual(babies.isValidDate('2025-02-29'), false);
  assert.strictEqual(babies.isValidDate('2025-13-01'), false);
  assert.strictEqual(babies.isValidDate('2025-3-1'), false);
});

test('counting days to a due date', () => {
  const t = new Date(); const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const plus = n => { const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + n); return ymd(d); };
  assert.strictEqual(babies.daysUntil(plus(0)), 0);
  assert.strictEqual(babies.daysUntil(plus(10)), 10);
  assert.strictEqual(babies.daysUntil(plus(-3)), -3);
});

test('names read naturally', () => {
  assert.strictEqual(babies.babyNames([]), '');
  assert.strictEqual(babies.babyNames([{ name: 'Mia' }]), 'Mia');
  assert.strictEqual(babies.babyNames([{ name: 'Mia' }, { name: 'Leo' }]), 'Mia & Leo');
  assert.strictEqual(babies.babyNames([{ name: 'A' }, { name: 'B' }, { name: 'C' }]), 'A, B & C');
});

test('twins and triplets: new baby copies the shared birth details', () => {
  const first = { name: 'Mia', gender: 'girl', birthDate: '2025-03-14', gestationalAge: 'premature', feedingType: 'mixed', status: 'born', dueDate: '' };
  const second = babies.emptyBaby(first);
  assert.strictEqual(second.name, '');
  assert.strictEqual(second.birthDate, '2025-03-14');
  assert.strictEqual(second.gestationalAge, 'premature');
  assert.strictEqual(second.gender, '', 'gender is NOT copied');
});

test('legal text: every {{PLACEHOLDER}} has a value in appInfo (no typos)', () => {
  const values = {
    APP_NAME: info.APP_NAME, OWNER_NAME: info.OWNER_NAME, SUPPORT_EMAIL: info.SUPPORT_EMAIL, DATA_REGION: info.DATA_REGION,
    EMAIL_PROVIDER: info.EMAIL_PROVIDER, BACKUP_DAYS: info.BACKUP_DAYS, GOVERNING_LAW: info.GOVERNING_LAW, POLICY_UPDATED: info.POLICY_UPDATED,
  };
  for (const doc of [legal.PRIVACY, legal.TERMS]) {
    assert(doc.sections.length > 5);
    for (const s of doc.sections) for (const p of s.body) {
      const filled = legal.fillPlaceholders(p, values);
      assert(!/\{\{\w+\}\}/.test(filled), `unfilled placeholder in "${s.heading}": ${filled}`);
    }
  }
});

test('legal text covers what the app actually does', () => {
  const text = JSON.stringify([legal.PRIVACY, legal.TERMS]).toLowerCase();
  for (const word of ['delete', 'wellbeing', 'household', 'block', 'offline', 'emergency', '18']) assert(text.includes(word), `legal text should mention "${word}"`);
});
