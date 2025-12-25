/**
 * Claude Agent SDK Integration Hook
 *
 * The central orchestrator for the TUI's Claude integration. Manages the complete
 * lifecycle of AI-assisted conversations with Sigma (Σ) conversation lattice,
 * context compression, and semantic memory.
 *
 * ARCHITECTURE:
 * This hook composes several specialized hooks and services:
 *
 * 1. SESSION MANAGEMENT (useSessionManager):
 *    - Dual-identity session model (anchor ID + SDK session ID)
 *    - Session persistence across compressions
 *    - State tracking (.sigma/{session}.state.json)
 *
 * 2. TOKEN TRACKING (useTokenCount):
 *    - Real-time token usage monitoring
 *    - Compression threshold detection
 *    - Proper reset semantics for new sessions
 *
 * 3. TURN ANALYSIS (useTurnAnalysis):
 *    - Background semantic analysis of conversation turns
 *    - Embedding generation and novelty scoring
 *    - Paradigm shift detection
 *    - LanceDB persistence for conversation memory
 *
 * 4. COMPRESSION (useCompression):
 *    - Automatic context compression at token thresholds
 *    - Lattice-based intelligent recap generation
 *    - Session boundary management
 *
 * 5. SIGMA SERVICES:
 *    - EmbeddingService: Vector embeddings via workbench
 *    - ConversationOverlayRegistry: Conversation memory overlays (O1-O7)
 *    - RecallMcpServer: MCP tool for on-demand memory queries
 *    - ContextInjector: Real-time semantic context retrieval
 *
 * DATA FLOW:
 * User Input → Slash Command Expansion → Context Injection → SDK Query
 *   ↓
 * Streaming Response → Message State → Turn Analysis (background)
 *   ↓
 * Token Threshold → Compression → Lattice Recap → New SDK Session
 *   ↓
 * Persistent State → Resume on Restart
 *
 * DESIGN RATIONALE:
 *
 * WHY COMPOSITION OVER MONOLITH?
 * Originally a 1200+ line hook, this was refactored to compose smaller hooks.
 * Benefits:
 * - Testability: Each hook can be tested independently
 * - Reusability: Hooks can be used in other contexts
 * - Clarity: Clear separation of concerns
 * - Maintainability: Easier to understand and modify
 *
 * WHY BACKGROUND TURN ANALYSIS?
 * Turn analysis is CPU-intensive (embeddings, vector search). Running it
 * synchronously would block the UI. The queue-based approach ensures:
 * - Non-blocking conversation flow
 * - Ordered analysis (FIFO queue)
 * - Graceful degradation (analysis can lag without breaking UX)
 *
 * WHY DUAL-IDENTITY SESSIONS?
 * The SDK creates new session UUIDs on compression. Without stable anchor IDs:
 * - Users would lose track of their work
 * - State files would proliferate
 * - No clear audit trail
 * The dual model solves this: anchor ID = user-facing, SDK ID = internal.
 *
 * WHY LATTICE-BASED COMPRESSION?
 * Traditional summarization loses nuance and context. The conversation lattice:
 * - Preserves high-importance turns verbatim
 * - Clusters related concepts
 * - Maintains temporal coherence
 * - Enables semantic queries across history
 *
 * @example
 * // Basic TUI integration
 * const agent = useClaudeAgent({
 *   sessionId: 'my-project',
 *   cwd: process.cwd(),
 *   sessionTokens: 80000,
 *   debug: true
 * });
 *
 * // Send message
 * await agent.sendMessage('Explain the overlay system');
 *
 * // Display messages
 * agent.messages.map(msg => (
 *   <Message type={msg.type} content={msg.content} />
 * ));
 *
 * @example
 * // Monitor Sigma statistics
 * console.log(`Lattice nodes: ${agent.sigmaStats.nodes}`);
 * console.log(`Paradigm shifts: ${agent.sigmaStats.paradigmShifts}`);
 * console.log(`Avg novelty: ${agent.sigmaStats.avgNovelty}`);
 *
 * @example
 * // Handle compression
 * useEffect(() => {
 *   if (agent.tokenCount.total > 80000) {
 *     // Compression will trigger automatically via useCompression
 *     console.log('Approaching compression threshold...');
 *   }
 * }, [agent.tokenCount.total]);
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { EmbeddingService } from '../../core/services/embedding.js';
import { OverlayRegistry } from '../../core/algebra/overlay-registry.js';
import { ConversationOverlayRegistry } from '../../sigma/conversation-registry.js';
import { createRecallMcpServer } from '../../sigma/recall-tool.js';
import { createSigmaTaskUpdateMcpServer } from '../tools/sigma-task-update-tool.js';
import { createBackgroundTasksMcpServer } from '../tools/background-tasks-tool.js';
import {
  getBackgroundTaskManager,
  type BackgroundTaskManager,
} from '../services/BackgroundTaskManager.js';
import { injectRelevantContext } from '../../sigma/context-injector.js';
import { useTokenCount } from './tokens/useTokenCount.js';
import { useSessionManager } from './session/useSessionManager.js';
import {
  AgentProviderAdapter,
  isAuthenticationError,
  formatAuthError,
  formatSDKError,
} from './sdk/index.js';
import { formatToolUse } from './rendering/ToolFormatter.js';
import { stripANSICodes } from './rendering/MessageRenderer.js';
import { useTurnAnalysis } from './analysis/index.js';
import { useCompression } from './compression/useCompression.js';
import type {
  ConversationLattice,
  ConversationNode,
} from '../../sigma/types.js';
import {
  loadCommands,
  expandCommand,
  type Command,
} from '../commands/loader.js';
import type { McpSdkServerConfigWithInstance } from './sdk/types.js';
import type { MessagePublisher } from '../../ipc/MessagePublisher.js';
import type { MessageQueue } from '../../ipc/MessageQueue.js';
import { formatPendingMessages } from '../../ipc/agent-messaging-formatters.js';
import {
  checkWorkbenchHealthDetailed,
  type WorkbenchHealthResult,
} from '../../utils/workbench-detect.js';
import { createAgentMessagingMcpServer } from '../tools/agent-messaging-tool.js';
import { createCrossProjectQueryMcpServer } from '../tools/cross-project-query-tool.js';

/**
 * Build MCP servers record for agent adapter
 *
 * Combines available MCP servers into a single record, filtering out
 * unavailable servers based on conditions (e.g., recall only with history).
 */
function buildMcpServers(options: {
  recallServer: McpSdkServerConfigWithInstance | null;
  backgroundTasksServer: McpSdkServerConfigWithInstance | null;
  agentMessagingServer: McpSdkServerConfigWithInstance | null;
  crossProjectQueryServer: McpSdkServerConfigWithInstance | null;
  sigmaTaskUpdateServer: McpSdkServerConfigWithInstance | null;
  hasConversationHistory: boolean;
}): Record<string, McpSdkServerConfigWithInstance> | undefined {
  const servers: Record<string, McpSdkServerConfigWithInstance> = {};

  // Recall server: only enable when there's conversation history
  if (options.recallServer && options.hasConversationHistory) {
    servers['conversation-memory'] = options.recallServer;
  }

  // Background tasks server: always enable when available
  if (options.backgroundTasksServer) {
    servers['background-tasks'] = options.backgroundTasksServer;
  }

  // Agent messaging server: always enable when available
  if (options.agentMessagingServer) {
    servers['agent-messaging'] = options.agentMessagingServer;
  }

  // Cross-project query server: always enable when available
  if (options.crossProjectQueryServer) {
    servers['cross-project-query'] = options.crossProjectQueryServer;
  }

  // SigmaTaskUpdate server: always enable when available (replaces native TodoWrite for Claude)
  if (options.sigmaTaskUpdateServer) {
    servers['sigma-task-update'] = options.sigmaTaskUpdateServer;
  }

  return Object.keys(servers).length > 0 ? servers : undefined;
}

/**
 * Configuration options for Agent integration (Claude, Gemini, etc.)
 */
export interface UseAgentOptions {
  /**
   * User-provided session ID (from CLI --session-id flag)
   * If not provided, auto-generates timestamp-based ID
   */
  sessionId?: string;

  /**
   * Current working directory for .sigma/ state files
   */
  cwd: string;

  /**
   * Token threshold for automatic context compression
   * @default 80000
   */
  sessionTokens?: number;

  /**
   * Maximum tokens for extended thinking (experimental)
   * Enables Claude to think longer on complex problems
   */
  maxThinkingTokens?: number;

  /**
   * Display thinking blocks in the TUI
   * @default true
   */
  displayThinking?: boolean;

  /**
   * Enable debug logging to console and tui-debug.log
   * @default false
   */
  debug?: boolean;

  /**
   * LLM provider to use (default: 'claude')
   * @default 'claude'
   */
  provider?: string;

  /**
   * Model to use (provider-specific)
   * If not specified, uses provider's default model
   */
  model?: string;

  /**
   * Tool confirmation callback (for guardrails)
   * Called before executing each tool to request user permission
   * @returns Promise resolving to 'allow' or 'deny'
   */
  onRequestToolConfirmation?: (
    toolName: string,
    input: unknown
  ) => Promise<'allow' | 'deny'>;

  /**
   * Background task manager getter (for get_background_tasks tool)
   * Optional - if provided, enables the get_background_tasks tool
   */
  getTaskManager?: () => unknown;

  /**
   * Message publisher getter (for agent-to-agent messaging tool)
   * Optional - if provided, enables the send_agent_message and list_agents tools
   */
  getMessagePublisher?: () => MessagePublisher | null;

