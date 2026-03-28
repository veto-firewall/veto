/** @type {import('eslint').Linter.Config[]} */
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: [
      'node_modules/**',
      'tests/**',
      'dist/**',
      'assets/**',
      '*.min.js',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs['flat/recommended'],

  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.json',
      },
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        Buffer: 'readonly',
      },
    },
    rules: {
      // Prefer TS extension rule over base rule.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_|^e$',
          varsIgnorePattern: '^_',
        },
      ],

      // Security & web-extension constraints.
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'prefer-promise-reject-errors': 'error',
      'no-debugger': 'error',
      'no-restricted-globals': [
        'error',
        {
          name: 'chrome',
          message: 'Use browser instead for Firefox extensions',
        },
      ],

      // Project-specific guardrails.
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-namespace': 'error',
      '@typescript-eslint/no-floating-promises': [
        'warn',
        {
          ignoreVoid: true,
        },
      ],
      'no-warning-comments': [
        'warn',
        {
          terms: ['todo', 'fixme', 'xxx'],
          location: 'anywhere',
        },
      ],
      complexity: ['warn', 22],
      'max-depth': ['warn', 4],
      'max-lines': ['warn', 800],
      'max-lines-per-function': ['warn', 120],
      'max-params': ['warn', 5],
      'max-nested-callbacks': ['warn', 3],
      'no-case-declarations': 'warn',
    },
  },

  {
    files: ['eslint.config.mjs'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2022,
      globals: {
        __dirname: 'readonly',
        process: 'readonly',
      },
    },
  },

  {
    files: [
      'webpack.config.js',
      'webpack.config.cjs',
      '*.config.js',
      '*.config.cjs',
    ],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        module: 'readonly',
        require: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Keep last: disables formatting rules that conflict with Prettier.
  prettierConfig,
];
