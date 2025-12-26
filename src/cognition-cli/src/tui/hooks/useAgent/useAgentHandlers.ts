import { useCallback } from 'react';
import { expandCommand } from '../../commands/loader.js';
import { injectRelevantContext } from '../../../sigma/context-injector.js';
import {
  AgentProviderAdapter,
  isAuthenticationError,
  formatAuthError,
  formatSDKError,
} from '../sdk/index.js';
import { McpServerBuilder } from '../../services/McpServerBuilder.js';
import { formatPendingMessages } from '../../../ipc/agent-messaging-formatters.js';
import { stripANSICodes } from '../rendering/MessageRenderer.js';
import { formatToolUse } from '../rendering/ToolFormatter.js';
import type { AgentState } from './useAgentState.js';
import type { UseAgentOptions } from './types.js';
import type { UseSessionManagerResult } from '../session/useSessionManager.js';
import type { useTokenCount } from '../tokens/useTokenCount.js';
import type { UseTurnAnalysisReturn } from '../analysis/useTurnAnalysis.js';
import type { UseCompressionResult } from '../compression/useCompression.js';

const GEMINI_COMPRESSION_THRESHOLD = 50000;

interface UseAgentHandlersOptions {
  options: UseAgentOptions;
  state: AgentState;
  sessionManager: UseSessionManagerResult;
  tokenCounter: ReturnType<typeof useTokenCount>;
  turnAnalysis: UseTurnAnalysisReturn;
  compression: UseCompressionResult;
  debug: (message: string, ...args: unknown[]) => void;
  debugLog: (content: string) => void;
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
  } = options;

  const anchorId = sessionManager.state.anchorId;

  const processAgentMessage = useCallback(
    (agentMessage: AgentMessage, currentTokens?: number) => {
      const { type, content } = agentMessage;

      switch (type) {
        case 'assistant': {
          if (typeof content === 'string') {
            const colorReplacedText = stripANSICodes(content);
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
              const colorReplacedText = stripANSICodes(text);
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
                      effectiveTokens > GEMINI_COMPRESSION_THRESHOLD &&
                      !compressionInProgressRef.current
                    ) {
                      debug(
                        `Preemptive semantic compression for ${tool.name} (> 50k tokens)...`
                      );
                      await compression.triggerCompression(true);
                    }

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

        const isAutoResponse = prompt === '__AUTO_RESPONSE__';
        const userMessageTimestamp = new Date();
        if (!isAutoResponse) {
          setMessages((prev) => [
            ...prev,
            { type: 'user', content: prompt, timestamp: userMessageTimestamp },
          ]);
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
            console.error(`Context injection error: ${err}`);
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
            providerName === 'gemini' &&
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
