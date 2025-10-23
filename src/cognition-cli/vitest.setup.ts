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
