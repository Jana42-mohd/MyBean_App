const test = require('node:test');
const assert = require('node:assert');
const { build, install, fakeAsyncStorage } = require('./_mocks');

const storage = fakeAsyncStorage();
install({
  '@react-native-async-storage/async-storage': storage.module,
  'react-native': { useColorScheme: () => 'light' },
  react: { useState: v => [v, () => {}], useEffect: () => {}, useMemo: f => f() }, // hooks are not exercised here, only the palette and the rules
});
const theme = build('theme.js');

const lum = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// text on its background must stay readable in BOTH themes (WCAG AA is 4.5 for normal text)
const PAIRS = [
  ['text', 'bg', 4.5], ['text', 'card', 4.5], ['heading', 'bg', 4.5], ['muted', 'bg', 4.5], ['muted', 'card', 4.5], ['muted', 'cardAlt', 4.5],
  ['onAccent', 'accent', 4.5], ['accentText', 'card', 4.5], ['accentText', 'bg', 4.5], ['link', 'card', 4.5], ['link', 'bg', 4.5],
  ['onAccent', 'link', 4.5], ['onTint', 'tint', 3.0], ['danger', 'card', 4.5], ['danger', 'bg', 4.5], ['text', 'errorBg', 4.5],
  ['success', 'card', 3.0], ['sleep', 'card', 3.0], ['wet', 'card', 3.0], ['dirty', 'card', 3.0],
];
for (const [name, p] of [['dark', theme.DARK], ['light', theme.LIGHT]]) {
  test(`${name} palette: text and accents are readable on their surfaces`, () => {
    const failures = [];
    for (const [fg, bg, min] of PAIRS) {
      const r = ratio(p[fg], p[bg]);
      if (r < min) failures.push(`${fg} on ${bg}: ${r.toFixed(2)} (needs ${min})`);
    }
    assert.deepStrictEqual(failures, []);
  });
}

test('both palettes define exactly the same roles', () => {
  assert.deepStrictEqual(Object.keys(theme.LIGHT).sort(), Object.keys(theme.DARK).sort());
  assert.strictEqual(theme.LIGHT.scheme, 'light');
  assert.strictEqual(theme.DARK.scheme, 'dark');
});

test('Auto follows the phone, a choice wins, and unknown means dark (the app is dark-first)', () => {
  assert.strictEqual(theme.resolveScheme('system', 'light'), 'light');
  assert.strictEqual(theme.resolveScheme('system', 'dark'), 'dark');
  assert.strictEqual(theme.resolveScheme('system', null), 'dark');
  assert.strictEqual(theme.resolveScheme('light', 'dark'), 'light');
  assert.strictEqual(theme.resolveScheme('dark', 'light'), 'dark');
});

test('the saved choice is restored, and a garbage value is ignored', async () => {
  await theme.setThemePreference('light');
  assert.strictEqual(storage.store.themePreference, 'light');
  await theme.setThemePreference('system');
  storage.store.themePreference = 'purple';
  await theme.loadThemePreference();
  storage.store.themePreference = 'dark';
  await theme.loadThemePreference();
  assert.strictEqual(storage.store.themePreference, 'dark');
});
