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
      'src/core/orchestrators/genesis.test.ts',
      'src/core/orchestrators/genesis.gc.test.ts',
      'src/core/orchestrators/overlay.test.ts',
      'src/core/pgc/manager.test.ts',
      'src/core/query/query.test.ts',
      'src/core/overlays/lineage/worker.test.ts',
      'src/core/overlays/strategic-coherence/manager.test.ts',
      'src/core/overlays/lineage/interface-lineage.test.ts',
    ],
    dangerouslyIgnoreUnhandledErrors: true,
    maxConcurrency: 1,
    teardownTimeout: 5000,
    hookTimeout: 10000,
  },
});
