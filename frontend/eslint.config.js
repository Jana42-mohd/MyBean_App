// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'tests/*', 'scripts/*'],
  },
  {
    rules: {
      // Quotes and apostrophes in React Native <Text> are rendered as-is. This rule exists for HTML on the web.
      'react/no-unescaped-entities': 'off',
    },
  },
]);
