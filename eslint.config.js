import js from '@eslint/js';
import globals from 'globals';

/**
 * Komponenten, die nur in JSX vorkommen (`<Matrix />`), gelten für no-unused-vars sonst als
 * unbenutzt – diese Regel meldet sie als benutzt (wie react/jsx-uses-vars, ohne das Plugin).
 */
const jsxUsesVars = {
  create: context => ({
    JSXOpeningElement(node) {
      let name = node.name;
      while (name.type === 'JSXMemberExpression') name = name.object;
      if (name.type === 'JSXIdentifier' && /^[A-Z]/.test(name.name)) context.sourceCode.markVariableAsUsed(name.name, node);
    },
  }),
};

export default [
  { ignores: ['node_modules/', 'test-results/', 'playwright-report/', 'dist/'] },
  js.configs.recommended,
  {
    // App-Code: ES-Module, gebündelt von Vite
    files: ['js/**/*.js', 'js/**/*.jsx'],
    languageOptions: {
      ecmaVersion: 2025, sourceType: 'module', globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { local: { rules: { 'jsx-uses-vars': jsxUsesVars } } },
    rules: {
      'local/jsx-uses-vars': 'error',
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
