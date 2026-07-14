import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'no-undef': 'off',
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/await-thenable': 'warn',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { arguments: false, properties: false } }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'object-shorthand': 'error',
      'preserve-caught-error': 'off',
      'no-control-regex': 'off',
      'no-useless-escape': 'off',
      'no-useless-assignment': 'off',
      'no-constant-binary-expression': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      '@typescript-eslint/no-require-imports': 'warn',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      'docker/',
      'logs/',
      'scripts/',
      'tmp/',
      'apps/dashboard/',
      'apps/desktop/',
      'apps/cli/',
      '**/*.config.js',
      '**/*.config.ts',
      'test-*.js',
      'test-*.cjs',
      'smoke-*.*',
      '**/*.cjs',
      '**/*.d.ts',
      '**/*.mjs',
    ],
  },
];
