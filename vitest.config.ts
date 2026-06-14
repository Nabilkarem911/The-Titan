import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.{test,spec}.ts', 'apps/**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.ts',
        '**/migrations/**',
        '**/scripts/**',
      ],
    },
    setupFiles: [],
    reporters: ['verbose'],
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
  resolve: {
    alias: {
      '@titan/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
      '@titan/config': path.resolve(__dirname, 'packages/config/src/index.ts'),
      '@titan/logging': path.resolve(__dirname, 'packages/logging/src/index.ts'),
      '@titan/database': path.resolve(__dirname, 'packages/database/src/index.ts'),
      '@titan/memory': path.resolve(__dirname, 'packages/memory/src/index.ts'),
      '@titan/queue': path.resolve(__dirname, 'packages/queue/src/index.ts'),
      '@titan/auth': path.resolve(__dirname, 'packages/auth/src/index.ts'),
      '@titan/websocket': path.resolve(__dirname, 'packages/websocket/src/index.ts'),
      '@titan/observability': path.resolve(__dirname, 'packages/observability/src/index.ts'),
      '@titan/telemetry': path.resolve(__dirname, 'packages/telemetry/src/index.ts'),
      '@titan/agent-engine': path.resolve(__dirname, 'packages/agent-engine/src/index.ts'),
      '@titan/tools': path.resolve(__dirname, 'packages/tools/src/index.ts'),
    },
  },
});
