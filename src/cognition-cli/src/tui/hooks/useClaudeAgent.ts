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

interface UseClaudeAgentOptions {
  sessionId?: string;
  cwd: string;
  sessionTokens?: number;
  maxThinkingTokens?: number;
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
    maxThinkingTokens,
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

  // Slash commands: Load commands cache
  const [commandsCache, setCommandsCache] = useState<Map<string, Command>>(
    new Map()
  );

  // Track count of ONLY user/assistant messages (not system/tool_progress)
  // This prevents infinite loop when compression adds system messages
  const userAssistantMessageCount = messages.filter(
    (m) => m.type === 'user' || m.type === 'assistant'
  ).length;

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
  const resumeSessionId = sessionManager.state.resumeSessionId;

  // Ref to track current session ID synchronously (prevents duplicate session entries during rapid SDK messages)
  // React state updates are async, so during rapid message processing (347 msgs in 6s during turn analysis),
  // the state variable lags behind and causes duplicate "expiration" entries in compression_history
  const currentSessionIdRef = useRef(currentSessionId);

  // Keep ref in sync with state
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

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
      debug('🗜️  Triggering compression');

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

      try {
        const { compressContext } = await import('../../sigma/compressor.js');
        const { reconstructSessionContext } = await import(
          '../../sigma/context-reconstructor.js'
        );

        const result = await compressContext(turnAnalysis.analyses, {
          target_size: 40000,
        });

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
        const sessionContext = await reconstructSessionContext(
          latticeWithPending,
          cwd,
          conversationRegistryRef.current || undefined
        );

        const recap =
          `COMPRESSED CONVERSATION RECAP (${latticeWithPending.nodes.length} key turns)\n` +
          `${(tokens / 1000).toFixed(1)}K → ${(result.compressed_size / 1000).toFixed(1)}K tokens\n\n` +
          sessionContext.recap;

        fs.writeFileSync(
          path.join(cwd, '.sigma', `${currentSessionId}.recap.txt`),
          recap,
          'utf-8'
        );
        setInjectedRecap(recap);
        sessionManager.resetResumeSession();

        // FIX: Re-analyze pending turn in NEW session after compression
        if (pendingTurn) {
          debug('🔄 Re-analyzing pending turn in new session');
          await turnAnalysis.enqueueAnalysis(pendingTurn);
        }

        debug(
          `✅ Compression: ${result.lattice.nodes.length} nodes, ${(result.compressed_size / 1000).toFixed(1)}K tokens`
        );
      } catch (err) {
        debug('❌ Compression failed:', (err as Error).message);
      }
    },
    [debug, messages, turnAnalysis, cwd, currentSessionId, sessionManager]
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

  // Update session stats (delegated to sessionManager)
  const updateAnchorStats = useCallback(() => {
    sessionManager.updateStats(turnAnalysis.analyses);
  }, [sessionManager, turnAnalysis.analyses]);

  // Initialize services on mount
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
  }, [cwd, debugFlag]);

  // Load slash commands on mount
  useEffect(() => {
    loadCommands(cwd).then((result) => {
      setCommandsCache(result.commands);
      // Log any errors/warnings
      if (result.errors.length > 0 && debugFlag) {
        console.error('Command loading errors:', result.errors);
      }
      if (result.warnings.length > 0 && debugFlag) {
        console.warn('Command loading warnings:', result.warnings);
      }
    });
  }, [cwd, debugFlag]);

  // Load existing lattice on session resume from LanceDB (only once per session)
  useEffect(() => {
    const loadLattice = async () => {
      const sessionId = resumeSessionId || anchorId;

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
        // Silent fail - new session will start fresh
      }
    };

    loadLattice();
  }, [anchorId, resumeSessionId, cwd]);

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

        // Compression trigger is now handled by useCompression hook above
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
  ]);

  // Minimal initialization - token counts come from SDK, lattice loading disabled for now  useEffect(() => {    debug('🚀 Session initialized:', anchorId);    if (resumeSessionId) debug('📂 Resuming from:', resumeSessionId);  }, [anchorId, resumeSessionId, debug]);

  // Set session and cleanup
  useEffect(() => {
    conversationRegistryRef.current?.setCurrentSession(currentSessionId);
    return () => {
      conversationRegistryRef.current?.flushAll(currentSessionId);
    };
  }, [currentSessionId]);

  // Compute overlay scores from conversation registry
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
          }
        }

        // Get current resume session ID
        const currentResumeId = resumeSessionId;

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
      commandsCache,
    ]
  );

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
