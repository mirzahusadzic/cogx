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
import type { SDKMessage, Query } from '@anthropic-ai/claude-agent-sdk';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { EmbeddingService } from '../../core/services/embedding.js';
import { OverlayRegistry } from '../../core/algebra/overlay-registry.js';
import { ConversationOverlayRegistry } from '../../sigma/conversation-registry.js';
import { createRecallMcpServer } from '../../sigma/recall-tool.js';
import { injectRelevantContext } from '../../sigma/context-injector.js';
import { useTokenCount } from './tokens/useTokenCount.js';
import { useSessionManager } from './session/useSessionManager.js';
import {
  createSDKQuery,
  isAuthenticationError,
  formatAuthError,
  formatSDKError,
} from './sdk/index.js';
import { formatToolUse } from './rendering/ToolFormatter.js';
import { stripANSICodes } from './rendering/MessageRenderer.js';
import { useTurnAnalysis } from './analysis/index.js';
import { useCompression } from './compression/useCompression.js';
import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk';
import type {
  ConversationLattice,
  ConversationNode,
} from '../../sigma/types.js';
import {
  loadCommands,
  expandCommand,
  type Command,
} from '../commands/loader.js';

/**
 * Configuration options for Claude Agent SDK integration
 */
interface UseClaudeAgentOptions {
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
   * Enable debug logging to console and tui-debug.log
   * @default false
   */
  debug?: boolean;
}

/**
 * Message object displayed in conversation UI
 */
