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
  const [currentSessionId, setCurrentSessionId] = useState(options.sessionId);
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
      if (!embedder) return;
      const lastMessage = messages[messages.length - 1];

      // Only analyze user and assistant messages (not tool_progress/system)
      if (lastMessage.type !== 'user' && lastMessage.type !== 'assistant')
        return;

      // Check if we've already analyzed this turn
      const existingAnalysis = turnAnalyses.current.find(
        (a) => a.timestamp === lastMessage.timestamp.getTime()
      );
      if (existingAnalysis) return; // Already analyzed

      try {
        // Build context from previous analyses
        const context: ConversationContext = {
          projectRoot: options.cwd,
          sessionId: options.sessionId,
          history: turnAnalyses.current.map((a) => ({
            id: a.turn_id,
            role: a.role,
            content: a.content,
            timestamp: a.timestamp,
            embedding: a.embedding, // Include for novelty calculation
          })) as Array<ConversationTurn & { embedding: number[] }>,
        };

        // Analyze this turn
        const analysis = await analyzeTurn(
          {
            id: `turn-${lastMessage.timestamp.getTime()}`,
            role: lastMessage.type as 'user' | 'assistant',
            content: lastMessage.content,
            timestamp: lastMessage.timestamp.getTime(),
          },
          context,
          embedder
        );

        // Store analysis
        turnAnalyses.current.push(analysis);

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

        // Check if compression needed (150K token threshold)
        const TOKEN_THRESHOLD = 150000;
        if (
          tokenCount.total > TOKEN_THRESHOLD &&
          !compressionTriggered.current
        ) {
          compressionTriggered.current = true;

          // Trigger compression
          const compressionResult = await compressContext(
            turnAnalyses.current,
            {
              target_size: 40000, // 40K tokens (20% of 200K limit)
              preserve_threshold: 7, // Paradigm shifts
            }
          );

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

              // 3. Store recap for injection on first query
              setInjectedRecap(reconstructed.recap);

              // 4. Generate new session ID
              const newSessionId = `${currentSessionId}-sigma-${Date.now()}`;

              // 5. Update session ID
              setCurrentSessionId(newSessionId);

              // 6. Reset state for new session
              setTokenCount({ input: 0, output: 0, total: 0 });
              compressionTriggered.current = false;
              turnAnalyses.current = []; // Clear for new session

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
        // Log analysis errors but don't break the UI
        fs.appendFileSync(
          path.join(options.cwd, 'tui-debug.log'),
          `[SIGMA ERROR] ${(err as Error).message}\n`
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
        const q = query({
          prompt,
          options: {
            cwd: options.cwd,
            resume: currentSessionId, // Use current session ID (may be switched)
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

  return {
    messages,
    sendMessage,
    interrupt,
    isThinking,
    error,
    tokenCount,
    conversationLattice, // Sigma compressed context
    currentSessionId, // Active session ID (may switch)
  };
}
