import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  {
    // App-Code: klassische Browser-Skripte ohne Build. Sie teilen sich den globalen
    // Gültigkeitsbereich (Reihenfolge in index.html); Bezüge zwischen den Dateien
    // prüft die Typprüfung (tsc), daher hier kein no-undef und nur lokale Unbenutzt-Prüfung.
    files: ['js/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: globals.browser },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': ['error', { vars: 'local', args: 'none', caughtErrors: 'none' }],
      'no-redeclare': 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // Werkzeuge und Tests laufen in Node
    files: ['*.config.js', 'tests/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
  },
];
