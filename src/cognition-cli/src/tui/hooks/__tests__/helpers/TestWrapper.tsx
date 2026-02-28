import React from 'react';
import { vi } from 'vitest';
import { AgentProvider } from '../../../contexts/AgentContext.js';
import type { UseAgentOptions } from '../../useAgent/types.js';
import type { AgentState } from '../../useAgent/useAgentState.js';
import type { UseSessionManagerResult } from '../../session/useSessionManager.js';
import type { useTokenCount } from '../../tokens/useTokenCount.js';
import type { useSessionTokenCount } from '../../tokens/useSessionTokenCount.js';
import type { UseTurnAnalysisReturn } from '../../analysis/useTurnAnalysis.js';
import type { UseCompressionResult } from '../../compression/useCompression.js';

/**
 * Creates a mock AgentState with all required fields
 */
export const createMockAgentState = (
  overrides: Partial<AgentState> = {}
): AgentState => {
  return {
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
    ...overrides,
  } as AgentState;
};

export const createAgentTestWrapper = (
  options: UseAgentOptions,
  state: AgentState & {
    sessionManager?: UseSessionManagerResult;
    tokenCounter?: ReturnType<typeof useTokenCount>;
    sessionTokenCounter?: ReturnType<typeof useSessionTokenCount>;
    turnAnalysis?: UseTurnAnalysisReturn;
    compression?: UseCompressionResult;
  }
) => {
  const {
    sessionManager,
    tokenCounter,
    sessionTokenCounter,
    turnAnalysis,
    compression,
    ...pureState
  } = state;

  const mocks = {
    sessionManager,
    tokenCounter,
    sessionTokenCounter,
    turnAnalysis,
    compression,
  };

  return ({ children }: { children: React.ReactNode }) => (
    <AgentProvider
      options={options}
      state={pureState as AgentState}
      mocks={mocks}
    >
      {children}
    </AgentProvider>
  );
};