  /**
   * Message queue getter (for agent-to-agent messaging tool to read messages)
   * Optional - if provided, enables the list_pending_messages and mark_message_read tools
   */
  getMessageQueue?: () => MessageQueue | null;

  /**
   * Auto-respond to agent messages without user input
   * When true, triggers a turn automatically when messages arrive
   * @default true
   */
  autoResponse?: boolean;

  /**
   * Pre-computed workbench health result
   * If provided, skips redundant health check on startup
   */
  initialWorkbenchHealth?: WorkbenchHealthResult | null;
}

/**
 * Message object displayed in conversation UI
 */
export interface TUIMessage {
  /** Message role */
  type: 'user' | 'assistant' | 'system' | 'tool_progress' | 'thinking';

  /** Message text content */
  content: string;

  /** When message was created */
  timestamp: Date;
}

/**
 * Manages Claude Agent SDK integration with Sigma conversation lattice.
 *
 * This is the primary hook for the TUI. It orchestrates:
 * - SDK query lifecycle
 * - Message streaming and display
 * - Token tracking
 * - Turn analysis (background)
 * - Context compression
 * - Session management
 * - Slash command expansion
 * - Semantic context injection
 *
 * LIFECYCLE:
 * 1. Mount:
 *    - Initialize services (embedder, registries, MCP server)
 *    - Load session state (if resuming)
 *    - Load conversation lattice from LanceDB
 *    - Load slash commands from .claude/commands/
 *
 * 2. User Input:
 *    - Expand slash commands (if applicable)
 *    - Inject semantic context from lattice
 *    - Create SDK query with Claude Code preset
 *    - Attach recall MCP server for memory queries
 *
 * 3. Streaming Response:
 *    - Process SDK messages (assistant, tool_use, stream_event)
 *    - Update token counts
 *    - Display tool progress
 *    - Update message state
 *
 * 4. Turn Completion:
 *    - Queue turn for background analysis
 *    - Update overlay scores
 *    - Check compression threshold
 *
 * 5. Compression (if needed):
 *    - Wait for analysis queue to complete
 *    - Build conversation lattice
 *    - Generate intelligent recap
 *    - Create new SDK session
 *    - Update session state
 *
 * 6. Unmount:
 *    - Flush conversation overlays to LanceDB
 *    - Save session state
 *
 * @param options - Configuration for SDK, session, and compression
 * @returns Object with messages, sendMessage, and Sigma statistics
 *
 * @example
 * // Initialize agent
 * const agent = useClaudeAgent({
 *   sessionId: 'my-work',
 *   cwd: '/home/user/project',
 *   sessionTokens: 80000,
 *   debug: true
 * });
 *
 * // Send user message
 * const handleSubmit = async (input: string) => {
 *   await agent.sendMessage(input);
 * };
 *
 * // Interrupt long-running query
 * const handleInterrupt = async () => {
 *   await agent.interrupt();
 * };
 *
 * // Display conversation
 * {agent.messages.map((msg, i) => (
 *   <Box key={i}>
 *     <Text color={msg.type === 'user' ? 'blue' : 'white'}>
 *       {msg.content}
 *     </Text>
 *   </Box>
 * ))}
 */
