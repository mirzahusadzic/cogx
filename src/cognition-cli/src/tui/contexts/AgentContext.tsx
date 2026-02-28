import React, {
  createContext,
  useContext,
  ReactNode,
  useMemo,
  useCallback,
  useEffect,
} from 'react';
import type {
  UseAgentOptions,
  TUIMessage,
  SigmaTasks,
  SigmaTask,
} from '../hooks/useAgent/types.js';
import type { AgentState } from '../hooks/useAgent/useAgentState.js';
import { useAgentServices } from '../hooks/useAgent/useAgentServices.js';
import { useAgentMessaging } from '../hooks/useAgent/useAgentMessaging.js';
import { useAgentSync } from '../hooks/useAgent/useAgentSync.js';
import { useAgentHandlers } from '../hooks/useAgent/useAgentHandlers.js';
import { useAgentCompressionHandler } from '../hooks/useAgent/useAgentCompressionHandler.js';
import {
  useSessionManager,
  UseSessionManagerResult,
} from '../hooks/session/useSessionManager.js';
import { useTokenCount, TokenCount } from '../hooks/tokens/useTokenCount.js';
import {
  useSessionTokenCount,
  SessionTokenCount,
} from '../hooks/tokens/useSessionTokenCount.js';
import {
  useTurnAnalysis,
  UseTurnAnalysisReturn,
} from '../hooks/analysis/index.js';
import {
  useCompression,
  UseCompressionResult,
} from '../hooks/compression/useCompression.js';
import { systemLog } from '../../utils/debug-logger.js';
import {
  AUTO_RESPONSE_TRIGGER,
  isProviderContextSensitive,
} from '../hooks/useAgent/constants.js';

export interface AgentContextType {
  options: UseAgentOptions;
  state: AgentState;
  messages: TUIMessage[];
  sendMessage: (content: string) => Promise<void>;
  addSystemMessage: (content: string) => void;
  isThinking: boolean;
  setIsThinking: React.Dispatch<React.SetStateAction<boolean>>;
  retryCount: number;
  activeModel: string | undefined;
  error: string | null;
  overlayScores: AgentState['overlayScores'];
  tokenCount: TokenCount;
  sessionTokenCount: SessionTokenCount;
  workbenchHealth: AgentState['workbenchHealth'];
  currentSessionId: string | undefined;
  anchorId: string | undefined;
  interrupt: () => void;
  sigmaStats: {
    nodes: number;
    edges: number;
    paradigmShifts: number;
    avgNovelty: number;
    avgImportance: number;
  };
  sigmaTasks: SigmaTasks;
  avgOverlays: AgentState['overlayScores'];
}

// First level context for infrastructure and shared callbacks
interface AgentBaseContextType {
  options: UseAgentOptions;
  state: AgentState;
  sessionManager: UseSessionManagerResult;
  tokenCounter: ReturnType<typeof useTokenCount>;
  sessionTokenCounter: ReturnType<typeof useSessionTokenCount>;
  turnAnalysis: UseTurnAnalysisReturn;
  compression: UseCompressionResult;
  debug: (message: string, ...args: unknown[]) => void;
  anchorId: string | undefined;
  currentSessionId: string | undefined;
  addSystemMessage: (content: string) => void;
}

const AgentBaseContext = createContext<AgentBaseContextType | null>(null);

export const useAgentBaseContext = () => {
  const context = useContext(AgentBaseContext);
  if (!context) {
    throw new Error('useAgentBaseContext must be used within an AgentProvider');
  }
  return context;
};

// Second level context for full agent functionality
const AgentContext = createContext<AgentContextType | null>(null);

export const useAgentContext = () => {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgentContext must be used within an AgentProvider');
  }
  return context;
};

/**
 * Internal orchestrator that uses the base context to set up behavioral services and handlers
 */
