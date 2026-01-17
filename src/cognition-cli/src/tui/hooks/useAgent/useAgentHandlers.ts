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
import stripAnsi from 'strip-ansi';
import { formatToolUse, formatToolResult } from '../rendering/ToolFormatter.js';
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

                    const formatted = formatToolUse({
                      name: tool.name,
                      input: tool.input as Record<string, unknown>,
                    });
                    const content = `${formatted.icon} ${formatted.name}: ${formatted.description}`;
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
            const formatted = formatToolUse({
              name: agentMessage.toolName,
              input: agentMessage.toolInput as Record<string, unknown>,
            });
            const content = `${formatted.icon} ${formatted.name}: ${formatted.description}`;
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
            const contentStr = `🔧 ${content}`;
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
                const formatted = formatToolUse({
                  name: tool.name,
                  input: tool.input as Record<string, unknown>,
                });
                const contentStr = `${formatted.icon} ${formatted.name}: ${formatted.description}`;
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
              resultData
            );

            if (
              isStreamingToolOutputRef.current &&
              (agentMessage.toolName === 'bash' ||
                agentMessage.toolName === 'shell')
            ) {
              // For streamed bash output, provide a concise summary in the TUI
              // The agent still receives the full output from tool-executors.ts
              const exitCodeStr = (resultData as string).includes('Exit code:')
                ? (resultData as string)
                    .split('Exit code:')[1]
                    .split('\n')[0]
                    .trim()
                : 'unknown';

              const codeColor = exitCodeStr === '0' ? '\x1b[32m' : '\x1b[31m'; // Green for 0, Red otherwise

              formattedResult = `\x1b[90mExit code: ${codeColor}${exitCodeStr}\x1b[90m (streamed)\x1b[0m`;
            }
            if (formattedResult) {
              setMessages((prev) => {
                // We simply append the result.
                // The previous message (which was streaming) stays as is, acting as the "log".
                // This preserves the full output (tail-truncated) for the user to see.
                return [
                  ...prev,
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
                  content: `🔧 Expanding command: ${commandName} (${expanded.length} chars)`,
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
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.type === 'tool_progress') {
                isStreamingToolOutputRef.current = true;
                // For streaming tool output, ensure there's a newline between
                // the tool invocation and the first piece of output.
                // ALSO: Reset color to default (or gray) so output doesn't inherit
                // the tool header's color (usually yellow/orange).
                const hasNewline = last.content.includes('\n');

                // \x1b[0m resets all attributes (color, bold, etc.)
                // \x1b[90m sets text to bright black (gray)
                const prefix = hasNewline ? '' : '\n\x1b[0m\x1b[90m';

                let content = last.content + prefix + chunk;

                // FLOATING WINDOW LOGIC:
                // If output becomes too long, truncate it to keep only the last 30 lines
                // to prevent the "active" message from growing indefinitely.
                const header = activeToolContentRef.current;
                if (header && content.startsWith(header)) {
                  // Split header from output
                  const outputPart = content.slice(header.length);
                  const lines = outputPart.split('\n');
                  const MAX_STREAM_LINES = 30;

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

                return [...prev.slice(0, -1), { ...last, content }];
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
            await compression.triggerCompression(true);
            setShouldAutoRespond(true);
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
      state,
      options,
      sessionManager,
      tokenCounter,
      turnAnalysis,
      compression,
      debug,
      setIsThinking,
      setError,
      setMessages,
      setInjectedRecap,
      setPendingMessageNotification,
      setShouldAutoRespond,
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
      anchorId,
      providerName,
      modelName,
      cwd,
      maxThinkingTokens,
      displayThinking,
      getTaskManager,
      getMessagePublisher,
      getMessageQueue,
      onRequestToolConfirmation,
      debugFlag,
      processAgentMessage,
    ]
  );

  return { sendMessage, processAgentMessage };
}
