import { useState, useRef, useEffect } from 'react';
import type { TUIMessage, UseAgentOptions } from './types.js';
import { EmbeddingService } from '../../../core/services/embedding.js';
import { OverlayRegistry } from '../../../core/algebra/overlay-registry.js';
import { ConversationOverlayRegistry } from '../../../sigma/conversation-registry.js';
import { McpSdkServerConfigWithInstance } from '../sdk/types.js';
import { BackgroundTaskManager } from '../../services/BackgroundTaskManager.js';
import { Command } from '../../commands/loader.js';
import { AgentProviderAdapter } from '../sdk/index.js';

export interface AgentState {
  messages: TUIMessage[];
  setMessages: React.Dispatch<React.SetStateAction<TUIMessage[]>>;
  isThinking: boolean;
  setIsThinking: React.Dispatch<React.SetStateAction<boolean>>;
  retryCount: number;
  setRetryCount: React.Dispatch<React.SetStateAction<number>>;
  activeModel: string | undefined;
  setActiveModel: React.Dispatch<React.SetStateAction<string | undefined>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  overlayScores: {
    O1_structural: number;
    O2_security: number;
    O3_lineage: number;
    O4_mission: number;
    O5_operational: number;
    O6_mathematical: number;
    O7_strategic: number;
  };
  setOverlayScores: React.Dispatch<
    React.SetStateAction<AgentState['overlayScores']>
  >;
  commandsCache: Map<string, Command>;
  setCommandsCache: React.Dispatch<React.SetStateAction<Map<string, Command>>>;
  injectedRecap: string | null;
  setInjectedRecap: React.Dispatch<React.SetStateAction<string | null>>;
  pendingMessageNotification: string | null;
  setPendingMessageNotification: React.Dispatch<
    React.SetStateAction<string | null>
  >;
  shouldAutoRespond: boolean;
  setShouldAutoRespond: React.Dispatch<React.SetStateAction<boolean>>;
  workbenchHealth: {
    reachable: boolean;
    embeddingReady: boolean;
    summarizationReady: boolean;
    hasApiKey: boolean;
  } | null;
  setWorkbenchHealth: React.Dispatch<
    React.SetStateAction<AgentState['workbenchHealth']>
  >;

  currentAdapterRef: React.RefObject<AgentProviderAdapter | null>;
  abortedRef: React.RefObject<boolean>;
  embedderRef: React.RefObject<EmbeddingService | null>;
  projectRegistryRef: React.RefObject<OverlayRegistry | null>;
  conversationRegistryRef: React.RefObject<ConversationOverlayRegistry | null>;
  recallMcpServerRef: React.RefObject<McpSdkServerConfigWithInstance | null>;
  backgroundTasksMcpServerRef: React.RefObject<McpSdkServerConfigWithInstance | null>;
  agentMessagingMcpServerRef: React.RefObject<McpSdkServerConfigWithInstance | null>;
  crossProjectQueryMcpServerRef: React.RefObject<McpSdkServerConfigWithInstance | null>;
  sigmaTaskUpdateMcpServerRef: React.RefObject<McpSdkServerConfigWithInstance | null>;
  backgroundTaskManagerRef: React.RefObject<BackgroundTaskManager | null>;
  messagesRef: React.RefObject<TUIMessage[]>;
  userMessageEmbeddingCache: React.RefObject<Map<number, number[]>>;
  latticeLoadedRef: React.RefObject<Set<string>>;
  compressionInProgressRef: React.RefObject<boolean>;
  lastPersistedTokensRef: React.RefObject<number>;
  autoResponseTimestamps: React.RefObject<number[]>;
  currentSessionIdRef: React.RefObject<string>;
}

export function useAgentState(
  _options: UseAgentOptions,
  currentSessionId: string
): AgentState {
  // State
  const [messages, setMessages] = useState<TUIMessage[]>([
    {
      type: 'system',
      content:
        '     ⬢      ↔       👤     ↔     💎\n' +
        '   Traversal      Projection    Resonance\n' +
        ' ',
      timestamp: new Date(),
    },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [activeModel, setActiveModel] = useState<string | undefined>(
    _options.model
  );
  const [error, setError] = useState<string | null>(null);
  const [overlayScores, setOverlayScores] = useState({
    O1_structural: 0,
    O2_security: 0,
    O3_lineage: 0,
    O4_mission: 0,
    O5_operational: 0,
    O6_mathematical: 0,
    O7_strategic: 0,
  });
  const [commandsCache, setCommandsCache] = useState<Map<string, Command>>(
    new Map()
  );
  const [injectedRecap, setInjectedRecap] = useState<string | null>(null);
  const [pendingMessageNotification, setPendingMessageNotification] = useState<
    string | null
  >(null);
  const [shouldAutoRespond, setShouldAutoRespond] = useState(false);
  const [workbenchHealth, setWorkbenchHealth] =
    useState<AgentState['workbenchHealth']>(null);

  // Refs
  const currentAdapterRef = useRef<AgentProviderAdapter | null>(null);
  const abortedRef = useRef(false);
  const embedderRef = useRef<EmbeddingService | null>(null);
  const projectRegistryRef = useRef<OverlayRegistry | null>(null);
  const conversationRegistryRef = useRef<ConversationOverlayRegistry | null>(
    null
  );
  const recallMcpServerRef = useRef<McpSdkServerConfigWithInstance | null>(
    null
  );
  const backgroundTasksMcpServerRef =
    useRef<McpSdkServerConfigWithInstance | null>(null);
  const agentMessagingMcpServerRef =
    useRef<McpSdkServerConfigWithInstance | null>(null);
  const crossProjectQueryMcpServerRef =
    useRef<McpSdkServerConfigWithInstance | null>(null);
  const sigmaTaskUpdateMcpServerRef =
    useRef<McpSdkServerConfigWithInstance | null>(null);
  const backgroundTaskManagerRef = useRef<BackgroundTaskManager | null>(null);
  const messagesRef = useRef<TUIMessage[]>(messages);
  const userMessageEmbeddingCache = useRef<Map<number, number[]>>(new Map());
  const latticeLoadedRef = useRef<Set<string>>(new Set());
  const compressionInProgressRef = useRef(false);
  const lastPersistedTokensRef = useRef(0);
  const autoResponseTimestamps = useRef<number[]>([]);
  const currentSessionIdRef = useRef(currentSessionId);

  // Update messagesRef when messages state changes
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Keep currentSessionIdRef in sync
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  return {
    messages,
    setMessages,
    isThinking,
    setIsThinking,
    retryCount,
    setRetryCount,
    activeModel,
    setActiveModel,
    error,
    setError,
    overlayScores,
    setOverlayScores,
    commandsCache,
    setCommandsCache,
    injectedRecap,
    setInjectedRecap,
    pendingMessageNotification,
    setPendingMessageNotification,
    shouldAutoRespond,
    setShouldAutoRespond,
    workbenchHealth,
    setWorkbenchHealth,

    currentAdapterRef,
    abortedRef,
    embedderRef,
    projectRegistryRef,
    conversationRegistryRef,
    recallMcpServerRef,
    backgroundTasksMcpServerRef,
    agentMessagingMcpServerRef,
    crossProjectQueryMcpServerRef,
    sigmaTaskUpdateMcpServerRef,
    backgroundTaskManagerRef,
    messagesRef,
    userMessageEmbeddingCache,
    latticeLoadedRef,
    compressionInProgressRef,
    lastPersistedTokensRef,
    autoResponseTimestamps,
    currentSessionIdRef,
  };
}
