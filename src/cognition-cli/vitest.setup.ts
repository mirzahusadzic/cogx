/**
 * Vitest Test Setup
 *
 * Worker pools are mocked in tests that use GenesisOrchestrator to prevent
 * real worker creation and cleanup timing issues.
 *
 * See:
 * - src/core/orchestrators/genesis.test.ts
 * - src/core/pgc/manager.test.ts
 */

import { vi } from 'vitest';

// Global mock for workerpool to prevent Vite worker parsing errors
vi.mock('workerpool', () => ({
  default: {
    pool: vi.fn(() => ({
      exec: vi.fn(),
      terminate: vi.fn(),
    })),
    worker: vi.fn(),
  },
  pool: vi.fn(() => ({
    exec: vi.fn(),
    terminate: vi.fn(),
  })),
  worker: vi.fn(),
}));
