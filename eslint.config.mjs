import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**', 'assets/js/effects.bundle.js', 'assets/vendor/**']
  },
  js.configs.recommended,
  {
    files: ['assets/js/**/*.js', 'scripts/**/*.mjs', 'tests/e2e/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      'no-console': 'off'
    }
  }
];
