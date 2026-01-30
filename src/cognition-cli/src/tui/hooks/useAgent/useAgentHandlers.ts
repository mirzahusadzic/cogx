import { useCallback, useRef } from 'react';
import { expandCommand } from '../../commands/loader.js';
import { injectRelevantContext } from '../../../sigma/context-injector.js';
import { systemLog } from '../../../utils/debug-logger.js';
import {
  AgentProviderAdapter,
  isAuthenticationError,
  formatAuthError,
  formatSDKError,
} from '../sdk/index.js';
import { McpServerBuilder } from '../../services/McpServerBuilder.js';
import { formatPendingMessages } from '../../../ipc/agent-messaging-formatters.js';
import { cleanAnsi as stripAnsi } from '../../../utils/string-utils.js';
import {
  formatToolUse,
  formatToolResult,
  formatToolUseMessage,
} from '../rendering/ToolFormatter.js';
import { terminal } from '../../services/TerminalService.js';
import { stripCursorSequences, ANSI_RESET } from '../../utils/ansi-utils.js';
import type { AgentState } from './useAgentState.js';
import type { UseAgentOptions } from './types.js';
import type { UseSessionManagerResult } from '../session/useSessionManager.js';
import type { useTokenCount } from '../tokens/useTokenCount.js';
import type { UseTurnAnalysisReturn } from '../analysis/useTurnAnalysis.js';
import type { UseCompressionResult } from '../compression/useCompression.js';
import {
  AUTO_RESPONSE_TRIGGER,
  COMPRESSION_RECOVERY_PROMPT,
  isProviderContextSensitive,
  MAX_STREAM_STABILIZATION_LINES,
} from './constants.js';

interface UseAgentHandlersOptions {
  options: UseAgentOptions;
  state: AgentState;
  sessionManager: UseSessionManagerResult;
  tokenCounter: ReturnType<typeof useTokenCount>;
  turnAnalysis: UseTurnAnalysisReturn;
  compression: UseCompressionResult;
  debug: (message: string, ...args: unknown[]) => void;
}

interface MessageBlock {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  input?: unknown;
}

interface AgentMessage {
  type: string;
  content?: string | MessageBlock[];
  toolName?: string;
  toolInput?: unknown;
}

