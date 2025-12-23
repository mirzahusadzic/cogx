import { defineConfig, Plugin } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { coverageConfig } from './vitest.coverage.config';

// Plugin to prevent Vite from analyzing workerpool's worker code
const skipWorkerpoolPlugin = (): Plugin => ({
  name: 'skip-workerpool-worker-analysis',
  resolveId(id) {
    if (id === 'workerpool') {
      return { id: 'workerpool-mock', external: false };
    }
  },
  load(id) {
    if (id === 'workerpool-mock') {
      return `
        export const pool = () => ({ exec: async () => ({}), terminate: async () => {} });
        export default { pool };
      `;
    }
  },
});

// Plugin to prevent Vite from analyzing optional anthropic sdk
const skipAnthropicSdkPlugin = (): Plugin => ({
  name: 'skip-anthropic-sdk-analysis',
  resolveId(id) {
    if (id === '@anthropic-ai/claude-agent-sdk') {
      return { id: 'claude-agent-sdk-mock', external: false };
    }
  },
  load(id) {
    if (id === 'claude-agent-sdk-mock') {
      return `
        export const query = () => ({ 
          interrupt: async () => {},
          [Symbol.asyncIterator]: async function* () {}
        });
        export default { query };
      `;
    }
  },
});

export default defineConfig({
  plugins: [tsconfigPaths(), skipWorkerpoolPlugin(), skipAnthropicSdkPlugin()],
  test: {
    // Exclude workerpool tests - they run in a separate config with vmThreads pool
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
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
      'src/tui/services/__tests__/BackgroundTaskManager.test.ts', // Uses child_process mocking - runs in workerpool config
    ],
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    globalTeardown: './vitest.global-teardown.ts',
    /**
     * Ignore unhandled errors from workerpool/Tinypool incompatibility.
     *
     * workerpool sends a 'ready' message when workers initialize, but Vitest's
     * Tinypool doesn't expect this message format. This is harmless and doesn't
     * affect test execution, but causes test runs to fail.
     *
     * This flag prevents unhandled errors from failing the test run while still
     * logging them for visibility.
     */
    dangerouslyIgnoreUnhandledErrors: true,
    /**
     * LanceDB native cleanup: Force sequential execution to prevent crashes.
     * LanceDB native bindings have race conditions when tests run in parallel,
     * causing segfaults and heap corruption even with proper cleanup delays.
     */
    maxConcurrency: 1, // Force sequential - LanceDB native code is not thread-safe
    testTimeout: 15000, // 15 seconds for individual tests (forked processes are slower)
    teardownTimeout: 5000, // 5 seconds for native cleanup
    hookTimeout: 10000, // 10 seconds for test hooks (beforeEach/afterEach)
    /**
     * ZeroMQ E2E tests: Use forked processes to prevent segfaults.
     * ZeroMQ native bindings can segfault during process cleanup even with
     * proper socket closure. Running in forked processes isolates the cleanup.
     */
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
    pool: 'forks', // Use forks for all tests to prevent native binding segfaults
    coverage: coverageConfig,
  },
});
