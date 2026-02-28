import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentHandlers } from '../../../useAgent/useAgentHandlers.js';
import { createAgentTestWrapper } from '../../helpers/TestWrapper.js';
import type { AgentState } from '../../../useAgent/useAgentState.js';
import type { UseAgentOptions } from '../../../useAgent/types.js';
import type { UseSessionManagerResult } from '../../../session/useSessionManager.js';
import type { useTokenCount } from '../../../tokens/useTokenCount.js';
import type { useSessionTokenCount } from '../../../tokens/useSessionTokenCount.js';
import type { UseTurnAnalysisReturn } from '../../../analysis/useTurnAnalysis.js';
import type { UseCompressionResult } from '../../../compression/useCompression.js';

import { systemLog } from '../../../../../utils/debug-logger.js';

// Mock dependencies
vi.mock('../../../../../utils/debug-logger.js', () => ({
  systemLog: vi.fn(),
}));
vi.mock('../../../../../sigma/context-injector.js', () => ({
  injectRelevantContext: vi
    .fn()
    .mockResolvedValue({ message: 'Mocked context' }),
}));

vi.mock('../../../../commands/loader.js', () => ({
  expandCommand: vi.fn(),
  loadCommands: vi.fn().mockResolvedValue({ commands: new Map() }),
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
      messages: [],
      setMessages: vi.fn(),
      isThinking: false,
      setIsThinking: vi.fn(),
      retryCount: 0,
      setRetryCount: vi.fn(),
      activeModel: undefined,
      setActiveModel: vi.fn(),
      error: null,
      setError: vi.fn(),
      overlayScores: {
        O1_structural: 0,
        O2_security: 0,
        O3_lineage: 0,
        O4_mission: 0,
        O5_operational: 0,
        O6_mathematical: 0,
        O7_strategic: 0,
      },
      setOverlayScores: vi.fn(),
      commandsCache: new Map(),
      setCommandsCache: vi.fn(),
      injectedRecap: null,
      setInjectedRecap: vi.fn(),
      pendingMessageNotification: null,
      setPendingMessageNotification: vi.fn(),
      shouldAutoRespond: false,
      setShouldAutoRespond: vi.fn(),
      workbenchHealth: null,
      setWorkbenchHealth: vi.fn(),
      sigmaTasks: { todos: [] },
      setSigmaTasks: vi.fn(),
      currentAdapterRef: { current: null },
      abortedRef: { current: false },
      embedderRef: { current: null },
      projectRegistryRef: { current: null },
      conversationRegistryRef: { current: null },
      recallMcpServerRef: { current: null },
      backgroundTasksMcpServerRef: { current: null },
      agentMessagingMcpServerRef: { current: null },
      crossProjectQueryMcpServerRef: { current: null },
      sigmaTaskUpdateMcpServerRef: { current: null },
      backgroundTaskManagerRef: { current: null },
      messagesRef: { current: [] },
      userMessageEmbeddingCache: { current: new Map() },
      latticeLoadedRef: { current: new Set() },
      compressionInProgressRef: { current: false },
      lastPersistedTokensRef: { current: 0 },
      autoResponseTimestamps: { current: [] },
      currentSessionIdRef: { current: 'session-1' },
      lastCompressionTimestamp: 0,
      setLastCompressionTimestamp: vi.fn(),
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
      initialize: vi.fn(),
    } as unknown as ReturnType<typeof useTokenCount>;

    mockSessionTokenCounter = {
      count: { total: 0, input: 0, output: 0 },
      update: vi.fn(),
      commit: vi.fn(),
      reset: vi.fn(),
      initialize: vi.fn(),
      getLatestCount: vi
        .fn()
        .mockReturnValue({ total: 0, input: 0, output: 0 }),
    } as unknown as ReturnType<typeof useSessionTokenCount>;

    mockTurnAnalysis = {
      analyses: [],
      stats: {
        totalAnalyzed: 0,
        paradigmShifts: 0,
        routineTurns: 0,
        avgNovelty: 0,
        avgImportance: 0,
      },
    } as unknown as UseTurnAnalysisReturn;

    mockCompression = {
      shouldTrigger: false,
      triggerCompression: vi.fn().mockResolvedValue(undefined),
      state: { triggered: false },
      reset: vi.fn(),
    };
  });

  it('should process assistant messages correctly', async () => {
    const { result } = renderHook(() => useAgentHandlers(), {
      wrapper: createAgentTestWrapper(mockOptions, {
        ...mockState,
        sessionManager: mockSessionManager,
        tokenCounter: mockTokenCounter,
        sessionTokenCounter: mockSessionTokenCounter,
        turnAnalysis: mockTurnAnalysis,
        compression: mockCompression,
        debug: mockDebug,
      } as unknown as AgentState),
    });

    await act(async () => {
      await result.current.processAgentMessage({
        type: 'assistant',
        content: 'Hello world',
      });
    });

    expect(mockState.setMessages).toHaveBeenCalled();
  });

  it('should process tool_result messages correctly', async () => {
    const { result } = renderHook(() => useAgentHandlers(), {
      wrapper: createAgentTestWrapper(mockOptions, {
        ...mockState,
        sessionManager: mockSessionManager,
        tokenCounter: mockTokenCounter,
        sessionTokenCounter: mockSessionTokenCounter,
        turnAnalysis: mockTurnAnalysis,
        compression: mockCompression,
        debug: mockDebug,
      } as unknown as AgentState),
    });

    await act(async () => {
      await result.current.processAgentMessage({
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
    const geminiOptions = {
      ...mockOptions,
      provider: 'gemini',
      semanticThreshold: 50000,
    };

    const debugSpy = vi.fn();

    // We want to test that it uses the PASSED token count (60k), not the state token count (0)
    const { result } = renderHook(() => useAgentHandlers(), {
      wrapper: createAgentTestWrapper(geminiOptions, {
        ...mockState,
        tokenCounter: mockTokenCounter,
        sessionTokenCounter: mockSessionTokenCounter,
        turnAnalysis: mockTurnAnalysis,
        compression: mockCompression,
        debug: debugSpy,
      } as unknown as AgentState),
    });

    await act(async () => {
      // Pass 60000 tokens explicitly
      await result.current.processAgentMessage(
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

    expect(systemLog).toHaveBeenCalledWith(
      'sigma',
      expect.stringContaining('Preemptive semantic compression')
    );

    expect(mockCompression.triggerCompression).toHaveBeenCalledWith(true);
  });

  it('should NOT trigger preemptive compression if token count <= 50k', async () => {
    const geminiOptions = { ...mockOptions, provider: 'gemini' };

    const { result } = renderHook(() => useAgentHandlers(), {
      wrapper: createAgentTestWrapper(geminiOptions, {
        ...mockState,
        tokenCounter: mockTokenCounter,
        sessionTokenCounter: mockSessionTokenCounter,
        turnAnalysis: mockTurnAnalysis,
        compression: mockCompression,
        debug: mockDebug,
      } as unknown as AgentState),
    });

    await act(async () => {
      await result.current.processAgentMessage(
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
    const { result } = renderHook(() => useAgentHandlers(), {
      wrapper: createAgentTestWrapper(mockOptions, {
        ...mockState,
        sessionManager: mockSessionManager,
        tokenCounter: mockTokenCounter,
        sessionTokenCounter: mockSessionTokenCounter,
        turnAnalysis: mockTurnAnalysis,
        compression: mockCompression,
        debug: mockDebug,
      } as unknown as AgentState),
    });

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(mockState.setIsThinking).toHaveBeenCalledWith(true);
    expect(mockState.setMessages).toHaveBeenCalled();
    // Re-verify after act
  });
});
