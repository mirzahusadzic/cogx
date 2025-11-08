import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  query,
  type SDKMessage,
  type Query,
} from '@anthropic-ai/claude-agent-sdk';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as Diff from 'diff';
import chalk from 'chalk';
import { EmbeddingService } from '../../core/services/embedding.js';
import { analyzeTurn } from '../../sigma/analyzer-with-embeddings.js';
import { compressContext } from '../../sigma/compressor.js';
import { reconstructSessionContext } from '../../sigma/context-reconstructor.js';
import { OverlayRegistry } from '../../core/algebra/overlay-registry.js';
import { ConversationOverlayRegistry } from '../../sigma/conversation-registry.js';
import { populateConversationOverlays } from '../../sigma/conversation-populator.js';
import { createRecallMcpServer } from '../../sigma/recall-tool.js';
import { injectRelevantContext } from '../../sigma/context-injector.js';
import {
  rebuildTurnAnalysesFromLanceDB,
  rebuildLatticeFromLanceDB,
} from '../../sigma/lattice-reconstructor.js';
import {
  loadSessionState,
  saveSessionState,
  createSessionState,
  updateSessionState,
  updateSessionStats,
  migrateOldStateFile,
} from '../../sigma/session-state.js';
import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk';
import type {
  ConversationLattice,
  TurnAnalysis,
  ConversationContext,
  ConversationTurn,
} from '../../sigma/types.js';

interface UseClaudeAgentOptions {
  sessionId?: string;
  cwd: string;
  sessionTokens?: number;
  debug?: boolean;
}

export interface ClaudeMessage {
  type: 'user' | 'assistant' | 'system' | 'tool_progress';
  content: string;
  timestamp: Date;
}

/**
 * Strip ALL ANSI codes from SDK output to prevent color bleeding
 * We apply our own colors in ClaudePanelAgent instead
 */
