/**
 * Tests for services/index.ts barrel exports
 *
 * Verifies that all exports from the services module are correctly exposed.
 */

import { describe, it, expect } from 'vitest';

describe('services/index exports', () => {
  it('should export BackgroundTaskManager class', async () => {
    const { BackgroundTaskManager } = await import('../index.js');
    expect(BackgroundTaskManager).toBeDefined();
    expect(typeof BackgroundTaskManager).toBe('function');
  });

  it('should export getBackgroundTaskManager function', async () => {
    const { getBackgroundTaskManager } = await import('../index.js');
    expect(getBackgroundTaskManager).toBeDefined();
    expect(typeof getBackgroundTaskManager).toBe('function');
  });

  it('should export resetBackgroundTaskManager function', async () => {
    const { resetBackgroundTaskManager } = await import('../index.js');
    expect(resetBackgroundTaskManager).toBeDefined();
    expect(typeof resetBackgroundTaskManager).toBe('function');
  });

  it('should have all expected exports', async () => {
    const exports = await import('../index.js');

    // Function exports
    expect(exports.BackgroundTaskManager).toBeDefined();
    expect(exports.getBackgroundTaskManager).toBeDefined();
    expect(exports.resetBackgroundTaskManager).toBeDefined();

    // Type exports are verified by TypeScript compilation
  });
});
