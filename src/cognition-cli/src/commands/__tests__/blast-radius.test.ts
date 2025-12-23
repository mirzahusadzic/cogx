import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runBlastRadius } from '../blast-radius.js';
import type { PGCManager } from '../../core/pgc/manager.js';
import type { GraphTraversal } from '../../core/graph/traversal.js';
import type { BlastRadiusResult } from '../../core/types/graph.js';
import chalk from 'chalk';

describe('runBlastRadius', () => {
  const mockResult: BlastRadiusResult = {
    symbol: 'testSymbol',
    filePath: 'src/test.ts',
    consumers: [
      {
        symbol: 'consumer1',
        filePath: 'src/c1.ts',
        type: 'function',
        architecturalRole: 'core',
      },
    ],
    dependencies: [
      {
        symbol: 'dep1',
        filePath: 'src/d1.ts',
        type: 'class',
        architecturalRole: 'utility',
      },
    ],
    metrics: {
      totalImpacted: 2,
      maxConsumerDepth: 1,
      maxDependencyDepth: 1,
      criticalPaths: [],
    },
  };

  let mockTraversal: GraphTraversal;
  const mockPGC = {} as PGCManager;

  beforeEach(() => {
    // Disable chalk colors for consistent test assertions
    chalk.level = 0;
    mockTraversal = {
      getBlastRadius: vi.fn().mockResolvedValue(mockResult),
    } as unknown as GraphTraversal;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should analyze blast radius and output human-readable results', async () => {
    await runBlastRadius(
      'testSymbol',
      {
        maxDepth: '3',
        direction: 'both',
        transitive: true,
      },
      mockPGC,
      mockTraversal
    );

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Blast Radius Analysis: testSymbol')
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Symbol found: src/test.ts')
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Total impacted: 2')
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Consumers (1)')
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Dependencies (1)')
    );
  });

  it('should output JSON when requested', async () => {
    await runBlastRadius(
      'testSymbol',
      {
        maxDepth: '3',
        direction: 'both',
        json: true,
        transitive: true,
      },
      mockPGC,
      mockTraversal
    );

    const logCalls = vi.mocked(console.log).mock.calls;
    const lastCall = logCalls[logCalls.length - 1][0] as string;
    const parsed = JSON.parse(lastCall);
    expect(parsed.symbol).toBe('testSymbol');
    expect(parsed.metrics.totalImpacted).toBe(2);
  });

  it('should handle only up direction', async () => {
    await runBlastRadius(
      'testSymbol',
      {
        maxDepth: '3',
        direction: 'up',
        transitive: true,
      },
      mockPGC,
      mockTraversal
    );

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Consumers (1)')
    );
    expect(console.log).not.toHaveBeenCalledWith(
      expect.stringContaining('Dependencies (1)')
    );
  });
});
