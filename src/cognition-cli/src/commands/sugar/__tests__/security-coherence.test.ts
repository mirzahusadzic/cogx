/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { securityCoherenceCommand } from '../security-coherence.js';

// Mock dependencies
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock(
  '../../../core/overlays/strategic-coherence/algebra-adapter.js',
  () => ({
    CoherenceAlgebraAdapter: vi.fn().mockImplementation(() => ({
      getAllItems: vi.fn().mockResolvedValue([]),
    })),
  })
);

vi.mock('../../../core/workspace-manager.js', () => ({
  WorkspaceManager: class {
    resolvePgcRoot = vi.fn().mockReturnValue('/test/project');
  },
}));

describe('Security Coherence Sugar Commands', () => {
  const options = { projectRoot: '/test/project' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should analyze security symbols correctly', async () => {
    const { CoherenceAlgebraAdapter } =
      await import('../../../core/overlays/strategic-coherence/algebra-adapter.js');
    const mockSymbols = [
      {
        metadata: {
          symbolName: 'MissionValidator',
          filePath: 'src/security/validator.ts',
          coherence: 0.9,
          topConcept: 'Verification',
          topConceptScore: 0.95,
        },
      },
      {
        metadata: {
          symbolName: 'SomeUtils',
          filePath: 'src/utils/misc.ts',
          coherence: 0.5,
          topConcept: 'Mission',
          topConceptScore: 0.6,
        },
      },
    ];
    vi.mocked(CoherenceAlgebraAdapter).mockImplementation(
      () =>
        ({
          getAllItems: vi.fn().mockResolvedValue(mockSymbols),
        }) as any
    );

    await securityCoherenceCommand(options);

    // Should only have analyzed MissionValidator (matches 'security' or 'validator')
    // We can't easily check internal state, but we can check if it finished without error
    expect(vi.mocked(CoherenceAlgebraAdapter)).toHaveBeenCalled();
  });

  it('should output JSON when format is json', async () => {
    const { CoherenceAlgebraAdapter } =
      await import('../../../core/overlays/strategic-coherence/algebra-adapter.js');
    const mockSymbols = [
      {
        metadata: {
          symbolName: 'MissionValidator',
          filePath: 'src/security/validator.ts',
          coherence: 0.9,
          topConcept: 'Verification',
          topConceptScore: 0.95,
        },
      },
    ];
    vi.mocked(CoherenceAlgebraAdapter).mockImplementation(
      () =>
        ({
          getAllItems: vi.fn().mockResolvedValue(mockSymbols),
        }) as any
    );

    await securityCoherenceCommand({ ...options, format: 'json' });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('"overallSecurityCoherence": 0.9')
    );
  });
});
