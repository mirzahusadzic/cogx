import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';

describe('pr-analyze command', () => {
  beforeEach(() => {
    chalk.level = 0;
    vi.clearAllMocks();
    vi.resetModules();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call PRAnalyzer with correct options', async () => {
    const mockAnalyze = vi.fn().mockResolvedValue({
      structural: {
        filesChanged: 1,
        modulesAdded: [],
        functionsModified: [],
        classesUpdated: [],
      },
      security: { riskLevel: 'LOW', threats: [] },
      blastRadius: {
        directConsumers: 0,
        transitiveImpact: 0,
        criticalPaths: [],
      },
      missionAlignment: {
        aligned: true,
        confidence: 100,
        matchingConcepts: [],
      },
      coherenceImpact: {
        trend: 'STABLE',
        before: { alignedCount: 0, driftedCount: 0 },
        after: { alignedCount: 0, driftedCount: 0 },
        delta: { alignedDelta: 0 },
      },
      recommendations: [],
      mergeable: true,
      riskScore: 0,
    });

    vi.doMock('../../core/orchestrators/pr-analyzer.js', () => ({
      PRAnalyzer: vi.fn().mockImplementation(() => ({
        analyze: mockAnalyze,
      })),
    }));

    const { analyzePRImpact } = await import('../pr-analyze.js');
    const mockPGCManager = vi.fn().mockImplementation(() => ({}));

    await analyzePRImpact(
      { branch: 'test-branch', maxDepth: '5' },
      mockPGCManager
    );

    expect(mockAnalyze).toHaveBeenCalledWith({
      branch: 'test-branch',
      maxDepth: 5,
    });
  });

  it('should output JSON when json option is true', async () => {
    const analysisResult = { test: 'result' };
    const mockAnalyze = vi.fn().mockResolvedValue(analysisResult);

    vi.doMock('../../core/orchestrators/pr-analyzer.js', () => ({
      PRAnalyzer: vi.fn().mockImplementation(() => ({
        analyze: mockAnalyze,
      })),
    }));

    const { analyzePRImpact } = await import('../pr-analyze.js');
    const mockPGCManager = vi.fn().mockImplementation(() => ({}));
    const consoleLogSpy = vi.spyOn(console, 'log');

    await analyzePRImpact({ json: true }, mockPGCManager);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify(analysisResult, null, 2)
    );
  });
});
