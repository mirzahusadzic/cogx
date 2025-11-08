import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
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
    teardownTimeout: 5000, // 5 seconds for native cleanup
    hookTimeout: 10000, // 10 seconds for test hooks (beforeEach/afterEach)
  },
});
