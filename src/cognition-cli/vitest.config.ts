import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
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
  },
});
