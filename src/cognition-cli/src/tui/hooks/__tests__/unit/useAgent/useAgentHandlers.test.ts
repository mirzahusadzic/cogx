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
  let mockSessionTokenCounter: ReturnType<typeof useTokenCount>;
  let mockTurnAnalysis: UseTurnAnalysisReturn;
  let mockCompression: UseCompressionResult;
  const mockDebug = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockState = {
      setMessages: vi.fn(),
      setIsThinking: vi.fn(),
      setRetryCount: vi.fn(),
      setActiveModel: vi.fn(),
      setError: vi.fn(),
      setInjectedRecap: vi.fn(),
      setPendingMessageNotification: vi.fn(),
      setShouldAutoRespond: vi.fn(),
      setSigmaTasks: vi.fn(),
      setOverlayScores: vi.fn(),
      setWorkbenchHealth: vi.fn(),
      setLastCompressionTimestamp: vi.fn(),
      lastCompressionTimestamp: 0,
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
      projectRegistryRef: { current: null },
      backgroundTaskManagerRef: { current: null },
      messagesRef: { current: [] },
      latticeLoadedRef: { current: false },
      lastPersistedTokensRef: { current: 0 },
      autoResponseTimestamps: { current: [] },
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
      count: { total: 0, input: 0, output: 0 },
      update: vi.fn(),
      reset: vi.fn(),
    };

    mockSessionTokenCounter = {
      count: { total: 0, input: 0, output: 0 },
      update: vi.fn(),
      commit: vi.fn(),
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
        sessionTokenCounter: mockSessionTokenCounter,
        turnAnalysis: mockTurnAnalysis,
        compression: mockCompression,
        debug: mockDebug,
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

  it('should process tool_result messages correctly', () => {
    const { result } = renderHook(() =>
      useAgentHandlers({
        options: mockOptions,
        state: mockState,
        sessionManager: mockSessionManager,
        tokenCounter: mockTokenCounter,
        sessionTokenCounter: mockSessionTokenCounter,
        turnAnalysis: mockTurnAnalysis,
        compression: mockCompression,
        debug: mockDebug,
      })
    );

    act(() => {
      result.current.processAgentMessage({
        type: 'tool_result',
        toolName: 'read_file',
        content: 'file content',
      });
    });

    expect(mockState.setMessages).toHaveBeenCalled();
    const call = vi.mocked(mockState.setMessages).mock.calls[0][0];
    const newMessages = call([]);
    expect(newMessages[0].type).toBe('tool_progress');
    expect(newMessages[0].content).toContain('file content');
  });

  it('should trigger preemptive compression for Gemini with SigmaTaskUpdate when token count > 50k', async () => {
    // Setup Gemini provider and high token count
    const geminiOptions = { ...mockOptions, provider: 'gemini' };

    // We want to test that it uses the PASSED token count (60k), not the state token count (0)
    const { result } = renderHook(() =>
      useAgentHandlers({
        options: geminiOptions,
        state: mockState,
        sessionManager: mockSessionManager,
        tokenCounter: mockTokenCounter, // count.total is 0
        turnAnalysis: mockTurnAnalysis,
        compression: mockCompression,
        debug: mockDebug,
      })
    );

    await act(async () => {
      // Pass 60000 tokens explicitly
      result.current.processAgentMessage(
        {
          type: 'assistant',
          content: [
            {
              type: 'tool_use',
              name: 'SigmaTaskUpdate',
              input: { todos: [] },
            },
          ],
        },
        60000 // currentTokens > 50000
      );
    });

    expect(mockDebug).toHaveBeenCalledWith(
      expect.stringContaining('Preemptive semantic compression')
    );
    expect(mockCompression.triggerCompression).toHaveBeenCalledWith(true);
  });

  it('should NOT trigger preemptive compression if token count <= 50k', async () => {
    const geminiOptions = { ...mockOptions, provider: 'gemini' };

    const { result } = renderHook(() =>
      useAgentHandlers({
        options: geminiOptions,
        state: mockState,
        sessionManager: mockSessionManager,
        tokenCounter: mockTokenCounter,
        sessionTokenCounter: mockSessionTokenCounter,
        turnAnalysis: mockTurnAnalysis,
        compression: mockCompression,
        debug: mockDebug,
      })
    );

    await act(async () => {
      result.current.processAgentMessage(
        {
          type: 'assistant',
          content: [
            {
              type: 'tool_use',
              name: 'SigmaTaskUpdate',
              input: { todos: [] },
            },
          ],
        },
        40000 // currentTokens <= 50000
      );
    });

    expect(mockCompression.triggerCompression).not.toHaveBeenCalled();
  });

  it('should send a message and handle the flow', async () => {
    const { result } = renderHook(() =>
      useAgentHandlers({
        options: mockOptions,
        state: mockState,
        sessionManager: mockSessionManager,
        tokenCounter: mockTokenCounter,
        sessionTokenCounter: mockSessionTokenCounter,
        turnAnalysis: mockTurnAnalysis,
        compression: mockCompression,
        debug: mockDebug,
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
