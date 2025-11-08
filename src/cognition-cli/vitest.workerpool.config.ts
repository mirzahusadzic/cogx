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
    maxConcurrency: 1,
    teardownTimeout: 5000,
    hookTimeout: 10000,
  },
});
