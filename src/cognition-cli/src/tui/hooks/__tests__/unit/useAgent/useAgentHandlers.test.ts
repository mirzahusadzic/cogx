import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentHandlers } from '../../../useAgent/useAgentHandlers.js';
import type { AgentState } from '../../../useAgent/useAgentState.js';
import type { UseAgentOptions } from '../../../useAgent/types.js';
import type { UseSessionManagerResult } from '../../../session/useSessionManager.js';
import type { useTokenCount } from '../../../tokens/useTokenCount.js';
import type { UseTurnAnalysisReturn } from '../../../analysis/useTurnAnalysis.js';
import type { UseCompressionResult } from '../../../compression/useCompression.js';

// Mock dependencies
vi.mock('../../../../../sigma/context-injector.js', () => ({
  injectRelevantContext: vi
    .fn()
    .mockResolvedValue({ message: 'Mocked context' }),
}));

vi.mock('../../../../commands/loader.js', () => ({
  expandCommand: vi.fn(),
}));

const mockQuery = vi.fn().mockImplementation(async function* () {
  yield {
    messages: [{ type: 'assistant', content: 'Hello' }],
    tokens: { prompt: 10, completion: 10, total: 20 },
    numTurns: 1,
  };
});

vi.mock('../../sdk/index.js', () => ({
  AgentProviderAdapter: vi.fn().mockImplementation(() => ({
    query: mockQuery,
  })),
  isAuthenticationError: vi.fn().mockReturnValue(false),
  formatAuthError: vi.fn(),
  formatSDKError: vi.fn(),
}));

describe('useAgentHandlers', () => {
  let mockState: AgentState;
  let mockOptions: UseAgentOptions;
  let mockSessionManager: UseSessionManagerResult;
  let mockTokenCounter: ReturnType<typeof useTokenCount>;
  let mockTurnAnalysis: UseTurnAnalysisReturn;
  let mockCompression: UseCompressionResult;
  const mockDebug = vi.fn();
  const mockDebugLog = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockState = {
      setMessages: vi.fn(),
      setIsThinking: vi.fn(),
      setError: vi.fn(),
      setInjectedRecap: vi.fn(),
      setPendingMessageNotification: vi.fn(),
      setShouldAutoRespond: vi.fn(),
      userMessageEmbeddingCache: { current: new Map() },
      currentAdapterRef: { current: null },
      abortedRef: { current: false },
      embedderRef: { current: {} },
      conversationRegistryRef: { current: null },
      recallMcpServerRef: { current: null },
      backgroundTasksMcpServerRef: { current: null },
      agentMessagingMcpServerRef: { current: null },
      crossProjectQueryMcpServerRef: { current: null },
      sigmaTaskUpdateMcpServerRef: { current: null },
      compressionInProgressRef: { current: false },
      currentSessionIdRef: { current: 'session-1' },
      commandsCache: new Map(),
    };

    mockOptions = {
      cwd: '/test',
      provider: 'claude',
    };

    mockSessionManager = {
      state: { anchorId: 'anchor-1' },
      getResumeSessionId: vi.fn().mockReturnValue(null),
      updateSDKSession: vi.fn(),
    };

    mockTokenCounter = {
      count: { total: 0 },
      update: vi.fn(),
      reset: vi.fn(),
    };

    mockTurnAnalysis = {
      analyses: [],
    };

    mockCompression = {
      shouldTrigger: false,
      triggerCompression: vi.fn().mockResolvedValue(undefined),
      state: { triggered: false },
      reset: vi.fn(),
    };
  });

  it('should process assistant messages correctly', () => {
    const { result } = renderHook(() =>
      useAgentHandlers({
        options: mockOptions,
        state: mockState,
        sessionManager: mockSessionManager,
        tokenCounter: mockTokenCounter,
        turnAnalysis: mockTurnAnalysis,
        compression: mockCompression,
        debug: mockDebug,
        debugLog: mockDebugLog,
      })
    );

    act(() => {
      result.current.processAgentMessage({
        type: 'assistant',
        content: 'Hello world',
      });
    });

    expect(mockState.setMessages).toHaveBeenCalled();
  });

  it('should send a message and handle the flow', async () => {
    const { result } = renderHook(() =>
      useAgentHandlers({
        options: mockOptions,
        state: mockState,
        sessionManager: mockSessionManager,
        tokenCounter: mockTokenCounter,
        turnAnalysis: mockTurnAnalysis,
        compression: mockCompression,
        debug: mockDebug,
        debugLog: mockDebugLog,
      })
    );

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(mockState.setIsThinking).toHaveBeenCalledWith(true);
    expect(mockState.setMessages).toHaveBeenCalled();
    // Re-verify after act
  });
});
