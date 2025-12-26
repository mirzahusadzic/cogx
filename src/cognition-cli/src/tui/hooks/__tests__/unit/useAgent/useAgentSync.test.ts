import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAgentSync } from '../../../useAgent/useAgentSync.js';
import type { AgentState } from '../../../useAgent/useAgentState.js';
import type { UseSessionManagerResult } from '../../../session/useSessionManager.js';
import type { UseTurnAnalysisReturn } from '../../../analysis/useTurnAnalysis.js';

// Mock dependencies
vi.mock('../../../../../sigma/lattice-reconstructor.js', () => ({
  rebuildTurnAnalysesFromLanceDB: vi.fn().mockResolvedValue([]),
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn(),
  },
}));

describe('useAgentSync', () => {
  let mockState: AgentState;
  let mockSessionManager: UseSessionManagerResult;
  let mockTurnAnalysis: UseTurnAnalysisReturn;
  const mockDebug = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockState = {
      latticeLoadedRef: { current: new Set() },
      setInjectedRecap: vi.fn(),
      setMessages: vi.fn(),
      conversationRegistryRef: {
        current: {
          setCurrentSession: vi.fn(),
          flushAll: vi.fn().mockResolvedValue(undefined),
        },
      },
      lastPersistedTokensRef: { current: 0 },
      setOverlayScores: vi.fn(),
      currentSessionIdRef: { current: 'session-1' },
      tokenCounter: { count: { total: 0 } },
    };

    mockSessionManager = {
      getResumeSessionId: vi.fn().mockReturnValue(null),
      updateTokens: vi.fn(),
    };

    mockTurnAnalysis = {
      setAnalyses: vi.fn(),
      stats: { totalAnalyzed: 0 },
    };
  });

  it('should flush overlays on unmount', () => {
    const { unmount } = renderHook(() =>
      useAgentSync(
        mockState,
        mockSessionManager,
        mockTurnAnalysis,
        '/test',
        'anchor-1',
        mockDebug
      )
    );

    unmount();

    expect(
      mockState.conversationRegistryRef.current.flushAll
    ).toHaveBeenCalledWith('session-1');
  });

  it('should update tokens when they change', () => {
    const { rerender } = renderHook(() =>
      useAgentSync(
        mockState,
        mockSessionManager,
        mockTurnAnalysis,
        '/test',
        'anchor-1',
        mockDebug
      )
    );

    mockState.tokenCounter.count = { total: 100 };
    rerender();

    expect(mockSessionManager.updateTokens).toHaveBeenCalledWith({
      total: 100,
    });
    expect(mockState.lastPersistedTokensRef.current).toBe(100);
  });

  it('should not update tokens if they havent changed', () => {
    mockState.tokenCounter.count.total = 100;
    mockState.lastPersistedTokensRef.current = 100;

    renderHook(() =>
      useAgentSync(
        mockState,
        mockSessionManager,
        mockTurnAnalysis,
        '/test',
        'anchor-1',
        mockDebug
      )
    );

    expect(mockSessionManager.updateTokens).not.toHaveBeenCalled();
  });
});
