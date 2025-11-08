import { useState, useCallback, useEffect, useRef } from 'react';
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

  // Session management (extracted to useSessionManager hook)
  const sessionManager = useSessionManager({
    sessionIdProp,
    cwd,
    debug: debugFlag,
    onSessionLoaded: (message) => {
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
    },
    onSDKSessionChanged: (event) => {
      if (debugFlag) {
        console.log(
          chalk.dim(
            `[Σ]  Session updated: ${event.previousSessionId} → ${event.newSessionId} (${event.reason})`
          )
        );
      }
    },
  });

  // Convenient aliases for session state
  const anchorId = sessionManager.state.anchorId;
  const currentSessionId = sessionManager.state.currentSessionId;
  const resumeSessionId = sessionManager.state.resumeSessionId;

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

  // Update session stats (delegated to sessionManager)
  const updateAnchorStats = useCallback(() => {
    sessionManager.updateStats(turnAnalysis.analyses);
  }, [sessionManager, turnAnalysis.analyses]);

  // Initialize services on mount
  useEffect(() => {
    const endpoint = process.env.WORKBENCH_URL || 'http://localhost:8000';
    embedderRef.current = new EmbeddingService(endpoint);
    const sigmaPath = path.join(cwd, '.sigma');
    conversationRegistryRef.current = new ConversationOverlayRegistry(sigmaPath, endpoint, debugFlag);
    recallMcpServerRef.current = createRecallMcpServer(conversationRegistryRef.current, endpoint);
    const pgcPath = path.join(cwd, '.open_cognition');
    if (fs.existsSync(pgcPath)) projectRegistryRef.current = new OverlayRegistry(pgcPath, endpoint);
  }, [cwd, debugFlag]);

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

  // Minimal initialization - token counts come from SDK, lattice loading disabled for now  useEffect(() => {    debug('🚀 Session initialized:', anchorId);    if (resumeSessionId) debug('📂 Resuming from:', resumeSessionId);  }, [anchorId, resumeSessionId, debug]);

  // Set session and cleanup
  useEffect(() => {
    conversationRegistryRef.current?.setCurrentSession(currentSessionId);
    return () => {
      conversationRegistryRef.current?.flushAll(currentSessionId);
    };
  }, [currentSessionId]);

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
      sessionManager,
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
      const prevSessionId = currentSessionId;

      if (prevSessionId !== sdkSessionId) {
        // SDK gave us a different session ID - update via sessionManager
        debug(' SDK session changed:', prevSessionId, '→', sdkSessionId);

        if (prevSessionId.startsWith('tui-')) {
          // First time getting real SDK session (was placeholder)
          debugLog(
            `[SESSION] Updated from placeholder ${prevSessionId} to SDK session ID: ${sdkSessionId}\n\n`
          );
        }

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
          debugLog(
            `[COMPRESSION FLAG RESET] New session: ${sdkSessionId}\n` +
              `  Previous session: ${prevSessionId}\n` +
              `  Reason: ${reason}\n\n`
          );
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
