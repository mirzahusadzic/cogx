import { defineConfig } from 'vitest/config';

/**
 * Separate Vitest config for tests that import workerpool
 * Uses vmThreads pool to avoid Vite transformation issues
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'vmThreads', // Use VM threads instead of Vite transformation
    poolOptions: {
      vmThreads: {
        useAtomics: true,
      },
    },
    include: [
      'src/commands/audit.test.ts',
      'src/core/algebra/__tests__/query-parser.test.ts',
      'src/core/orchestrators/__tests__/genesis.test.ts',
      'src/core/orchestrators/__tests__/genesis.gc.test.ts',
      'src/core/orchestrators/__tests__/overlay.test.ts',
      'src/core/pgc/__tests__/manager.test.ts',
      'src/core/query/__tests__/query.test.ts',
      'src/core/overlays/lineage/__tests__/worker.test.ts',
      'src/core/overlays/strategic-coherence/__tests__/manager.test.ts',
      'src/core/overlays/lineage/__tests__/interface-lineage.test.ts',
    ],
    dangerouslyIgnoreUnhandledErrors: true,
    globalTeardown: './vitest.global-teardown.ts', // Share same teardown as main config
    maxConcurrency: 1,
    sequence: {
      shuffle: false, // Ensure consistent test order
    },
    teardownTimeout: 10000, // Increase from 5s to 10s
    hookTimeout: 15000, // Increase from 10s to 15s
  },
});
