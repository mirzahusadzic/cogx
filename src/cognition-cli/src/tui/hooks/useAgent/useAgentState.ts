import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useReducer,
  useCallback,
} from 'react';
import { terminal, TerminalStatus } from '../../services/TerminalService.js';
import gradient from 'gradient-string';
import type { TUIMessage, UseAgentOptions, SigmaTasks } from './types.js';
import { ThinkingState } from './types.js';
import { messagesReducer, MessageAction } from './messagesReducer.js';
import { EmbeddingService } from '../../../core/services/embedding.js';
import { OverlayRegistry } from '../../../core/algebra/overlay-registry.js';
import { ConversationOverlayRegistry } from '../../../sigma/conversation-registry.js';
import { McpSdkServerConfigWithInstance } from '../sdk/types.js';
import { BackgroundTaskManager } from '../../services/BackgroundTaskManager.js';
import { Command } from '../../commands/loader.js';
import { AgentProviderAdapter } from '../sdk/index.js';
import { SIGMA_LOGO } from '../../constants.js';
import { TUITheme } from '../../theme.js';
import { tuiSyncManager } from '../../../core/state/tui-sync/TUISyncManager.js';
import type {
  WorkbenchHealthStatus,
  OverlayScores,
} from '../../../core/state/tui-sync/types.js';

export interface AgentState {
  messages: TUIMessage[];
  setMessages: React.Dispatch<React.SetStateAction<TUIMessage[]>>;
  dispatchMessages: React.Dispatch<MessageAction>;
  isThinking: boolean;
  setIsThinking: React.Dispatch<React.SetStateAction<boolean>>;
  thinkingState: ThinkingState;
  setThinkingState: React.Dispatch<React.SetStateAction<ThinkingState>>;
  retryCount: number;
  setRetryCount: React.Dispatch<React.SetStateAction<number>>;
  activeModel: string | undefined;
  setActiveModel: React.Dispatch<React.SetStateAction<string | undefined>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  overlayScores: OverlayScores;
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
  workbenchHealth: WorkbenchHealthStatus | null;
  setWorkbenchHealth: React.Dispatch<
    React.SetStateAction<AgentState['workbenchHealth']>
  >;
  sigmaTasks: SigmaTasks;
  setSigmaTasks: React.Dispatch<React.SetStateAction<SigmaTasks>>;

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
  thinkingStateRef: React.RefObject<ThinkingState>;
  userMessageEmbeddingCache: React.RefObject<Map<number, number[]>>;
  latticeLoadedRef: React.RefObject<Set<string>>;
  compressionInProgressRef: React.RefObject<boolean>;
  lastPersistedTokensRef: React.RefObject<number>;
  autoResponseTimestamps: React.RefObject<number[]>;
  currentSessionIdRef: React.RefObject<string>;
  lastCompressionTimestamp: number;
  setLastCompressionTimestamp: React.Dispatch<React.SetStateAction<number>>;
}

