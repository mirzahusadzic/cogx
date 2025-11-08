import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { SDKMessage, Query } from '@anthropic-ai/claude-agent-sdk';
import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { EmbeddingService } from '../../core/services/embedding.js';
import { OverlayRegistry } from '../../core/algebra/overlay-registry.js';
import { ConversationOverlayRegistry } from '../../sigma/conversation-registry.js';
import { createRecallMcpServer } from '../../sigma/recall-tool.js';
import { injectRelevantContext } from '../../sigma/context-injector.js';
// Lattice reconstruction functions disabled - re-embedding blocks UI
// import {
//   rebuildTurnAnalysesFromLanceDB,
//   rebuildLatticeFromLanceDB,
// } from '../../sigma/lattice-reconstructor.js';
import {
  loadSessionState,
  saveSessionState,
  createSessionState,
  updateSessionState,
  updateSessionStats,
  migrateOldStateFile,
} from '../../sigma/session-state.js';
import { useTokenCount } from './tokens/useTokenCount.js';
import {
  createSDKQuery,
  isAuthenticationError,
  formatAuthError,
  formatSDKError,
} from './sdk/index.js';
import { formatToolUse } from './rendering/ToolFormatter.js';
import { stripANSICodes } from './rendering/MessageRenderer.js';
import { useTurnAnalysis } from './analysis/index.js';
import type { AnalysisTask } from './analysis/types.js';
import { useCompression } from './compression/useCompression.js';
import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk';
import type { ConversationLattice, TurnAnalysis } from '../../sigma/types.js';

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

  // Token counting with proper reset semantics
  const tokenCounter = useTokenCount();

  // Sigma state: conversation lattice and analysis
  const [conversationLattice, setConversationLattice] =
    useState<ConversationLattice | null>(null);
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

  // Turn analysis with background queue (replaces inline analyzeNewTurns)
  const turnAnalysis = useTurnAnalysis({
    embedder: embedderRef.current,
    projectRegistry: projectRegistryRef.current,
    conversationRegistry: conversationRegistryRef.current,
    cwd,
    sessionId: currentSessionId,
    debug: debugFlag,
  });

  // Compression orchestration (replaces inline compression trigger logic)
  const compression = useCompression({
    tokenCount: tokenCounter.count.total,
    analyzedTurns: turnAnalysis.stats.totalAnalyzed,
    isThinking,
    tokenThreshold: sessionTokens,
    minTurns: 5,
    enabled: true,
    debug: debugFlag,
    onCompressionTriggered: (tokens, turns) => {
      debug('🗜️  Triggering compression');
      setMessages((prev) => [
        ...prev,
        {
          type: 'system',
          content:
            `🗜️  Context compression triggered at ${(tokens / 1000).toFixed(1)}K tokens\n` +
            `Compressing ${turns} turns into intelligent recap...\n` +
            `(Use --debug flag to see detailed compression metrics)`,
          timestamp: new Date(),
        },
      ]);
      // TODO: Implement actual compression workflow
      // For now, just show the message
    },
  });

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
        total_turns_analyzed: turnAnalysis.analyses.length,
        paradigm_shifts: turnAnalysis.analyses.filter(
          (t) => t.is_paradigm_shift
        ).length,
        routine_turns: turnAnalysis.analyses.filter((t) => t.is_routine).length,
        avg_novelty:
          turnAnalysis.analyses.length > 0
            ? (
                turnAnalysis.analyses.reduce((sum, t) => sum + t.novelty, 0) /
                turnAnalysis.analyses.length
              ).toFixed(3)
            : '0.000',
        avg_importance:
          turnAnalysis.analyses.length > 0
            ? (
                turnAnalysis.analyses.reduce(
                  (sum, t) => sum + t.importance_score,
                  0
                ) / turnAnalysis.analyses.length
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

  // Sigma: Queue turn analysis in background (non-blocking!)
  useEffect(() => {
    const currentMessages = messagesRef.current;
    if (currentMessages.length === 0) return;

    const queueNewAnalyses = async () => {
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

      debug(' Unanalyzed user/assistant messages:', unanalyzedMessages.length);

      // Queue each unanalyzed message for background processing
      for (const {
        msg: message,
        originalIndex: messageIndex,
      } of unanalyzedMessages) {
        // For assistant messages, only queue if we're NOT currently thinking
        if (message.type === 'assistant' && isThinking) {
          debug('   Skipping assistant message - still streaming');
          return;
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

        // Queue for background analysis (NON-BLOCKING!)
        const task: AnalysisTask = {
          message,
          messageIndex,
          timestamp: turnTimestamp,
          cachedEmbedding,
        };

        debug(`   Queuing turn for analysis: ${turnTimestamp}`);
        await turnAnalysis.enqueueAnalysis(task);

        // Clean up cached embedding
        if (cachedEmbedding) {
          userMessageEmbeddingCache.current.delete(turnTimestamp);
        }

        // Compression trigger is now handled by useCompression hook above
      }
    };

    queueNewAnalyses();
  }, [
    userAssistantMessageCount,
    isThinking,
    cwd,
    currentSessionId,
    debug,
    debugLog,
    updateAnchorStats,
    tokenCounter.count,
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

          tokenCounter.update({
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

          const latticeWithEmbeddings = restoredLattice;

          // DISABLED: Re-embedding blocks UI - will be moved to background queue during refactor
          // if (isV2Format) {
          //   debug(' V2 lattice detected, loading embeddings from LanceDB...');
          //   // Load embeddings from LanceDB for v2 format
          //   const { rebuildLatticeFromLanceDB } = await import(
          //     '../../sigma/lattice-reconstructor.js'
          //   );
          //   latticeWithEmbeddings = await rebuildLatticeFromLanceDB(
          //     sessionId,
          //     cwd
          //   );
          //   debug(' Embeddings loaded from LanceDB');
          // }
          if (isV2Format) {
            debug(
              ' V2 lattice detected - embeddings will be lazy-loaded (re-embedding disabled)'
            );
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

          turnAnalysis.setAnalyses(restoredAnalyses);

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
          tokenCounter.reset();
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
            ' No existing lattice found - skipping LanceDB reconstruction (re-embedding disabled)'
          );

          // DISABLED: Re-embedding blocks UI - will be moved to background queue during refactor
          // try {
          //   // Rebuild from LanceDB (the source of truth for embeddings)
          //   const rebuiltAnalyses = await rebuildTurnAnalysesFromLanceDB(
          //     sessionId,
          //     cwd
          //   );
          //
          //   if (rebuiltAnalyses.length > 0) {
          //     turnAnalysis.analyses = rebuiltAnalyses;
          //
          //     debug(
          //       ' Lattice reconstructed from LanceDB:',
          //       rebuiltAnalyses.length,
          //       'turns'
          //     );
          //     debugLog(
          //       `[SIGMA] Session state reconstructed from LanceDB\n` +
          //         `  Session ID: ${sessionId}\n` +
          //         `  Turns reconstructed: ${rebuiltAnalyses.length}\n` +
          //         `  Paradigm shifts: ${rebuiltAnalyses.filter((t) => t.is_paradigm_shift).length}\n` +
          //         `  Avg importance: ${(rebuiltAnalyses.reduce((sum, t) => sum + t.importance_score, 0) / rebuiltAnalyses.length).toFixed(1)}\n\n`
          //     );
          //
          //     // Also rebuild the lattice structure for consistency
          //     const rebuiltLattice = await rebuildLatticeFromLanceDB(
          //       sessionId,
          //       cwd
          //     );
          //     setConversationLattice(rebuiltLattice);
          //
          //     // Add system message to UI
          //     setMessages((prev) => [
          //       ...prev,
          //       {
          //         type: 'system',
          //         content: `🔄 Resumed session with ${rebuiltAnalyses.length} turns from LanceDB`,
          //         timestamp: new Date(),
          //       },
          //     ]);
          //   } else {
          //     debug(' No turns found in LanceDB for session:', sessionId);
          //   }
          // } catch (err) {
          //   debug(' Failed to reconstruct from LanceDB:', err);
          //   debugLog(
          //     `[SIGMA ERROR] LanceDB reconstruction failed: ${(err as Error).message}\n` +
          //       `  Stack: ${(err as Error).stack}\n\n`
          //   );
          // }
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
        } else if (embedderRef.current && turnAnalysis.analyses.length > 0) {
          // Real-time lattice context injection for fluent conversation
          try {
            const result = await injectRelevantContext(
              prompt,
              turnAnalysis.analyses,
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

        const q = createSDKQuery({
          prompt: finalPrompt,
          cwd: cwd,
          resumeSessionId: currentResumeId, // undefined after compression = fresh session!
          onStderr: (data: string) => {
            stderrLines.push(data);
            debugLog(`[STDERR] ${data}\n`);
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
      resumeSessionId,
      injectedRecap,
      debugLog,
      embedderRef,
      turnAnalysis,
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
            const reason = compression.state.triggered
              ? 'compression'
              : 'expiration';

            // Get compressed size from the last compression result
            const compressedTokens =
              reason === 'compression'
                ? compression.state.lastCompressedTokens || tokenCounter.count.total
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
            if (compression.state.triggered) {
              compression.reset();
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
              const formatted = formatToolUse(tool);
              setMessages((prev) => [
                ...prev,
                {
                  type: 'tool_progress',
                  content: `${formatted.icon} ${formatted.name}: ${formatted.description}`,
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

          // Update token count (hook automatically handles Math.max and reset logic)
          tokenCounter.update({
            input: totalInput,
            output: totalOutput,
            total: totalInput + totalOutput,
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
    nodes: turnAnalysis.analyses.length,
    edges:
      turnAnalysis.analyses.length > 0 ? turnAnalysis.analyses.length - 1 : 0, // temporal edges
    paradigmShifts: turnAnalysis.analyses.filter((t) => t.is_paradigm_shift)
      .length,
    avgNovelty:
      turnAnalysis.analyses.length > 0
        ? turnAnalysis.analyses.reduce((sum, t) => sum + t.novelty, 0) /
          turnAnalysis.analyses.length
        : 0,
    avgImportance:
      turnAnalysis.analyses.length > 0
        ? turnAnalysis.analyses.reduce(
            (sum, t) => sum + t.importance_score,
            0
          ) / turnAnalysis.analyses.length
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

  if (turnAnalysis.analyses.length > 0) {
    turnAnalysis.analyses.forEach((turn) => {
      Object.keys(avgOverlays).forEach((key) => {
        avgOverlays[key as keyof typeof avgOverlays] +=
          turn.overlay_scores[key as keyof typeof turn.overlay_scores];
      });
    });
    Object.keys(avgOverlays).forEach((key) => {
      avgOverlays[key as keyof typeof avgOverlays] /=
        turnAnalysis.analyses.length;
    });
  }

  return {
    messages,
    sendMessage,
    interrupt,
    isThinking,
    error,
    tokenCount: tokenCounter.count,
    conversationLattice, // Sigma compressed context
    currentSessionId, // Active session ID (may switch)
    sigmaStats, // Lattice statistics for header display
    avgOverlays, // Average overlay scores for info panel
  };
}