const AgentOrchestrator: React.FC<{ children: ReactNode }> = ({ children }) => {
  const {
    options,
    state,
    tokenCounter,
    sessionTokenCounter,
    turnAnalysis,
    anchorId,
    currentSessionId,
    addSystemMessage,
  } = useAgentBaseContext();

  const { autoResponse = true } = options;

  const {
    messages,
    setIsThinking,
    isThinking,
    overlayScores,
    shouldAutoRespond,
    setShouldAutoRespond,
    workbenchHealth,
    currentAdapterRef,
    abortedRef,
    messagesRef,
    userMessageEmbeddingCache,
    embedderRef,
  } = state;

  // 6. Services, Messaging & Sync
  useAgentServices();
  useAgentMessaging();
  useAgentSync();

  // 7. Handlers (SendMessage, ProcessAgentMessage)
  const { sendMessage } = useAgentHandlers();

  // 8. Integration effects
  useEffect(() => {
    if (shouldAutoRespond && !isThinking && autoResponse) {
      setShouldAutoRespond(false);
      sendMessage(AUTO_RESPONSE_TRIGGER);
    }
  }, [
    shouldAutoRespond,
    isThinking,
    autoResponse,
    sendMessage,
    setShouldAutoRespond,
  ]);

  useEffect(() => {
    const currentMessages = messagesRef.current;
    if (currentMessages.length === 0) return;

    const queueNewAnalyses = async () => {
      if (!embedderRef.current) return;

      const lastIndex =
        turnAnalysis.analyses.length > 0
          ? turnAnalysis.analyses.length - 1
          : -1;
      const unanalyzedMessages = currentMessages
        .slice(lastIndex + 1)
        .map((msg, idx) => ({ msg, originalIndex: lastIndex + 1 + idx }))
        .filter(({ msg }) => msg.type === 'user' || msg.type === 'assistant');

      for (const {
        msg: message,
        originalIndex: messageIndex,
      } of unanalyzedMessages) {
        if (message.type === 'assistant' && isThinking) continue;

        const turnTimestamp = message.timestamp.getTime();
        if (turnAnalysis.hasAnalyzed(turnTimestamp)) continue;

        const cachedEmbedding =
          message.type === 'user'
            ? userMessageEmbeddingCache.current.get(turnTimestamp)
            : undefined;

        await turnAnalysis.enqueueAnalysis({
          message,
          messageIndex,
          timestamp: turnTimestamp,
          cachedEmbedding,
        });

        if (cachedEmbedding)
          userMessageEmbeddingCache.current.delete(turnTimestamp);
      }
    };

    queueNewAnalyses();
  }, [
    messages.length,
    isThinking,
    turnAnalysis,
    embedderRef,
    userMessageEmbeddingCache,
  ]);

  const interrupt = useCallback(() => {
    if (currentAdapterRef.current) {
      currentAdapterRef.current.interrupt();
      abortedRef.current = true;
      setIsThinking(false);
    }
  }, [currentAdapterRef, abortedRef, setIsThinking]);

  // 9. Sigma Statistics
  const sigmaStats = useMemo(
    () => ({
      nodes: turnAnalysis.stats.totalAnalyzed,
      edges: Math.max(0, turnAnalysis.stats.totalAnalyzed - 1),
      paradigmShifts: turnAnalysis.stats.paradigmShifts,
      avgNovelty: turnAnalysis.stats.avgNovelty,
      avgImportance: turnAnalysis.stats.avgImportance,
    }),
    [turnAnalysis.stats]
  );

  const value = useMemo(
    () => ({
      options,
      state,
      messages,
      sendMessage,
      addSystemMessage,
      isThinking,
      setIsThinking,
      retryCount: state.retryCount,
      activeModel: state.activeModel,
      error: state.error,
      overlayScores,
      tokenCount: tokenCounter.count,
      sessionTokenCount: sessionTokenCounter.count,
      workbenchHealth,
      currentSessionId,
      anchorId,
      interrupt,
      sigmaStats,
      sigmaTasks: state.sigmaTasks,
      avgOverlays: overlayScores,
    }),
    [
      options,
      state,
      messages,
      sendMessage,
      addSystemMessage,
      isThinking,
      setIsThinking,
      state.retryCount,
      state.activeModel,
      state.error,
      overlayScores,
      tokenCounter.count,
      sessionTokenCounter.count,
      workbenchHealth,
      currentSessionId,
      anchorId,
      interrupt,
      sigmaStats,
      state.sigmaTasks,
    ]
  );

  return (
    <AgentContext.Provider value={value}>{children}</AgentContext.Provider>
  );
};

