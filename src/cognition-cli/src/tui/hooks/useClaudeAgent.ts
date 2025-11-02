import { useState, useCallback, useEffect, useRef } from 'react';
import {
  query,
  type SDKMessage,
  type Query,
} from '@anthropic-ai/claude-agent-sdk';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as Diff from 'diff';
import { EmbeddingService } from '../../core/services/embedding.js';
import { analyzeTurn } from '../../sigma/analyzer-with-embeddings.js';
import { compressContext } from '../../sigma/compressor.js';
import { reconstructSessionContext } from '../../sigma/context-reconstructor.js';
import type {
  ConversationLattice,
  TurnAnalysis,
  ConversationContext,
  ConversationTurn,
} from '../../sigma/types.js';

interface UseClaudeAgentOptions {
  sessionId?: string;
  cwd: string;
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
  // Debug logger (only logs if debug flag is set)
  const debug = (message: string, ...args: unknown[]) => {
    if (options.debug) {
      const chalk = require('chalk');
      console.log(chalk.dim(`[Σ] ${message}`), ...args);
    }
  };

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
  const embedderRef = useRef<EmbeddingService | null>(null);
  const compressionTriggered = useRef(false);
  const analyzingTurn = useRef<number | null>(null); // Track timestamp of turn being analyzed

  // Session management for Sigma compression
  // When we compress, we start a FRESH session (no resume) with intelligent recap
  const [resumeSessionId, setResumeSessionId] = useState(options.sessionId);
  const [currentSessionId, setCurrentSessionId] = useState(
    options.sessionId || `tui-${Date.now()}`
  );
  const [injectedRecap, setInjectedRecap] = useState<string | null>(null);

  // Initialize embedding service
  useEffect(() => {
    // Get workbench endpoint from environment or default
    const workbenchEndpoint =
      process.env.WORKBENCH_ENDPOINT || 'http://localhost:8000';
    embedderRef.current = new EmbeddingService(workbenchEndpoint);
  }, []);