export interface ClaudeMessage {
  /** Message role */
  type: 'user' | 'assistant' | 'system' | 'tool_progress';

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
export function useClaudeAgent(options: UseClaudeAgentOptions) {
  // Destructure options to get stable primitive values
  // This prevents the entire options object from causing re-renders
  const {
    sessionId: sessionIdProp,
    cwd,
    sessionTokens,
    maxThinkingTokens,
    debug: debugFlag,
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
  const [messages, setMessages] = useState<ClaudeMessage[]>([
    {
      type: 'system',
      content: `
           ⬢      ↔       👤     ↔     💎
       Traversal      Projection    Resonance
      `,
      timestamp: new Date(),
    },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQuery, setCurrentQuery] = useState<Query | null>(null);

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
  const messagesRef = useRef<ClaudeMessage[]>(messages); // Ref to avoid effect re-running on every message change
  const userMessageEmbeddingCache = useRef<Map<number, number[]>>(new Map()); // Cache user message embeddings by timestamp
  const latticeLoadedRef = useRef<Set<string>>(new Set()); // Track which sessions have been loaded
  const compressionInProgressRef = useRef(false); // ✅ Guard against concurrent compression requests

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
    debug: debugFlag,
    onSessionLoaded: handleSessionLoaded,
    onSDKSessionChanged: handleSDKSessionChanged,
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
          const { reconstructSessionContext } = await import(
            '../../sigma/context-reconstructor.js'
          );
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
          const sessionContext = await reconstructSessionContext(
            latticeWithPending,
            cwd,
            conversationRegistryRef.current || undefined
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

          // Re-enable user input after compression completes
          debug('🔍 [COMPRESSION] Step 14: Setting isThinking=false');
          setIsThinking(false);
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
  const compression = useCompression({
    tokenCount: tokenCounter.count.total,
    analyzedTurns: turnAnalysis.stats.totalAnalyzed,
    isThinking,
    tokenThreshold: sessionTokens,
    minTurns: 5,
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
   * Initialize Sigma services on mount.
   *
   * Creates:
   * - EmbeddingService: For generating semantic embeddings
   * - ConversationOverlayRegistry: For O1-O7 conversation overlays
   * - RecallMcpServer: MCP tool for memory queries
   * - OverlayRegistry: For project PGC overlays (if exists)
   */
  useEffect(() => {
    const endpoint = process.env.WORKBENCH_URL || 'http://localhost:8000';
    embedderRef.current = new EmbeddingService(endpoint);
    const sigmaPath = path.join(cwd, '.sigma');
    conversationRegistryRef.current = new ConversationOverlayRegistry(
      sigmaPath,
      endpoint,
      debugFlag
    );
    recallMcpServerRef.current = createRecallMcpServer(
      conversationRegistryRef.current,
      endpoint
    );
    const pgcPath = path.join(cwd, '.open_cognition');
    if (fs.existsSync(pgcPath))
      projectRegistryRef.current = new OverlayRegistry(pgcPath, endpoint);

    // Warn user if WORKBENCH_API_KEY is not set
    if (!process.env.WORKBENCH_API_KEY) {
      setMessages((prev) => [
        ...prev,
        {
          type: 'system',
          content:
            '⚠️  WORKBENCH_API_KEY not set\n' +
            '   Conversation analysis and semantic memory features will be disabled.\n' +
            '   Set WORKBENCH_API_KEY environment variable to enable these features.',
          timestamp: new Date(),
        },
      ]);
    }
  }, [cwd, debugFlag]);

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
        const { rebuildTurnAnalysesFromLanceDB } = await import(
          '../../sigma/lattice-reconstructor.js'
        );

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
        setIsThinking(true);
        setError(null);

        // STEP 1: Expand slash command FIRST (before adding user message)
        let finalPrompt = prompt;

        // Only treat as command if it starts with / but is NOT a file path
        // File paths have another / in the first word (e.g., /home/user/file.txt)
        const firstWord = prompt.split(' ')[0];
        const isCommand =
          prompt.startsWith('/') && !firstWord.slice(1).includes('/'); // No / after first character

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
              // Unknown command - provide helpful error with fuzzy matching
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

              throw new Error(errorMessage);
            }
          }
        }

        // STEP 2: Add user message (show ORIGINAL input, not expanded)
        const userMessageTimestamp = new Date();
        setMessages((prev) => [
          ...prev,
          {
            type: 'user',
            content: prompt, // Show what user typed
            timestamp: userMessageTimestamp,
          },
        ]);

        // STEP 2.5: Check if compression needed AFTER user message added to state
        // This runs synchronously as part of user action, NOT in useEffect
        // Prevents React effect deadlocks with getAllItems()
        // User's message is now in state, so compression will include it
        if (compression.shouldTrigger && !compressionInProgressRef.current) {
          debug('🔄 Compression needed after adding user message...');
          // Keep isThinking=true (already set above)
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
        } else if (embedderRef.current && turnAnalysis.analyses.length > 0) {
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

        // Create query with Claude Code system prompt preset
        const q = createSDKQuery({
          prompt: finalPrompt,
          cwd: cwd,
          resumeSessionId: currentResumeId, // undefined after compression = fresh session!
          maxThinkingTokens, // Enable extended thinking if specified
          onStderr: (data: string) => {
            stderrLines.push(data);
          },
          onCanUseTool: async (toolName, input) => {
            // Auto-approve all tools for now (we can add UI prompts later)
            return {
              behavior: 'allow',
              updatedInput: input,
            };
          },
          // Add recall MCP server for on-demand memory queries
          // Only enable when there's conversation history (resuming or post-compression)
          mcpServers:
            recallMcpServerRef.current &&
            (currentResumeId || turnAnalysis.analyses.length > 0)
              ? {
                  'conversation-memory': recallMcpServerRef.current,
                }
              : undefined,
        });

        setCurrentQuery(q);

        // Process streaming messages
        let messageCount = 0;
        let hasAssistantMessage = false;
        for await (const message of q) {
          messageCount++;
          if (message.type === 'assistant') {
            hasAssistantMessage = true;
          }
          processSDKMessage(message);
        }

        // If query completed without assistant response, show error
        if (!hasAssistantMessage && messageCount <= 1) {
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

        setIsThinking(false);
      } catch (err) {
        const originalError = (err as Error).message;
        let errorMsg = originalError;

        // Check if this is an authentication error
        const mockStderr = [originalError];
        if (isAuthenticationError(mockStderr)) {
          errorMsg = formatAuthError();
        } else {
          errorMsg = `Error: ${originalError}`;
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
        setIsThinking(false);
      }
    },
    [
      cwd,
      // resumeSessionId removed - use sessionManager.getResumeSessionId() directly for synchronous access
      injectedRecap,
      debugLog,
      embedderRef,
      turnAnalysis,
      debugFlag,
      recallMcpServerRef,
      anchorId,
      sessionManager,
      updateAnchorStats,
      commandsCache,
    ]
  );

  /**
   * Process streaming SDK messages and update UI state.
   *
   * Handles all SDK message types:
   * - assistant: Tool calls, text responses
   * - stream_event: Content deltas, token counts
   * - tool_progress: Tool execution updates
   * - result: Final query outcome
   * - system: SDK initialization messages
   *
   * SESSION ID TRACKING:
   * All SDK messages include session_id field. This is critical for
   * detecting session changes (compression, expiration). The hook
   * compares against currentSessionIdRef (synchronous) to prevent
   * duplicate state updates during rapid message processing.
   *
   * TOKEN COUNT UPDATES:
   * SDK sends token counts in message_delta events. These are cumulative
   * within a session. The hook uses Math.max to prevent decreases, but
   * allows reset after compression via useTokenCount's justReset flag.
   *
   * @param sdkMessage - Message from Claude Agent SDK
   */
  const processSDKMessage = (sdkMessage: SDKMessage) => {
    // Extract session ID from SDK message (all SDK messages have it)
    // This is critical for session-less TUI starts where SDK creates its own ID
    if ('session_id' in sdkMessage && sdkMessage.session_id) {
      const sdkSessionId = sdkMessage.session_id;
      const prevSessionId = currentSessionIdRef.current; // Read from ref (synchronous, prevents duplicates)

      if (prevSessionId !== sdkSessionId) {
        // SDK gave us a different session ID - update via sessionManager
        debug(' SDK session changed:', prevSessionId, '→', sdkSessionId);

        // Determine reason for session change
        const reason = compression.state.triggered
          ? 'compression'
          : prevSessionId.startsWith('tui-')
            ? 'initial'
            : 'expiration';

        // Get compressed token count if this was a compression
        const compressedTokens =
          reason === 'compression'
            ? compression.state.lastCompressedTokens || tokenCounter.count.total
            : undefined;

        // Update session via sessionManager
        sessionManager.updateSDKSession(sdkSessionId, reason, compressedTokens);

        // CRITICAL: Reset compression flag when new SDK session starts
        // This allows compression to trigger again in the new session
        if (compression.state.triggered) {
          compression.reset();
          tokenCounter.reset(); // Reset token count for new session
          debug(' Compression flag reset - can compress again in new session');
        }

        // Mark that we've received SDK session ID and trigger initial flush
        if (
          !sessionManager.state.hasReceivedSDKSessionId &&
          conversationRegistryRef.current
        ) {
          // Trigger immediate flush with correct session ID
          // This ensures overlays are saved even if we never hit compression threshold
          conversationRegistryRef.current
            .flushAll(sdkSessionId)
            .then(() => {
              debug(
                ' Initial flush completed with SDK session ID:',
                sdkSessionId
              );
              // Update anchor stats
              updateAnchorStats();
            })
            .catch((err) => {
              debug(' Initial flush failed:', err);
            });
        }
      }
    }

    switch (sdkMessage.type) {
      case 'assistant': {
        // Check if this message has tool calls - if so, display them
        const toolUses = sdkMessage.message.content.filter(
          (c: { type: string }) => c.type === 'tool_use'
        ) as Array<{ name: string; input: Record<string, unknown> }>;
        if (toolUses.length > 0) {
          toolUses.forEach((tool) => {
            const formatted = formatToolUse(tool);
            setMessages((prev) => [
              ...prev,
              {
                type: 'tool_progress',
                content: `${formatted.icon} ${formatted.name}: ${formatted.description}`,
                timestamp: new Date(),
              },
            ]);
          });
        }
        break;
      }

      case 'stream_event': {
        // Handle different stream event types
        const event = sdkMessage.event as {
          type: string;
          content_block?: { type: string; name: string };
          delta?: { type: string; text: string };
          usage?: {
            input_tokens: number;
            output_tokens: number;
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
          };
        };

        // Update token count from message_delta events (progressive updates)
        if (event.type === 'message_delta' && event.usage) {
          const usage = event.usage;
          const totalInput =
            usage.input_tokens +
            (usage.cache_creation_input_tokens || 0) +
            (usage.cache_read_input_tokens || 0);
          const totalOutput = usage.output_tokens;

          // Update token count (hook automatically handles Math.max and reset logic)
          tokenCounter.update({
            input: totalInput,
            output: totalOutput,
            total: totalInput + totalOutput,
          });
        }

        if (
          event.type === 'content_block_delta' &&
          event.delta?.type === 'text_delta'
        ) {
          // Text content streaming
          const delta = event.delta;
          const colorReplacedText = stripANSICodes(delta.text);
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.type === 'assistant') {
              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  content: last.content + colorReplacedText,
                },
              ];
            } else {
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
        }
        break;
      }

      case 'tool_progress':
        // Tool execution progress
        setMessages((prev) => [
          ...prev,
          {
            type: 'tool_progress',
            content: `⏱️ ${sdkMessage.tool_name} (${Math.round(sdkMessage.elapsed_time_seconds)}s)`,
            timestamp: new Date(),
          },
        ]);
        break;

      case 'result':
        // Final result - update token counts (keep existing if higher)
        if (sdkMessage.subtype === 'success') {
          const usage = sdkMessage.usage;
          // Result usage doesn't include cache tokens, so only update if it's higher
          const resultTotal = usage.input_tokens + usage.output_tokens;

          // Update token count (hook automatically handles Math.max and reset logic)
          tokenCounter.update({
            input: usage.input_tokens,
            output: usage.output_tokens,
            total: resultTotal,
          });

          setMessages((prev) => [
            ...prev,
            {
              type: 'system',
              content: `✓ Complete (${sdkMessage.num_turns} turns, $${sdkMessage.total_cost_usd.toFixed(4)})`,
              timestamp: new Date(),
            },
          ]);
        } else {
          // Check if this is an interrupt (user pressed ESC ESC)
          const isInterrupt = sdkMessage.subtype === 'error_during_execution';

          setMessages((prev) => [
            ...prev,
            {
              type: 'system',
              content: isInterrupt
                ? '⏸️  Interrupted · What should Claude do instead?'
                : `✗ Error: ${sdkMessage.subtype}`,
              timestamp: new Date(),
            },
          ]);
        }
        break;

      case 'system':
        // System messages
        if (sdkMessage.subtype === 'init') {
          setMessages((prev) => [
            ...prev,
            {
              type: 'system',
              content: `Connected to Claude (${sdkMessage.model})`,
              timestamp: new Date(),
            },
          ]);
        }
        break;
    }
  };

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
    if (currentQuery) {
      await currentQuery.interrupt();
      setIsThinking(false);
    }
  }, [currentQuery]);

  // ========================================
  // RETURN VALUE
  // ========================================

  /**
   * Return hook interface for TUI components.
   *
   * Provides:
   * - messages: Conversation history
   * - sendMessage: Send user input to Claude
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
    interrupt,
    isThinking,
    error,
    tokenCount: tokenCounter.count,
    conversationLattice,
    currentSessionId,
    sigmaStats: {
      nodes: turnAnalysis?.stats?.totalAnalyzed ?? 0,
      edges: Math.max(0, (turnAnalysis?.stats?.totalAnalyzed ?? 0) - 1),
      paradigmShifts: turnAnalysis?.stats?.paradigmShifts ?? 0,
      avgNovelty: turnAnalysis?.stats?.avgNovelty ?? 0,
      avgImportance: turnAnalysis?.stats?.avgImportance ?? 0,
    },
    avgOverlays: overlayScores,
  };
}
