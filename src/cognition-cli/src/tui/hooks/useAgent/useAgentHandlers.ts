import { useCallback, useRef } from 'react';
import { expandCommand } from '../../commands/loader.js';
import { injectRelevantContext } from '../../../sigma/context-injector.js';
import { systemDiagnosticsService } from '../../../core/services/diagnostics/SystemDiagnosticsService.js';
import {
  AgentProviderAdapter,
  isAuthenticationError,
  formatAuthError,
  formatSDKError,
  isSilentTimeout,
} from '../sdk/index.js';
import { McpServerBuilder } from '../../services/McpServerBuilder.js';
import { formatPendingMessages } from '../../../ipc/agent-messaging-formatters.js';
// Use terminalFormatter instead of deprecated utilities
import {
  formatToolUse,
  formatToolResult,
  formatToolUseMessage,
} from '../rendering/ToolFormatter.js';
import { terminal } from '../../services/TerminalService.js';
import { terminalFormatter } from '../../../core/services/terminal-formatter/TerminalFormatterService.js';
import { TUITheme } from '../../theme.js';
import type { SigmaTasks, SigmaTask } from './types.js';
import { ThinkingState } from './types.js';
import { processSigmaTaskUpdateInput } from '../../../llm/core/utils/tool-helpers.js';
import {
  AUTO_RESPONSE_TRIGGER,
  COMPRESSION_RECOVERY_PROMPT,
  isProviderContextSensitive,
  MAX_STREAM_STABILIZATION_LINES,
} from './constants.js';
import { tuiSyncManager } from '../../../core/state/tui-sync/TUISyncManager.js';

/**
 * Check if a tool is "output-producing" for TUI rendering purposes.
 * Output-producing tools are those that are likely to have long-running or
 * multi-line output that should be preserved in the active tool content area.
 */
export function isOutputProducingTool(name?: string): boolean {
  if (!name) return false;

  const normalized = name
    .toLowerCase()
    .replace(/^mcp__.*?__/, '')
    .replace(/_/g, ''); // Fix naming inconsistency (read_file vs readfile)

  const outputProducingTools = [
    'bash',
    'shell',
    'executebash',
    'bashoutput',
    'checkoutput',
    'getbashoutput',
    'read',
    'readfile',
    'grep',
    'glob',
    'fetchurl',
    'webfetch',
    'websearch',
    'search',
    'query',
    'list',
    'ls',
    'sigmataskupdate',
    'recallpastconversation',
    'getbackgroundtasks',
    'listagents',
    'queryagent',
    'listpendingmessages',
  ];

  return outputProducingTools.includes(normalized);
}

interface MessageBlock {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  input?: unknown;
  content?: unknown; // Added for tool_result support
  thoughtSignature?: string;
  id?: string; // toolCallId
}

interface AgentMessage {
  type: string;
  content?: string | MessageBlock[];
  toolName?: string;
  toolInput?: unknown;
  thoughtSignature?: string;
  toolCallId?: string;
}