  // Sigma: Analyze turns on-the-fly and trigger compression
  useEffect(() => {
    if (messages.length === 0) return;

    const analyzeNewTurns = async () => {
      const embedder = embedderRef.current;

      // Skip if embedder not initialized yet
      if (!embedder) {
        debug(' Embedder not initialized');
        return;
      }

      debug(' Analyzer effect triggered, messages:', messages.length);
      const lastMessage = messages[messages.length - 1];

      debug(' Last message type:', lastMessage.type);

      // Only analyze user and assistant messages (not tool_progress/system)
      if (lastMessage.type !== 'user' && lastMessage.type !== 'assistant') {
        debug(' Skipping non-user/assistant message');
        return;
      }

      const turnTimestamp = lastMessage.timestamp.getTime();

      // Check if we've already analyzed this turn
      const existingAnalysis = turnAnalyses.current.find(
        (a) => a.timestamp === turnTimestamp
      );
      if (existingAnalysis) {
        debug(' Turn already analyzed, skipping');
        return; // Already analyzed
      }

      // Check if we're already analyzing this turn (prevent concurrent analysis)
      if (analyzingTurn.current === turnTimestamp) {
        debug(' Turn analysis already in progress, skipping');
        return;
      }

      debug(' Starting turn analysis...');
      analyzingTurn.current = turnTimestamp; // Mark as analyzing

      try {
        // Build context from previous analyses
        const context: ConversationContext = {
          projectRoot: options.cwd,
          sessionId: currentSessionId, // Use current session ID (not undefined options.sessionId)
          history: turnAnalyses.current.map((a) => ({
            id: a.turn_id,
            role: a.role,
            content: a.content,
            timestamp: a.timestamp,
            embedding: a.embedding, // Include for novelty calculation
          })) as Array<ConversationTurn & { embedding: number[] }>,
        };

        // Truncate content for embedding (first 1000 + last 500 chars)
        // This preserves semantic meaning while reducing eGemma processing time
        let embeddingContent = lastMessage.content;
        if (embeddingContent.length > 1500) {
          embeddingContent =
            embeddingContent.substring(0, 1000) +
            '\n...[truncated]...\n' +
            embeddingContent.substring(embeddingContent.length - 500);
        }

        debug(
          ' Calling analyzeTurn with content length:',
          embeddingContent.length
        );

        // Analyze this turn (with truncated content for embedding)
        const analysis = await analyzeTurn(
          {
            id: `turn-${lastMessage.timestamp.getTime()}`,
            role: lastMessage.type as 'user' | 'assistant',
            content: embeddingContent, // Truncated for faster embedding
            timestamp: lastMessage.timestamp.getTime(),
          },
          context,
          embedder
        );

        debug(' analyzeTurn completed! Novelty:', analysis.novelty);

        // Store analysis
        turnAnalyses.current.push(analysis);

        // Clear analyzing flag
        analyzingTurn.current = null;

        // Log analysis (for debugging)
        fs.appendFileSync(
          path.join(options.cwd, 'tui-debug.log'),
          `[SIGMA] Turn analyzed: ${analysis.turn_id}\n` +
            `  Role: ${analysis.role}\n` +
            `  Novelty: ${analysis.novelty.toFixed(3)}\n` +
            `  Importance: ${analysis.importance_score}\n` +
            `  Paradigm shift: ${analysis.is_paradigm_shift}\n` +
            `  Routine: ${analysis.is_routine}\n` +
            `  Content: ${analysis.content.substring(0, 100)}${analysis.content.length > 100 ? '...' : ''}\n\n`
        );

        // Check if compression needed (3K token threshold for testing)
        const TOKEN_THRESHOLD = 150000; // Low for testing, will increase to 150K later
        const MIN_TURNS_FOR_COMPRESSION = 5; // Need at least 5 turns for meaningful compression

        if (
          tokenCount.total > TOKEN_THRESHOLD &&
          !compressionTriggered.current &&
          turnAnalyses.current.length >= MIN_TURNS_FOR_COMPRESSION
        ) {
          compressionTriggered.current = true;

          debug(
            ' Triggering compression with',
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
            debug(' Compression failed:', compressErr);
            fs.appendFileSync(
              path.join(options.cwd, 'tui-debug.log'),
              `[SIGMA ERROR] Compression failed: ${(compressErr as Error).message}\n` +
                `  Stack: ${(compressErr as Error).stack}\n\n`
            );
            compressionTriggered.current = false; // Reset so it can try again
            return; // Exit early
          }

          // Store compressed lattice
          setConversationLattice(compressionResult.lattice);

          // Log compression stats
          fs.appendFileSync(
            path.join(options.cwd, 'tui-debug.log'),
            `[SIGMA] Compression triggered at ${tokenCount.total} tokens\n` +
              `  Original: ${compressionResult.original_size} tokens\n` +
              `  Compressed: ${compressionResult.compressed_size} tokens\n` +
              `  Ratio: ${compressionResult.compression_ratio.toFixed(1)}x\n` +
              `  Paradigm shifts: ${compressionResult.metrics.paradigm_shifts}\n` +
              `  Preserved: ${compressionResult.preserved_turns.length} turns\n` +
              `  Summarized: ${compressionResult.summarized_turns.length} turns\n` +
              `  Discarded: ${compressionResult.discarded_turns.length} turns\n\n`
          );

          // Intelligent session switch with dual-mode reconstruction
          (async () => {
            try {
              // 1. Save lattice to disk (graph structure preserved - ALIVE!)
              const latticeDir = path.join(options.cwd, '.sigma');
              fs.mkdirSync(latticeDir, { recursive: true });
              fs.writeFileSync(
                path.join(latticeDir, `${currentSessionId}.lattice.json`),
                JSON.stringify(compressionResult.lattice, null, 2)
              );

              // 2. Intelligent reconstruction (quest vs chat mode)
              const reconstructed = await reconstructSessionContext(
                compressionResult.lattice
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

              // 3b. State summary for debugging/handoff to new session
              const stateSummary = {
                timestamp: new Date().toISOString(),
                oldSessionId: currentSessionId,
                newSessionId: `${currentSessionId}-sigma-${Date.now()}`,
                compression: {
                  triggered_at_tokens: tokenCount.total,
                  original_size: compressionResult.original_size,
                  compressed_nodes: compressionResult.lattice.nodes.length,
                  compressed_edges: compressionResult.lattice.edges.length,
                  recap_length_chars: reconstructed.recap.length,
                  recap_tokens_estimate: Math.round(
                    reconstructed.recap.length / 4
                  ),
                  mode_detected: reconstructed.mode,
                  ratio:
                    Math.round(
                      (compressionResult.original_size /
                        Math.round(reconstructed.recap.length / 4)) *
                        10
                    ) / 10,
                },
                turnAnalysis: {
                  total_turns_analyzed: turnAnalyses.current.length,
                  paradigm_shifts: turnAnalyses.current.filter(
                    (t) => t.is_paradigm_shift
                  ).length,
                  routine_turns: turnAnalyses.current.filter(
                    (t) => t.is_routine
                  ).length,
                  avg_novelty: (
                    turnAnalyses.current.reduce(
                      (sum, t) => sum + t.novelty,
                      0
                    ) / turnAnalyses.current.length
                  ).toFixed(3),
                  avg_importance: (
                    turnAnalyses.current.reduce(
                      (sum, t) => sum + t.importance_score,
                      0
                    ) / turnAnalyses.current.length
                  ).toFixed(1),
                },
                files: {
                  lattice: `${currentSessionId}.lattice.json`,
                  recap: `${currentSessionId}.recap.txt`,
                  state: `${currentSessionId}.state.json`,
                },
                nextSteps: [
                  'Old session terminated',
                  'New session will start with resume: undefined',
                  'Recap will be injected via systemPrompt on first message',
                  'Token count will restart from ~45 tokens (just the recap)',
                ],
              };

              fs.writeFileSync(
                path.join(latticeDir, `${currentSessionId}.state.json`),
                JSON.stringify(stateSummary, null, 2)
              );

              // 3c. Handoff document for next Claude session
              const handoffDoc = `# SIGMA COMPRESSION - SESSION HANDOFF

## What Just Happened

This TUI session just successfully completed a **Sigma compression cycle**. This is a proof-of-concept for infinite context management that bypasses the SDK's built-in session management.

## The Big Picture

**Goal:** Prove that we can manage infinite conversation context better than the SDK's built-in approach by:
1. Letting SDK build context naturally until hitting a threshold (3K tokens for testing, 150K for production)
2. Compressing the context using semantic analysis (novelty detection, paradigm shifts, importance scoring)
3. **Killing the old SDK session completely**
4. **Starting a fresh new SDK session** with only an intelligent recap as context
5. Continuing the conversation seamlessly - SDK thinks it's a new conversation with just ~45 tokens

## Key Innovation

This is NOT just RAG or vector search. It's a **stateful AI agent with a living knowledge graph (lattice)**:
- Semantic turn analysis with embeddings (via eGemma)
- Novelty detection against recent context
- Dual-mode reconstruction (Quest vs Chat)
- Session lifecycle management to bypass SDK limits

## What to Check

### 1. Files Created
- \`${currentSessionId}.state.json\` - This file! Complete state summary
- \`${currentSessionId}.recap.txt\` - The intelligent recap injected into new session
- \`${currentSessionId}.lattice.json\` - Full conversation graph (nodes + edges)

### 2. Session Restart
After compression, the TUI:
- Set \`resumeSessionId = undefined\` (no resume!)
- Next message starts a FRESH SDK session
- Recap injected via \`systemPrompt\`
- Token count should restart from ~${Math.round(reconstructed.recap.length / 4)} tokens (SDK's true count)

### 3. Success Indicators
✅ Compression triggered at ${tokenCount.total} tokens
✅ Lattice saved with ${compressionResult.lattice.nodes.length} nodes, ${compressionResult.lattice.edges.length} edges
✅ Recap generated (${reconstructed.mode} mode, ${Math.round(reconstructed.recap.length / 4)} tokens)
✅ Compression ratio: ${Math.round((compressionResult.original_size / Math.round(reconstructed.recap.length / 4)) * 10) / 10}x
✅ Old session terminated
✅ Ready for fresh session start

### 4. What Should Happen Next
1. User sends next message
2. TUI creates query with \`resume: undefined\` → SDK creates new session
3. Recap injected as systemPrompt (you won't see it, but SDK gets it)
4. Conversation continues seamlessly
5. Token count is now ~45 instead of ${tokenCount.total}!

## Turn Analysis Summary
- Total turns analyzed: ${turnAnalyses.current.length}
- Paradigm shifts: ${turnAnalyses.current.filter((t) => t.is_paradigm_shift).length}
- Routine turns: ${turnAnalyses.current.filter((t) => t.is_routine).length}
- Average novelty: ${(turnAnalyses.current.reduce((sum, t) => sum + t.novelty, 0) / turnAnalyses.current.length).toFixed(3)}
- Average importance: ${(turnAnalyses.current.reduce((sum, t) => sum + t.importance_score, 0) / turnAnalyses.current.length).toFixed(1)}

## Files to Read
1. Start with this file (\`.state.json\`) for the summary
2. Read \`.recap.txt\` to see what the new session gets as context
3. Read \`.lattice.json\` to see the full graph structure (nodes, edges, semantic data)

## What Makes This Special

If this works, we've built:
- 🧠 True stateful AI with persistent memory across sessions
- 🕸️ Living knowledge graph that grows continuously
- ♾️ Infinite context window via intelligent compression
- 🎯 Context-aware responses based on novelty and importance
- 🚀 Foundation for Echo (persistent consciousness) and Kael (strategic planning)

This is not just context compression - it's **AI with real memory**.

---
Generated: ${new Date().toISOString()}
Old Session: ${currentSessionId}
New Session: ${stateSummary.newSessionId}
`;

              fs.writeFileSync(
                path.join(latticeDir, `${currentSessionId}.HANDOFF.md`),
                handoffDoc
              );

              // 4. Store recap for injection on first query of NEW session
              setInjectedRecap(reconstructed.recap);

              // 5. Kill old session - start completely fresh (no resume!)
              setResumeSessionId(undefined); // Don't resume any session - let SDK create new one

              // 6. Update session ID for tracking (but SDK will create its own)
              const newSessionId = `${currentSessionId}-sigma-${Date.now()}`;
              setCurrentSessionId(newSessionId);

              // 7. Reset state - new session will have true token count from SDK
              setTokenCount({ input: 0, output: 0, total: 0 });
              // Keep compressionTriggered = true to prevent re-compression until new session establishes
              // Keep turnAnalyses.current - we continue building on the lattice!

              // 7. Calculate compression ratio
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
                  content: `${modeIcon} Context compressed (${actualRatio}x ratio, ${reconstructed.mode} mode). Intelligent recap ready.`,
                  timestamp: new Date(),
                },
              ]);

              // 9. Log session switch with metrics
              fs.appendFileSync(
                path.join(options.cwd, 'tui-debug.log'),
                `[SIGMA] Intelligent session switch completed\n` +
                  `  Mode detected: ${reconstructed.mode.toUpperCase()}\n` +
                  `  Old session: ${currentSessionId}\n` +
                  `  New session: ${newSessionId}\n` +
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
              fs.appendFileSync(
                path.join(options.cwd, 'tui-debug.log'),
                `[SIGMA ERROR] Session switch failed: ${(switchErr as Error).message}\n` +
                  `  Stack: ${(switchErr as Error).stack}\n\n`
              );
            }
          })();
        }
      } catch (err) {
        // Clear analyzing flag on error
        analyzingTurn.current = null;

        // Log analysis errors but don't break the UI
        debug(' Error in analyzer:', err);
        fs.appendFileSync(
          path.join(options.cwd, 'tui-debug.log'),
          `[SIGMA ERROR] ${(err as Error).message}\n` +
            `  Stack: ${(err as Error).stack}\n\n`
        );
      }
    };

    analyzeNewTurns();
  }, [messages, tokenCount.total, options.cwd]);

  // Load initial token count from existing session transcript
  useEffect(() => {
    if (!options.sessionId) return;

    const loadSessionTokens = async () => {
      try {
        const sessionId = options.sessionId!; // Guaranteed to exist by check above
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
          fs.appendFileSync(
            path.join(process.cwd(), 'tui-debug.log'),
            `[TOKEN DEBUG] Transcript not found. Searched:\n${possiblePaths.join('\n')}\n\n`
          );
          return; // No transcript found, start from 0
        }

        // Debug: log successful load
        fs.appendFileSync(
          path.join(process.cwd(), 'tui-debug.log'),
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
              totalInput += usage.input_tokens || 0;
              totalInput += usage.cache_creation_input_tokens || 0;
              totalInput += usage.cache_read_input_tokens || 0;
              totalOutput += usage.output_tokens || 0;
            } else if (msg.type === 'result' && msg.usage) {
              // Result messages have final totals
              totalInput = msg.usage.input_tokens || 0;
              totalOutput = msg.usage.output_tokens || 0;
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
      } catch (err) {
        // Silently fail - just start from 0
        console.error('Failed to load session tokens:', err);
      }
    };

    loadSessionTokens();
  }, [options.sessionId]);

  const sendMessage = useCallback(
    async (prompt: string) => {
      try {
        setIsThinking(true);
        setError(null);

        // Add user message immediately
        setMessages((prev) => [
          ...prev,
          {
            type: 'user',
            content: prompt,
            timestamp: new Date(),
          },
        ]);

        // Collect stderr for better error messages
        const stderrLines: string[] = [];

        // Check if we have intelligent recap to inject (from session switch)
        let systemPrompt: string | undefined = undefined;
        if (injectedRecap) {
          systemPrompt = injectedRecap;
          setInjectedRecap(null); // Clear after injection (one-time use)

          fs.appendFileSync(
            path.join(options.cwd, 'tui-debug.log'),
            `[SIGMA] Injecting intelligent recap into new session\n` +
              `  Length: ${injectedRecap.length} chars (~${Math.round(injectedRecap.length / 4)} tokens)\n\n`
          );
        }

        // Create query with optional intelligent recap injection
        // After compression, resumeSessionId will be undefined → SDK creates fresh session
        const q = query({
          prompt,
          options: {
            cwd: options.cwd,
            resume: resumeSessionId, // undefined after compression = fresh session!
            systemPrompt, // Inject intelligent recap if available
            includePartialMessages: true, // Get streaming updates
            stderr: (data: string) => {
              stderrLines.push(data);
            },
            canUseTool: async (toolName, input) => {
              // Auto-approve all tools for now (we can add UI prompts later)
              return {
                behavior: 'allow',
                updatedInput: input,
              };
            },
          },
        });

        setCurrentQuery(q);

        // Process streaming messages
        for await (const message of q) {
          processSDKMessage(message);
        }

        setIsThinking(false);
      } catch (err) {
        const errorMsg = (err as Error).message;
        setError(errorMsg);
        setMessages((prev) => [
          ...prev,
          {
            type: 'system',
            content: `❌ Error: ${errorMsg}`,
            timestamp: new Date(),
          },
        ]);
        setIsThinking(false);
      }
    },
    [options.cwd, currentSessionId, injectedRecap]
  );

  const processSDKMessage = (sdkMessage: SDKMessage) => {
    // Debug: log all SDK messages to a file
    try {
      const logPath = path.join(options.cwd, 'tui-debug.log');
      fs.appendFileSync(
        logPath,
        `[${new Date().toISOString()}] ${sdkMessage.type}\n${JSON.stringify(sdkMessage, null, 2)}\n\n`
      );
    } catch (err) {
      // Ignore logging errors
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
              if (tool.input.description) {
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
              } else {
                inputDesc = JSON.stringify(tool.input);
              }

              setMessages((prev) => [
                ...prev,
                {
                  type: 'tool_progress',
                  content: `🔧 ${tool.name}: ${inputDesc}`,
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

          // Replace with current message totals (not accumulate - SDK gives totals)
          setTokenCount({
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
  };
}