export function useAgent(options: UseAgentOptions) {
  // Destructure options to get stable primitive values
  // This prevents the entire options object from causing re-renders
  const {
    sessionId: sessionIdProp,
    cwd,
    sessionTokens,
    maxThinkingTokens,
    displayThinking,
    debug: debugFlag,
    provider: providerName = 'claude',
    model: modelName,
    onRequestToolConfirmation,
    getTaskManager,
    getMessagePublisher,
    getMessageQueue,
    autoResponse = true,
    initialWorkbenchHealth,
  } = options;

  // ========================================
  // DEBUG UTILITIES
  // ========================================

  // Debug logger (only logs if debug flag is set)
  const debug = useCallback(
    (message: string, ...args: unknown[]) => {
      if (debugFlag) {
        console.log(chalk.dim(`[Σ] ${message}`), ...args);
      }
    },
    [debugFlag]
  );

  // Debug file logger (only writes to file if debug flag is set)
  const debugLog = useCallback(
    (content: string) => {
      if (debugFlag) {
        try {
          fs.appendFileSync(path.join(cwd, 'tui-debug.log'), content);
        } catch (err) {
          // Silent fail - debug logs are non-critical
          console.error(
            `Debug log write error: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    },
    [debugFlag, cwd]
  );

  // ========================================
  // STATE MANAGEMENT
  // ========================================

  // Initialize with welcome message (colors applied by ClaudePanelAgent)
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
  const [error, setError] = useState<string | null>(null);

  // Store current adapter for interrupt functionality
  const currentAdapterRef = useRef<AgentProviderAdapter | null>(null);
  // Track user-initiated aborts (ESC key)
  const abortedRef = useRef(false);

  // ========================================
  // COMPOSED HOOKS
  // ========================================

  // Token counting with proper reset semantics
  const tokenCounter = useTokenCount();

  // ========================================
  // SIGMA STATE & SERVICES
  // ========================================

  // Sigma state: conversation lattice and analysis
  const [conversationLattice] = useState<ConversationLattice | null>(null);
  const [overlayScores, setOverlayScores] = useState({
    O1_structural: 0,
    O2_security: 0,
    O3_lineage: 0,
    O4_mission: 0,
    O5_operational: 0,
    O6_mathematical: 0,
    O7_strategic: 0,
  });
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
  const messagesRef = useRef<TUIMessage[]>(messages); // Ref to avoid effect re-running on every message change
  const userMessageEmbeddingCache = useRef<Map<number, number[]>>(new Map()); // Cache user message embeddings by timestamp
  const latticeLoadedRef = useRef<Set<string>>(new Set()); // Track which sessions have been loaded
  const compressionInProgressRef = useRef(false); // ✅ Guard against concurrent compression requests
  const lastPersistedTokensRef = useRef(0); // Track last persisted token count for throttling

  // Slash commands: Load commands cache
  const [commandsCache, setCommandsCache] = useState<Map<string, Command>>(
    new Map()
  );

  // Track count of ONLY user/assistant messages (not system/tool_progress)
  // This prevents infinite loop when compression adds system messages
  const userAssistantMessageCount = messages.filter(
    (m) => m.type === 'user' || m.type === 'assistant'
  ).length;

  // ========================================
  // SESSION MANAGEMENT
  // ========================================

  // Session callbacks (stable references to prevent infinite loops)
  const handleSessionLoaded = useCallback((message?: string) => {
    if (message) {
      setMessages((prev) => [
        ...prev,
        {
          type: 'system',
          content: message,
          timestamp: new Date(),
        },
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
        console.log(
          chalk.dim(
            `[Σ]  Session updated: ${event.previousSessionId} → ${event.newSessionId} (${event.reason})`
          )
        );
      }
    },
    [debugFlag]
  );

  // Session management (extracted to useSessionManager hook)
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

  // Convenient aliases for session state
  const anchorId = sessionManager.state.anchorId;
  const currentSessionId = sessionManager.state.currentSessionId;
  // NOTE: Do NOT capture resumeSessionId as const - use sessionManager.getResumeSessionId() directly
  // The getter checks a synchronous ref that bypasses React's async state updates

  // Ref to track current session ID synchronously (prevents duplicate session entries during rapid SDK messages)
  // React state updates are async, so during rapid message processing (347 msgs in 6s during turn analysis),
  // the state variable lags behind and causes duplicate "expiration" entries in compression_history
  const currentSessionIdRef = useRef(currentSessionId);

  // Keep ref in sync with state
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // ========================================
  // TURN ANALYSIS & COMPRESSION
  // ========================================

  // Intelligent recap for compression (not part of session manager)
  const [injectedRecap, setInjectedRecap] = useState<string | null>(null);
  // Pending message notification (injected on next turn)
  const [pendingMessageNotification, setPendingMessageNotification] = useState<
    string | null
  >(null);
  // Auto-response trigger (for agent messaging)
  const [shouldAutoRespond, setShouldAutoRespond] = useState(false);
  // Workbench health status (for status bar display)
  const [workbenchHealth, setWorkbenchHealth] = useState<{
    reachable: boolean;
    embeddingReady: boolean;
    summarizationReady: boolean;
    hasApiKey: boolean;
  } | null>(null);

  // ========================================
  // YOSSARIAN PROTOCOL (Infinite Loop Breaker)
  // ========================================
  // Prevents agents from burning API budget in "Thank you" -> "You're welcome" loops
  const autoResponseTimestamps = useRef<number[]>([]);
  const AUTO_RESPONSE_WINDOW_MS = 60000; // 1 minute window
  const AUTO_RESPONSE_MAX_IN_WINDOW = 5; // Max 5 auto-responses per minute

  // Turn analysis with background queue (replaces inline analyzeNewTurns)
  const turnAnalysis = useTurnAnalysis({
    embedder: embedderRef.current,
    projectRegistry: projectRegistryRef.current,
    conversationRegistry: conversationRegistryRef.current,
    cwd,
    sessionId: currentSessionId,
    debug: debugFlag,
  });

  // Compression callback (stable reference to prevent infinite loops)
  const handleCompressionTriggered = useCallback(
    async (tokens: number, turns: number) => {
      // ✅ CRITICAL FIX: Guard against concurrent compression requests
      if (compressionInProgressRef.current) {
        debug(
          '⏭️  Compression already in progress, skipping duplicate request'
        );
        return;
      }

      compressionInProgressRef.current = true;

      try {
        // Snapshot session ID before waiting (prevents session boundary race)
        const compressionSessionId = currentSessionId;

        debug('🗜️  Triggering compression');

        // 🆕 STEP 1: IMMEDIATELY NOTIFY USER (P0 UX REQUIREMENT)
        let progressMessageIndex = -1;
        setMessages((prev) => {
          progressMessageIndex = prev.length; // Track index for updates
          return [
            ...prev,
            {
              type: 'system',
              content:
                `⏳ Preparing context compression at ${(tokens / 1000).toFixed(1)}K tokens\n` +
                `   Analyzing ${turns} conversation turns (this may take 5-10s)...`,
              timestamp: new Date(),
            },
          ];
        });

        // STEP 2: Wait for analysis queue to complete (configurable timeout)
        const startTime = Date.now();
        const timeout = parseInt(
          process.env.SIGMA_COMPRESSION_TIMEOUT_MS || '60000', // 60s for network workbench
          10
        );

        // Throttle progress updates to every 500ms
        let lastProgressUpdate = 0;
        const PROGRESS_THROTTLE_MS = 500;

        // Helper to build progress bar: [▓▓▓▓▓░░░░░] 12/18
        const buildProgressBar = (current: number, total: number): string => {
          const barLength = 10;
          const filled = Math.floor((current / total) * barLength);
          const empty = barLength - filled;
          return (
            '[' +
            '▓'.repeat(filled) +
            '░'.repeat(empty) +
            ']' +
            ` ${current}/${total}`
          );
        };

        try {
          await turnAnalysis.waitForCompressionReady(
            timeout,
            (elapsed, status) => {
              // Throttle updates
              const now = Date.now();
              if (now - lastProgressUpdate < PROGRESS_THROTTLE_MS) {
                return;
              }
              lastProgressUpdate = now;

              const processed = status.totalProcessed;
              const remaining = status.queueLength;
              const total = processed + remaining;
              const elapsedSecs = (elapsed / 1000).toFixed(1);

              // Update progress message in-place
              setMessages((prev) => {
                // Validate index still exists
                if (
                  progressMessageIndex < 0 ||
                  progressMessageIndex >= prev.length
                ) {
                  return prev;
                }

                const updated = [...prev];
                updated[progressMessageIndex] = {
                  type: 'system',
                  content:
                    `⏳ Analyzing conversation turns... ${buildProgressBar(processed, total)}\n` +
                    `   Elapsed: ${elapsedSecs}s`,
                  timestamp: prev[progressMessageIndex].timestamp,
                };
                return updated;
              });
            }
          );
        } catch (waitError) {
          // 🆕 STEP 2a: USER-FRIENDLY TIMEOUT MESSAGE
          const timeoutSecs = ((Date.now() - startTime) / 1000).toFixed(1);

          setMessages((prev) => [
            ...prev,
            {
              type: 'system',
              content:
                `⚠️  Analysis timeout after ${timeoutSecs}s\n` +
                `   Compression postponed - your conversation continues normally`,
              timestamp: new Date(),
            },
          ]);

          console.error(
            '[Σ] Compression aborted: analysis queue timeout',
            waitError
          );

          // Reset compression state so it can be attempted again
          compression.reset();
          return;
        }

        const waitTime = Date.now() - startTime;

        // 🆕 STEP 2b: FINAL PROGRESS UPDATE (ensure UI shows 100% before "complete" message)
        // Fix for bug where progress bar gets stuck (e.g., 4/8) due to throttling
        const finalStatus = turnAnalysis.queueStatus;
        setMessages((prev) => {
          if (progressMessageIndex < 0 || progressMessageIndex >= prev.length) {
            return prev;
          }

          const updated = [...prev];
          updated[progressMessageIndex] = {
            type: 'system',
            content:
              `⏳ Analyzing conversation turns... ${buildProgressBar(finalStatus.totalProcessed, finalStatus.totalProcessed)}\n` +
              `   Elapsed: ${(waitTime / 1000).toFixed(1)}s`,
            timestamp: prev[progressMessageIndex].timestamp,
          };
          return updated;
        });

        // 🆕 STEP 3: UPDATE USER WITH COMPLETION
        setMessages((prev) => [
          ...prev,
          {
            type: 'system',
            content: `✓ Analysis complete (${(waitTime / 1000).toFixed(1)}s) - compressing conversation...`,
            timestamp: new Date(),
          },
        ]);

        debug('✅ Analysis queue ready, proceeding with compression');

        // FIX: Detect pending (unanalyzed) turn before compression
        // This fixes the bug where assistant's last message is dropped from compressed recap
        const lastMessage = messages[messages.length - 1];
        const lastAnalyzed =
          turnAnalysis.analyses[turnAnalysis.analyses.length - 1];

        const hasPendingTurn =
          lastMessage &&
          lastMessage.type !== 'system' &&
          lastMessage.type !== 'tool_progress' &&
          (!lastAnalyzed ||
            lastMessage.timestamp.getTime() > lastAnalyzed.timestamp);

        const pendingTurn = hasPendingTurn
          ? {
              message: lastMessage,
              messageIndex: messages.length - 1,
              timestamp: lastMessage.timestamp.getTime(),
            }
          : null;

        if (pendingTurn) {
          debug(
            `🔄 Detected pending turn (${pendingTurn.message.type}) - will re-analyze after compression`
          );
        }

        setMessages((prev) => [
          ...prev,
          {
            type: 'system',
            content:
              `🗜️  Context compression triggered at ${(tokens / 1000).toFixed(1)}K tokens\n` +
              `Compressing ${turns} turns into intelligent recap...`,
            timestamp: new Date(),
          },
        ]);

        // CRITICAL: Block user input during compression
        // Set isThinking to true to prevent user from sending messages during compression
        setIsThinking(true);
        debug('🔍 [COMPRESSION] Step 1: Set isThinking=true');

        // Track if compression succeeded (for conditional recap injection)
        let compressionSucceeded = false;

        try {
          debug('🔍 [COMPRESSION] Step 2: Importing compressor modules...');
          const { compressContext } = await import('../../sigma/compressor.js');
          const { reconstructSessionContext } =
            await import('../../sigma/context-reconstructor.js');
          const { loadSessionState } =
            await import('../../sigma/session-state.js');
          debug('🔍 [COMPRESSION] Step 3: Modules imported successfully');

          debug(
            `🔍 [COMPRESSION] Step 4: Starting compressContext with ${turnAnalysis.analyses.length} analyses...`
          );
          const result = await compressContext(turnAnalysis.analyses, {
            target_size: 40000,
          });
          debug(
            `🔍 [COMPRESSION] Step 5: compressContext complete (${result.lattice.nodes.length} nodes)`
          );

          // FIX: Add pending turn to lattice BEFORE building recap
          // This ensures the assistant's final message is included in the compressed recap
          const latticeWithPending = { ...result.lattice };
          if (pendingTurn) {
            const msgType = pendingTurn.message.type;
            const role: 'user' | 'assistant' | 'system' =
              msgType === 'user'
                ? 'user'
                : msgType === 'system'
                  ? 'system'
                  : 'assistant';
            const content = pendingTurn.message.content;

            // Create a minimal node for the pending turn
            const pendingNode: ConversationNode = {
              id: `pending_${Date.now()}`,
              type: 'conversation_turn',
              turn_id: `pending_${Date.now()}`,
              role,
              content,
              timestamp: pendingTurn.timestamp,
              embedding: [], // No embedding yet
              novelty: 0.5,
              overlay_scores: {
                O1_structural: 0,
                O2_security: 0,
                O3_lineage: 0,
                O4_mission: 0,
                O5_operational: 0,
                O6_mathematical: 0,
                O7_strategic: 0,
              },
              importance_score: 5, // Medium importance by default
              is_paradigm_shift: false,
              semantic_tags: [],
            };

            latticeWithPending.nodes = [...result.lattice.nodes, pendingNode];
            debug(`📝 Added pending turn to lattice (${role})`);
          }

          // FIX: Use reconstructSessionContext to build recap with system fingerprint
          debug(
            `🔍 [COMPRESSION] Step 6: Starting reconstructSessionContext with ${latticeWithPending.nodes.length} nodes...`
          );

          // Load todos from session state for injection into recap
          // (for providers without native SigmaTaskUpdate like Gemini/OpenAI)
          const sessionState = loadSessionState(anchorId, cwd);

          const sessionContext = await reconstructSessionContext(
            latticeWithPending,
            cwd,
            conversationRegistryRef.current || undefined,
            modelName,
            sessionState?.todos || undefined
          );
          debug('🔍 [COMPRESSION] Step 7: reconstructSessionContext complete');

          const recap =
            `COMPRESSED CONVERSATION RECAP (${latticeWithPending.nodes.length} key turns)\n` +
            `${(tokens / 1000).toFixed(1)}K → ${(result.compressed_size / 1000).toFixed(1)}K tokens\n\n` +
            sessionContext.recap;
          debug(`🔍 [COMPRESSION] Step 8: Recap built (${recap.length} chars)`);

          try {
            fs.writeFileSync(
              path.join(cwd, '.sigma', `${compressionSessionId}.recap.txt`),
              recap,
              'utf-8'
            );
          } catch (err) {
            console.error(
              'Failed to save recap file:',
              err instanceof Error ? err.message : String(err)
            );
            // Continue - recap is saved in memory via setInjectedRecap
          }

          // Only inject recap if compression fully succeeded
          debug('🔍 [COMPRESSION] Step 9: Setting injected recap');
          setInjectedRecap(recap);

          // FIX: Re-analyze pending turn in NEW session after compression
          if (pendingTurn) {
            debug('🔍 [COMPRESSION] Step 10: Re-analyzing pending turn...');
            debug('🔄 Re-analyzing pending turn in new session');
            await turnAnalysis.enqueueAnalysis(pendingTurn);
            debug(
              '🔍 [COMPRESSION] Step 11: Pending turn re-analysis complete'
            );
          }

          compressionSucceeded = true;
          debug('🔍 [COMPRESSION] Step 12: Compression succeeded!');
          debug(
            `✅ Compression: ${result.lattice.nodes.length} nodes, ${(result.compressed_size / 1000).toFixed(1)}K tokens`
          );

          // Show success message to user with compression stats
          setMessages((prev) => [
            ...prev,
            {
              type: 'system',
              content:
                `✅ Compression complete!\n` +
                `   ${result.lattice.nodes.length} key turns preserved (${(tokens / 1000).toFixed(1)}K → ${(result.compressed_size / 1000).toFixed(1)}K tokens)\n` +
                `   Conversation continues with intelligent recap...`,
              timestamp: new Date(),
            },
          ]);
        } catch (err) {
          // CRITICAL FIX: Show error to user (not just debug log)
          const errorMessage = err instanceof Error ? err.message : String(err);
          debug('🔍 [COMPRESSION] ERROR:', errorMessage);
          debug('❌ Compression failed:', errorMessage);

          setMessages((prev) => [
            ...prev,
            {
              type: 'system',
              content:
                `❌ Context compression failed: ${errorMessage}\n` +
                `   Starting fresh session anyway to prevent token limit issues.`,
              timestamp: new Date(),
            },
          ]);
        } finally {
          debug(
            '🔍 [COMPRESSION] Step 13: In finally block - resetting session'
          );
          // CRITICAL FIX: ALWAYS reset session, even if compression fails
          // This ensures we start a fresh session and avoid hitting token limits again
          sessionManager.resetResumeSession();
          debug(
            `🔄 Session reset triggered (compression ${compressionSucceeded ? 'succeeded' : 'failed but resetting anyway'})`
          );

          // Don't set isThinking(false) here - the agent is still responding!
          // The agent completion handler in sendMessage will set it when done
          debug(
            '🔍 [COMPRESSION] Step 14: Compression complete (keeping isThinking=true for agent response)'
          );
          debug('🔍 [COMPRESSION] Step 15: Compression handler complete!');
        }
      } finally {
        // ✅ CRITICAL: Always release lock
        compressionInProgressRef.current = false;
      }
    },
    [
      debug,
      messages,
      turnAnalysis,
      cwd,
      currentSessionId,
      sessionManager,
      setMessages,
    ]
  );

  // Compression orchestration (replaces inline compression trigger logic)
  const isGemini =
    providerName === 'gemini' || (modelName && modelName.includes('gemini'));
  const compression = useCompression({
    tokenCount: tokenCounter.count.total,
    analyzedTurns: turnAnalysis.stats.totalAnalyzed,
    isThinking,
    tokenThreshold: sessionTokens,
    semanticThreshold: isGemini ? 50000 : undefined,
    tpmLimit: isGemini ? 1000000 : undefined,
    minTurns: isGemini ? 1 : 5,
    enabled: true,
    debug: debugFlag,
    onCompressionTriggered: handleCompressionTriggered,
  });

  // ========================================
  // HELPER FUNCTIONS
  // ========================================

  // Update session stats (delegated to sessionManager)
  const updateAnchorStats = useCallback(() => {
    sessionManager.updateStats(turnAnalysis.analyses);
  }, [sessionManager, turnAnalysis.analyses]);

  // ========================================
  // INITIALIZATION EFFECTS
  // ========================================

  /**
   * Initialize LLM providers on mount.
   *
   * Registers available providers (Claude, Gemini) with the global registry.
   * This enables multi-provider support throughout the TUI.
   */
  useEffect(() => {
    const initProviders = async () => {
      try {
        const { initializeProviders } = await import('../../llm/index.js');
        await initializeProviders();
        if (debugFlag) {
          const { registry } = await import('../../llm/index.js');
          console.log(
            chalk.dim('[Σ] LLM providers initialized:'),
            registry.list().join(', ')
          );
        }
      } catch (error) {
        console.error(
          'Failed to initialize LLM providers:',
          error instanceof Error ? error.message : String(error)
        );
      }
    };

    initProviders();
  }, []); // Only run once on mount

  /**
   * Initialize Sigma services on mount.
   *
   * Creates:
   * - EmbeddingService: For generating semantic embeddings
   * - ConversationOverlayRegistry: For O1-O7 conversation overlays
   * - RecallMcpServer: MCP tool for memory queries
   * - OverlayRegistry: For project PGC overlays (if exists)
   */
  useEffect(() => {
    const initSigmaServices = async () => {
      const endpoint = process.env.WORKBENCH_URL || 'http://localhost:8000';
      embedderRef.current = new EmbeddingService(endpoint);
      const sigmaPath = path.join(cwd, '.sigma');
      conversationRegistryRef.current = new ConversationOverlayRegistry(
        sigmaPath,
        endpoint,
        debugFlag
      );

      let claudeAgentSdkModule;
      try {
        const claudeAgentSdkName = '@anthropic-ai/claude-agent-sdk';
        claudeAgentSdkModule = await import(claudeAgentSdkName);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        // SDK not available - recall tool will be disabled silently
      }

      recallMcpServerRef.current = createRecallMcpServer(
        conversationRegistryRef.current,
        claudeAgentSdkModule,
        endpoint
      );

      // Initialize background task manager and MCP server
      try {
        backgroundTaskManagerRef.current = getBackgroundTaskManager(cwd);
        backgroundTasksMcpServerRef.current = createBackgroundTasksMcpServer(
          () => backgroundTaskManagerRef.current,
          claudeAgentSdkModule
        );
      } catch {
        // Task manager not needed if not running wizard - silent fail
      }

      // Initialize agent messaging MCP server (for agent-to-agent communication)
      if (getMessagePublisher) {
        agentMessagingMcpServerRef.current = createAgentMessagingMcpServer(
          getMessagePublisher,
          getMessageQueue, // New argument
          cwd,
          sessionIdProp || 'unknown', // Current agent ID for excluding self
          claudeAgentSdkModule
        );

        // Initialize cross-project query MCP server (for semantic queries across repos)
        crossProjectQueryMcpServerRef.current =
          createCrossProjectQueryMcpServer(
            getMessagePublisher,
            getMessageQueue,
            cwd,
            sessionIdProp || 'unknown',
            claudeAgentSdkModule,
            addSystemMessage
          );
      }

      // Initialize SigmaTaskUpdate MCP server (for Claude provider)
      // Provides task management with delegation support, replacing native TodoWrite
      sigmaTaskUpdateMcpServerRef.current = createSigmaTaskUpdateMcpServer(
        cwd,
        anchorId,
        claudeAgentSdkModule
      );

      const pgcPath = path.join(cwd, '.open_cognition');
      if (fs.existsSync(pgcPath))
        projectRegistryRef.current = new OverlayRegistry(pgcPath, endpoint);

      // Use cached health result if provided (avoids redundant /health call)
      // Otherwise check workbench health for status bar display
      const healthResult =
        initialWorkbenchHealth ??
        (await checkWorkbenchHealthDetailed(endpoint, true));
      const hasApiKey = !!process.env.WORKBENCH_API_KEY;

      setWorkbenchHealth({
        reachable: healthResult.reachable,
        embeddingReady: healthResult.embeddingReady,
        summarizationReady: healthResult.summarizationReady,
        hasApiKey,
      });
    };

    initSigmaServices();
  }, [cwd, debugFlag, initialWorkbenchHealth]);

  /**
   * Listen for new messages arriving and set notification.
   * This triggers when messages arrive while agent is idle (not in a turn).
   * Uses polling to wait for queue to be available (initialized async in index.tsx).
   */
  useEffect(() => {
    if (!getMessageQueue) return;

    let previousCount = 0;
    let cleanup: (() => void) | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const handleCountChanged = async (...args: unknown[]) => {
      const newCount = args[0] as number;

      // Only notify when count increases (new message arrived)
      if (newCount > previousCount && newCount > 0) {
        // Fetch and inject actual messages
        const queue = getMessageQueue();
        if (queue) {
          const pendingMessages = await queue.getMessages('pending');
          if (pendingMessages.length > 0) {
            const formattedMessages = formatPendingMessages(pendingMessages);
            const notification = `📬 **New messages from other agents:**\n\n${formattedMessages}\n\nPlease acknowledge and respond to these messages.`;
            setPendingMessageNotification(notification);

            // Trigger auto-response so agent sees and responds to messages
            // Only if autoResponse is enabled (--no-auto-response disables this)
            if (autoResponse) {
              // YOSSARIAN PROTOCOL: Rate limit auto-responses to prevent infinite loops
              const now = Date.now();
              const windowStart = now - AUTO_RESPONSE_WINDOW_MS;
              // Clean old timestamps
              autoResponseTimestamps.current =
                autoResponseTimestamps.current.filter((t) => t > windowStart);

              if (
                autoResponseTimestamps.current.length <
                AUTO_RESPONSE_MAX_IN_WINDOW
              ) {
                autoResponseTimestamps.current.push(now);
                setShouldAutoRespond(true);
              } else {
                // Rate limit hit - show warning instead
                setMessages((prev) => [
                  ...prev,
                  {
                    type: 'system',
                    content: `⚠️ Auto-response rate limit hit (${AUTO_RESPONSE_MAX_IN_WINDOW}/min). Send a message to respond.`,
                    timestamp: new Date(),
                  },
                ]);
              }
            }

            // Also show in UI (abbreviated)
            setMessages((prev) => [
              ...prev,
              {
                type: 'system',
                content: `📬 ${pendingMessages.length} pending message${pendingMessages.length > 1 ? 's' : ''} injected into context`,
                timestamp: new Date(),
              },
            ]);
          }
        }
      }

      previousCount = newCount;
    };

    const setupListener = () => {
      const queue = getMessageQueue();
      if (!queue) return false;

      queue.on('countChanged', handleCountChanged);

      // Get initial count
      queue.getPendingCount().then((count) => {
        previousCount = count;
      });

      cleanup = () => {
        queue.off('countChanged', handleCountChanged);
      };

      return true;
    };

    // Try immediately
    if (!setupListener()) {
      // Queue not ready, poll until available (initialized async in index.tsx)
      pollInterval = setInterval(() => {
        if (setupListener() && pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      }, 500);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (cleanup) cleanup();
    };
  }, [getMessageQueue, autoResponse]);

  /**
   * Load slash commands from .claude/commands/ directory.
   *
   * Commands are markdown files that expand into full prompts.
   * Loaded once on mount and cached for the session.
   */
  useEffect(() => {
    loadCommands(cwd)
      .then((result) => {
        setCommandsCache(result.commands);
        // Log any errors/warnings
        if (result.errors.length > 0 && debugFlag) {
          console.error('Command loading errors:', result.errors);
        }
        if (result.warnings.length > 0 && debugFlag) {
          console.warn('Command loading warnings:', result.warnings);
        }
      })
      .catch((error) => {
        console.error('Failed to load commands:', error);
        // Continue without commands - non-critical failure
      });
  }, [cwd, debugFlag]);

  /**
   * Load existing conversation lattice from LanceDB on session resume.
   *
   * Reconstructs turn analyses from persisted LanceDB vectors.
   * Only runs once per session (tracked by latticeLoadedRef).
   */
  useEffect(() => {
    const loadLattice = async () => {
      // Get current resume session ID dynamically (bypasses React async state)
      const currentResumeId = sessionManager.getResumeSessionId();
      const sessionId = currentResumeId || anchorId;

      // Skip if already loaded for this session
      if (latticeLoadedRef.current.has(sessionId)) return;
      latticeLoadedRef.current.add(sessionId);

      try {
        const { rebuildTurnAnalysesFromLanceDB } =
          await import('../../sigma/lattice-reconstructor.js');

        const restoredAnalyses = await rebuildTurnAnalysesFromLanceDB(
          sessionId,
          cwd
        );

        if (restoredAnalyses.length === 0) return;

        turnAnalysis.setAnalyses(restoredAnalyses);

        // Load recap for compression injection
        const recapPath = path.join(cwd, '.sigma', `${sessionId}.recap.txt`);
        if (fs.existsSync(recapPath)) {
          const recapContent = fs.readFileSync(recapPath, 'utf-8');
          const recapLines = recapContent.split('\n');
          const recapStartIdx = recapLines.findIndex((line) =>
            line.startsWith('='.repeat(80))
          );
          if (recapStartIdx >= 0) {
            setInjectedRecap(recapLines.slice(recapStartIdx + 2).join('\n'));
          }
        }

        setMessages((prev) => [
          ...prev,
          {
            type: 'system',
            content: `🕸️  Resumed session with ${restoredAnalyses.length} turns from LanceDB`,
            timestamp: new Date(),
          },
        ]);
      } catch (err) {
        console.warn('Failed to load lattice from LanceDB:', err);
        // Continue with fresh session - non-critical failure
      }
    };

    loadLattice();
    // resumeSessionId removed from deps - using sessionManager.getResumeSessionId() directly
    // sessionManager is a stable object (doesn't change), so no need to include in deps
  }, [anchorId, cwd, sessionManager]);

  // ========================================
  // MESSAGE SYNCHRONIZATION
  // ========================================

  /**
   * Keep messagesRef in sync with messages state.
   *
   * Required for turn analysis effect to access latest messages
   * without re-triggering the effect on every message change.
   */
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ========================================
  // TURN ANALYSIS QUEUEING
  // ========================================

  /**
   * Queue turn analysis in background (non-blocking).
   *
   * CRITICAL DESIGN:
   * This effect must NOT block the conversation flow. Turn analysis
   * is CPU-intensive (embeddings, vector search) and happens asynchronously
   * in a background queue.
   *
   * ALGORITHM:
   * 1. Find unanalyzed messages (user/assistant only)
   * 2. Skip if embedder not initialized
   * 3. Skip assistant messages if still streaming (isThinking)
   * 4. Queue each unanalyzed message for background processing
   * 5. Check compression threshold after queueing
   *
   * DEPENDENCIES:
   * - userAssistantMessageCount: Triggers only on user/assistant messages
   *   (NOT on system/tool_progress to prevent infinite loops)
   * - isThinking: Ensures assistant messages fully streamed before analysis
   */
  useEffect(() => {
    const currentMessages = messagesRef.current;
    if (currentMessages.length === 0) return;

    const queueNewAnalyses = async () => {
      try {
        // Skip if embedder not initialized yet
        if (!embedderRef.current) {
          if (debugFlag) {
            console.log(chalk.dim('[Σ]  Embedder not initialized'));
          }
          return;
        }

        if (debugFlag) {
          console.log(
            chalk.dim('[Σ]  Queue effect triggered, messages:'),
            currentMessages.length,
            'isThinking:',
            isThinking
          );
        }

        // Find unanalyzed messages (ONLY user/assistant, skip system/tool_progress)
        const lastIndex =
          turnAnalysis.analyses.length > 0
            ? turnAnalysis.analyses.length - 1
            : -1;
        const unanalyzedMessages = currentMessages
          .slice(lastIndex + 1)
          .map((msg, idx) => ({
            msg,
            originalIndex: lastIndex + 1 + idx,
          }))
          .filter(({ msg }) => msg.type === 'user' || msg.type === 'assistant');

        if (unanalyzedMessages.length === 0) {
          debug(' No unanalyzed messages');
          return;
        }

        debug(
          ' Unanalyzed user/assistant messages:',
          unanalyzedMessages.length
        );

        // Queue each unanalyzed message for background processing
        for (const {
          msg: message,
          originalIndex: messageIndex,
        } of unanalyzedMessages) {
          // For assistant messages, only queue if we're NOT currently thinking
          if (message.type === 'assistant' && isThinking) {
            debug(
              '   Skipping assistant message - still streaming (will retry after stream completes)'
            );
            continue; // ✅ CRITICAL FIX: Skip THIS message, continue to next (not return!)
          }

          const turnTimestamp = message.timestamp.getTime();

          // Skip if already analyzed
          if (turnAnalysis.hasAnalyzed(turnTimestamp)) {
            debug('   Turn already analyzed, skipping');
            continue;
          }

          // Get cached embedding for user messages
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

          // Clean up cached embedding
          if (cachedEmbedding) {
            userMessageEmbeddingCache.current.delete(turnTimestamp);
          }
        }

        // 🔄 COMPRESSION MOVED TO sendMessage()
        // Compression now triggers synchronously when user sends message (user action)
        // NOT from this effect (async React render cycle)
        // This prevents React effect deadlocks with LanceDB getAllItems()
        // See sendMessage() STEP 0 for new compression logic
      } catch (error) {
        // Log queueing errors but don't block conversation flow
        debug('❌ Queueing error:', error);
      }
    };

    queueNewAnalyses();
  }, [
    userAssistantMessageCount,
    isThinking,
    debug,
    debugFlag,
    turnAnalysis.enqueueAnalysis,
    turnAnalysis.hasAnalyzed,
    compression.shouldTrigger,
    compression.triggerCompression,
  ]);

  // ========================================
  // SESSION LIFECYCLE
  // ========================================

  /**
   * Set current session ID and cleanup on unmount.
   *
   * Ensures conversation registry knows which session is active.
   * Flushes all conversation overlays to LanceDB on unmount.
   */
  useEffect(() => {
    conversationRegistryRef.current?.setCurrentSession(currentSessionId);
    return () => {
      // Note: cleanup functions can't be async, but we handle the promise
      conversationRegistryRef.current
        ?.flushAll(currentSessionId)
        .catch((err) => {
          console.error('Failed to flush conversation overlays:', err);
        });
    };
  }, [currentSessionId]);

  // ========================================
  // TOKEN PERSISTENCE (synchronized with TUI)
  // ========================================

  /**
   * Persist token count whenever TUI display updates.
   * useEffect ensures file write happens AFTER React state update.
   */
  useEffect(() => {
    // Skip if no session manager or tokens unchanged
    if (tokenCounter.count.total === lastPersistedTokensRef.current) return;

    sessionManager.updateTokens(tokenCounter.count);
    lastPersistedTokensRef.current = tokenCounter.count.total;
  }, [tokenCounter.count, sessionManager]);

  // ========================================
  // OVERLAY STATISTICS
  // ========================================

  /**
   * Compute overlay scores from conversation registry.
   *
   * Calculates average project alignment scores for each overlay (O1-O7).
   * Updates when turn analysis completes.
   */
  useEffect(() => {
    async function computeOverlayScores() {
      if (!conversationRegistryRef.current || !currentSessionId) return;

      try {
        const registry = conversationRegistryRef.current;
        const scores = {
          O1_structural: 0,
          O2_security: 0,
          O3_lineage: 0,
          O4_mission: 0,
          O5_operational: 0,
          O6_mathematical: 0,
          O7_strategic: 0,
        };

        // Compute average alignment score for each overlay
        const overlayIds: Array<
          'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'
        > = ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'];

        for (const overlayId of overlayIds) {
          try {
            const manager = await registry.get(overlayId);
            const items = await manager.getAllItems();

            if (items.length > 0) {
              // Calculate average project_alignment_score
              const total = items.reduce((sum, item) => {
                // @ts-expect-error - metadata might have project_alignment_score
                return sum + (item.metadata?.project_alignment_score || 0);
              }, 0);
              const avg = total / items.length;

              // Map to overlay name format
              const key =
                `${overlayId}_${overlayId === 'O1' ? 'structural' : overlayId === 'O2' ? 'security' : overlayId === 'O3' ? 'lineage' : overlayId === 'O4' ? 'mission' : overlayId === 'O5' ? 'operational' : overlayId === 'O6' ? 'mathematical' : 'strategic'}` as keyof typeof scores;
              scores[key] = avg;
            }
          } catch (err) {
            // Skip if overlay not available
            debug(`Failed to compute ${overlayId} scores: ${err}`);
          }
        }

        setOverlayScores(scores);
      } catch (err) {
        debug('Failed to compute overlay scores:', err);
      }
    }

    // Recompute when analyses change
    if (turnAnalysis.stats.totalAnalyzed > 0) {
      computeOverlayScores();
    }
  }, [turnAnalysis.stats.totalAnalyzed, currentSessionId, debug]);

  /**
   * Send a message to Claude and process the response.
   *
   * ALGORITHM:
   * 1. Expand slash commands (if input starts with /)
   * 2. Add user message to conversation
   * 3. Inject semantic context from lattice (if available)
   * 4. Create SDK query with Claude Code preset
   * 5. Stream response and update messages
   * 6. Queue turn for background analysis
   * 7. Check compression threshold
   *
   * SLASH COMMAND EXPANSION:
   * Commands are loaded from .claude/commands/*.md files.
   * Format: /command-name args
   * Example: /review-pr 123 → expands to full PR review prompt
   *
   * CONTEXT INJECTION:
   * If conversation lattice exists, inject relevant context via semantic search:
   * - Embed user query
   * - Search lattice for similar turns
   * - Prepend relevant context to prompt
   * - Improves coherence and reduces repetition
   *
   * ERROR HANDLING:
   * - Authentication errors: Show friendly auth setup message
   * - SDK errors: Parse stderr for helpful diagnostics
   * - Network errors: Display connection issues
   *
   * @param prompt - User input (may be slash command or regular text)
   *
   * @example
   * await sendMessage('Explain the overlay system');
   *
   * @example
   * await sendMessage('/review-pr 42');
   */
  const sendMessage = useCallback(
    async (prompt: string) => {
      try {
        if (process.env.DEBUG_ESC_INPUT) {
          console.error('[useAgent] Setting isThinking=true');
        }
        setIsThinking(true);
        setError(null);

        // STEP 1: Expand slash command FIRST (before adding user message)
        let finalPrompt = prompt;

        // Only treat as command if it starts with / but is NOT a file path or glob pattern
        // File paths have another / in the first word (e.g., /home/user/file.txt)
        // Glob patterns contain * ? or [ (e.g., /** or /src/*.ts)
        const firstWord = prompt.split(' ')[0];
        const isGlobPattern = /[*?[]/.test(firstWord);
        const isCommand =
          prompt.startsWith('/') &&
          !firstWord.slice(1).includes('/') &&
          !isGlobPattern;

        if (isCommand && commandsCache.size > 0) {
          const commandName = prompt.split(' ')[0];

          // Skip expansion if user just typed "/" alone
          if (commandName === '/') {
            // Just treat as normal text, don't try to expand
            // This allows "/" to be used in regular conversation
          } else {
            const expanded = expandCommand(prompt, commandsCache);

            if (expanded) {
              finalPrompt = expanded;

              // Show system message about expansion
              setMessages((prev) => [
                ...prev,
                {
                  type: 'system',
                  content: `🔧 Expanding command: ${commandName} (${expanded.length} chars)`,
                  timestamp: new Date(),
                },
              ]);
            } else {
              // Unknown command - handle gracefully without throwing
              const allCommandNames = Array.from(commandsCache.keys());

              // Try to find similar commands (simple string distance)
              const lowerInput = commandName.slice(1).toLowerCase();
              const similar = allCommandNames
                .filter((name) => {
                  const lowerName = name.toLowerCase();
                  return (
                    lowerName.includes(lowerInput) ||
                    lowerInput.includes(lowerName)
                  );
                })
                .slice(0, 3);

              let errorMessage = `Unknown command: ${commandName}\n`;

              if (similar.length > 0) {
                errorMessage += `Did you mean: ${similar.map((s) => `/${s}`).join(', ')}?\n`;
              } else {
                const firstFive = allCommandNames
                  .slice(0, 5)
                  .map((c) => `/${c}`)
                  .join(', ');
                errorMessage += `Available commands: ${firstFive}...\n`;
              }

              errorMessage += `Type '/' to see all ${commandsCache.size} available commands.`;

              // Show inline system message (don't use setError - that triggers full-screen error box)
              setMessages((prev) => [
                ...prev,
                {
                  type: 'user',
                  content: prompt,
                  timestamp: new Date(),
                },
                {
                  type: 'system',
                  content: `❌ ${errorMessage}`,
                  timestamp: new Date(),
                },
              ]);
              setIsThinking(false);

              if (process.env.DEBUG_ESC_INPUT) {
                console.error(
                  '[useAgent] DEBUG: returning early from unknown command'
                );
              }
              return;
            }
          }
        }

        // STEP 2: Add user message (show ORIGINAL input, not expanded)
        // Skip for auto-response triggers (agent messaging)
        const isAutoResponse = prompt === '__AUTO_RESPONSE__';
        const userMessageTimestamp = new Date();
        if (!isAutoResponse) {
          setMessages((prev) => [
            ...prev,
            {
              type: 'user',
              content: prompt, // Show what user typed
              timestamp: userMessageTimestamp,
            },
          ]);
        }

        // STEP 2.5: Check if compression needed AFTER user message added to state
        // This runs synchronously as part of user action, NOT in useEffect
        // Prevents React effect deadlocks with getAllItems()
        // User's message is now in state, so compression will include it
        if (compression.shouldTrigger && !compressionInProgressRef.current) {
          debug('🔄 Compression needed after adding user message...');
          // Keep isThinking=true (already set above)
          // Wait a tick to ensure message state updates propagate (Fixes "Tail Race" condition)
          await new Promise((resolve) => setTimeout(resolve, 100));
          await compression.triggerCompression(); // Wait for compression
          debug('✅ Compression complete, proceeding with Claude query...');
        }

        // Collect stderr for better error messages
        const stderrLines: string[] = [];

        // STEP 3: Continue with existing logic (context injection, SDK query, etc.)
        // Prepare prompt with optional recap injection OR real-time context injection
        // Use finalPrompt instead of prompt from here on

        if (injectedRecap) {
          // Inject recap as part of the user prompt to preserve claude_code preset
          finalPrompt = `${injectedRecap}\n\n---\n\nUser request: ${finalPrompt}`;
          // Clear recap after first injection - subsequent queries use real-time context injection
          // This ensures: 1st query = full recap, 2nd+ queries = semantic lattice search
          setInjectedRecap(null);
        }

        // Inject pending message notification if present
        if (pendingMessageNotification) {
          if (isAutoResponse) {
            // For auto-response, the notification IS the prompt
            finalPrompt = `<system-reminder>\n${pendingMessageNotification}\n</system-reminder>`;
          } else {
            finalPrompt = `<system-reminder>\n${pendingMessageNotification}\n</system-reminder>\n\n${finalPrompt}`;
          }
          // Clear notification after injection
          setPendingMessageNotification(null);
        }

        if (
          !injectedRecap &&
          embedderRef.current &&
          turnAnalysis.analyses.length > 0
        ) {
          // Real-time lattice context injection for fluent conversation
          try {
            // For slash commands, use original prompt (not expanded) for context search
            const searchPrompt = prompt.startsWith('/') ? prompt : finalPrompt;

            const result = await injectRelevantContext(
              searchPrompt,
              turnAnalysis.analyses,
              embedderRef.current,
              { debug: debugFlag }
            );

            // If this was a command expansion, prepend context to expanded command
            if (prompt.startsWith('/') && finalPrompt !== prompt) {
              finalPrompt = `${result.message}\n\n---\n\n${finalPrompt}`;
            } else {
              finalPrompt = result.message;
            }

            // Cache the user message embedding for reuse in analyzeTurn
            if (result.embedding) {
              userMessageEmbeddingCache.current.set(
                userMessageTimestamp.getTime(),
                result.embedding
              );
            }

            // Context injected successfully
          } catch (err) {
            // Fail gracefully - use original prompt
            console.error(
              `Context injection error: ${err instanceof Error ? err.message : String(err)}`
            );
          }
        }

        // Get current resume session ID dynamically (bypasses React async state)
        // CRITICAL: Must call getter directly, NOT use captured const
        // This ensures we get the latest value even if resetResumeSession() was just called
        const currentResumeId = sessionManager.getResumeSessionId();

        // Create agent provider adapter for multi-provider support
        const adapter = new AgentProviderAdapter({
          provider: providerName,
          model: modelName,
          cwd: cwd,
          resumeSessionId: currentResumeId, // undefined after compression = fresh session!
          maxThinkingTokens, // Enable extended thinking if specified
          displayThinking, // Control thinking block generation
          conversationRegistry: conversationRegistryRef.current || undefined,
          workbenchUrl: process.env.WORKBENCH_URL || 'http://localhost:8000',
          getTaskManager, // Pass task manager getter for background tasks tool
          getMessagePublisher, // Pass message publisher getter for agent messaging tools
          getMessageQueue, // Pass message queue getter for agent messaging tools
          projectRoot: cwd, // Pass project root for agent discovery
          agentId: sessionIdProp || 'unknown', // Pass current agent ID for excluding self from listings
          anchorId, // Pass session anchor ID for SigmaTaskUpdate state persistence
          remainingTPM: 1000000 - tokenCounter.count.total, // Pass remaining TPM for dynamic budgeting
          onStderr: (data: string) => {
            stderrLines.push(data);
          },
          onCanUseTool: async (toolName, input) => {
            // Block Claude SDK's native TodoWrite - we provide SigmaTaskUpdate instead
            // Native TodoWrite lacks delegation support needed for Manager/Worker pattern
            // See: https://github.com/anthropics/claude-code/issues/6760
            if (toolName === 'TodoWrite' && providerName === 'claude') {
              if (debugFlag) {
                console.log(
                  '[useAgent] Blocking native TodoWrite for Claude provider, using SigmaTaskUpdate instead'
                );
              }
              return {
                behavior: 'deny',
                updatedInput: input,
              };
            }

            // Auto-approve SigmaTaskUpdate for all providers (matches Gemini/OpenAI behavior)
            // SigmaTaskUpdate is a read-only tool that only updates session state
            // Note: MCP tools are prefixed with "mcp__<server-name>__"
            if (
              toolName === 'SigmaTaskUpdate' ||
              toolName === 'mcp__sigma-task-update__SigmaTaskUpdate'
            ) {
              return {
                behavior: 'allow',
                updatedInput: input,
              };
            }

            // Use confirmation callback if provided (guardrails)
            if (onRequestToolConfirmation) {
              const decision = await onRequestToolConfirmation(toolName, input);
              return {
                behavior: decision,
                updatedInput: input,
              };
            }

            // Auto-approve if no confirmation callback provided
            return {
              behavior: 'allow',
              updatedInput: input,
            };
          },
          // Add MCP servers for agent tools
          mcpServers: buildMcpServers({
            recallServer: recallMcpServerRef.current,
            backgroundTasksServer: backgroundTasksMcpServerRef.current,
            agentMessagingServer: agentMessagingMcpServerRef.current,
            crossProjectQueryServer: crossProjectQueryMcpServerRef.current,
            sigmaTaskUpdateServer: sigmaTaskUpdateMcpServerRef.current,
            hasConversationHistory:
              !!currentResumeId || turnAnalysis.analyses.length > 0,
          }),
          debug: debugFlag,
        });

        // Store adapter for interrupt functionality
        currentAdapterRef.current = adapter;
        abortedRef.current = false; // Reset abort flag for new query

        // Process streaming agent responses
        let previousMessageCount = 0;
        let hasAssistantMessage = false;
        let lastResponse:
          | import('../../llm/agent-provider-interface.js').AgentResponse
          | null = null;
        let turnWasSemantic = false; // Tracks if SigmaTaskUpdate was used in this turn

        for await (const response of adapter.query(finalPrompt)) {
          lastResponse = response;
          // Process only new messages (delta)
          const newMessages = response.messages.slice(previousMessageCount);
          previousMessageCount = response.messages.length;

          // Update session ID from response
          if (response.sessionId) {
            const prevSessionId = currentSessionIdRef.current;
            if (prevSessionId !== response.sessionId) {
              debug(
                ' Agent session changed:',
                prevSessionId,
                '→',
                response.sessionId
              );

              const reason = compression.state.triggered
                ? 'compression'
                : prevSessionId.startsWith('tui-')
                  ? 'initial'
                  : 'expiration';

              const compressedTokens =
                reason === 'compression'
                  ? compression.state.lastCompressedTokens ||
                    tokenCounter.count.total
                  : undefined;

              sessionManager.updateSDKSession(
                response.sessionId,
                reason,
                compressedTokens
              );

              if (compression.state.triggered) {
                compression.reset();
                tokenCounter.reset(); // useEffect will persist 0 in sync with TUI
                debug(
                  ' Compression flag reset - can compress again in new session'
                );
              }

              if (
                !sessionManager.state.hasReceivedSDKSessionId &&
                conversationRegistryRef.current
              ) {
                conversationRegistryRef.current
                  .flushAll(response.sessionId)
                  .then(() => {
                    debug(
                      ' Initial flush completed with session ID:',
                      response.sessionId
                    );
                    updateAnchorStats();
                  })
                  .catch((err) => {
                    debug(' Initial flush failed:', err);
                  });
              }
            }
          }

          // Update token counts (map AgentResponse tokens to TokenCount format)
          const newTokens = {
            input: response.tokens.prompt,
            output: response.tokens.completion,
            total: response.tokens.total,
          };
          tokenCounter.update(newTokens);

          // Check for semantic triggers (SigmaTaskUpdate)
          if (
            response.toolResult &&
            (response.toolResult.name === 'SigmaTaskUpdate' ||
              response.toolResult.name ===
                'mcp__sigma-task-update__SigmaTaskUpdate')
          ) {
            turnWasSemantic = true;
          }

          // Process new messages
          for (const agentMessage of newMessages) {
            if (agentMessage.type === 'assistant') {
              hasAssistantMessage = true;
            }
            processAgentMessage(agentMessage);
          }
        }

        // Show completion message if query succeeded
        if (lastResponse && hasAssistantMessage) {
          const cost = (lastResponse.tokens.total / 1_000_000) * 3; // Rough estimate
          const messageCount = lastResponse.messages.length;
          setMessages((prev) => [
            ...prev,
            {
              type: 'system',
              content: `✓ Complete (${lastResponse.numTurns} turns, ${messageCount} messages, ~$${cost.toFixed(4)})`,
              timestamp: new Date(),
            },
          ]);

          // Check for pending messages after turn completes
          // If there are pending messages, fetch and inject them directly
          if (getMessageQueue) {
            const queue = getMessageQueue();
            if (queue) {
              const pendingMessages = await queue.getMessages('pending');
              if (pendingMessages.length > 0) {
                // Inject the actual message content, not just a notification
                const formattedMessages =
                  formatPendingMessages(pendingMessages);
                const notification = `📬 **New messages from other agents:**\n\n${formattedMessages}\n\nPlease acknowledge and respond to these messages.`;
                setPendingMessageNotification(notification);
                // Also show in UI (abbreviated)
                setMessages((prev) => [
                  ...prev,
                  {
                    type: 'system',
                    content: `📬 ${pendingMessages.length} pending message${pendingMessages.length > 1 ? 's' : ''} injected into context`,
                    timestamp: new Date(),
                  },
                ]);
              }
            }
          }

          // Trigger semantic compression if SigmaTaskUpdate was used (Gemini only)
          if (
            providerName === 'gemini' &&
            turnWasSemantic &&
            compression.getTriggerInfo(true).shouldTrigger
          ) {
            debug('🔄 Semantic compression triggered by SigmaTaskUpdate...');
            // Wait a tick to ensure message state updates propagate
            await new Promise((resolve) => setTimeout(resolve, 100));
            // Trigger compression immediately (flush=true)
            await compression.triggerCompression(true);
            debug('✅ Semantic compression complete');
          } else if (compression.shouldTrigger) {
            // Check for normal compression if semantic didn't trigger
            debug('🔄 Standard compression triggered by token threshold...');
            // Wait a tick to ensure message state updates propagate (Fixes "Tail Race" condition)
            await new Promise((resolve) => setTimeout(resolve, 100));
            await compression.triggerCompression();
            debug('✅ Standard compression complete');
          }
        }

        // If query completed without assistant response, show error
        // BUT: Don't show error if user aborted via ESC key
        if (
          !hasAssistantMessage &&
          previousMessageCount <= 1 &&
          !abortedRef.current
        ) {
          // Check for authentication errors in stderr
          let errorMsg = '';

          if (isAuthenticationError(stderrLines)) {
            errorMsg = formatAuthError();
          } else {
            errorMsg = formatSDKError(stderrLines, hasAssistantMessage);
          }

          setError(errorMsg);
          setMessages((prev) => [
            ...prev,
            {
              type: 'system',
              content: `❌ ${errorMsg}`,
              timestamp: new Date(),
            },
          ]);
        }

        if (process.env.DEBUG_ESC_INPUT) {
          console.error('[useAgent] Setting isThinking=false (success)');
        }
        setIsThinking(false);
      } catch (err) {
        const originalError = (err as Error).message;
        let errorMsg = originalError;

        // Check if this is an authentication error
        const mockStderr = [originalError];
        if (isAuthenticationError(mockStderr)) {
          errorMsg = formatAuthError();
        }
        // Don't add "Error: " prefix - our error messages are already well-formatted

        setError(errorMsg);
        setMessages((prev) => [
          ...prev,
          {
            type: 'system',
            content: `❌ ${errorMsg}`,
            timestamp: new Date(),
          },
        ]);
        if (process.env.DEBUG_ESC_INPUT) {
          console.error('[useAgent] Setting isThinking=false (error)');
        }
        setIsThinking(false);
      } finally {
        // Always clear adapter reference to prevent memory leaks
        currentAdapterRef.current = null;
      }
    },
    [
      cwd,
      // resumeSessionId removed - use sessionManager.getResumeSessionId() directly for synchronous access
      injectedRecap,
      pendingMessageNotification,
      debugLog,
      embedderRef,
      turnAnalysis,
      debugFlag,
      recallMcpServerRef,
      anchorId,
      sessionManager,
      updateAnchorStats,
      commandsCache,
      getMessageQueue,
      compression,
      tokenCounter,
      providerName,
      modelName,
      maxThinkingTokens,
      displayThinking,
      getMessagePublisher,
      getTaskManager,
    ]
  );

  /**
   * Process agent messages from provider abstraction layer
   *
   * Handles AgentMessage types from provider:
   * - assistant: Text responses (content string or array)
   * - tool_use: Tool call messages
   * - tool_result: Tool execution results
   * - thinking: Extended thinking blocks
   *
   * @param agentMessage - Message from agent provider
   */
  const processAgentMessage = (
    agentMessage: import('../../llm/agent-provider-interface.js').AgentMessage
  ) => {
    const { type, content } = agentMessage;

    switch (type) {
      case 'assistant': {
        // Assistant message - could be text or tool use
        if (typeof content === 'string') {
          // Simple text response
          const colorReplacedText = stripANSICodes(content);
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.type === 'assistant') {
              // Append to existing assistant message
              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  content: last.content + colorReplacedText,
                },
              ];
            } else {
              // New assistant message
              return [
                ...prev,
                {
                  type: 'assistant',
                  content: colorReplacedText,
                  timestamp: new Date(),
                },
              ];
            }
          });
        } else if (Array.isArray(content)) {
          // Content blocks (tool use, text, thinking, etc.)
          const toolUses = content.filter((c) => c.type === 'tool_use');
          const textBlocks = content.filter((c) => c.type === 'text');
          const thinkingBlocks = content.filter((c) => c.type === 'thinking');

          // Show thinking blocks FIRST (reasoning before tool call)
          if (thinkingBlocks.length > 0) {
            const thinking = thinkingBlocks
              .map((b) => b.thinking || '')
              .join('\n');
            setMessages((prev) => [
              ...prev,
              {
                type: 'thinking',
                content: thinking,
                timestamp: new Date(),
              },
            ]);
          }

          // Show text blocks (e.g., "Let me check that" before tool use)
          if (textBlocks.length > 0) {
            const text = textBlocks.map((b) => b.text || '').join('\n');
            const colorReplacedText = stripANSICodes(text);
            setMessages((prev) => [
              ...prev,
              {
                type: 'assistant',
                content: colorReplacedText,
                timestamp: new Date(),
              },
            ]);
          }

          // Then show tool uses
          if (toolUses.length > 0) {
            toolUses.forEach((tool) => {
              if (tool.name && tool.input) {
                const formatted = formatToolUse({
                  name: tool.name,
                  input: tool.input as Record<string, unknown>,
                });
                setMessages((prev) => [
                  ...prev,
                  {
                    type: 'tool_progress',
                    content: `${formatted.icon} ${formatted.name}: ${formatted.description}`,
                    timestamp: new Date(),
                  },
                ]);
              }
            });
          }
        }
        break;
      }

      case 'tool_use': {
        // Tool use message
        // Check for Gemini-style toolName/toolInput fields first
        if (agentMessage.toolName && agentMessage.toolInput) {
          const formatted = formatToolUse({
            name: agentMessage.toolName,
            input: agentMessage.toolInput as Record<string, unknown>,
          });
          setMessages((prev) => [
            ...prev,
            {
              type: 'tool_progress',
              content: `${formatted.icon} ${formatted.name}: ${formatted.description}`,
              timestamp: new Date(),
            },
          ]);
        } else if (typeof content === 'string') {
          setMessages((prev) => [
            ...prev,
            {
              type: 'tool_progress',
              content: `🔧 ${content}`,
              timestamp: new Date(),
            },
          ]);
        } else if (Array.isArray(content)) {
          content.forEach((tool) => {
            if (tool.name && tool.input) {
              const formatted = formatToolUse({
                name: tool.name,
                input: tool.input as Record<string, unknown>,
              });
              setMessages((prev) => [
                ...prev,
                {
                  type: 'tool_progress',
                  content: `${formatted.icon} ${formatted.name}: ${formatted.description}`,
                  timestamp: new Date(),
                },
              ]);
            }
          });
        }
        break;
      }

      case 'tool_result': {
        // Tool execution result
        if (typeof content === 'string') {
          // Simple string result
          debug('🔧 Tool result:', content.substring(0, 100));
        } else if (Array.isArray(content)) {
          // Content blocks with results
          content.forEach((result) => {
            if (result.is_error) {
              // Tool execution error
              const errorText =
                typeof result.content === 'string'
                  ? result.content
                  : JSON.stringify(result.content);
              debug('❌ Tool error:', errorText.substring(0, 100));
            } else {
              // Successful tool result
              debug(
                '✅ Tool success:',
                typeof result.content === 'string'
                  ? result.content.substring(0, 100)
                  : '...'
              );
            }
          });
        }
        // Tool results are usually internal - don't show in UI by default
        break;
      }

      case 'user': {
        // User message (shouldn't normally appear in streaming responses)
        if (typeof content === 'string') {
          debug('👤 User message:', content.substring(0, 100));
        }
        break;
      }

      case 'thinking': {
        // Extended thinking - display in UI
        if (typeof content === 'string') {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.type === 'thinking') {
              // Append to existing thinking message
              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  content: last.content + content,
                },
              ];
            } else {
              // New thinking message
              return [
                ...prev,
                {
                  type: 'thinking',
                  content,
                  timestamp: new Date(),
                },
              ];
            }
          });
        }
        debug(
          '💭 Thinking:',
          typeof content === 'string' ? content.substring(0, 100) : '...'
        );
        break;
      }

      default:
        // Log unknown message types for debugging
        debug('❓ Unknown message type:', type);
        break;
    }
  };

  // processSDKMessage removed - now using processAgentMessage for provider abstraction

  /**
   * Interrupt the current SDK query.
   *
   * Sends interrupt signal to Claude Agent SDK, stopping tool execution
   * and response generation. Used for ESC ESC keyboard shortcut in TUI.
   *
   * @example
   * // Interrupt long-running query
   * await interrupt();
   */
  const interrupt = useCallback(async () => {
    if (process.env.DEBUG_ESC_INPUT) {
      console.error('[useAgent] interrupt() called');
    }
    // Interrupt current agent execution
    if (currentAdapterRef.current) {
      try {
        if (process.env.DEBUG_ESC_INPUT) {
          console.error('[useAgent] Calling adapter.interrupt()');
        }
        abortedRef.current = true; // Mark as user-aborted
        await currentAdapterRef.current.interrupt();
        currentAdapterRef.current = null;
      } catch (err) {
        // Catch any errors from interrupt to prevent TUI crash
        if (process.env.DEBUG_ESC_INPUT) {
          console.error(
            '[useAgent] interrupt() error (ignoring):',
            err instanceof Error ? err.message : String(err)
          );
        }
        // Still clean up the adapter reference
        currentAdapterRef.current = null;
      }
    } else {
      if (process.env.DEBUG_ESC_INPUT) {
        console.error('[useAgent] No current adapter to interrupt');
      }
    }
    if (process.env.DEBUG_ESC_INPUT) {
      console.error('[useAgent] Setting isThinking=false (interrupt)');
    }
    setIsThinking(false);
  }, []);

  // ========================================
  // DISPLAY-ONLY MESSAGE
  // ========================================

  /**
   * Add a system message to the UI without sending to the agent.
   * Used for display-only content like /agents output.
   */
  const addSystemMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        type: 'system' as const,
        content,
        timestamp: new Date(),
      },
    ]);
  }, []);

  // ========================================
  // RETURN VALUE
  // ========================================

  // ========================================
  // AUTO-RESPONSE FOR AGENT MESSAGING
  // ========================================

  /**
   * Auto-trigger a turn when pending messages arrive.
   * This allows the agent to respond to messages without user intervention.
   */
  useEffect(() => {
    if (shouldAutoRespond && !isThinking) {
      // Reset flag first to prevent loops
      setShouldAutoRespond(false);
      // Trigger an invisible turn that will pick up the pending notification
      sendMessage('__AUTO_RESPONSE__');
    }
  }, [shouldAutoRespond, isThinking, sendMessage]);

  /**
   * Return hook interface for TUI components.
   *
   * Provides:
   * - messages: Conversation history
   * - sendMessage: Send user input to Claude
   * - addSystemMessage: Add display-only message (not sent to agent)
   * - interrupt: Stop current query
   * - isThinking: Whether Claude is responding
   * - error: Error message (if any)
   * - tokenCount: Current token usage
   * - conversationLattice: Sigma conversation graph
   * - currentSessionId: Active SDK session
   * - sigmaStats: Conversation analysis metrics
   * - avgOverlays: Average overlay alignment scores
   */
  return {
    messages,
    sendMessage,
    addSystemMessage,
    interrupt,
    isThinking,
    error,
    tokenCount: tokenCounter.count,
    conversationLattice,
    currentSessionId,
    anchorId, // Stable ID for agent identity (doesn't change during compression)
    sigmaStats: {
      nodes: turnAnalysis?.stats?.totalAnalyzed ?? 0,
      edges: Math.max(0, (turnAnalysis?.stats?.totalAnalyzed ?? 0) - 1),
      paradigmShifts: turnAnalysis?.stats?.paradigmShifts ?? 0,
      avgNovelty: turnAnalysis?.stats?.avgNovelty ?? 0,
      avgImportance: turnAnalysis?.stats?.avgImportance ?? 0,
    },
    avgOverlays: overlayScores,
    workbenchHealth, // Workbench health status for status bar
  };
}