export function useAgentHandlers({
  options,
  state,
  sessionManager,
  tokenCounter,
  turnAnalysis,
  compression,
  debug,
}: UseAgentHandlersOptions) {
  const {
    setMessages,
    setIsThinking,
    setRetryCount,
    setActiveModel,
    setError,
    setInjectedRecap,
    setPendingMessageNotification,
    setShouldAutoRespond,
    userMessageEmbeddingCache,
    currentAdapterRef,
    abortedRef,
    embedderRef,
    conversationRegistryRef,
    recallMcpServerRef,
    backgroundTasksMcpServerRef,
    agentMessagingMcpServerRef,
    crossProjectQueryMcpServerRef,
    sigmaTaskUpdateMcpServerRef,
    compressionInProgressRef,
    currentSessionIdRef,
  } = state;

  const {
    cwd,
    provider: providerName = 'claude',
    model: modelName,
    sessionId: sessionIdProp,
    maxThinkingTokens,
    displayThinking,
    getTaskManager,
    getMessagePublisher,
    getMessageQueue,
    onRequestToolConfirmation,
    debug: debugFlag,
    semanticThreshold = 50000,
  } = options;

  const anchorId = sessionManager.state.anchorId;

  // Track the original content of the active tool message (before streaming updates)
  // This allows us to revert the "streaming" view when the final result arrives,
  // preventing duplication of output in the chat history.
  const isStreamingToolOutputRef = useRef<boolean>(false);
  const activeToolContentRef = useRef<string | null>(null);

  const processAgentMessage = useCallback(
    (agentMessage: AgentMessage, currentTokens?: number) => {
      const { type, content } = agentMessage;

      switch (type) {
        case 'assistant': {
          if (typeof content === 'string') {
            const colorReplacedText = stripAnsi(content);
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.type === 'assistant') {
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: last.content + colorReplacedText },
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
          } else if (Array.isArray(content)) {
            const toolUses = content.filter((c) => c.type === 'tool_use');
            const textBlocks = content.filter((c) => c.type === 'text');
            const thinkingBlocks = content.filter((c) => c.type === 'thinking');

            if (thinkingBlocks.length > 0) {
              const thinking = thinkingBlocks
                .map((b) => b.thinking || '')
                .join('\n');
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.type === 'thinking') {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, content: last.content + thinking },
                  ];
                } else {
                  return [
                    ...prev,
                    {
                      type: 'thinking',
                      content: thinking,
                      timestamp: new Date(),
                    },
                  ];
                }
              });
            }

            if (textBlocks.length > 0) {
              const text = textBlocks.map((b) => b.text || '').join('\n');
              const colorReplacedText = stripAnsi(text);
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.type === 'assistant') {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, content: last.content + colorReplacedText },
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

            if (toolUses.length > 0) {
              (async () => {
                for (const tool of toolUses) {
                  if (tool.name && tool.input) {
                    // Use explicitly passed tokens if available, otherwise fall back to state
                    // This ensures we use the most up-to-date count from the streaming response
                    // rather than waiting for the React state update cycle
                    const effectiveTokens =
                      currentTokens ?? tokenCounter.count.total;

                    if (
                      providerName === 'gemini' &&
                      (tool.name === 'SigmaTaskUpdate' ||
                        tool.name ===
                          'mcp__sigma-task-update__SigmaTaskUpdate') &&
                      effectiveTokens > semanticThreshold &&
                      !compressionInProgressRef.current
                    ) {
                      debug(
                        `Preemptive semantic compression for ${tool.name} (> ${semanticThreshold} tokens)...`
                      );
                      await compression.triggerCompression(true);
                    }

                    const content = formatToolUseMessage(
                      {
                        name: tool.name,
                        input: tool.input as Record<string, unknown>,
                      },
                      cwd
                    );
                    activeToolContentRef.current = content;

                    setMessages((prev) => [
                      ...prev,
                      {
                        type: 'tool_progress',
                        content,
                        timestamp: new Date(),
                      },
                    ]);
                  }
                }
              })();
            }
          }
          break;
        }

        case 'thinking': {
          if (typeof content === 'string') {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.type === 'thinking') {
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: last.content + content },
                ];
              } else {
                return [
                  ...prev,
                  {
                    type: 'thinking',
                    content: content,
                    timestamp: new Date(),
                  },
                ];
              }
            });
          }
          break;
        }

        case 'tool_use': {
          if (agentMessage.toolName && agentMessage.toolInput) {
            const content = formatToolUseMessage(
              {
                name: agentMessage.toolName,
                input: agentMessage.toolInput as Record<string, unknown>,
              },
              cwd
            );
            activeToolContentRef.current = content;

            setMessages((prev) => [
              ...prev,
              {
                type: 'tool_progress',
                content,
                timestamp: new Date(),
              },
            ]);
          } else if (typeof content === 'string') {
            const contentStr = `> ${content}`;
            activeToolContentRef.current = contentStr;

            setMessages((prev) => [
              ...prev,
              {
                type: 'tool_progress',
                content: contentStr,
                timestamp: new Date(),
              },
            ]);
          } else if (Array.isArray(content)) {
            content.forEach((tool) => {
              if (tool.name && tool.input) {
                const contentStr = formatToolUseMessage(
                  {
                    name: tool.name,
                    input: tool.input as Record<string, unknown>,
                  },
                  cwd
                );
                activeToolContentRef.current = contentStr;

                setMessages((prev) => [
                  ...prev,
                  {
                    type: 'tool_progress',
                    content: contentStr,
                    timestamp: new Date(),
                  },
                ]);
              }
            });
          }
          break;
        }

        case 'tool_result': {
          // Immediately hide cursor after tool completes, as its final output might have requested to show it
          terminal.setCursorVisibility(false);
          if (process.env.DEBUG_INPUT) {
            systemLog(
              'tui',
              `[tool_result] processing ${agentMessage.toolName}`,
              {
                contentLength:
                  typeof agentMessage.content === 'string'
                    ? agentMessage.content.length
                    : 'unknown',
              }
            );
          }
          if (agentMessage.toolName) {
            // content for tool_result might be in agentMessage.content (string or block array)
            const resultData =
              typeof agentMessage.content === 'string'
                ? agentMessage.content
                : agentMessage.content; // Use as is, formatToolResult handles it

            let formattedResult = formatToolResult(
              agentMessage.toolName,
              resultData,
              cwd
            );

            const isBash =
              agentMessage.toolName === 'bash' ||
              agentMessage.toolName === 'shell';
            const strippedData =
              typeof resultData === 'string'
                ? stripAnsi(resultData).trim()
                : '';
            const isOnlyExitCode =
              isBash && /^Exit code: -?\d+$/.test(strippedData);

            if (isStreamingToolOutputRef.current && isBash) {
              // For streamed bash output, provide a concise summary in the TUI
              // The agent still receives the full output from tool-executors.ts
              const exitCodeMatch = strippedData.match(
                /Exit code: (-?\d+)\s*$/
              );
              const exitCodeStr = exitCodeMatch ? exitCodeMatch[1] : 'unknown';

              const codeColor = exitCodeStr === '0' ? '\x1b[32m' : '\x1b[31m'; // Green for 0, Red otherwise

              formattedResult = `Exit code: ${codeColor}${exitCodeStr}${ANSI_RESET}`;
            } else if (isOnlyExitCode) {
              // If not streaming but we only have an exit code (e.g. fast command with no output)
              // format it consistently (colored, no indentation)
              const exitCodeStr = strippedData.split('Exit code:')[1].trim();
              const codeColor = exitCodeStr === '0' ? '\x1b[32m' : '\x1b[31m';
              formattedResult = `Exit code: ${codeColor}${exitCodeStr}${ANSI_RESET}`;
            }
            if (formattedResult) {
              // Layer 13: Tool Result Header Injection.
              // Prefix the result with a distinct result icon (↪) and label to differentiate
              // it from the tool call (>). This ensures the TUI recognizes it as a structured
              // tool result while reducing visual redundancy.
              const toolInfo = formatToolUse(
                { name: agentMessage.toolName, input: {} },
                cwd
              );

              const resultIcon = '↪';
              const isOutput = [
                'bash',
                'shell',
                'read',
                'read_file',
                'grep',
                'glob',
                'fetch_url',
                'webfetch',
                'fetchurl',
                'websearch',
                'search',
                'query',
                'list',
                'ls',
              ].includes(
                agentMessage.toolName.toLowerCase().replace(/^mcp__.*?__/, '')
              );
              const suffix = isOutput ? ' Output' : ' Result';

              // Layer 13: Tool Result Header Injection.
              // Use a newline after the header to ensure the content starts on its own line.
              formattedResult = `${resultIcon} ${toolInfo.name}${suffix}:\n${formattedResult}`;

              setMessages((prev) => {
                // Clean up any remaining streaming markers from the active tool_progress message.
                // We search backwards to find it robustly.
                const cleanedPrev = [...prev];
                let targetIdx = -1;
                for (let i = cleanedPrev.length - 1; i >= 0; i--) {
                  if (cleanedPrev[i].type === 'tool_progress') {
                    targetIdx = i;
                    break;
                  }
                }

                if (targetIdx !== -1) {
                  cleanedPrev[targetIdx] = {
                    ...cleanedPrev[targetIdx],
                    content: cleanedPrev[targetIdx].content.replace(
                      // eslint-disable-next-line no-control-regex
                      /\n\x1b\[90m\(streaming\)\x1b\[0m$/,
                      ''
                    ),
                  };
                }

                return [
                  ...cleanedPrev,
                  {
                    type: 'tool_progress',
                    content: formattedResult,
                    timestamp: new Date(),
                  },
                ];
              });
              // Reset the ref
              activeToolContentRef.current = null;
              isStreamingToolOutputRef.current = false;
            } else if (process.env.DEBUG_INPUT) {
              systemLog(
                'tui',
                `[tool_result] SKIPPED: ${agentMessage.toolName} (empty formatted result)`
              );
            }
          }
          break;
        }
      }
    },
    [
      providerName,
      tokenCounter.count.total,
      compressionInProgressRef,
      compression,
      debug,
      setMessages,
    ]
  );

  const sendMessage = useCallback(
    async (prompt: string) => {
      try {
        setIsThinking(true);
        setRetryCount(0);
        setError(null);

        let finalPrompt = prompt;
        const firstWord = prompt.split(' ')[0];
        const isGlobPattern = /[*?[]/.test(firstWord);
        const isCommand =
          prompt.startsWith('/') &&
          !firstWord.slice(1).includes('/') &&
          !isGlobPattern;

        if (isCommand && state.commandsCache.size > 0) {
          const commandName = prompt.split(' ')[0];
          if (commandName !== '/') {
            const expanded = expandCommand(prompt, state.commandsCache);
            if (expanded) {
              finalPrompt = expanded;
              setMessages((prev) => [
                ...prev,
                {
                  type: 'system',
                  content: `> Expanding command: ${commandName} (${expanded.length} chars)`,
                  timestamp: new Date(),
                },
              ]);
            } else {
              setMessages((prev) => [
                ...prev,
                { type: 'user', content: prompt, timestamp: new Date() },
                {
                  type: 'system',
                  content: `❌ Unknown command: ${commandName}`,
                  timestamp: new Date(),
                },
              ]);
              setIsThinking(false);
              return;
            }
          }
        }

        const isAutoResponse = prompt === AUTO_RESPONSE_TRIGGER;
        const userMessageTimestamp = new Date();
        if (!isAutoResponse) {
          setMessages((prev) => [
            ...prev,
            { type: 'user', content: prompt, timestamp: userMessageTimestamp },
          ]);
        } else {
          // For auto-response, we use the expanded prompt for the LLM
          // but we don't show it in the UI as a user message
          finalPrompt = COMPRESSION_RECOVERY_PROMPT;
        }

        if (compression.shouldTrigger && !compressionInProgressRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          await compression.triggerCompression();
          setShouldAutoRespond(true);
        }

        const stderrLines: string[] = [];
        if (state.injectedRecap) {
          finalPrompt = `${state.injectedRecap}\n\n---\n\nUser request: ${finalPrompt}`;
          setInjectedRecap(null);
        }

        if (state.pendingMessageNotification) {
          finalPrompt = isAutoResponse
            ? `<system-reminder>\n${state.pendingMessageNotification}\n</system-reminder>`
            : `<system-reminder>\n${state.pendingMessageNotification}\n</system-reminder>\n\n${finalPrompt}`;
          setPendingMessageNotification(null);
        }

        // Proactive token pressure injection (Gemini & OpenAI specific)
        if (
          isProviderContextSensitive(providerName, modelName) &&
          tokenCounter.count.total > semanticThreshold &&
          !isAutoResponse
        ) {
          const warning = `<token-pressure-warning>
Current context is at ${tokenCounter.count.total.toLocaleString()} tokens. 
To maintain performance and stay within TPM limits, please consider marking your current task as "completed" using SigmaTaskUpdate as soon as you reach a logical stopping point. 
This will trigger a semantic compression event, flushing implementation noise while preserving your high-level plan.
</token-pressure-warning>`;
          finalPrompt = `${warning}\n\n${finalPrompt}`;
        }

        if (
          !state.injectedRecap &&
          embedderRef.current &&
          turnAnalysis.analyses.length > 0
        ) {
          try {
            const searchPrompt = prompt.startsWith('/') ? prompt : finalPrompt;
            const result = await injectRelevantContext(
              searchPrompt,
              turnAnalysis.analyses,
              embedderRef.current,
              { debug: debugFlag }
            );

            if (prompt.startsWith('/') && finalPrompt !== prompt) {
              finalPrompt = `${result.message}\n\n---\n\n${finalPrompt}`;
            } else {
              finalPrompt = result.message;
            }

            if (result.embedding) {
              userMessageEmbeddingCache.current.set(
                userMessageTimestamp.getTime(),
                result.embedding
              );
            }
          } catch (err) {
            systemLog('sigma', `Context injection error: ${err}`, {}, 'error');
          }
        }

        const currentResumeId = sessionManager.getResumeSessionId();
        const adapter = new AgentProviderAdapter({
          provider: providerName,
          model: modelName,
          cwd: cwd,
          resumeSessionId: currentResumeId,
          maxThinkingTokens,
          displayThinking,
          conversationRegistry: conversationRegistryRef.current || undefined,
          workbenchUrl: process.env.WORKBENCH_URL || 'http://localhost:8000',
          getTaskManager,
          getMessagePublisher,
          getMessageQueue,
          projectRoot: cwd,
          agentId: sessionIdProp || 'unknown',
          anchorId,
          remainingTPM: 1000000 - tokenCounter.count.total,
          onStderr: (data: string) => stderrLines.push(data),
          onToolOutput: (chunk: string) => {
            // Layer 10: Aggressively hide terminal cursor while streaming tool output
            terminal.setCursorVisibility(false);

            // Pre-strip cursor control sequences and ANSI from output chunks before storing
            // This ensures clean processing and prevents rendering artifacts like extra newlines
            const cleanChunk = stripAnsi(stripCursorSequences(chunk));

            setMessages((prev) => {
              // Robustly find the active tool_progress message by searching backwards.
              // This ensures that intermediate assistant messages (e.g. from Gemini thought signatures)
              // don't break streaming output updates.
              let targetIdx = -1;
              for (let i = prev.length - 1; i >= 0; i--) {
                if (prev[i].type === 'tool_progress') {
                  targetIdx = i;
                  break;
                }
              }

              if (targetIdx !== -1) {
                const target = prev[targetIdx];
                isStreamingToolOutputRef.current = true;

                // Strip existing streaming marker if present from previous chunk
                // Use a non-capturing group for the optional newline to avoid issues
                // Robustly strip the streaming marker AND any trailing newlines from content
                // to prepare for clean appending.
                let content = target.content.replace(
                  // eslint-disable-next-line no-control-regex
                  /(?:\r?\n)*\x1b\[90m\(streaming\)\x1b\[0m$/,
                  ''
                );

                // Ensure clean chunk doesn't have leading newlines if we already have content
                // This prevents double-newlines when joining chunks.
                // We handle both \n and \r\n explicitly.
                let effectiveChunk = cleanChunk;
                if (content.length > 0) {
                  effectiveChunk = effectiveChunk.replace(/^(\r?\n)+/, '');
                }

                // Append with exactly one newline separator if needed
                if (content.length > 0 && !content.endsWith('\n')) {
                  content += '\n';
                }
                content += effectiveChunk;

                // FLOATING WINDOW LOGIC:
                // If output becomes too long, truncate it to keep only the last 30 lines
                // (25 lines + 5 lines buffer).
                const header = activeToolContentRef.current;
                if (header && content.startsWith(header)) {
                  // Split header from output
                  const outputPart = content.slice(header.length);
                  const lines = outputPart.split(/\r?\n/);
                  const MAX_STREAM_LINES = MAX_STREAM_STABILIZATION_LINES; // Use shared stabilization constant

                  if (lines.length > MAX_STREAM_LINES) {
                    // Keep the header and the last N lines
                    // We add a marker to indicate truncation
                    const keptLines = lines.slice(-MAX_STREAM_LINES);
                    content =
                      header +
                      '\n\x1b[90m... (tail of stream)\x1b[0m\n' +
                      keptLines.join('\n');
                  }
                }

                // Add streaming marker to the end - this triggers stabilization in ClaudePanelAgent
                // We ensure it starts on a new line unless it's already there
                if (!content.endsWith('\n')) {
                  content += '\n';
                }
                content += '\x1b[90m(streaming)\x1b[0m';

                const newMessages = [...prev];
                newMessages[targetIdx] = { ...target, content };
                return newMessages;
              }
              return prev;
            });
          },
          onCanUseTool: async (toolName, input) => {
            if (toolName === 'TodoWrite' && providerName === 'claude') {
              return { behavior: 'deny', updatedInput: input };
            }
            if (
              toolName === 'SigmaTaskUpdate' ||
              toolName === 'mcp__sigma-task-update__SigmaTaskUpdate'
            ) {
              return { behavior: 'allow', updatedInput: input };
            }
            if (onRequestToolConfirmation) {
              const decision = await onRequestToolConfirmation(toolName, input);
              return { behavior: decision, updatedInput: input };
            }
            return { behavior: 'allow', updatedInput: input };
          },
          mcpServers: new McpServerBuilder({
            recallServer: recallMcpServerRef.current,
            backgroundTasksServer: backgroundTasksMcpServerRef.current,
            agentMessagingServer: agentMessagingMcpServerRef.current,
            crossProjectQueryServer: crossProjectQueryMcpServerRef.current,
            sigmaTaskUpdateServer: sigmaTaskUpdateMcpServerRef.current,
            hasConversationHistory:
              !!currentResumeId || turnAnalysis.analyses.length > 0,
          }).build(),
          debug: debugFlag,
        });

        currentAdapterRef.current = adapter;
        abortedRef.current = false;

        let previousMessageCount = 0;
        let hasAssistantMessage = false;
        let lastResponse: {
          sessionId?: string;
          tokens: { prompt: number; completion: number; total: number };
          messages: unknown[];
          numTurns: number;
          toolResult?: { name: string };
        } | null = null;
        let turnWasSemantic = false;

        const queryResult = adapter.query(finalPrompt);
        for await (const response of queryResult) {
          // Update retry count if provider is retrying (Gemini specific)
          if (response.retryCount !== undefined) {
            setRetryCount(response.retryCount);
          }

          // Update active model if it changed due to failover (Gemini specific)
          if (response.activeModel) {
            setActiveModel(response.activeModel);
          }

          lastResponse = response as unknown as {
            sessionId?: string;
            tokens: { prompt: number; completion: number; total: number };
            messages: unknown[];
            numTurns: number;
            toolResult?: { name: string };
          };
          const newMessages = response.messages.slice(previousMessageCount);
          previousMessageCount = response.messages.length;

          if (response.sessionId) {
            const prevSessionId = currentSessionIdRef.current;
            if (prevSessionId !== response.sessionId) {
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
                tokenCounter.reset();
              }
            }
          }

          tokenCounter.update({
            input: response.tokens.prompt,
            output: response.tokens.completion,
            total: response.tokens.total,
          });

          if (
            response.toolResult &&
            (response.toolResult.name === 'SigmaTaskUpdate' ||
              response.toolResult.name ===
                'mcp__sigma-task-update__SigmaTaskUpdate')
          ) {
            turnWasSemantic = true;
          }

          for (const agentMessage of newMessages) {
            if (agentMessage.type === 'assistant') hasAssistantMessage = true;
            processAgentMessage(agentMessage, response.tokens.total);
          }
        }

        if (lastResponse && hasAssistantMessage) {
          const cost = (lastResponse.tokens.total / 1_000_000) * 3;
          setMessages((prev) => [
            ...prev,
            {
              type: 'system',
              content: `✓ Complete (${lastResponse.numTurns} turns, ${lastResponse.messages.length} messages, ~$${cost.toFixed(4)})`,
              timestamp: new Date(),
            },
          ]);

          if (getMessageQueue) {
            const queue = getMessageQueue();
            if (queue) {
              const pendingMessages = await queue.getMessages('pending');
              if (pendingMessages.length > 0) {
                const formattedMessages =
                  formatPendingMessages(pendingMessages);
                setPendingMessageNotification(
                  `📬 **New messages from other agents:**\n\n${formattedMessages}\n\nPlease acknowledge and respond to these messages.`
                );
                setMessages((prev) => [
                  ...prev,
                  {
                    type: 'system',
                    content: `📬 ${pendingMessages.length} pending messages injected`,
                    timestamp: new Date(),
                  },
                ]);
              }
            }
          }

          if (
            isProviderContextSensitive(providerName, modelName) &&
            turnWasSemantic &&
            compression.getTriggerInfo(true).shouldTrigger
          ) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            const success = await compression.triggerCompression(true);
            if (success) {
              setShouldAutoRespond(true);
            }
          } else if (compression.shouldTrigger) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            await compression.triggerCompression();
          }
        }

        if (
          !hasAssistantMessage &&
          previousMessageCount <= 1 &&
          !abortedRef.current
        ) {
          const errorMsg = isAuthenticationError(stderrLines)
            ? formatAuthError()
            : formatSDKError(stderrLines, hasAssistantMessage);
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
        const errorMsg = isAuthenticationError([originalError])
          ? formatAuthError()
          : originalError;
        setError(errorMsg);
        setMessages((prev) => [
          ...prev,
          { type: 'system', content: `❌ ${errorMsg}`, timestamp: new Date() },
        ]);
        setIsThinking(false);
      } finally {
        currentAdapterRef.current = null;
      }
    },
    [
      /* state */
      setMessages,
      setIsThinking,
      setRetryCount,
      setError,
      setInjectedRecap,
      setPendingMessageNotification,
      setShouldAutoRespond,
      state.commandsCache,
      state.injectedRecap,
      state.pendingMessageNotification,
      embedderRef,
      userMessageEmbeddingCache,
      currentAdapterRef,
      abortedRef,
      conversationRegistryRef,
      recallMcpServerRef,
      backgroundTasksMcpServerRef,
      agentMessagingMcpServerRef,
      crossProjectQueryMcpServerRef,
      sigmaTaskUpdateMcpServerRef,
      compressionInProgressRef,
      currentSessionIdRef,

      /* options */
      cwd,
      providerName,
      modelName,
      sessionIdProp,
      maxThinkingTokens,
      displayThinking,
      getTaskManager,
      getMessagePublisher,
      getMessageQueue,
      onRequestToolConfirmation,
      debugFlag,
      semanticThreshold,

      /* hooks & utils */
      sessionManager,
      tokenCounter,
      turnAnalysis,
      compression,
      debug,
      anchorId,
      processAgentMessage,
    ]
  );

  return { sendMessage, processAgentMessage };
}
