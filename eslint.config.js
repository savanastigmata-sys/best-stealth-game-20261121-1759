// ESLint flat config for Nightshade Gallery (ESLint 10).
// No dependencies: the globals are listed inline, so this works with the
// global install (playwright, eslint, vitest on the VM) as well as a local
// `npm install`. The game itself ships zero dependencies.
export default [
  {
    files: ['game/src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        URLSearchParams: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      // No `curly` rule on purpose: this codebase's consistent style is
      // braceless single-statement guards (`if (x) return;`). Rewriting
      // ~110 of them would churn the sim-verified game for no benefit.
    },
  },
  {
    files: ['tests/**/*.js', 'tests/**/*.mjs', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
        // Referenced inside page.evaluate callbacks, which run in the
        // browser even though this file itself runs in Node.
        window: 'readonly',
        document: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
    },
  },
];
