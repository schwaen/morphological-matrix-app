import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'test-results/', 'playwright-report/', 'dist/'] },
  js.configs.recommended,
  {
    // App-Code: ES-Module, gebündelt von Vite
    files: ['js/**/*.js'],
    languageOptions: { ecmaVersion: 2025, sourceType: 'module', globals: globals.browser },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // Werkzeuge und Tests laufen in Node
    files: ['*.config.js', 'tests/**/*.js', 'scripts/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
  },
];
