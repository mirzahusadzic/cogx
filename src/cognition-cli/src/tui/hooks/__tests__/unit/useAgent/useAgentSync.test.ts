import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAgentSync } from '../../../useAgent/useAgentSync.js';
import {
  createAgentTestWrapper,
  createMockAgentState,
} from '../../helpers/TestWrapper.js';
import type { AgentState } from '../../../useAgent/useAgentState.js';
import type { UseSessionManagerResult } from '../../../session/useSessionManager.js';
import type { UseTurnAnalysisReturn } from '../../../analysis/useTurnAnalysis.js';
import type { UseAgentOptions } from '../../../useAgent/types.js';
import type { useTokenCount } from '../../../tokens/useTokenCount.js';
import type { useSessionTokenCount } from '../../../tokens/useSessionTokenCount.js';
import { ConversationOverlayRegistry } from '../../../../../sigma/conversation-registry.js';

// Mock dependencies
vi.mock('../../../../../sigma/conversation-registry.js', () => ({
  ConversationOverlayRegistry: vi.fn().mockImplementation(() => ({
    setCurrentSession: vi.fn(),
    flushAll: vi.fn().mockResolvedValue(undefined),
  })),
}));

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
  let mockOptions: UseAgentOptions;
  let mockSessionManager: UseSessionManagerResult;
  let mockTurnAnalysis: UseTurnAnalysisReturn;
  let mockTokenCounter: ReturnType<typeof useTokenCount>;
  let mockSessionTokenCounter: ReturnType<typeof useSessionTokenCount>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockState = createMockAgentState({
      conversationRegistryRef: {
        current: {
          setCurrentSession: vi.fn(),
          flushAll: vi.fn().mockResolvedValue(undefined),
        } as unknown as ConversationOverlayRegistry,
      },
    });

    mockOptions = {
      cwd: '/test',
      provider: 'claude',
    };

    mockTokenCounter = {
      count: { total: 0 },
      update: vi.fn(),
      initialize: vi.fn(),
    } as unknown as ReturnType<typeof useTokenCount>;

    mockSessionTokenCounter = {
      count: { total: 0 },
      update: vi.fn(),
      initialize: vi.fn(),
    } as unknown as ReturnType<typeof useSessionTokenCount>;

    mockSessionManager = {
      state: { anchorId: 'anchor-1', sessionId: 'session-1' },
      getResumeSessionId: vi.fn().mockReturnValue(null),
      updateTokens: vi.fn(),
      updateSessionTokens: vi.fn(),
      updateTasks: vi.fn(),
    } as unknown as UseSessionManagerResult;

    mockTurnAnalysis = {
      setAnalyses: vi.fn(),
      stats: { totalAnalyzed: 0 },
    } as unknown as UseTurnAnalysisReturn;
  });

  it('should flush overlays on unmount', () => {
    const { unmount } = renderHook(() => useAgentSync(), {
      wrapper: createAgentTestWrapper(mockOptions, {
        ...mockState,
        sessionManager: mockSessionManager,
        turnAnalysis: mockTurnAnalysis,
        tokenCounter: mockTokenCounter,
        sessionTokenCounter: mockSessionTokenCounter,
      } as unknown as AgentState),
    });

    unmount();

    expect(
      mockState.conversationRegistryRef.current!.flushAll
    ).toHaveBeenCalledWith('session-1');
  });

  it('should update tokens when they change', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockTokenCounter as any).count = { total: 100 };

    renderHook(() => useAgentSync(), {
      wrapper: createAgentTestWrapper(mockOptions, {
        ...mockState,
        sessionManager: mockSessionManager,
        turnAnalysis: mockTurnAnalysis,
        tokenCounter: mockTokenCounter,
        sessionTokenCounter: mockSessionTokenCounter,
      } as unknown as AgentState),
    });

    expect(mockSessionManager.updateTokens).toHaveBeenCalledWith({
      total: 100,
    });
    expect(mockState.lastPersistedTokensRef.current).toBe(100);
  });

  it('should not update tokens if they havent changed', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockTokenCounter as any).count = { total: 100 };
    mockState.lastPersistedTokensRef.current = 100;

    renderHook(() => useAgentSync(), {
      wrapper: createAgentTestWrapper(mockOptions, {
        ...mockState,
        sessionManager: mockSessionManager,
        turnAnalysis: mockTurnAnalysis,
        tokenCounter: mockTokenCounter,
        sessionTokenCounter: mockSessionTokenCounter,
      } as unknown as AgentState),
    });

    expect(mockSessionManager.updateTokens).not.toHaveBeenCalled();
  });
});
