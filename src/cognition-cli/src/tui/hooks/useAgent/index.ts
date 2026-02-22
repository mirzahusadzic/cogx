import { useCallback, useEffect, useMemo } from 'react';
import { systemLog } from '../../../utils/debug-logger.js';
import { useTokenCount } from '../tokens/useTokenCount.js';
import { useSessionManager } from '../session/useSessionManager.js';
import { useTurnAnalysis } from '../analysis/index.js';
import { useCompression } from '../compression/useCompression.js';
import type { UseAgentOptions } from './types.js';

import { useAgentState } from './useAgentState.js';
import { useAgentServices } from './useAgentServices.js';
import { useAgentMessaging } from './useAgentMessaging.js';
import { useAgentSync } from './useAgentSync.js';
import { useAgentHandlers } from './useAgentHandlers.js';
import { useAgentCompressionHandler } from './useAgentCompressionHandler.js';
import {
  AUTO_RESPONSE_TRIGGER,
  isProviderContextSensitive,
} from './constants.js';

/**
 * useAgent hook - Professional production-ready version.
 *
 * Refactored to reduce size and improve maintainability while keeping all functionality.
 * Logic is split into specialized sub-hooks and helper modules.
 */
export function useAgent(options: UseAgentOptions) {
  const {
    sessionId: sessionIdProp,
    cwd,
    sessionTokens,
    debug: debugFlag,
    provider: providerName = 'claude',
    model: modelName,
    autoResponse = true,
    semanticThreshold: semanticThresholdProp,
  } = options;

  // 1. Utilities (defined early for use in sessionManager and sub-hooks)
  const debug = useCallback(
    (message: string, ...args: unknown[]) => {
      if (debugFlag) {
        systemLog('sigma', message, args.length > 0 ? { args } : {});
      }
    },
    [debugFlag]
  );

  const tokenCounter = useTokenCount();

  // 2. Session management
  const handleSessionLoaded = useCallback((message?: string) => {
    if (message) {
      setMessages((prev) => [
        ...prev,
        { type: 'system', content: message, timestamp: new Date() },
      ]);
    }
  }, []);

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

  const sessionManager = useSessionManager({
    sessionIdProp,
    cwd,
    provider: providerName,
    model: modelName,
    debug: debugFlag,
    onSessionLoaded: handleSessionLoaded,
    onSDKSessionChanged: handleSDKSessionChanged,
    onTokensRestored: tokenCounter.initialize,
  });

  const anchorId = sessionManager.state.anchorId;
  const currentSessionId = sessionManager.state.currentSessionId;
  const initialLastCompressionTimestamp =
    sessionManager.state.lastCompressionTimestamp;

  // 3. State management (needs currentSessionId for currentSessionIdRef initialization)
  const state = useAgentState(
    options,
    currentSessionId,
    initialLastCompressionTimestamp
  );
  const {
    messages,
    setMessages,
    isThinking,
    setIsThinking,
    overlayScores,
    shouldAutoRespond,
    setShouldAutoRespond,
    workbenchHealth,
    currentAdapterRef,
    abortedRef,
    messagesRef,
    userMessageEmbeddingCache,
    embedderRef,
    projectRegistryRef,
    conversationRegistryRef,
  } = state;

  // 4. Turn analysis
  const turnAnalysis = useTurnAnalysis({
    embedder: embedderRef.current,
    projectRegistry: projectRegistryRef.current,
    conversationRegistry: conversationRegistryRef.current,
    cwd,
    sessionId: currentSessionId,
    debug: debugFlag,
  });

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
  });

  const isContextSensitive = isProviderContextSensitive(
    providerName,
    modelName
  );
  const compression = useCompression({
    tokenCount: tokenCounter.count.total,
    analyzedTurns: turnAnalysis.stats.totalAnalyzed,
    isThinking,
    tokenThreshold: sessionTokens,
    semanticThreshold:
      semanticThresholdProp ?? (isContextSensitive ? 50000 : undefined),
    tpmLimit: isContextSensitive ? 1000000 : undefined,
    minTurns: isContextSensitive ? 1 : 5,
    enabled: true,
    debug: debugFlag,
    onCompressionTriggered: handleCompressionTriggered,
  });

  // 6. Services, Messaging & Sync
  const addSystemMessage = useCallback(
    (content: string) => {
      setMessages((prev) => [
        ...prev,
        { type: 'system', content, timestamp: new Date() },
      ]);
    },
    [setMessages]
  );

  useAgentServices({ options, state, anchorId, addSystemMessage });
  useAgentMessaging({ options, state });
  useAgentSync(
    { ...state, tokenCounter },
    sessionManager,
    turnAnalysis,
    cwd,
    anchorId,
    debug
  );

  // 7. Handlers (SendMessage, ProcessAgentMessage)
  const { sendMessage } = useAgentHandlers({
    options,
    state,
    sessionManager,
    tokenCounter,
    turnAnalysis,
    compression,
    debug,
  });

  // 8. Integration effects (specific lifecycle hooks)

  // Auto-response trigger effect
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

  // Turn analysis queueing effect
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
      avgImportance: turnAnalysis.stats.avgImportance, // Already scaled 0-10
    }),
    [turnAnalysis.stats]
  );

  // 10. Memoize return object to prevent re-renders in consumers
  return useMemo(
    () => ({
      messages,
      sendMessage,
      addSystemMessage,
      isThinking,
      retryCount: state.retryCount,
      activeModel: state.activeModel,
      error: state.error,
      overlayScores,
      tokenCount: tokenCounter.count,
      workbenchHealth,
      currentSessionId,
      anchorId,
      interrupt,
      sigmaStats,
      avgOverlays: overlayScores,
    }),
    [
      messages,
      sendMessage,
      addSystemMessage,
      isThinking,
      state.retryCount,
      state.activeModel,
      state.error,
      overlayScores,
      tokenCounter.count,
      workbenchHealth,
      currentSessionId,
      anchorId,
      interrupt,
      sigmaStats,
    ]
  );
}