function replaceSDKDiffColors(text: string): string {
  // Remove ALL ANSI escape codes (colors, bold, dim, etc.)
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Hook to manage Claude Agent SDK integration
 */
export function useClaudeAgent(options: UseClaudeAgentOptions) {
  // Destructure options to get stable primitive values
  // This prevents the entire options object from causing re-renders
  const {
    sessionId: sessionIdProp,
    cwd,
    sessionTokens,
    debug: debugFlag,
  } = options;

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
        fs.appendFileSync(path.join(cwd, 'tui-debug.log'), content);
      }
    },
    [debugFlag, cwd]
  );

  // Initialize with welcome message (colors applied by ClaudePanelAgent)
  const [messages, setMessages] = useState<ClaudeMessage[]>([
    {
      type: 'system',
      content: `Welcome to Cognition CLI with AIEcho Theme 🎨\n\nStart typing to chat with Claude...`,
      timestamp: new Date(),
    },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQuery, setCurrentQuery] = useState<Query | null>(null);
  const [tokenCount, setTokenCount] = useState({
    input: 0,
    output: 0,
    total: 0,
  });

  // Sigma state: conversation lattice and analysis
  const [conversationLattice, setConversationLattice] =
    useState<ConversationLattice | null>(null);
  const turnAnalyses = useRef<TurnAnalysis[]>([]);
  const lastCompressedSize = useRef<number>(0); // Track compressed token count
  const embedderRef = useRef<EmbeddingService | null>(null);
  const projectRegistryRef = useRef<OverlayRegistry | null>(null);
  const conversationRegistryRef = useRef<ConversationOverlayRegistry | null>(
    null
  );
  const recallMcpServerRef = useRef<McpSdkServerConfigWithInstance | null>(
    null
  );
  const compressionTriggered = useRef(false);
  const analyzingTurn = useRef<number | null>(null); // Track timestamp of turn being analyzed
  const lastAnalyzedMessageIndex = useRef<number>(-1); // Track last analyzed message index
  const messagesRef = useRef<ClaudeMessage[]>(messages); // Ref to avoid effect re-running on every message change
  const userMessageEmbeddingCache = useRef<Map<number, number[]>>(new Map()); // Cache user message embeddings by timestamp

  // Track count of ONLY user/assistant messages (not system/tool_progress)
  // This prevents infinite loop when compression adds system messages
  const userAssistantMessageCount = messages.filter(
    (m) => m.type === 'user' || m.type === 'assistant'
  ).length;

  // Session management for Sigma compression
  // When we compress, we start a FRESH session (no resume) with intelligent recap
  // If resuming a compressed session, we forward to the new session automatically

  // anchor_id = stable user-facing ID (from CLI --session-id or auto-generated)
  // This is what we use for file naming: .sigma/{anchor_id}.state.json
  // It NEVER changes across compressions/expirations
  // Use useMemo to ensure it's only computed once
  const anchorId = useMemo(
    () => sessionIdProp || `tui-${Date.now()}`,
    [sessionIdProp]
  );

  const [resumeSessionId, setResumeSessionId] = useState<string | undefined>(
    undefined
  ); // Will be set in loadSessionState

  // currentSessionId = actual SDK session UUID (transient, changes on compression)
  const [currentSessionId, setCurrentSessionId] = useState(anchorId);
  const [injectedRecap, setInjectedRecap] = useState<string | null>(null);
  const hasReceivedSDKSessionId = useRef(false); // Track if we've gotten real SDK session ID

  /**
   * Helper: Write session state file
   * Used for both initial flush and periodic flushes to ensure state is always tracked
   */
  const updateAnchorStatsRef = useRef<() => void>(() => {});
  updateAnchorStatsRef.current = () => {
    try {
      // Use the stable anchorId for file access
      const state = loadSessionState(anchorId, cwd);

      if (!state) {
        // No state yet, skip (will be created on first SDK message)
        return;
      }

      const stats = {
        total_turns_analyzed: turnAnalyses.current.length,
        paradigm_shifts: turnAnalyses.current.filter((t) => t.is_paradigm_shift)
          .length,
        routine_turns: turnAnalyses.current.filter((t) => t.is_routine).length,
        avg_novelty:
          turnAnalyses.current.length > 0
            ? (
                turnAnalyses.current.reduce((sum, t) => sum + t.novelty, 0) /
                turnAnalyses.current.length
              ).toFixed(3)
            : '0.000',
        avg_importance:
          turnAnalyses.current.length > 0
            ? (
                turnAnalyses.current.reduce(
                  (sum, t) => sum + t.importance_score,
                  0
                ) / turnAnalyses.current.length
              ).toFixed(1)
            : '0.0',
      };

      const updated = updateSessionStats(state, stats);
      saveSessionState(updated, cwd);
      if (debugFlag) {
        console.log(chalk.dim(`[Σ]  Anchor stats updated: ${anchorId}`));
      }
    } catch (err) {
      if (debugFlag) {
        console.log(chalk.dim('[Σ]  Failed to update anchor stats:'), err);
      }
    }
  };

  const updateAnchorStats = useCallback(() => {
    updateAnchorStatsRef.current?.();
  }, []);

  // Initialize embedding service and registries
  useEffect(() => {
    // Check if WORKBENCH_API_KEY is set
    const hasApiKey = !!process.env.WORKBENCH_API_KEY;

    if (!hasApiKey) {
      // Show warning message in UI
      setMessages((prev) => [
        ...prev,
        {
          type: 'system',
          content:
            '⚠️  WORKBENCH_API_KEY not set - Sigma features disabled\n' +
            '   • Context compression: OFF\n' +
            '   • Conversation history: OFF\n' +
            '   • Intelligent recap: OFF\n' +
            '   • Real-time context injection: OFF\n\n' +
            '   Set WORKBENCH_API_KEY to enable infinite context via compression.',
          timestamp: new Date(),
        },
      ]);
      debug(
        '⚠️  WORKBENCH_API_KEY not set - Sigma compression and history disabled'
      );
    }

    // Get workbench endpoint from environment or default
    const workbenchEndpoint =
      process.env.WORKBENCH_URL || 'http://localhost:8000';
    embedderRef.current = new EmbeddingService(workbenchEndpoint);

    // Initialize project registry (for querying .open_cognition/overlays/)
    try {
      const pgcPath = path.join(cwd, '.open_cognition');
      if (fs.existsSync(pgcPath)) {
        projectRegistryRef.current = new OverlayRegistry(
          pgcPath,
          workbenchEndpoint
        );
        debug(' Project registry initialized:', pgcPath);
      } else {
        debug(' No .open_cognition found, project alignment disabled');
      }
    } catch (err) {
      debug(' Failed to initialize project registry:', err);
    }

    // Initialize conversation registry (for storing conversation overlays in .sigma/)
    const sigmaPath = path.join(cwd, '.sigma');
    conversationRegistryRef.current = new ConversationOverlayRegistry(
      sigmaPath,
      workbenchEndpoint,
      debugFlag
    );
    debug(' Conversation registry initialized:', sigmaPath);

    // Initialize recall MCP server (for on-demand memory queries)
    recallMcpServerRef.current = createRecallMcpServer(
      conversationRegistryRef.current,
      workbenchEndpoint
    );
    if (debugFlag) {
      console.log(chalk.dim('[Σ]  Recall MCP server initialized'));
    }
  }, [cwd, debugFlag, debug]);

  // Keep messagesRef in sync with messages state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Sigma: Analyze turns on-the-fly and trigger compression
  useEffect(() => {
    const currentMessages = messagesRef.current;
    if (currentMessages.length === 0) return;

    const analyzeNewTurns = async () => {
      const embedder = embedderRef.current;

      // Skip if embedder not initialized yet
      if (!embedder) {
        if (debugFlag) {
          console.log(chalk.dim('[Σ]  Embedder not initialized'));
        }
        return;
      }

      if (debugFlag) {
        console.log(
          chalk.dim('[Σ]  Analyzer effect triggered, messages:'),
          currentMessages.length,
          'isThinking:',
          isThinking
        );
      }

      // Find unanalyzed messages (ONLY user/assistant, skip system/tool_progress)
      // This prevents infinite loop: compression adds system messages which would re-trigger this effect
      const unanalyzedMessages = currentMessages
        .slice(lastAnalyzedMessageIndex.current + 1)
        .map((msg, idx) => ({
          msg,
          originalIndex: lastAnalyzedMessageIndex.current + 1 + idx,
        }))
        .filter(({ msg }) => msg.type === 'user' || msg.type === 'assistant');

      if (unanalyzedMessages.length === 0) {
        debug(' No unanalyzed messages');
        return;
      }

      debug(' Unanalyzed user/assistant messages:', unanalyzedMessages.length);

      // Process each unanalyzed message
      for (const {
        msg: message,
        originalIndex: messageIndex,
      } of unanalyzedMessages) {
        debug(
          ` Processing message ${messageIndex}: type=${message.type}, isThinking=${isThinking}`
        );

        // For assistant messages, only analyze if we're NOT currently thinking
        // (i.e., the assistant has finished responding)
        if (message.type === 'assistant' && isThinking) {
          debug('   Skipping assistant message - still streaming');
          return; // Don't advance lastAnalyzedMessageIndex - will retry when isThinking becomes false
        }

        const turnTimestamp = message.timestamp.getTime();

        // Check if we've already analyzed this turn
        const existingAnalysis = turnAnalyses.current.find(
          (a) => a.timestamp === turnTimestamp
        );
        if (existingAnalysis) {
          debug('   Turn already analyzed, skipping');
          lastAnalyzedMessageIndex.current = messageIndex;
          continue;
        }

        // Check if we're already analyzing this turn (prevent concurrent analysis)
        if (analyzingTurn.current === turnTimestamp) {
          debug('   Turn analysis already in progress, skipping');
          return; // Don't advance - wait for completion
        }

        debug('   Starting turn analysis...');
        analyzingTurn.current = turnTimestamp; // Mark as analyzing

        try {
          // Build context from previous analyses
          const context: ConversationContext = {
            projectRoot: cwd,
            sessionId: currentSessionId,
            history: turnAnalyses.current.map((a) => ({
              id: a.turn_id,
              role: a.role,
              content: a.content,
              timestamp: a.timestamp,
              embedding: a.embedding, // Include for novelty calculation
            })) as Array<ConversationTurn & { embedding: number[] }>,
          };

          debug(
            '   Calling analyzeTurn with content length:',
            message.content.length
          );

          // Analyze this turn with FULL content
          // For user messages, reuse cached embedding from context injection
          // Pass projectRegistry for Meet operation (Conversation ∧ Project)
          const turnTimestamp = message.timestamp.getTime();
          const cachedEmbedding =
            message.type === 'user'
              ? userMessageEmbeddingCache.current.get(turnTimestamp)
              : undefined;

          const analysis = await analyzeTurn(
            {
              id: `turn-${turnTimestamp}`,
              role: message.type as 'user' | 'assistant',
              content: message.content, // FULL content (not truncated)
              timestamp: turnTimestamp,
            },
            context,
            embedder,
            projectRegistryRef.current, // KEY: enables project alignment
            {}, // options
            cachedEmbedding // Reuse embedding from context injection!
          );

          // Clean up cached embedding after use
          if (cachedEmbedding) {
            userMessageEmbeddingCache.current.delete(turnTimestamp);
          }

          debug('   analyzeTurn completed! Novelty:', analysis.novelty);
          debug(
            '   Overlay scores:',
            Object.entries(analysis.overlay_scores)
              .map(([k, v]) => `${k}=${v}`)
              .join(', ')
          );

          // Store analysis
          turnAnalyses.current.push(analysis);

          // Mark message as analyzed
          lastAnalyzedMessageIndex.current = messageIndex;

          // Populate conversation overlays based on project alignment
          if (conversationRegistryRef.current) {
            try {
              await populateConversationOverlays(
                analysis,
                conversationRegistryRef.current
              );
              debug('   Conversation overlays populated');

              // Periodic flush: Every 5 turns, flush overlays to disk
              // This ensures data is persisted even if compression doesn't trigger
              const FLUSH_INTERVAL = 5;
              if (turnAnalyses.current.length % FLUSH_INTERVAL === 0) {
                debug(
                  ` Periodic flush triggered (${turnAnalyses.current.length} turns)`
                );
                try {
                  await conversationRegistryRef.current.flushAll(
                    currentSessionId
                  );
                  debug(' Conversation overlays flushed to disk');
                  // Update anchor stats
                  updateAnchorStats();
                } catch (flushErr) {
                  debug(' Failed to flush conversation overlays:', flushErr);
                }
              }
            } catch (err) {
              debug(' Failed to populate conversation overlays:', err);
            }
          }

          // Clear analyzing flag
          analyzingTurn.current = null;

          // Log analysis (for debugging)
          debugLog(
            `[SIGMA] Turn analyzed: ${analysis.turn_id}\n` +
              `  Role: ${analysis.role}\n` +
              `  Novelty: ${analysis.novelty.toFixed(3)}\n` +
              `  Importance: ${analysis.importance_score}\n` +
              `  Paradigm shift: ${analysis.is_paradigm_shift}\n` +
              `  Routine: ${analysis.is_routine}\n` +
              `  Content: ${analysis.content.substring(0, 100)}${analysis.content.length > 100 ? '...' : ''}\n\n`
          );

          // Check if compression needed (configurable threshold, defaults to 120K)
          const TOKEN_THRESHOLD = sessionTokens || 120000;
          const MIN_TURNS_FOR_COMPRESSION = 5; // Need at least 5 turns for meaningful compression

          if (
            tokenCount.total > TOKEN_THRESHOLD &&
            !compressionTriggered.current &&
            turnAnalyses.current.length >= MIN_TURNS_FOR_COMPRESSION
          ) {
            compressionTriggered.current = true;

            // User-visible notification (always shown, not debug-only)
            setMessages((prev) => [
              ...prev,
              {
                type: 'system',
                content:
                  `🗜️  Context compression triggered at ${(tokenCount.total / 1000).toFixed(1)}K tokens\n` +
                  `Compressing ${turnAnalyses.current.length} turns into intelligent recap...\n` +
                  `(Use --debug flag to see detailed compression metrics)`,
                timestamp: new Date(),
              },
            ]);

            debug(
              '🗜️  Triggering compression with',
              turnAnalyses.current.length,
              'analyzed turns'
            );

            // Trigger compression
            let compressionResult;
            try {
              compressionResult = await compressContext(turnAnalyses.current, {
                target_size: 40000, // 40K tokens (20% of 200K limit)
                preserve_threshold: 7, // Paradigm shifts
              });
            } catch (compressErr) {
              // User-visible error notification
              setMessages((prev) => [
                ...prev,
                {
                  type: 'system',
                  content:
                    `❌ Compression failed: ${(compressErr as Error).message}\n` +
                    `Will retry on next turn. Use --debug for details.`,
                  timestamp: new Date(),
                },
              ]);

              debug('❌ Compression failed:', compressErr);
              debugLog(
                `[SIGMA ERROR] Compression failed: ${(compressErr as Error).message}\n` +
                  `  Stack: ${(compressErr as Error).stack}\n\n`
              );
              compressionTriggered.current = false; // Reset so it can try again
              return; // Exit early
            }

            // Store compressed lattice
            setConversationLattice(compressionResult.lattice);

            // Store compressed size for session state tracking
            lastCompressedSize.current = compressionResult.compressed_size;

            // Log compression stats
            debugLog(
              `[SIGMA] Compression triggered at ${tokenCount.total} tokens\n` +
                `  Original: ${compressionResult.original_size} tokens\n` +
                `  Compressed: ${compressionResult.compressed_size} tokens\n` +
                `  Ratio: ${compressionResult.compression_ratio.toFixed(1)}x\n` +
                `  Paradigm shifts: ${compressionResult.metrics.paradigm_shifts}\n` +
                `  Preserved: ${compressionResult.preserved_turns.length} turns\n` +
                `  Summarized: ${compressionResult.summarized_turns.length} turns\n` +
                `  Discarded: ${compressionResult.discarded_turns.length} turns\n\n`
            );

            // Reset token count IMMEDIATELY (before async logic)
            // This prevents token count from continuing to accumulate during compression
            setTokenCount({ input: 0, output: 0, total: 0 });
            lastCompressedSize.current = compressionResult.compressed_size;

            // Reset lastAnalyzedMessageIndex to prevent re-analyzing compressed turns
            lastAnalyzedMessageIndex.current = messages.length - 1;

            // Intelligent session switch with dual-mode reconstruction
            (async () => {
              try {
                // 1. Save lattice to disk (graph structure preserved - ALIVE!)
                const latticeDir = path.join(cwd, '.sigma');
                fs.mkdirSync(latticeDir, { recursive: true });

                // Strip embeddings from lattice before saving (v2 format)
                // Embeddings stored in LanceDB, not JSON (saves 90% disk space)
                const latticeWithoutEmbeddings = {
                  format_version: 2,
                  lancedb_metadata: {
                    storage_path: '.sigma/conversations.lancedb',
                    session_id: currentSessionId,
                  },
                  ...compressionResult.lattice,
                  nodes: compressionResult.lattice.nodes.map((node) => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { embedding, ...nodeWithoutEmbedding } = node;
                    return nodeWithoutEmbedding;
                  }),
                };

                fs.writeFileSync(
                  path.join(latticeDir, `${currentSessionId}.lattice.json`),
                  JSON.stringify(latticeWithoutEmbeddings, null, 2)
                );

                // 1b. Flush conversation overlays to disk
                if (conversationRegistryRef.current) {
                  try {
                    await conversationRegistryRef.current.flushAll(
                      currentSessionId
                    );
                    debug(' Conversation overlays flushed to', latticeDir);
                  } catch (flushErr) {
                    debug(' Failed to flush conversation overlays:', flushErr);
                  }
                }

                // 2. Intelligent reconstruction (quest vs chat mode)
                // Pass conversationRegistry for better recap generation!
                const reconstructed = await reconstructSessionContext(
                  compressionResult.lattice,
                  conversationRegistryRef.current || undefined
                );

                // 3. Write comprehensive state files

                // 3a. Recap for human inspection
                fs.writeFileSync(
                  path.join(latticeDir, `${currentSessionId}.recap.txt`),
                  `SIGMA INTELLIGENT RECAP\n` +
                    `Mode: ${reconstructed.mode}\n` +
                    `Generated: ${new Date().toISOString()}\n` +
                    `Original tokens: ${compressionResult.original_size}\n` +
                    `Recap tokens: ~${Math.round(reconstructed.recap.length / 4)}\n` +
                    `\n${'='.repeat(80)}\n\n` +
                    reconstructed.recap
                );

                // 3b. Update anchor stats (state will be updated when SDK provides new UUID)
                updateAnchorStats();

                // 4. Store recap for injection on first query of NEW session
                setInjectedRecap(reconstructed.recap);

                // 5. Kill old session - start completely fresh (no resume!)
                setResumeSessionId(undefined); // Don't resume any session - let SDK create new one

                // 6. SDK will provide new UUID in next message, we'll update anchor state then
                // Keep currentSessionId as-is (the anchor ID), SDK session will be captured in message handler

                // 7. State already reset (above, before async block)
                // Keep compressionTriggered = true to prevent re-compression until new session establishes
                // Keep turnAnalyses.current - we continue building on the lattice!

                // 7b. DO NOT clear in-memory conversation overlays!
                // They should continue accumulating across SDK session boundaries.
                // When you resume with --session-id, we want ALL overlays (old + new).
                // The overlays are flushed to disk above, but we keep them in memory
                // so new turns continue building on the same overlay files.
                debug(
                  ' Keeping conversation overlays in memory (continue accumulating)'
                );

                // 7c. Calculate compression ratio
                const recapTokens = Math.round(reconstructed.recap.length / 4);
                const originalTokens = compressionResult.original_size;
                const actualRatio =
                  Math.round((originalTokens / recapTokens) * 10) / 10;

                // 8. Add system message to UI
                const modeIcon = reconstructed.mode === 'quest' ? '🎯' : '💬';
                setMessages((prev) => [
                  ...prev,
                  {
                    type: 'system',
                    content:
                      `${modeIcon} Context compressed (${actualRatio}x ratio, ${reconstructed.mode} mode)\n` +
                      `   • Preserved: ${compressionResult.preserved_turns.length} paradigm shifts\n` +
                      `   • Compressed: ${compressionResult.summarized_turns.length} important turns\n` +
                      `   • Discarded: ${compressionResult.discarded_turns.length} low-value turns\n` +
                      `   • Message history remains visible in UI\n` +
                      `   • Intelligent recap will inject on next query`,
                    timestamp: new Date(),
                  },
                ]);

                // 9. Log session switch with metrics
                debugLog(
                  `[SIGMA] Intelligent session switch completed\n` +
                    `  Mode detected: ${reconstructed.mode.toUpperCase()}\n` +
                    `  Old session: ${currentSessionId}\n` +
                    `  New session: SDK will provide UUID in next message\n` +
                    `  Lattice saved: .sigma/${currentSessionId}.lattice.json\n` +
                    `  \n` +
                    `  Lattice Structure:\n` +
                    `    Nodes: ${compressionResult.lattice.nodes.length}\n` +
                    `    Edges: ${compressionResult.lattice.edges.length}\n` +
                    `    Paradigm shifts: ${reconstructed.metrics.paradigm_shifts}\n` +
                    `  \n` +
                    `  Reconstruction:\n` +
                    `    Original: ${originalTokens} tokens\n` +
                    `    Recap: ${recapTokens} tokens (~${reconstructed.recap.length} chars)\n` +
                    `    Compression ratio: ${actualRatio}x\n` +
                    `  \n` +
                    `  Mode Indicators:\n` +
                    `    Tool uses: ${reconstructed.metrics.tool_uses}\n` +
                    `    Code blocks: ${reconstructed.metrics.code_blocks}\n` +
                    `    Avg structural (O1): ${reconstructed.metrics.avg_structural}\n` +
                    `    Avg operational (O5): ${reconstructed.metrics.avg_operational}\n` +
                    `  \n` +
                    `  Context type: ${reconstructed.mode === 'quest' ? 'Mental map + query functions' : 'Linear important points'}\n` +
                    `  Ready for injection on first query\n\n`
                );
              } catch (switchErr) {
                debugLog(
                  `[SIGMA ERROR] Session switch failed: ${(switchErr as Error).message}\n` +
                    `  Stack: ${(switchErr as Error).stack}\n\n`
                );
              }
            })();

            // Exit loop immediately after triggering compression
            // This prevents analyzing more turns while compression is in progress
            return;
          }
        } catch (err) {
          // Clear analyzing flag on error
          analyzingTurn.current = null;

          // Log analysis errors but don't break the UI
          debug('   Error in analyzer:', err);
          debugLog(
            `[SIGMA ERROR] ${(err as Error).message}\n` +
              `  Stack: ${(err as Error).stack}\n\n`
          );
          // Continue to next message on error
          lastAnalyzedMessageIndex.current = messageIndex;
        }
      } // end for loop
    };

    analyzeNewTurns();
  }, [
    userAssistantMessageCount,
    isThinking,
    cwd,
    currentSessionId,
    debug,
    debugLog,
    updateAnchorStats,
    tokenCount,
    debugFlag,
    sessionTokens,
  ]);

  // Load initial token count from existing session transcript
  // AND restore Sigma lattice + conversation overlays
  useEffect(() => {
    const loadAnchorSession = async () => {
      try {
        // anchorId is already defined at the top of the component

        // Try to migrate old state file if exists
        let sessionState = loadSessionState(anchorId, cwd);
        if (sessionState && !('compression_history' in sessionState)) {
          sessionState = migrateOldStateFile(anchorId, cwd);
        }

        let sdkSessionToResume: string | undefined;
        let sessionId: string;

        if (!sessionState) {
          debug('󱖫 No state - fresh session');
          sdkSessionToResume = undefined;
          sessionId = anchorId;
        } else {
          debug('󱖫 Found state, SDK session:', sessionState.current_session);
          sdkSessionToResume = sessionState.current_session;
          sessionId = sessionState.current_session;

          setMessages((prev) => [
            ...prev,
            {
              type: 'system',
              content: `🔄 Resuming: ${anchorId} (${sessionState.compression_history.length} sessions)`,
              timestamp: new Date(),
            },
          ]);
        }

        setResumeSessionId(sdkSessionToResume);
        setCurrentSessionId(anchorId);

        // ========================================
        // 1. LOAD TOKEN COUNT FROM TRANSCRIPT
        // ========================================
        // Try common Claude Code transcript locations
        const possiblePaths = [
          path.join(
            os.homedir(),
            '.claude-code',
            'sessions',
            sessionId,
            'transcript.jsonl'
          ),
          path.join(
            os.homedir(),
            '.config',
            'claude-code',
            'sessions',
            sessionId,
            'transcript.jsonl'
          ),
          path.join(
            process.cwd(),
            '.claude-code',
            'sessions',
            sessionId,
            'transcript.jsonl'
          ),
        ];

        let transcriptPath: string | null = null;
        for (const p of possiblePaths) {
          if (fs.existsSync(p)) {
            transcriptPath = p;
            break;
          }
        }

        if (!transcriptPath) {
          // Debug: log where we looked
          debugLog(
            `[TOKEN DEBUG] Transcript not found. Searched:\n${possiblePaths.join('\n')}\n\n`
          );
        } else {
          // Debug: log successful load
          debugLog(
            `[TOKEN DEBUG] Loading transcript from: ${transcriptPath}\n`
          );

          // Read transcript and calculate cumulative tokens
          const transcriptContent = fs.readFileSync(transcriptPath, 'utf-8');
          const lines = transcriptContent.trim().split('\n').filter(Boolean);

          let totalInput = 0;
          let totalOutput = 0;

          for (const line of lines) {
            try {
              const msg = JSON.parse(line);

              // Look for usage information in different message types
              if (
                msg.type === 'stream_event' &&
                msg.event?.type === 'message_delta' &&
                msg.event?.usage
              ) {
                const usage = msg.event.usage;
                // SDK provides cumulative totals in each message_delta, so take the max
                // (not accumulate - same logic as line 1242)
                const currentInput =
                  (usage.input_tokens || 0) +
                  (usage.cache_creation_input_tokens || 0) +
                  (usage.cache_read_input_tokens || 0);
                const currentOutput = usage.output_tokens || 0;
                totalInput = Math.max(totalInput, currentInput);
                totalOutput = Math.max(totalOutput, currentOutput);
              } else if (msg.type === 'result' && msg.usage) {
                // Result messages have final totals (without cache tokens)
                totalInput = Math.max(totalInput, msg.usage.input_tokens || 0);
                totalOutput = Math.max(
                  totalOutput,
                  msg.usage.output_tokens || 0
                );
              }
            } catch (err) {
              // Skip invalid JSON lines
            }
          }

          setTokenCount({
            input: totalInput,
            output: totalOutput,
            total: totalInput + totalOutput,
          });
        }

        // ========================================
        // 2. RESTORE SIGMA LATTICE
        // ========================================
        const latticeDir = path.join(cwd, '.sigma');
        const latticePath = path.join(latticeDir, `${sessionId}.lattice.json`);

        if (fs.existsSync(latticePath)) {
          debug(' Found existing lattice, restoring:', latticePath);

          const latticeContent = fs.readFileSync(latticePath, 'utf-8');
          const restoredLattice = JSON.parse(
            latticeContent
          ) as ConversationLattice & {
            format_version?: number;
            lancedb_metadata?: {
              storage_path: string;
              session_id: string;
            };
          };

          // Check if v2 format (embeddings in LanceDB)
          const isV2Format =
            restoredLattice.format_version === 2 &&
            restoredLattice.lancedb_metadata;

          let latticeWithEmbeddings = restoredLattice;

          if (isV2Format) {
            debug(' V2 lattice detected, loading embeddings from LanceDB...');
            // Load embeddings from LanceDB for v2 format
            const { rebuildLatticeFromLanceDB } = await import(
              '../../sigma/lattice-reconstructor.js'
            );
            latticeWithEmbeddings = await rebuildLatticeFromLanceDB(
              sessionId,
              cwd
            );
            debug(' Embeddings loaded from LanceDB');
          }

          // Restore lattice to state
          setConversationLattice(latticeWithEmbeddings);

          // Rebuild turnAnalyses from lattice nodes
          const restoredAnalyses: TurnAnalysis[] =
            latticeWithEmbeddings.nodes.map((node) => ({
              turn_id: node.id,
              role: node.role,
              content: node.content,
              timestamp: node.timestamp,
              embedding: node.embedding || [],
              novelty: node.novelty || 0,
              importance_score: node.importance_score || 0,
              is_paradigm_shift: node.is_paradigm_shift || false,
              is_routine: (node.importance_score || 0) < 3, // Reconstruct from importance score
              overlay_scores: node.overlay_scores || {
                O1_structural: 0,
                O2_security: 0,
                O3_lineage: 0,
                O4_mission: 0,
                O5_operational: 0,
                O6_mathematical: 0,
                O7_strategic: 0,
              },
              references: [], // Not preserved in lattice nodes, start empty
              semantic_tags: node.semantic_tags || [],
            }));

          turnAnalyses.current = restoredAnalyses;

          debug(
            ' Lattice restored:',
            restoredLattice.nodes.length,
            'nodes,',
            restoredLattice.edges.length,
            'edges'
          );
          debug(' Turn analyses restored:', restoredAnalyses.length, 'turns');

          debugLog(
            `[SIGMA] Session state restored from lattice\n` +
              `  Session ID: ${sessionId}\n` +
              `  Nodes: ${restoredLattice.nodes.length}\n` +
              `  Edges: ${restoredLattice.edges.length}\n` +
              `  Turn analyses: ${restoredAnalyses.length}\n` +
              `  Paradigm shifts: ${restoredAnalyses.filter((t) => t.is_paradigm_shift).length}\n\n`
          );

          // Reset token count - compressed session starts fresh
          // The old NDJSON transcript contains pre-compression tokens which are incorrect
          // SDK will provide accurate token count on first new message
          setTokenCount({ input: 0, output: 0, total: 0 });
          debug(
            ' Token count reset (compressed session - will get true count from SDK)'
          );

          // Load recap for injection on first query
          const recapPath = path.join(latticeDir, `${sessionId}.recap.txt`);
          if (fs.existsSync(recapPath)) {
            const recapContent = fs.readFileSync(recapPath, 'utf-8');
            // Extract just the recap text (skip the header lines)
            const recapLines = recapContent.split('\n');
            const recapStartIdx = recapLines.findIndex((line) =>
              line.startsWith('='.repeat(80))
            );
            if (recapStartIdx >= 0) {
              const recap = recapLines.slice(recapStartIdx + 2).join('\n');
              setInjectedRecap(recap);
              debug(
                ` Loaded recap for injection (~${Math.round(recap.length / 4)} tokens)`
              );
            }
          }

          // Don't resume SDK session - let it create new one with recap injection
          setResumeSessionId(undefined);
          debug(
            ' Resume cleared - new SDK session will start with recap injection'
          );

          // Add system message to UI
          setMessages((prev) => [
            ...prev,
            {
              type: 'system',
              content: `🕸️  Resumed session with ${restoredLattice.nodes.length} nodes, ${restoredLattice.edges.length} edges`,
              timestamp: new Date(),
            },
          ]);
        } else {
          debug(
            ' No existing lattice found, attempting LanceDB reconstruction'
          );

          try {
            // Rebuild from LanceDB (the source of truth for embeddings)
            const rebuiltAnalyses = await rebuildTurnAnalysesFromLanceDB(
              sessionId,
              cwd
            );

            if (rebuiltAnalyses.length > 0) {
              turnAnalyses.current = rebuiltAnalyses;

              debug(
                ' Lattice reconstructed from LanceDB:',
                rebuiltAnalyses.length,
                'turns'
              );
              debugLog(
                `[SIGMA] Session state reconstructed from LanceDB\n` +
                  `  Session ID: ${sessionId}\n` +
                  `  Turns reconstructed: ${rebuiltAnalyses.length}\n` +
                  `  Paradigm shifts: ${rebuiltAnalyses.filter((t) => t.is_paradigm_shift).length}\n` +
                  `  Avg importance: ${(rebuiltAnalyses.reduce((sum, t) => sum + t.importance_score, 0) / rebuiltAnalyses.length).toFixed(1)}\n\n`
              );

              // Also rebuild the lattice structure for consistency
              const rebuiltLattice = await rebuildLatticeFromLanceDB(
                sessionId,
                cwd
              );
              setConversationLattice(rebuiltLattice);

              // Add system message to UI
              setMessages((prev) => [
                ...prev,
                {
                  type: 'system',
                  content: `🔄 Resumed session with ${rebuiltAnalyses.length} turns from LanceDB`,
                  timestamp: new Date(),
                },
              ]);
            } else {
              debug(' No turns found in LanceDB for session:', sessionId);
            }
          } catch (err) {
            debug(' Failed to reconstruct from LanceDB:', err);
            debugLog(
              `[SIGMA ERROR] LanceDB reconstruction failed: ${(err as Error).message}\n` +
                `  Stack: ${(err as Error).stack}\n\n`
            );
          }
        }

        // ========================================
        // 3. RESTORE CONVERSATION OVERLAYS
        // ========================================
        // Overlays are automatically loaded from disk by BaseConversationManager.getAllItems()
        // when queried via conversationRegistryRef.current.get(overlayId)
        // No explicit restoration needed - they're loaded on-demand from .sigma/overlays/
        debug(' Conversation overlays will be loaded on-demand from disk');
      } catch (err) {
        // Silently fail - just start from 0
        console.error('Failed to load session state:', err);
        debugLog(
          `[SIGMA ERROR] Failed to restore session: ${(err as Error).message}\n` +
            `  Stack: ${(err as Error).stack}\n\n`
        );
      }
    };

    loadAnchorSession();
  }, [anchorId, cwd, debug, debugLog]);

  // Effect: Set current session for LanceDB filtering
  useEffect(() => {
    if (conversationRegistryRef.current && currentSessionId) {
      conversationRegistryRef.current
        .setCurrentSession(currentSessionId)
        .then(() => {
          if (debugFlag) {
            console.log(
              chalk.dim(
                `[Σ]  Current session set for LanceDB: ${currentSessionId}`
              )
            );
          }
        })
        .catch((err) => {
          if (debugFlag) {
            console.log(chalk.dim('[Σ]  Failed to set current session:'), err);
          }
        });
    }
  }, [currentSessionId, debugFlag]);

  // Cleanup effect: Flush conversation overlays when component unmounts
  useEffect(() => {
    return () => {
      // Flush on cleanup
      if (conversationRegistryRef.current && currentSessionId) {
        conversationRegistryRef.current
          .flushAll(currentSessionId)
          .then(() => {
            if (debugFlag) {
              console.log(chalk.dim('[Σ]  Final flush on cleanup complete'));
            }
          })
          .catch((err) => {
            if (debugFlag) {
              console.log(chalk.dim('[Σ]  Failed to flush on cleanup:'), err);
            }
          });
      }
    };
  }, [currentSessionId, debugFlag]);

  const sendMessage = useCallback(
    async (prompt: string) => {
      try {
        setIsThinking(true);
        setError(null);

        // Add user message immediately (capture timestamp for embedding cache)
        const userMessageTimestamp = new Date();
        setMessages((prev) => [
          ...prev,
          {
            type: 'user',
            content: prompt,
            timestamp: userMessageTimestamp,
          },
        ]);

        // Collect stderr for better error messages
        const stderrLines: string[] = [];

        // Prepare prompt with optional recap injection OR real-time context injection
        let finalPrompt = prompt;

        if (injectedRecap) {
          // Inject recap as part of the user prompt to preserve claude_code preset
          finalPrompt = `${injectedRecap}\n\n---\n\nUser request: ${prompt}`;
          // Clear recap after first injection - subsequent queries use real-time context injection
          // This ensures: 1st query = full recap, 2nd+ queries = semantic lattice search
          setInjectedRecap(null);

          debugLog(
            `[SIGMA] Injecting intelligent recap into user prompt (one-time)\n` +
              `  Recap length: ${injectedRecap.length} chars (~${Math.round(injectedRecap.length / 4)} tokens)\n` +
              `  Subsequent queries will use real-time context injection\n\n`
          );
        } else if (embedderRef.current && turnAnalyses.current.length > 0) {
          // Real-time lattice context injection for fluent conversation
          try {
            const result = await injectRelevantContext(
              prompt,
              turnAnalyses.current,
              embedderRef.current,
              { debug: debugFlag }
            );

            finalPrompt = result.message;

            // Cache the user message embedding for reuse in analyzeTurn
            if (result.embedding) {
              userMessageEmbeddingCache.current.set(
                userMessageTimestamp.getTime(),
                result.embedding
              );
            }

            if (finalPrompt !== prompt) {
              debugLog(
                `[SIGMA] Real-time context injected from lattice\n` +
                  `  Original length: ${prompt.length} chars\n` +
                  `  Enhanced length: ${finalPrompt.length} chars\n\n`
              );
            }
          } catch (err) {
            // Fail gracefully - use original prompt
            debugLog(
              `[SIGMA] Context injection failed: ${(err as Error).message}\n`
            );
          }
        }

        // Get current resume session ID
        const currentResumeId = resumeSessionId;

        // Create query with Claude Code system prompt preset
        // This ensures the TUI has the same instructions as standard Claude Code CLI
        debugLog(
          `[QUERY START] Creating query with resume=${currentResumeId}, hasRecap=${!!injectedRecap}\n`
        );

        const q = query({
          prompt: finalPrompt,
          options: {
            cwd: cwd,
            resume: currentResumeId, // undefined after compression = fresh session!
            systemPrompt: { type: 'preset', preset: 'claude_code' }, // Always use claude_code preset!
            includePartialMessages: true, // Get streaming updates
            stderr: (data: string) => {
              stderrLines.push(data);
              debugLog(`[STDERR] ${data}\n`);
            },
            canUseTool: async (toolName, input) => {
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
              (currentResumeId || turnAnalyses.current.length > 0)
                ? {
                    'conversation-memory': recallMcpServerRef.current,
                  }
                : undefined,
          },
        });

        setCurrentQuery(q);

        debugLog(`[QUERY LOOP] Starting to process SDK messages\n`);
        // Process streaming messages
        let messageCount = 0;
        let hasAssistantMessage = false;
        for await (const message of q) {
          messageCount++;
          debugLog(`[QUERY LOOP] Processing message type: ${message.type}\n`);
          if (message.type === 'assistant') {
            hasAssistantMessage = true;
          }
          processSDKMessage(message);
        }

        debugLog(
          `[QUERY LOOP] Query completed. Messages: ${messageCount}, hadAssistant: ${hasAssistantMessage}\n`
        );
        if (stderrLines.length > 0) {
          debugLog(`[STDERR SUMMARY] ${stderrLines.join('\n')}\n`);
        }

        // If query completed without assistant response, show error
        if (!hasAssistantMessage && messageCount <= 1) {
          // Check for authentication errors in stderr
          const stderrText = stderrLines.join(' ');
          let errorMsg = '';

          if (
            stderrText.includes('401') &&
            (stderrText.includes('authentication_error') ||
              stderrText.includes('OAuth token has expired') ||
              stderrText.includes('token has expired'))
          ) {
            errorMsg =
              '⎿ API Error: 401 - OAuth token has expired. Please obtain a new token or refresh your existing token.\n· Please run /login';
          } else if (stderrLines.length > 0) {
            errorMsg = `SDK error: ${stderrText}`;
          } else {
            errorMsg = 'SDK completed without response - check authentication';
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
        if (
          originalError.includes('401') &&
          (originalError.includes('authentication_error') ||
            originalError.includes('OAuth token has expired') ||
            originalError.includes('token has expired'))
        ) {
          errorMsg =
            '⎿ API Error: 401 - OAuth token has expired. Please obtain a new token or refresh your existing token.\n· Please run /login';
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
      resumeSessionId,
      injectedRecap,
      debugLog,
      embedderRef,
      turnAnalyses,
      debugFlag,
      recallMcpServerRef,
      anchorId,
      setCurrentSessionId,
      updateAnchorStats,
    ]
  );

  const processSDKMessage = (sdkMessage: SDKMessage) => {
    // Debug: log all SDK messages to a file
    try {
      debugLog(
        `[${new Date().toISOString()}] ${sdkMessage.type}\n${JSON.stringify(sdkMessage, null, 2)}\n\n`
      );
    } catch (err) {
      // Ignore logging errors
    }

    // Extract session ID from SDK message (all SDK messages have it)
    // This is critical for session-less TUI starts where SDK creates its own ID
    if ('session_id' in sdkMessage && sdkMessage.session_id) {
      const sdkSessionId = sdkMessage.session_id;
      setCurrentSessionId((prev) => {
        if (prev !== sdkSessionId) {
          // SDK gave us a different session ID - update anchor state
          // ALWAYS use anchorId for file access, never SDK session UUID
          debug(' SDK session changed:', prev, '→', sdkSessionId);

          if (prev.startsWith('tui-')) {
            // First time getting real SDK session (was placeholder)
            debugLog(
              `[SESSION] Updated from placeholder ${prev} to SDK session ID: ${sdkSessionId}\n\n`
            );
          }

          // Load state by anchor_id (NOT by SDK session UUID!)
          const state = loadSessionState(anchorId, cwd);

          if (!state) {
            // First time - create initial state
            const newState = createSessionState(anchorId, sdkSessionId);
            saveSessionState(newState, cwd);
            debug('󱖫 Created anchor state:', anchorId, '→', sdkSessionId);
          } else {
            // Update existing state with new SDK session
            const reason = compressionTriggered.current
              ? 'compression'
              : 'expiration';

            // Get compressed size from the last compression result
            const compressedTokens =
              reason === 'compression'
                ? lastCompressedSize.current || tokenCount.total
                : undefined;

            const updated = updateSessionState(
              state,
              sdkSessionId,
              reason,
              compressedTokens
            );
            saveSessionState(updated, cwd);
            debug(
              `󱖫 Updated anchor state: ${anchorId} → ${sdkSessionId} (${reason})`
            );

            // CRITICAL: Reset compression flag when new SDK session starts
            // This allows compression to trigger again in the new session
            if (compressionTriggered.current) {
              compressionTriggered.current = false;
              debugLog(
                `[COMPRESSION FLAG RESET] New session: ${sdkSessionId}\n` +
                  `  Previous session: ${prev}\n` +
                  `  Reason: ${reason}\n\n`
              );
              debug(
                ' Compression flag reset - can compress again in new session'
              );
            }
          }

          // Mark that we've received SDK session ID
          if (
            !hasReceivedSDKSessionId.current &&
            conversationRegistryRef.current
          ) {
            hasReceivedSDKSessionId.current = true;

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

          return sdkSessionId;
        }
        return prev; // Keep existing if already set or not a placeholder
      });

      // CRITICAL FIX: Update resumeSessionId so next query continues from this session
      // Without this, each query starts fresh and loses conversation context!
      setResumeSessionId(sdkSessionId);
    }

    switch (sdkMessage.type) {
      case 'assistant': {
        // Check if this message has tool calls - if so, display them
        const toolUses = sdkMessage.message.content.filter(
          (c: { type: string }) => c.type === 'tool_use'
        );
        if (toolUses.length > 0) {
          toolUses.forEach(
            (tool: { name: string; input: Record<string, unknown> }) => {
              // Format tool input - show description if available, otherwise full input
              let inputDesc = '';
              let toolIcon = '🔧';

              // Special formatting for memory recall tool
              if (
                tool.name ===
                'mcp__conversation-memory__recall_past_conversation'
              ) {
                toolIcon = '🧠';
                if (tool.input.query) {
                  inputDesc = `"${tool.input.query as string}"`;
                } else {
                  inputDesc = JSON.stringify(tool.input);
                }
              } else if (tool.input.description) {
                inputDesc = tool.input.description as string;
              } else if (tool.input.file_path) {
                // For Edit tool, show character-level diff with background colors
                if (
                  tool.name === 'Edit' &&
                  tool.input.old_string &&
                  tool.input.new_string
                ) {
                  const diffLines: string[] = [];
                  diffLines.push(tool.input.file_path as string);

                  // Use diff library to get line changes
                  const lineDiff = Diff.diffLines(
                    tool.input.old_string as string,
                    tool.input.new_string as string
                  );

                  lineDiff.forEach((part) => {
                    const lines = part.value
                      .split('\n')
                      .filter(
                        (line) => line.length > 0 || part.value.endsWith('\n')
                      );

                    if (part.added) {
                      // Added lines - olive/dark green background with white text
                      lines.forEach((line) => {
                        if (line) {
                          // \x1b[48;5;58m = dark olive background, \x1b[97m = bright white text
                          diffLines.push(
                            `  \x1b[32m+\x1b[0m \x1b[48;5;58m\x1b[97m${line}\x1b[0m`
                          );
                        }
                      });
                    } else if (part.removed) {
                      // Removed lines - dark red background with white text
                      lines.forEach((line) => {
                        if (line) {
                          // \x1b[48;5;52m = dark red background, \x1b[97m = bright white text
                          diffLines.push(
                            `  \x1b[31m-\x1b[0m \x1b[48;5;52m\x1b[97m${line}\x1b[0m`
                          );
                        }
                      });
                    } else {
                      // Unchanged lines - no color
                      lines.forEach((line) => {
                        if (line) {
                          diffLines.push(`   ${line}`);
                        }
                      });
                    }
                  });

                  inputDesc = diffLines.join('\n');
                } else {
                  inputDesc = `file: ${tool.input.file_path as string}`;
                }
              } else if (tool.input.command) {
                inputDesc = `cmd: ${tool.input.command as string}`;
              } else if (tool.input.pattern) {
                inputDesc = `pattern: ${tool.input.pattern as string}`;
              } else if (tool.name === 'TodoWrite' && tool.input.todos) {
                // Format TodoWrite with a nice visual display
                const todos = tool.input.todos as Array<{
                  content: string;
                  status: string;
                  activeForm: string;
                }>;

                const todoLines: string[] = [];
                todos.forEach((todo) => {
                  let statusIcon = '';
                  let statusColor = '';

                  if (todo.status === 'completed') {
                    statusIcon = '✓';
                    statusColor = '\x1b[32m'; // green
                  } else if (todo.status === 'in_progress') {
                    statusIcon = '→';
                    statusColor = '\x1b[33m'; // yellow
                  } else {
                    statusIcon = '○';
                    statusColor = '\x1b[90m'; // gray
                  }

                  const displayText =
                    todo.status === 'in_progress'
                      ? todo.activeForm
                      : todo.content;
                  todoLines.push(
                    `  ${statusColor}${statusIcon}\x1b[0m ${displayText}`
                  );
                });

                inputDesc = '\n' + todoLines.join('\n');
              } else {
                inputDesc = JSON.stringify(tool.input);
              }

              setMessages((prev) => [
                ...prev,
                {
                  type: 'tool_progress',
                  content: `${toolIcon} ${tool.name}: ${inputDesc}`,
                  timestamp: new Date(),
                },
              ]);
            }
          );
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

          // SDK gives cumulative totals per query, use Math.max to handle multi-query sessions
          // This prevents token count from appearing to "drop" when a new query starts
          setTokenCount((prev) => {
            const newTotal = totalInput + totalOutput;
            if (newTotal > prev.total) {
              return {
                input: totalInput,
                output: totalOutput,
                total: newTotal,
              };
            }
            return prev; // Keep higher count from previous queries
          });
        }

        if (
          event.type === 'content_block_start' &&
          event.content_block?.type === 'tool_use'
        ) {
          // Tool starting - show indicator immediately
          const toolBlock = event.content_block;
          setMessages((prev) => [
            ...prev,
            {
              type: 'tool_progress',
              content: `🔧 ${toolBlock.name}...`,
              timestamp: new Date(),
            },
          ]);
        } else if (
          event.type === 'content_block_delta' &&
          event.delta?.type === 'text_delta'
        ) {
          // Text content streaming
          const delta = event.delta;
          const colorReplacedText = replaceSDKDiffColors(delta.text);
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

          setTokenCount((prev) => {
            // Only update if the result total is higher than what we have
            if (resultTotal > prev.total) {
              return {
                input: usage.input_tokens,
                output: usage.output_tokens,
                total: resultTotal,
              };
            }
            return prev; // Keep the higher count from message_delta
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
          setMessages((prev) => [
            ...prev,
            {
              type: 'system',
              content: `✗ Error: ${sdkMessage.subtype}`,
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

  const interrupt = useCallback(async () => {
    if (currentQuery) {
      await currentQuery.interrupt();
      setIsThinking(false);
    }
  }, [currentQuery]);

  // Calculate Sigma stats for header display
  const sigmaStats = {
    nodes: turnAnalyses.current.length,
    edges:
      turnAnalyses.current.length > 0 ? turnAnalyses.current.length - 1 : 0, // temporal edges
    paradigmShifts: turnAnalyses.current.filter((t) => t.is_paradigm_shift)
      .length,
    avgNovelty:
      turnAnalyses.current.length > 0
        ? turnAnalyses.current.reduce((sum, t) => sum + t.novelty, 0) /
          turnAnalyses.current.length
        : 0,
    avgImportance:
      turnAnalyses.current.length > 0
        ? turnAnalyses.current.reduce((sum, t) => sum + t.importance_score, 0) /
          turnAnalyses.current.length
        : 0,
  };

  // Calculate average overlay scores
  const avgOverlays = {
    O1_structural: 0,
    O2_security: 0,
    O3_lineage: 0,
    O4_mission: 0,
    O5_operational: 0,
    O6_mathematical: 0,
    O7_strategic: 0,
  };

  if (turnAnalyses.current.length > 0) {
    turnAnalyses.current.forEach((turn) => {
      Object.keys(avgOverlays).forEach((key) => {
        avgOverlays[key as keyof typeof avgOverlays] +=
          turn.overlay_scores[key as keyof typeof turn.overlay_scores];
      });
    });
    Object.keys(avgOverlays).forEach((key) => {
      avgOverlays[key as keyof typeof avgOverlays] /=
        turnAnalyses.current.length;
    });
  }

  return {
    messages,
    sendMessage,
    interrupt,
    isThinking,
    error,
    tokenCount,
    conversationLattice, // Sigma compressed context
    currentSessionId, // Active session ID (may switch)
    sigmaStats, // Lattice statistics for header display
    avgOverlays, // Average overlay scores for info panel
  };
}