export function useAgentState(
  _options: UseAgentOptions,
  currentSessionId: string,
  initialLastCompressionTimestamp: number = 0
): AgentState {
  // State
  const [messages, dispatchMessages] = useReducer(
    messagesReducer,
    undefined,
    () => {
      const sigmaGradient = gradient([
        TUITheme.overlays.o7_strategic,
        TUITheme.overlays.o1_structural,
        TUITheme.overlays.o3_lineage,
      ]);

      return [
        {
          type: 'system' as const,
          content: sigmaGradient(SIGMA_LOGO) + '\n ',
          timestamp: new Date(),
        },
      ] as TUIMessage[];
    }
  );

  const setMessages = useCallback(
    (update: React.SetStateAction<TUIMessage[]>) => {
      if (typeof update === 'function') {
        dispatchMessages({
          type: 'SET_MESSAGES_FUNCTIONAL',
          update: update as (prev: TUIMessage[]) => TUIMessage[],
        });
      } else {
        dispatchMessages({ type: 'SET_MESSAGES', messages: update });
      }
    },
    []
  );
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingState, setThinkingState] = useState<ThinkingState>(
    ThinkingState.IDLE
  );
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
  const [lastCompressionTimestamp, setLastCompressionTimestamp] = useState(
    initialLastCompressionTimestamp
  );

  // Sync with TUISyncStateMachine
  useEffect(() => {
    return tuiSyncManager.subscribe((_status, state) => {
      // Sync overlay scores
      setOverlayScores((prev) => {
        const next = state.overlayScores;
        const hasChanged =
          Math.abs(prev.O1_structural - next.O1_structural) > 0.001 ||
          Math.abs(prev.O2_security - next.O2_security) > 0.001 ||
          Math.abs(prev.O3_lineage - next.O3_lineage) > 0.001 ||
          Math.abs(prev.O4_mission - next.O4_mission) > 0.001 ||
          Math.abs(prev.O5_operational - next.O5_operational) > 0.001 ||
          Math.abs(prev.O6_mathematical - next.O6_mathematical) > 0.001 ||
          Math.abs(prev.O7_strategic - next.O7_strategic) > 0.001;

        return hasChanged ? { ...next } : prev;
      });

      // Sync workbench health
      if (state.workbenchHealth) {
        setWorkbenchHealth(state.workbenchHealth);
      }

      // Sync messages if they changed
      if (state.messages.length > 0) {
        setMessages((prev) => {
          // This is tricky because TUIMessage formats differ slightly
          // and we don't want to overwrite system messages added by the hook.
          // For now, we'll just keep them in sync if the state machine has messages.
          // Ideally the state machine would be the ONLY source of truth.
          return prev; // No-op for now to avoid feedback loops
        });
      }
    });
  }, []);

  // Update when the prop changes (e.g., loaded from session manager)
  useEffect(() => {
    if (initialLastCompressionTimestamp > 0) {
      setLastCompressionTimestamp(initialLastCompressionTimestamp);
    }
  }, [initialLastCompressionTimestamp]);

  const [workbenchHealth, setWorkbenchHealth] =
    useState<AgentState['workbenchHealth']>(null);
  const [sigmaTasks, setSigmaTasks] = useState<SigmaTasks>({ todos: [] });

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
  const thinkingStateRef = useRef<ThinkingState>(thinkingState);
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

  // Keep thinkingStateRef in sync
  useEffect(() => {
    thinkingStateRef.current = thinkingState;
  }, [thinkingState]);

  // Keep currentSessionIdRef in sync
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // Keep terminal status in sync with thinkingState
  useEffect(() => {
    switch (thinkingState) {
      case ThinkingState.IDLE:
      case ThinkingState.SUCCESS:
      case ThinkingState.TYPING:
        terminal.setStatus(TerminalStatus.READY);
        break;
      case ThinkingState.PROCESSING:
      case ThinkingState.WAITING:
        terminal.setStatus(TerminalStatus.THINKING);
        break;
      case ThinkingState.EXECUTING:
        terminal.setStatus(TerminalStatus.PROCESSING);
        break;
      case ThinkingState.CONFIRMING:
        terminal.setStatus(TerminalStatus.CONFIRMING);
        break;
      case ThinkingState.ERROR:
        terminal.setStatus(TerminalStatus.ERROR);
        break;
    }
  }, [thinkingState]);

  return useMemo(
    () => ({
      messages,
      setMessages,
      dispatchMessages,
      isThinking,
      setIsThinking,
      thinkingState,
      setThinkingState,
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
      sigmaTasks,
      setSigmaTasks,

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
      thinkingStateRef,
      userMessageEmbeddingCache,
      latticeLoadedRef,
      compressionInProgressRef,
      lastPersistedTokensRef,
      autoResponseTimestamps,
      currentSessionIdRef,
      lastCompressionTimestamp,
      setLastCompressionTimestamp,
    }),
    [
      messages,
      isThinking,
      thinkingState,
      setThinkingState,
      retryCount,
      activeModel,
      error,
      overlayScores,
      commandsCache,
      injectedRecap,
      pendingMessageNotification,
      shouldAutoRespond,
      workbenchHealth,
      sigmaTasks,
      lastCompressionTimestamp,
    ]
  );
}