export const AgentProvider: React.FC<{
  options: UseAgentOptions;
  state: AgentState;
  children: ReactNode;
  // Test mocks
  mocks?: {
    sessionManager?: UseSessionManagerResult;
    tokenCounter?: ReturnType<typeof useTokenCount>;
    sessionTokenCounter?: ReturnType<typeof useSessionTokenCount>;
    turnAnalysis?: UseTurnAnalysisReturn;
    compression?: UseCompressionResult;
  };
}> = ({ options, state, children, mocks }) => {
  const {
    sessionId: sessionIdProp,
    cwd,
    debug: debugFlag,
    provider: providerName = 'claude',
    model: modelName,
    semanticThreshold: semanticThresholdProp,
  } = options;

  const {
    setMessages,
    embedderRef,
    projectRegistryRef,
    conversationRegistryRef,
    setSigmaTasks,
  } = state;

  // 1. Utilities
  const debug = useCallback(
    (message: string, ...args: unknown[]) => {
      if (debugFlag) {
        systemLog('sigma', message, args.length > 0 ? { args } : {});
      }
    },
    [debugFlag]
  );

  const internalTokenCounter = useTokenCount();
  const tokenCounter = mocks?.tokenCounter ?? internalTokenCounter;

  const internalSessionTokenCounter = useSessionTokenCount();
  const sessionTokenCounter =
    mocks?.sessionTokenCounter ?? internalSessionTokenCounter;

  // 2. Callbacks
  const handleSessionLoaded = useCallback(
    (message?: string) => {
      if (message) {
        setMessages((prev) => [
          ...prev,
          { type: 'system', content: message, timestamp: new Date() },
        ]);
      }
    },
    [setMessages]
  );

  const handleSDKSessionChanged = useCallback(
    (event: {
      previousSessionId: string;
      newSessionId: string;
      reason: string;
    }) => {
      if (debugFlag) {
        systemLog(
          'sigma',
          `Session updated: ${event.previousSessionId} → ${event.newSessionId} (${event.reason})`
        );
      }
    },
    [debugFlag]
  );

  const handleTasksRestored = useCallback(
    (tasks: SigmaTask[]) => {
      setSigmaTasks({ todos: tasks });
    },
    [setSigmaTasks]
  );

  // 3. Session management
  const internalSessionManager = useSessionManager({
    sessionIdProp,
    cwd,
    provider: providerName,
    model: modelName,
    debug: debugFlag,
    onSessionLoaded: handleSessionLoaded,
    onSDKSessionChanged: handleSDKSessionChanged,
    onTokensRestored: tokenCounter.initialize,
    onSessionTokensRestored: sessionTokenCounter.initialize,
    onTasksRestored: handleTasksRestored,
  });
  const sessionManager = mocks?.sessionManager ?? internalSessionManager;

  const anchorId = sessionManager.state.anchorId;
  const currentSessionId = sessionManager.state.currentSessionId;

  // Update state with actual sessionId from sessionManager
  useEffect(() => {
    if (currentSessionId && currentSessionId !== 'initial') {
      state.currentSessionIdRef.current = currentSessionId;
    }
  }, [currentSessionId, state.currentSessionIdRef]);

  // 4. Turn analysis
  const internalTurnAnalysis = useTurnAnalysis({
    embedder: embedderRef.current,
    projectRegistry: projectRegistryRef.current,
    conversationRegistry: conversationRegistryRef.current,
    cwd,
    sessionId: currentSessionId,
    debug: debugFlag,
  });
  const turnAnalysis = mocks?.turnAnalysis ?? internalTurnAnalysis;

  // 5. Compression orchestration
  const handleCompressionTriggered = useAgentCompressionHandler({
    state,
    sessionManager,
    turnAnalysis,
    tokenCounter,
    cwd,
    debug,
    currentSessionId,
    anchorId,
    modelName,
    solo: options.solo || false,
  });

  const isContextSensitive = isProviderContextSensitive(
    providerName,
    modelName
  );
  const internalCompression = useCompression({
    tokenCount: tokenCounter.count.total,
    analyzedTurns: turnAnalysis.stats.totalAnalyzed,
    isThinking: state.isThinking,
    tokenThreshold: options.sessionTokens,
    semanticThreshold:
      semanticThresholdProp ?? (isContextSensitive ? 50000 : undefined),
    tpmLimit: isContextSensitive ? 1000000 : undefined,
    minTurns: isContextSensitive ? 1 : 5,
    enabled: true,
    debug: debugFlag,
    onCompressionTriggered: handleCompressionTriggered,
  });
  const compression = mocks?.compression ?? internalCompression;

  const addSystemMessage = useCallback(
    (content: string) => {
      setMessages((prev) => [
        ...prev,
        { type: 'system', content, timestamp: new Date() },
      ]);
    },
    [setMessages]
  );

  const baseValue = useMemo(
    () => ({
      options,
      state,
      sessionManager,
      tokenCounter,
      sessionTokenCounter,
      turnAnalysis,
      compression,
      debug,
      anchorId,
      currentSessionId,
      addSystemMessage,
    }),
    [
      options,
      state,
      sessionManager,
      tokenCounter,
      sessionTokenCounter,
      turnAnalysis,
      compression,
      debug,
      anchorId,
      currentSessionId,
      addSystemMessage,
    ]
  );

  return (
    <AgentBaseContext.Provider value={baseValue}>
      <AgentOrchestrator>{children}</AgentOrchestrator>
    </AgentBaseContext.Provider>
  );
};
