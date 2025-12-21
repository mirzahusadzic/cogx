import type { CoverageOptions } from 'vitest';

/**
 * Shared coverage configuration for all Vitest test runners.
 *
 * This config is imported by both vitest.config.ts and vitest.workerpool.config.ts
 * to ensure consistent coverage reporting across different test pools.
 */
export const coverageConfig: CoverageOptions = {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  include: ['src/**'],
  exclude: [
    'node_modules/**',
    'dist/**',
    '**/*.test.ts',
    'vitest.setup.ts',
    'vitest.config.ts',
    'vitest.workerpool.config.ts',
    'vitest.global-teardown.ts',
    'build-worker.js',
  ],
};
