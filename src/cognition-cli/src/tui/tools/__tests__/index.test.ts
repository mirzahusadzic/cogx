/**
 * Tests for tools/index.ts barrel exports
 *
 * Verifies that all exports from the tools module are correctly exposed.
 */

import { describe, it, expect } from 'vitest';

describe('tools/index exports', () => {
  it('should export createBackgroundTasksMcpServer function', async () => {
    const { createBackgroundTasksMcpServer } = await import('../index.js');
    expect(createBackgroundTasksMcpServer).toBeDefined();
    expect(typeof createBackgroundTasksMcpServer).toBe('function');
  });

  it('should export createCrossProjectQueryMcpServer function', async () => {
    const { createCrossProjectQueryMcpServer } = await import('../index.js');
    expect(createCrossProjectQueryMcpServer).toBeDefined();
    expect(typeof createCrossProjectQueryMcpServer).toBe('function');
  });

  it('should have all expected exports', async () => {
    const exports = await import('../index.js');

    // Verify all exports are defined
    expect(exports.createBackgroundTasksMcpServer).toBeDefined();
    expect(exports.createCrossProjectQueryMcpServer).toBeDefined();

    // Verify exports match the source modules
    const { createBackgroundTasksMcpServer: bgTasksFn } =
      await import('../background-tasks-tool.js');
    const { createCrossProjectQueryMcpServer: crossQueryFn } =
      await import('../cross-project-query-tool.js');

    expect(exports.createBackgroundTasksMcpServer).toBe(bgTasksFn);
    expect(exports.createCrossProjectQueryMcpServer).toBe(crossQueryFn);
  });
});