export function updateSigmaTasksWithTokens(
  prev: SigmaTasks,
  input: SigmaTasks,
  effectiveTokens: number,
  cachedTokens: number = 0
): SigmaTasks {
  const mergedTodos = [...(prev?.todos || [])];
  const usedIndices = new Set<number>();

  for (const newTodo of input.todos) {
    // 1. Find by ID
    let existingIndex = mergedTodos.findIndex((t) => t.id === newTodo.id);

    // 2. Fallback to Content match for pending/in_progress tasks if no ID match
    if (
      existingIndex === -1 &&
      (newTodo.status === 'pending' || newTodo.status === 'in_progress')
    ) {
      existingIndex = mergedTodos.findIndex(
        (t, idx) =>
          !usedIndices.has(idx) &&
          (t.status === 'pending' || t.status === 'in_progress') &&
          (t.content ?? '').trim().toLowerCase() ===
            (newTodo.content ?? '').trim().toLowerCase()
      );
    }

    const oldTodo =
      existingIndex !== -1 ? mergedTodos[existingIndex] : undefined;

    // Preserve existing tracking data
    let tokensAtStart = oldTodo?.tokensAtStart;
    let tokensAccumulated = oldTodo?.tokensAccumulated ?? 0;
    let tokensUsed = oldTodo?.tokensUsed ?? 0;

    let tokensSavedAtStart = oldTodo?.tokensSavedAtStart;
    let tokensSavedAccumulated = oldTodo?.tokensSavedAccumulated ?? 0;
    let tokensSaved = oldTodo?.tokensSaved ?? 0;

    // Only update tokens if effectiveTokens > 0
    if (effectiveTokens > 0) {
      // If task was already completed in prev, freeze its token count
      if (oldTodo?.status === 'completed') {
        tokensAtStart = oldTodo.tokensAtStart;
        tokensAccumulated = oldTodo.tokensAccumulated ?? 0;
        tokensUsed = oldTodo.tokensUsed ?? 0;
        tokensSaved = oldTodo.tokensSaved ?? 0;
        tokensSavedAccumulated = oldTodo.tokensSavedAccumulated ?? 0;
        tokensSavedAtStart = oldTodo.tokensSavedAtStart;
      } else {
        // Initialize tracking if task just became in_progress
        if (
          newTodo.status === 'in_progress' &&
          oldTodo?.status !== 'in_progress'
        ) {
          if (tokensAtStart === undefined) {
            tokensAtStart = effectiveTokens;
          }
          if (tokensSavedAtStart === undefined) {
            tokensSavedAtStart = cachedTokens;
          }
        }

        // Calculate tokensUsed for in_progress or JUST completed tasks
        if (
          (newTodo.status === 'in_progress' ||
            newTodo.status === 'completed') &&
          tokensAtStart !== undefined
        ) {
          let currentDelta = Math.max(0, effectiveTokens - tokensAtStart);
          let calculatedTokensUsed = tokensAccumulated + currentDelta;

          let currentSavedDelta = 0;
          if (tokensSavedAtStart !== undefined) {
            currentSavedDelta = Math.max(0, cachedTokens - tokensSavedAtStart);
          }
          let calculatedTokensSaved =
            tokensSavedAccumulated + currentSavedDelta;

          // Detect eviction
          // If effectiveTokens drops below the start threshold, or if the calculated usage
          // drops below what we've already tracked (meaning context shrunk), we have evicted.
          if (
            effectiveTokens < tokensAtStart ||
            calculatedTokensUsed < tokensUsed
          ) {
            tokensAccumulated = tokensUsed;
            tokensAtStart = effectiveTokens;
            currentDelta = 0;
            calculatedTokensUsed = tokensAccumulated;

            // Sync saved tokens on eviction
            tokensSavedAccumulated = tokensSaved;
            tokensSavedAtStart = cachedTokens;
            currentSavedDelta = 0;
            calculatedTokensSaved = tokensSavedAccumulated;
          }

          tokensUsed = calculatedTokensUsed;
          tokensSaved = calculatedTokensSaved;
        }
      }
    }

    // Filter out null/undefined from newTodo to avoid overwriting existing fields
    const cleanNewTodo = Object.fromEntries(
      Object.entries(newTodo).filter(([, v]) => v !== null && v !== undefined)
    );

    const updatedTodo: SigmaTask = {
      ...(oldTodo || {}),
      ...cleanNewTodo,
      tokensAtStart,
      tokensAccumulated,
      tokensUsed,
      tokensSaved,
      tokensSavedAtStart,
      tokensSavedAccumulated,
    } as SigmaTask;

    if (existingIndex !== -1) {
      mergedTodos[existingIndex] = updatedTodo;
      usedIndices.add(existingIndex);
    } else {
      mergedTodos.push(updatedTodo);
      usedIndices.add(mergedTodos.length - 1);
    }
  }

  const mergedGrounding = [...(prev?.grounding || [])];
  if (input.grounding) {
    for (const newG of input.grounding) {
      const idx = mergedGrounding.findIndex((g) => g.id === newG.id);
      if (idx !== -1) mergedGrounding[idx] = newG;
      else mergedGrounding.push(newG);
    }
  }

  const mergedEvidence = [...(prev?.grounding_evidence || [])];
  if (input.grounding_evidence) {
    for (const newE of input.grounding_evidence) {
      const idx = mergedEvidence.findIndex((e) => e.id === newE.id);
      if (idx !== -1) mergedEvidence[idx] = newE;
      else mergedEvidence.push(newE);
    }
  }

  return {
    ...input,
    todos: mergedTodos,
    grounding: mergedGrounding.filter((g) =>
      mergedTodos.some((t) => t.id === g.id)
    ),
    grounding_evidence: mergedEvidence.filter((e) =>
      mergedTodos.some((t) => t.id === e.id)
    ),
  };
}

import { useAgentBaseContext } from '../../contexts/AgentContext.js';

export function useAgentHandlers() {
  const {
    options,
    state,
    sessionManager,
    tokenCounter,
    sessionTokenCounter,
    turnAnalysis,
    compression,
    debug,
  } = useAgentBaseContext();
  const {
    setMessages,
    setIsThinking,
    setThinkingState,
    setRetryCount,
    setActiveModel,
    setError,
    setInjectedRecap,
    lastCompressionTimestamp,
    setPendingMessageNotification,
    setShouldAutoRespond,
    sigmaTasks,
    setSigmaTasks,
    userMessageEmbeddingCache,
    thinkingStateRef,
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
    solo,
    sessionId: sessionIdProp,
    maxThinkingTokens,
    displayThinking,
    getTaskManager,
    getMessagePublisher,
    getMessageQueue,
    onRequestToolConfirmation,
    debug: debugFlag,
    semanticThreshold = 50000,
    taskLogEvictionThreshold,
  } = options;

  const anchorId = sessionManager.state.anchorId;

  // Track the original content of the active tool message (before streaming updates)
  // This allows us to revert the "streaming" view when the final result arrives,
  // preventing duplication of output in the chat history.
  const isStreamingToolOutputRef = useRef<boolean>(false);
  const activeToolContentRef = useRef<string | null>(null);
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const grayColor = `${terminalFormatter.hexToAnsi(TUITheme.text.secondary)}${terminalFormatter.ANSI_DIM}`;

  const processAgentMessage = useCallback(
    async (
      agentMessage: AgentMessage,
      currentTokens?: number,
      cachedTokens?: number
    ) => {
      const { type, content, thoughtSignature: msgSignature } = agentMessage;
      const thoughtSignature =
        msgSignature ||
        (Array.isArray(content)
          ? content.find((c) => c.thoughtSignature)?.thoughtSignature
          : undefined);

      // Use explicitly passed tokens if available, otherwise fall back to state
      // This ensures we use the most up-to-date count from the streaming response
      // rather than waiting for the React state update cycle
      const effectiveTokens = currentTokens ?? tokenCounter.count.total;
      const effectiveCachedTokens =
        cachedTokens ?? tokenCounter.count.cached ?? 0;

      switch (type) {
        case 'assistant': {
          setThinkingState(ThinkingState.PROCESSING);
          if (typeof content === 'string') {
            const colorReplacedText = terminalFormatter.cleanAnsi(content);
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.type === 'assistant') {
                return [
                  ...prev.slice(0, -1),
                  {
                    ...last,
                    content: last.content + colorReplacedText,
                    thoughtSignature: thoughtSignature ?? last.thoughtSignature,
                  },
                ];
              } else {
                return [
                  ...prev,
                  {
                    type: 'assistant',
                    content: colorReplacedText,
                    timestamp: new Date(),
                    thoughtSignature,
                  },
                ];
              }
            });

            // Sync to state machine
            tuiSyncManager.handleEvent({
              type: 'MESSAGE_ADD',
              message: {
                id: `assistant-${Date.now()}`,
                type: 'assistant',
                content: colorReplacedText,
                timestamp: new Date(),
              },
            });
          } else if (Array.isArray(content)) {
            const toolUses = content.filter((c) => c.type === 'tool_use');
            const textBlocks = content.filter((c) => c.type === 'text');
            const thinkingBlocks = content.filter((c) => c.type === 'thinking');

            if (thinkingBlocks.length > 0) {
              const thinking = thinkingBlocks
                .map((b) =>
                  terminalFormatter.stripSigmaMarkers(b.thinking || '')
                )
                .join('\n');
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.type === 'thinking') {
                  return [
                    ...prev.slice(0, -1),
                    {
                      ...last,
                      content: last.content + thinking,
                      thoughtSignature:
                        thoughtSignature ?? last.thoughtSignature,
                    },
                  ];
                } else {
                  return [
                    ...prev,
                    {
                      type: 'thinking',
                      content: thinking,
                      timestamp: new Date(),
                      thoughtSignature,
                    },
                  ];
                }
              });
            }

            if (textBlocks.length > 0) {
              const text = textBlocks
                .map((b) => terminalFormatter.stripSigmaMarkers(b.text || ''))
                .join('\n');
              const colorReplacedText = terminalFormatter.cleanAnsi(text);
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.type === 'assistant') {
                  return [
                    ...prev.slice(0, -1),
                    {
                      ...last,
                      content: last.content + colorReplacedText,
                      thoughtSignature:
                        thoughtSignature ?? last.thoughtSignature,
                    },
                  ];
                } else {
                  return [
                    ...prev,
                    {
                      type: 'assistant',
                      content: colorReplacedText,
                      timestamp: new Date(),
                      thoughtSignature,
                    },
                  ];
                }
              });

              // Sync to state machine
              tuiSyncManager.handleEvent({
                type: 'MESSAGE_ADD',
                message: {
                  id: `assistant-${Date.now()}`,
                  type: 'assistant',
                  content: colorReplacedText,
                  timestamp: new Date(),
                },
              });
            }

            if (toolUses.length > 0) {
              for (const tool of toolUses) {
                if (tool.name && tool.input) {
                  if (
                    tool.name === 'SigmaTaskUpdate' ||
                    tool.name === 'mcp__sigma-task-update__SigmaTaskUpdate'
                  ) {
                    if (tool.input && typeof tool.input === 'object') {
                      try {
                        const processedTodos = processSigmaTaskUpdateInput(
                          tool.input
                        );
                        const input: SigmaTasks = {
                          ...((tool.input as unknown as SigmaTasks) || {}),
                          todos: processedTodos as SigmaTask[],
                        };
                        setSigmaTasks((prev) =>
                          updateSigmaTasksWithTokens(
                            prev,
                            input,
                            effectiveTokens,
                            effectiveCachedTokens
                          )
                        );
                      } catch (err) {
                        // Ignore validation errors during streaming
                        systemDiagnosticsService.systemLog(
                          'sigma',
                          `Skipping intermediate SigmaTaskUpdate during stream: ${err}`
                        );
                      }
                    }
                  }

                  if (
                    providerName === 'gemini' &&
                    (tool.name === 'SigmaTaskUpdate' ||
                      tool.name ===
                        'mcp__sigma-task-update__SigmaTaskUpdate') &&
                    effectiveTokens > semanticThreshold &&
                    !compressionInProgressRef.current
                  ) {
                    systemDiagnosticsService.systemLog(
                      'sigma',
                      `Preemptive semantic compression for ${tool.name} (> ${semanticThreshold} tokens)...`
                    );
                    await compression.triggerCompression(true);
                  }

                  const content = formatToolUseMessage(
                    {
                      name: tool.name,
                      input: tool.input as Record<string, unknown>,
                    },
                    cwd,
                    sigmaTasks
                  );
                  const isOutputProducing = isOutputProducingTool(
                    tool.name || ''
                  );

                  if (isOutputProducing) {
                    activeToolContentRef.current = content;
                  }

                  setMessages((prev) => [
                    ...prev,
                    {
                      type: 'tool_progress',
                      content,
                      timestamp: new Date(),
                      toolCallId: tool.id,
                    },
                  ]);

                  // Sync to state machine
                  tuiSyncManager.handleEvent({
                    type: 'MESSAGE_ADD',
                    message: {
                      id: `tool-${Date.now()}`,
                      type: 'tool_progress',
                      content,
                      timestamp: new Date(),
                      toolCallId: tool.id,
                    },
                  });
                }
              }
            }
          }
          break;
        }

        case 'thinking': {
          setThinkingState(ThinkingState.PROCESSING);
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
          setThinkingState(ThinkingState.EXECUTING);
          if (agentMessage.toolName && agentMessage.toolInput) {
            if (
              agentMessage.toolName === 'SigmaTaskUpdate' ||
              agentMessage.toolName ===
                'mcp__sigma-task-update__SigmaTaskUpdate'
            ) {
              if (
                agentMessage.toolInput &&
                typeof agentMessage.toolInput === 'object'
              ) {
                try {
                  const processedTodos = processSigmaTaskUpdateInput(
                    agentMessage.toolInput
                  );
                  const input: SigmaTasks = {
                    ...((agentMessage.toolInput as unknown as SigmaTasks) ||
                      {}),
                    todos: processedTodos as SigmaTask[],
                  };
                  setSigmaTasks((prev) =>
                    updateSigmaTasksWithTokens(
                      prev,
                      input,
                      effectiveTokens,
                      effectiveCachedTokens
                    )
                  );
                } catch (err) {
                  systemDiagnosticsService.systemLog(
                    'sigma',
                    `Failed to process SigmaTaskUpdate: ${err}`
                  );
                }
              }
            }
            const content = formatToolUseMessage(
              {
                name: agentMessage.toolName,
                input: agentMessage.toolInput as Record<string, unknown>,
              },
              cwd,
              sigmaTasks
            );
            const isOutputProducing = isOutputProducingTool(
              agentMessage.toolName || ''
            );

            if (isOutputProducing) {
              activeToolContentRef.current = content;
            }

            setMessages((prev) => [
              ...prev,
              {
                type: 'tool_progress',
                content,
                timestamp: new Date(),
                toolCallId: agentMessage.toolCallId,
              },
            ]);

            // Sync to state machine
            tuiSyncManager.handleEvent({
              type: 'MESSAGE_ADD',
              message: {
                id: `tool-${Date.now()}`,
                type: 'tool_progress',
                content,
                timestamp: new Date(),
                toolCallId: agentMessage.toolCallId,
              },
            });
          } else if (typeof content === 'string') {
            const contentStr = `> ${content}`;
            // If we don't have a tool name, we can't reliably know if it's output-producing,
            // but usually string-based tool uses are simple and non-streaming.
            // We'll skip updating activeToolContentRef for these to be safe.

            setMessages((prev) => [
              ...prev,
              {
                type: 'tool_progress',
                content: contentStr,
                timestamp: new Date(),
              },
            ]);

            // Sync to state machine
            tuiSyncManager.handleEvent({
              type: 'MESSAGE_ADD',
              message: {
                id: `tool-${Date.now()}`,
                type: 'tool_progress',
                content: contentStr,
                timestamp: new Date(),
              },
            });
          } else if (Array.isArray(content)) {
            content.forEach((tool) => {
              if (tool.name && tool.input) {
                const contentStr = formatToolUseMessage(
                  {
                    name: tool.name,
                    input: tool.input as Record<string, unknown>,
                  },
                  cwd,
                  sigmaTasks
                );
                const isOutputProducing = isOutputProducingTool(
                  tool.name || ''
                );

                if (isOutputProducing) {
                  activeToolContentRef.current = contentStr;
                }

                setMessages((prev) => [
                  ...prev,
                  {
                    type: 'tool_progress',
                    content: contentStr,
                    timestamp: new Date(),
                  },
                ]);

                // Sync to state machine
                tuiSyncManager.handleEvent({
                  type: 'MESSAGE_ADD',
                  message: {
                    id: `tool-${Date.now()}`,
                    type: 'tool_progress',
                    content: contentStr,
                    timestamp: new Date(),
                  },
                });
              }
            });
          }
          break;
        }

        case 'tool_result': {
          setThinkingState(ThinkingState.PROCESSING);
          // Immediately hide cursor after tool completes, as its final output might have requested to show it
          terminal.setCursorVisibility(false);
          if (process.env.DEBUG_INPUT) {
            systemDiagnosticsService.systemLog(
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
            // Layer 14: Sigma Task Surgical Eviction (Strip hidden tags for display)
            const resultData =
              typeof agentMessage.content === 'string'
                ? terminalFormatter.stripSigmaMarkers(agentMessage.content)
                : Array.isArray(agentMessage.content)
                  ? agentMessage.content.map((block) => {
                      if (
                        block.type === 'text' &&
                        typeof block.text === 'string'
                      ) {
                        return {
                          ...block,
                          text: terminalFormatter.stripSigmaMarkers(block.text),
                        };
                      }
                      if (
                        block.type === 'tool_result' &&
                        typeof block.content === 'string'
                      ) {
                        return {
                          ...block,
                          content: terminalFormatter.stripSigmaMarkers(
                            block.content
                          ),
                        };
                      }
                      return block;
                    })
                  : agentMessage.content;

            // Robust handling for JSON-encoded tool results (e.g. from Gemini ADK wrapping)
            let effectiveResultData = resultData;
            if (
              typeof resultData === 'string' &&
              resultData.trim().startsWith('{')
            ) {
              try {
                const parsed = JSON.parse(resultData);
                if (parsed && typeof parsed === 'object') {
                  effectiveResultData = parsed;
                }
              } catch {
                // Not valid JSON or parsing failed, use original
              }
            }

            let formattedResult = formatToolResult(
              agentMessage.toolName,
              effectiveResultData,
              cwd
            );

            const baseToolName = agentMessage.toolName
              ?.toLowerCase()
              .replace(/^mcp__.*?__/, '');
            const isBash =
              baseToolName === 'bash' ||
              baseToolName === 'shell' ||
              baseToolName === 'bashoutput' ||
              baseToolName === 'check_output' ||
              baseToolName === 'get_bash_output' ||
              baseToolName === 'grep';

            // Layer 13: Standardize Sigma Marker Stripping
            // Apply stripSigmaMarkers BEFORE extraction to ensure exit codes are found
            // even if hidden markers are present at the end of the string.
            // Support both string and array of blocks for tool results.
            const rawResultText =
              typeof effectiveResultData === 'string'
                ? effectiveResultData
                : Array.isArray(effectiveResultData)
                  ? (effectiveResultData as unknown[])
                      .map((block) => {
                        const b = block as Record<string, unknown>;
                        if (b.type === 'text') return (b.text as string) || '';
                        if (b.content && typeof b.content === 'string')
                          return b.content;
                        return '';
                      })
                      .join('\n')
                  : typeof effectiveResultData === 'object' &&
                      effectiveResultData !== null
                    ? 'content' in effectiveResultData &&
                      typeof (effectiveResultData as Record<string, unknown>)
                        .content === 'string'
                      ? ((effectiveResultData as Record<string, unknown>)
                          .content as string)
                      : 'stdout' in effectiveResultData ||
                          'stderr' in effectiveResultData ||
                          'exitCode' in effectiveResultData
                        ? `${(effectiveResultData as Record<string, unknown>).stdout || ''}${(effectiveResultData as Record<string, unknown>).stderr ? `\nSTDERR:\n${(effectiveResultData as Record<string, unknown>).stderr}` : ''}\nExit code: ${(effectiveResultData as Record<string, unknown>).exitCode ?? 'unknown'}`
                        : JSON.stringify(effectiveResultData, null, 2)
                    : '';

            // For bash tools, we extract the exit code for the concise display
            let exitCode: string | number | undefined;

            if (isBash) {
              // Try to extract from structured data first
              if (
                typeof effectiveResultData === 'object' &&
                effectiveResultData !== null &&
                'exitCode' in effectiveResultData
              ) {
                exitCode = (effectiveResultData as Record<string, unknown>)
                  .exitCode as string | number | undefined;
              }

              if (exitCode === undefined && rawResultText) {
                // Fallback to regex extraction from the formatted text
                const match = rawResultText.match(
                  // eslint-disable-next-line no-control-regex
                  /Exit code:\s*(?:(?:\x1b\[[0-9;]*m)|\[[0-9;]*m)*\s*(-?\d+|null|unknown)(?:\x1b\[0m|\[0m)?/
                );
                if (match) {
                  exitCode = match[1];
                }
              }
            }

            const strippedData = terminalFormatter
              .cleanAnsi(terminalFormatter.stripSigmaMarkers(rawResultText))
              .trim();

            // Use a more robust check for "only exit code" that handles potential trailing markers
            // that might have survived or whitespace issues.
            /* eslint-disable no-control-regex */
            const isOnlyExitCode =
              isBash &&
              /^Exit code:\s*(?:(?:\x1b\[[0-9;]*m)|\[[0-9;]*m)*\s*(-?\d+|null|unknown)(?:\x1b\[0m|\[0m)?(?:\s+<!-- sigma-task: [^>]+ -->)?\s*$/.test(
                strippedData
              );

            if (isStreamingToolOutputRef.current && isBash) {
              // For streamed bash output, provide a concise summary in the TUI
              let exitCodeStr =
                exitCode !== undefined ? String(exitCode) : 'unknown';
              if (exitCodeStr === 'null') {
                exitCodeStr = '0';
              }

              const isZero = exitCodeStr === '0';
              const isUnknown = exitCodeStr === 'unknown';
              const codeColor = isZero
                ? '\x1b[32m'
                : isUnknown
                  ? '\x1b[90m'
                  : '\x1b[31m'; // Green for 0, Gray for unknown, Red otherwise

              const gray = '\x1b[90m';
              formattedResult = `${gray}Exit code: ${codeColor}${exitCodeStr}${terminalFormatter.ANSI_RESET}`;
            } else if (isOnlyExitCode) {
              // If not streaming but we only have an exit code (e.g. fast command with no output)
              // format it consistently (colored, no indentation)
              let exitCodeStr =
                exitCode !== undefined ? String(exitCode) : 'unknown';
              if (exitCodeStr === 'null') exitCodeStr = '0';
              const isZero = exitCodeStr === '0';
              const isUnknown = exitCodeStr === 'unknown';
              const codeColor = isZero
                ? '\x1b[32m'
                : isUnknown
                  ? '\x1b[90m'
                  : '\x1b[31m';
              const gray = '\x1b[90m';
              formattedResult = `${gray}Exit code: ${codeColor}${exitCodeStr}${terminalFormatter.ANSI_RESET}`;
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
              const isOutput = isOutputProducingTool(
                agentMessage.toolName || ''
              );
              const suffix = isOutput ? ' Output' : ' Result';

              // Layer 13: Tool Result Header Injection.
              // Use a newline after the header to ensure the content starts on its own line.
              // Normalize formattedResult to prevent double newlines when prepending header
              const cleanResult = formattedResult.trim();
              formattedResult = `${resultIcon} ${toolInfo.name}${suffix}:${cleanResult.length > 0 ? `\n${cleanResult}` : ''}`;

              setMessages((prev) => {
                // Clean up any remaining streaming markers from the active tool_progress message.
                // We search backwards to find it robustly.
                const cleanedPrev = [...prev];
                let targetIdx = -1;
                const activeHeader = activeToolContentRef.current;

                for (let i = cleanedPrev.length - 1; i >= 0; i--) {
                  const msg = cleanedPrev[i];
                  if (msg.type === 'tool_progress') {
                    // If we were streaming, we prefer the message that we were streaming into.
                    if (activeHeader && msg.content.startsWith(activeHeader)) {
                      targetIdx = i;
                      break;
                    }
                    // Fallback to the last tool_progress message if no header match
                    if (targetIdx === -1) {
                      targetIdx = i;
                    }
                  }
                }

                if (targetIdx !== -1) {
                  cleanedPrev[targetIdx] = {
                    ...cleanedPrev[targetIdx],
                    content: cleanedPrev[targetIdx].content.replace(
                      // eslint-disable-next-line no-control-regex
                      /(?:\r?\n)*(?:\x1b\[[0-9;]*m)*\(streaming\)(?:\x1b\[[0-9;]*m)*$/,
                      ''
                    ),
                  };

                  // If we were streaming, we update the existing message to avoid duplication.
                  // This prevents the "pushed down" look where the streaming output remains
                  // and the final result is appended below it.
                  if (
                    isStreamingToolOutputRef.current &&
                    activeHeader &&
                    cleanedPrev[targetIdx].content.startsWith(activeHeader)
                  ) {
                    cleanedPrev[targetIdx] = {
                      ...cleanedPrev[targetIdx],
                      content: `${activeHeader}\n${formattedResult}`,
                    };
                    return cleanedPrev;
                  }
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

              // Sync to state machine
              tuiSyncManager.handleEvent({
                type: 'MESSAGE_ADD',
                message: {
                  id: `result-${Date.now()}`,
                  type: 'tool_progress',
                  content: formattedResult,
                  timestamp: new Date(),
                },
              });

              // Only clear activeToolContentRef if this tool matches the one that set it.
              // We check if the current activeHeader starts with the icon and name of the tool that just finished.
              const activeHeader = activeToolContentRef.current;
              if (
                activeHeader &&
                activeHeader.startsWith(`${toolInfo.icon} ${toolInfo.name}`)
              ) {
                activeToolContentRef.current = null;
              }
              isStreamingToolOutputRef.current = false;
            } else if (process.env.DEBUG_INPUT) {
              systemDiagnosticsService.systemLog(
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
      setMessages,
      setSigmaTasks,
      terminal,
      cwd,
      semanticThreshold,
      compressionInProgressRef,
      compression,
      debug,
    ]
  );

  const sendMessage = useCallback(
    async (prompt: string) => {
      let waitingTimeout: NodeJS.Timeout | null = null;

      const resetBoredomTimer = () => {
        if (waitingTimeout) {
          clearTimeout(waitingTimeout);
          waitingTimeout = null;
        }
        waitingTimeout = setTimeout(() => {
          if (thinkingStateRef.current === ThinkingState.PROCESSING) {
            setThinkingState(ThinkingState.WAITING);
          }
        }, 2000);
      };

      try {
        if (statusTimeoutRef.current) {
          clearTimeout(statusTimeoutRef.current);
          statusTimeoutRef.current = null;
        }

        setIsThinking(true);
        setThinkingState(ThinkingState.PROCESSING);

        // Start waiting timeout - if model doesn't respond in 2s, Siggy gets bored
        resetBoredomTimer();

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
              setThinkingState(ThinkingState.IDLE);
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

          // Sync to state machine
          tuiSyncManager.handleEvent({
            type: 'MESSAGE_ADD',
            message: {
              id: `user-${userMessageTimestamp.getTime()}`,
              type: 'user',
              content: prompt,
              timestamp: userMessageTimestamp,
            },
          });
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
          const activeTask = state.sigmaTasks?.todos?.find(
            (t) => t.status === 'in_progress'
          );
          const taskId = activeTask ? activeTask.id : 'none';

          const warning = `<token-pressure-warning>
CRITICAL: Current context is at ${tokenCounter.count.total.toLocaleString()} tokens. 
Active Task: ${taskId}

To maintain high-fidelity reasoning and stay within TPM limits, follow the "Aggressive Micro-Tasking" rule: mark your current task as "completed" via SigmaTaskUpdate as soon as you reach a logical stopping point. 
This triggers a semantic compression event, flushing implementation noise while preserving your high-level plan.
</token-pressure-warning>`;
          finalPrompt = `${warning}\n\n${finalPrompt}`;
        }

        if (
          !state.injectedRecap &&
          embedderRef.current &&
          turnAnalysis.analyses.length > 0 &&
          lastCompressionTimestamp > 0 // Only inject if at least one compression has happened
        ) {
          try {
            const searchPrompt = prompt.startsWith('/') ? prompt : finalPrompt;
            const result = await injectRelevantContext(
              searchPrompt,
              turnAnalysis.analyses,
              embedderRef.current,
              {
                debug: debugFlag,
                beforeTimestamp: lastCompressionTimestamp, // Only inject from archived history
              }
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
            systemDiagnosticsService.systemLog(
              'sigma',
              `Context injection error: ${err}`,
              {},
              'error'
            );
          }
        }

        const currentResumeId = sessionManager.getResumeSessionId();
        const adapter = new AgentProviderAdapter({
          provider: providerName,
          model: modelName,
          mode: solo ? 'solo' : 'full',
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
          taskLogEvictionThreshold,
          remainingTPM: 1000000 - tokenCounter.count.total,
          onStderr: (data: string) => stderrLines.push(data),
          onToolOutput: (chunk: string, toolCallId?: string) => {
            setThinkingState(ThinkingState.EXECUTING);
            resetBoredomTimer();
            // Layer 10: Aggressively hide terminal cursor while streaming tool output
            terminal.setCursorVisibility(false);

            // Pre-strip cursor control sequences and ANSI from output chunks before storing
            // This ensures clean processing and prevents rendering artifacts like extra newlines
            const cleanChunk = terminalFormatter.cleanAnsi(
              terminalFormatter.stripCursorSequences(chunk)
            );

            setMessages((prev) => {
              // Robustly find the active tool_progress message by searching backwards.
              // This ensures that intermediate assistant messages (e.g. from Gemini thought signatures)
              // don't break streaming output updates.
              let targetIdx = -1;

              // 1. Try finding by toolCallId if provided (Primary mechanism for atomic batching)
              if (toolCallId) {
                for (let i = prev.length - 1; i >= 0; i--) {
                  if (
                    prev[i].type === 'tool_progress' &&
                    prev[i].toolCallId === toolCallId
                  ) {
                    targetIdx = i;
                    break;
                  }
                }
              }

              // 2. Fallback to matching by active header (Legacy mechanism)
              if (targetIdx === -1) {
                const activeHeader = activeToolContentRef.current;
                for (let i = prev.length - 1; i >= 0; i--) {
                  const msg = prev[i];
                  if (msg.type === 'tool_progress') {
                    // If we have an active tool header, we prefer a message that starts with it.
                    // This prevents interleaved output (e.g. bash output appearing in SigmaTaskUpdate).
                    if (activeHeader) {
                      if (msg.content.startsWith(activeHeader)) {
                        targetIdx = i;
                        break;
                      }
                    } else {
                      // Fallback to the last tool_progress message if no header is active
                      targetIdx = i;
                      break;
                    }
                  }
                }
              }

              if (targetIdx !== -1) {
                const target = prev[targetIdx];
                isStreamingToolOutputRef.current = true;

                // Strip existing streaming marker if present from previous chunk
                // Use a non-capturing group for the optional newline to avoid issues
                // Robustly strip the streaming marker AND any trailing newlines from content
                // to prepare for clean appending. We use a regex that matches the marker
                // with any ANSI color sequences (including multi-sequence themes).
                let content = target.content.replace(
                  // eslint-disable-next-line no-control-regex
                  /(?:\r?\n)*(?:\x1b\[[0-9;]*m)*\(streaming\)(?:\x1b\[[0-9;]*m)*$/,
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
                      `\n${grayColor}... (tail of stream)${terminalFormatter.ANSI_RESET}\n` +
                      keptLines.join('\n');
                  }
                }

                // Add streaming marker to the end - this triggers stabilization in ClaudePanelAgent
                // We ensure it starts on a new line unless it's already there
                if (!content.endsWith('\n')) {
                  content += '\n';
                }
                content += `${grayColor}(streaming)${terminalFormatter.ANSI_RESET}`;

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
              setThinkingState(ThinkingState.CONFIRMING);
              const decision = await onRequestToolConfirmation(toolName, input);
              setThinkingState(ThinkingState.PROCESSING);
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

        type LastResponse = {
          sessionId?: string;
          tokens: {
            prompt: number;
            completion: number;
            total: number;
            cached?: number;
          };
          messages: unknown[];
          numTurns: number;
          toolResult?: { name: string };
          finishReason?: string;
        };

        let previousMessageCount = 0;
        let hasAssistantMessage = false;
        let lastResponse: LastResponse | null = null;
        let turnWasSemantic = false;

        // Silent-timeout retry: Vertex AI / Gemini close idle SSE streams after ~2min
        // of no output (model thinking). The ADK generator completes cleanly with zero
        // content. We auto-retry once before surfacing an error.
        const MAX_SILENT_RETRIES = 1;
        let silentRetryCount = 0;

        const runQuery = async (
          prompt: string
        ): Promise<{
          hasAssistantMessage: boolean;
          lastResponse: LastResponse | null;
          turnWasSemantic: boolean;
        }> => {
          let runHasAssistantMessage = false;
          let runLastResponse: LastResponse | null = null;
          let runTurnWasSemantic = false;
          previousMessageCount = 0;

          const queryResult = adapter.query(prompt);
          for await (const response of queryResult) {
            // Process responses
            resetBoredomTimer();

            // Reset to PROCESSING if we were waiting (bored)
            if (thinkingStateRef.current === ThinkingState.WAITING) {
              setThinkingState(ThinkingState.PROCESSING);
            }

            // Update retry count if provider is retrying (Gemini specific)
            if (response.retryCount !== undefined) {
              setRetryCount(response.retryCount);
            }

            // Update active model if it changed due to failover (Gemini specific)
            if (response.activeModel) {
              setActiveModel(response.activeModel);
            }

            runLastResponse = response as unknown as LastResponse;
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
              cached: response.tokens.cached,
            });
            const turnCostUsd = adapter.estimateCost({
              input: response.tokens.prompt,
              output: response.tokens.completion,
              total: response.tokens.total,
              cached: response.tokens.cached,
            });

            const turnSavedCostUsd = adapter.estimateCost({
              input: response.tokens.cached || 0,
              output: 0,
              total: response.tokens.cached || 0,
              cached: 0,
            });

            sessionTokenCounter.update(
              {
                input: response.tokens.prompt,
                output: response.tokens.completion,
                total: response.tokens.total,
                cached: response.tokens.cached,
              },
              turnCostUsd,
              turnSavedCostUsd,
              response.numTurns
            );

            // Layer 15: Dynamic Task Token Tracking.
            // Synchronize in-progress task token usage on every turn, even if SigmaTaskUpdate wasn't called.
            // This ensures the sidebar displays real-time cost for the ongoing operation.
            setSigmaTasks((prev) =>
              updateSigmaTasksWithTokens(
                prev,
                prev,
                sessionTokenCounter.getLatestCount().total,
                sessionTokenCounter.getLatestCount().cached
              )
            );

            if (
              response.toolResult &&
              (response.toolResult.name === 'SigmaTaskUpdate' ||
                response.toolResult.name ===
                  'mcp__sigma-task-update__SigmaTaskUpdate')
            ) {
              runTurnWasSemantic = true;
            }

            for (const agentMessage of newMessages) {
              if (agentMessage.type === 'assistant')
                runHasAssistantMessage = true;
              await processAgentMessage(
                agentMessage,
                sessionTokenCounter.getLatestCount().total,
                sessionTokenCounter.getLatestCount().cached
              );
            }
          }
          return {
            hasAssistantMessage: runHasAssistantMessage,
            lastResponse: runLastResponse,
            turnWasSemantic: runTurnWasSemantic,
          };
        }; // end runQuery

        ({ hasAssistantMessage, lastResponse, turnWasSemantic } =
          await runQuery(finalPrompt));

        // Auto-retry on silent timeout (no content, no stderr = server closed idle stream).
        // Skip if provider already yielded finishReason:'error' — that means SDK-level retries
        // were exhausted, so TUI-level retry won't help.
        while (
          !hasAssistantMessage &&
          !abortedRef.current &&
          lastResponse?.finishReason !== 'error' &&
          isSilentTimeout(stderrLines, hasAssistantMessage) &&
          silentRetryCount < MAX_SILENT_RETRIES
        ) {
          silentRetryCount++;
          setMessages((prev) => [
            ...prev,
            {
              type: 'system',
              content: `⟳ Connection timed out, retrying... (attempt ${silentRetryCount}/${MAX_SILENT_RETRIES})`,
              timestamp: new Date(),
            },
          ]);
          ({ hasAssistantMessage, lastResponse, turnWasSemantic } =
            await runQuery(finalPrompt));
        }

        if (
          lastResponse &&
          hasAssistantMessage &&
          lastResponse.finishReason !== 'error'
        ) {
          const content = `✓ Complete (${lastResponse.numTurns} turns, ${lastResponse.messages.length} messages)`;
          setMessages((prev) => [
            ...prev,
            {
              type: 'system',
              content,
              timestamp: new Date(),
            },
          ]);

          // Sync to state machine
          tuiSyncManager.handleEvent({
            type: 'MESSAGE_ADD',
            message: {
              id: `system-${Date.now()}`,
              type: 'system',
              content,
              timestamp: new Date(),
            },
          });

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
                const notificationContent = `📬 ${pendingMessages.length} pending messages injected`;
                setMessages((prev) => [
                  ...prev,
                  {
                    type: 'system',
                    content: notificationContent,
                    timestamp: new Date(),
                  },
                ]);

                // Sync to state machine
                tuiSyncManager.handleEvent({
                  type: 'MESSAGE_ADD',
                  message: {
                    id: `notification-${Date.now()}`,
                    type: 'system',
                    content: notificationContent,
                    timestamp: new Date(),
                  },
                });
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

        if (!hasAssistantMessage && !abortedRef.current) {
          const errorMsg = isAuthenticationError(stderrLines)
            ? formatAuthError()
            : isSilentTimeout(stderrLines, hasAssistantMessage)
              ? `SDK completed without response after ${silentRetryCount} retry attempt(s) — possible server timeout or authentication issue`
              : formatSDKError(stderrLines, hasAssistantMessage);
          setMessages((prev) => [
            ...prev,
            {
              type: 'system',
              content: `❌ ${errorMsg}`,
              timestamp: new Date(),
            },
          ]);

          // Sync to state machine
          tuiSyncManager.handleEvent({
            type: 'MESSAGE_ADD',
            message: {
              id: `error-${Date.now()}`,
              type: 'error',
              content: errorMsg,
              timestamp: new Date(),
            },
          });

          setThinkingState(ThinkingState.ERROR);
        }

        setIsThinking(false);

        if (
          lastResponse?.finishReason === 'stop' &&
          hasAssistantMessage &&
          !abortedRef.current
        ) {
          setThinkingState(ThinkingState.SUCCESS);
          terminal.beep();
          // Auto-revert to IDLE after 5 seconds to keep the TUI clean
          statusTimeoutRef.current = setTimeout(() => {
            setThinkingState(ThinkingState.IDLE);
            statusTimeoutRef.current = null;
          }, 5000);
        } else if (thinkingStateRef.current === ThinkingState.ERROR) {
          // If we already set ERROR state (e.g. streaming error), let it persist for 5 seconds too
          statusTimeoutRef.current = setTimeout(() => {
            setThinkingState(ThinkingState.IDLE);
            statusTimeoutRef.current = null;
          }, 5000);
        } else {
          setThinkingState(ThinkingState.IDLE);
        }
      } catch (err) {
        const originalError = (err as Error).message;
        const errorMsg = isAuthenticationError([originalError])
          ? formatAuthError()
          : originalError;
        setMessages((prev) => [
          ...prev,
          { type: 'system', content: `❌ ${errorMsg}`, timestamp: new Date() },
        ]);

        // Sync to state machine
        tuiSyncManager.handleEvent({
          type: 'MESSAGE_ADD',
          message: {
            id: `error-${Date.now()}`,
            type: 'error',
            content: errorMsg,
            timestamp: new Date(),
          },
        });

        setIsThinking(false);
        setThinkingState(ThinkingState.IDLE);
      } finally {
        if (waitingTimeout) clearTimeout(waitingTimeout);
        sessionTokenCounter.commit();
        currentAdapterRef.current = null;
      }
    },
    [
      /* state */
      setMessages,
      setIsThinking,
      setThinkingState,
      setRetryCount,
      setActiveModel,
      setError,
      setInjectedRecap,
      setPendingMessageNotification,
      setShouldAutoRespond,
      state.commandsCache,
      state.injectedRecap,
      state.pendingMessageNotification,
      embedderRef,
      userMessageEmbeddingCache,
      thinkingStateRef,
      statusTimeoutRef,
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
      solo,
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
      sessionTokenCounter,
      turnAnalysis,
      compression,
      debug,
      anchorId,
      processAgentMessage,
    ]
  );

  return { sendMessage, processAgentMessage };
}
