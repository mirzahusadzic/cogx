/**
 * Minimax Agent Provider Implementation
 *
 * Implements AgentProvider using Anthropic SDK with Minimax's Anthropic-compatible API.
 */

import { getGroundingContext } from '../grounding-utils.js';
import { systemLog } from '../../../utils/debug-logger.js';
import { getActiveTaskId } from '../../../sigma/session-state.js';
import { buildSystemPrompt } from '../system-prompt.js';
import Anthropic from '@anthropic-ai/sdk';
import type { ConversationOverlayRegistry } from '../../../sigma/conversation-registry.js';
import type { BackgroundTaskManager } from '../../../tui/services/BackgroundTaskManager.js';
import type { MessagePublisher } from '../../../ipc/MessagePublisher.js';
import type { MessageQueue } from '../../../ipc/MessageQueue.js';
import type {
  AgentProvider,
  AgentRequest,
  AgentResponse,
  AgentMessage,
} from '../../agent-provider-interface.js';
import type {
  CompletionRequest,
  CompletionResponse,
} from '../../provider-interface.js';

import {
  getMinimaxTools,
  executeMinimaxTool,
  type MinimaxToolsContext,
} from './agent-tools.js';
import {
  archiveTaskLogs,
  TASK_LOG_EVICTION_THRESHOLD,
} from '../eviction-utils.js';

interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
}

interface ThinkingDelta {
  type: 'thinking_delta';
  thinking: string;
}

type MinimaxContentBlock =
  | Anthropic.ContentBlock
  | ThinkingBlock
  | Anthropic.ToolUseBlock;
type MinimaxContentBlockDelta = Anthropic.RawContentBlockDelta | ThinkingDelta;

export class MinimaxAgentProvider implements AgentProvider {
  name = 'minimax';
  models = [
    'MiniMax-M2.5',
    'MiniMax-M2.5-highspeed',
    'MiniMax-M2.1',
    'MiniMax-M2.1-highspeed',
    'MiniMax-M2',
  ];
  private client: Anthropic;
  private defaultModel: string;
  private abortController: AbortController | null = null;

  constructor(options: { apiKey?: string; model?: string } = {}) {
    const apiKey = options.apiKey || process.env.MINIMAX_API_KEY;
    if (!apiKey) throw new Error('MINIMAX_API_KEY is required');
    this.client = new Anthropic({
      apiKey,
      baseURL: 'https://api.minimax.io/anthropic',
    });
    this.defaultModel =
      options.model || process.env.MINIMAX_MODEL || 'MiniMax-M2.5';
    systemLog('minimax', 'Initialized', { model: this.defaultModel }, 'debug');
  }

  supportsAgentMode(): boolean {
    return true;
  }
  async isAvailable(): Promise<boolean> {
    return !!process.env.MINIMAX_API_KEY;
  }
  estimateCost(
    tokens: {
      prompt: number;
      completion: number;
      total: number;
      cached?: number;
    },
    model?: string
  ): number {
    // Validation for NaN - return 0 if invalid
    if (
      isNaN(tokens.prompt) ||
      isNaN(tokens.completion) ||
      (tokens.cached !== undefined && isNaN(tokens.cached))
    ) {
      return 0;
    }

    const inputMtokens = tokens.prompt / 1000000;
    const outputMtokens = tokens.completion / 1000000;

    if (model?.includes('highspeed')) {
      return inputMtokens * 0.6 + outputMtokens * 2.4;
    }
    return inputMtokens * 0.3 + outputMtokens * 1.2;
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const temperature = Math.min(Math.max(req.temperature || 1, 0.01), 1.0);
    const resp = await this.client.messages.create({
      model: req.model || this.defaultModel,
      max_tokens: req.maxTokens || 4096,
      temperature: temperature,
      system: req.systemPrompt,
      messages: [{ role: 'user', content: req.prompt }],
    });
    const text = resp.content
      .filter((b) => b.type === 'text')
      .map((b) => ('text' in b ? b.text : ''))
      .join('\n');
    return {
      text,
      model: resp.model,
      tokens: {
        prompt: resp.usage.input_tokens,
        completion: resp.usage.output_tokens,
        total: resp.usage.input_tokens + resp.usage.output_tokens,
      },
      finishReason: resp.stop_reason === 'end_turn' ? 'stop' : 'length',
    };
  }

  async *stream(req: CompletionRequest): AsyncGenerator<{
    delta: string;
    text: string;
    done: boolean;
    tokens?: { prompt: number; completion: number; total: number };
  }> {
    const temperature = Math.min(Math.max(req.temperature || 1, 0.01), 1.0);
    const stream = await this.client.messages.stream({
      model: req.model || this.defaultModel,
      max_tokens: req.maxTokens || 4096,
      temperature: temperature,
      system: req.systemPrompt,
      messages: [{ role: 'user', content: req.prompt }],
    });
    let full = '',
      pt = 0,
      ct = 0;
    for await (const ev of stream) {
      if (ev.type === 'message_start') pt = ev.message.usage.input_tokens;
      else if (ev.type === 'content_block_delta') {
        if (ev.delta.type === 'text_delta') {
          full += ev.delta.text;
          yield { delta: ev.delta.text, text: full, done: false };
        } else if (
          (ev.delta as MinimaxContentBlockDelta).type === 'thinking_delta'
        ) {
          const thinking = (ev.delta as ThinkingDelta).thinking;
          full += thinking;
          yield { delta: thinking, text: full, done: false };
        }
      } else if (ev.type === 'message_delta') ct = ev.usage.output_tokens;
      else if (ev.type === 'message_stop')
        yield {
          delta: '',
          text: full,
          done: true,
          tokens: { prompt: pt, completion: ct, total: pt + ct },
        };
    }
  }

  /**
   * Rolling prune for in-progress tasks (Minimax).
   * Maintains a ring buffer of tool outputs in the local history array.
   */
  private async rollingPruneTaskLogs(
    taskId: string,
    sessionId: string,
    projectRoot: string,
    history: Anthropic.MessageParam[],
    threshold: number = TASK_LOG_EVICTION_THRESHOLD
  ) {
    try {
      const tag = `<!-- sigma-task: ${taskId} -->`;
      const taggedIndices: number[] = [];

      for (let i = 0; i < history.length; i++) {
        const msg = history[i];
        const contentStr =
          typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content);
        if (contentStr.includes(tag)) {
          taggedIndices.push(i);
        }
      }

      if (taggedIndices.length <= threshold) return;

      const toPruneCount = taggedIndices.length - threshold;
      const indicesToPrune = taggedIndices.slice(0, toPruneCount);
      const evictedLogs: string[] = [];

      for (const idx of indicesToPrune) {
        const msg = history[idx];
        evictedLogs.push(JSON.stringify(msg, null, 2));

        const toolTombstone = `[Tool output for task ${taskId} evicted (Rolling Prune) to keep context small. Use 'grep' on .sigma/archives/${sessionId}/${taskId}.log if previous logs are needed.]`;

        if (typeof msg.content === 'string') {
          history[idx] = { ...msg, content: toolTombstone };
        } else if (Array.isArray(msg.content)) {
          const newContent = msg.content.map((part) => {
            if (part.type === 'text' && part.text.includes(tag)) {
              return { ...part, text: toolTombstone };
            }
            if (part.type === 'tool_result') {
              const result =
                typeof part.content === 'string'
                  ? part.content
                  : JSON.stringify(part.content);
              if (result.includes(tag)) {
                return { ...part, content: toolTombstone };
              }
            }
            return part;
          });
          history[idx] = {
            ...msg,
            content: newContent as Anthropic.MessageParam['content'],
          };
        }
      }

      await archiveTaskLogs({
        projectRoot,
        sessionId,
        taskId,
        evictedLogs,
      });

      systemLog(
        'sigma',
        `Rolling prune: Evicted ${toPruneCount} oldest tool logs for task ${taskId} (threshold: ${threshold}) (Minimax).`
      );
    } catch (err) {
      systemLog(
        'sigma',
        `Failed rolling prune for task ${taskId} (Minimax)`,
        { error: err instanceof Error ? err.message : String(err) },
        'error'
      );
    }
  }

  /**
   * Prune tool logs for a completed task and archive them.
   */
  private async pruneTaskLogs(
    taskId: string,
    result_summary: string | null | undefined,
    sessionId: string,
    projectRoot: string,
    history: Anthropic.MessageParam[]
  ) {
    try {
      const tag = `<!-- sigma-task: ${taskId} -->`;
      const evictedLogs: string[] = [];
      let evictedCount = 0;

      // Pass 0: Identify task range (from 'in_progress' to 'completed')
      let startIndex = -1;
      for (let i = 0; i < history.length; i++) {
        const msg = history[i];
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          const hasInProgress = msg.content.some((part) => {
            if (part.type === 'tool_use' && part.name === 'SigmaTaskUpdate') {
              const input = part.input as {
                todos?: Array<{ id: string; status: string }>;
              };
              return input.todos?.some(
                (t) => t.id === taskId && t.status === 'in_progress'
              );
            }
            return false;
          });
          if (hasInProgress) {
            startIndex = i;
            // Don't break; we want the *latest* in_progress for this task (if it was paused/resumed)
          }
        }
      }

      // Pass 1: Find last evicted index to inject summary
      let lastEvictedIndex = -1;
      for (let i = 0; i < history.length; i++) {
        const message = history[i];
        if (typeof message.content === 'string') {
          if (message.content.includes(tag)) lastEvictedIndex = i;
        } else if (Array.isArray(message.content)) {
          const hasTag = message.content.some((part) => {
            if (part.type === 'text' && part.text.includes(tag)) return true;
            if (part.type === 'tool_result') {
              const result =
                typeof part.content === 'string'
                  ? part.content
                  : JSON.stringify(part.content);
              return result.includes(tag);
            }
            return false;
          });
          if (hasTag) lastEvictedIndex = i;
        }
      }

      const isTurnInRange = (index: number) => {
        if (startIndex === -1 || index <= startIndex) return false;
        const msg = history[index];
        // Don't evict user turns
        if (msg.role === 'user') return false;
        // Don't evict the turn that marks it completed
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          const hasTaskCompleted = msg.content.some((part) => {
            if (part.type === 'tool_use' && part.name === 'SigmaTaskUpdate') {
              const input = part.input as {
                todos?: Array<{ id: string; status: string }>;
              };
              return input.todos?.some(
                (t) => t.id === taskId && t.status === 'completed'
              );
            }
            return false;
          });
          if (hasTaskCompleted) return false;
        }
        return true;
      };

      for (let i = 0; i < history.length; i++) {
        const message = history[i];
        const shouldInjectSummary = i === lastEvictedIndex && result_summary;

        if (typeof message.content === 'string') {
          if (message.content.includes(tag) || isTurnInRange(i)) {
            evictedLogs.push(JSON.stringify(message, null, 2));
            history[i] = {
              ...message,
              content: shouldInjectSummary
                ? `[Task ${taskId} completed. Raw logs evicted to archive. \nSUMMARY: ${result_summary}]`
                : `[Task ${taskId} completed: output evicted to archive. Use 'grep' on .sigma/archives/${sessionId}/${taskId}.log if previous logs are needed.]`,
            };
            evictedCount++;
          }
        } else if (Array.isArray(message.content)) {
          let hasTag = false;
          const newContent = message.content.map((part) => {
            if (
              part.type === 'text' &&
              (part.text.includes(tag) || isTurnInRange(i))
            ) {
              hasTag = true;
              return {
                ...part,
                text: shouldInjectSummary
                  ? `[Task ${taskId} completed. Raw logs evicted to archive. \nSUMMARY: ${result_summary}]`
                  : `[Task ${taskId} completed: output evicted to archive. Use 'grep' on .sigma/archives/${sessionId}/${taskId}.log if previous logs are needed.]`,
              };
            }
            if (part.type === 'tool_result') {
              const result =
                typeof part.content === 'string'
                  ? part.content
                  : JSON.stringify(part.content);
              if (result.includes(tag) || isTurnInRange(i)) {
                hasTag = true;
                return {
                  ...part,
                  content: shouldInjectSummary
                    ? `[Task ${taskId} completed. Raw logs evicted to archive. \nSUMMARY: ${result_summary}]`
                    : `[Task ${taskId} completed: output evicted to archive. Use 'grep' on .sigma/archives/${sessionId}/${taskId}.log if previous logs are needed.]`,
                };
              }
            }
            return part;
          });

          if (hasTag || isTurnInRange(i)) {
            evictedLogs.push(JSON.stringify(message, null, 2));
            history[i] = {
              ...message,
              content: newContent as Anthropic.MessageParam['content'],
            };
            evictedCount++;
          }
        }
      }

      if (evictedCount > 0) {
        await archiveTaskLogs({
          projectRoot,
          sessionId,
          taskId,
          evictedLogs,
          result_summary,
        });

        systemLog(
          'sigma',
          `Surgically evicted ${evictedCount} log messages for task ${taskId} (Minimax). ${process.env.DEBUG_ARCHIVE ? 'Archived to disk.' : ''}`
        );
      } else {
        systemLog(
          'sigma',
          `No logs found for eviction for task ${taskId} (Minimax). (history=${history.length}, lastEvictedIndex=${lastEvictedIndex})`,
          { taskId, sessionId, lastEvictedIndex },
          'warn'
        );
      }
    } catch (err) {
      systemLog(
        'sigma',
        `Failed to prune task logs for ${taskId} (Minimax)`,
        { error: err instanceof Error ? err.message : String(err) },
        'error'
      );
    }
  }

  async *executeAgent(
    req: AgentRequest
  ): AsyncGenerator<AgentResponse, void, undefined> {
    const modelId = req.model || this.defaultModel;
    systemLog(
      'minimax',
      'Execute',
      { model: modelId, prompt: req.prompt.length },
      'debug'
    );

    this.abortController = new AbortController();
    const abortSignal = this.abortController.signal;

    const messages: AgentMessage[] = [];
    const history: Anthropic.MessageParam[] = [];
    const sessionId = req.resumeSessionId || `mm-${Date.now()}`;
    let pt = 0,
      ct = 0;
    let turns = 0;
    const maxTurns = 50;

    const userMsg: AgentMessage = {
      id: `u-${Date.now()}`,
      type: 'user',
      role: 'user',
      content: req.prompt,
      timestamp: new Date(),
    };
    messages.push(userMsg);
    history.push({ role: 'user', content: req.prompt });
    yield {
      messages: [...messages],
      sessionId,
      tokens: { prompt: 0, completion: 0, total: 0 },
      numTurns: 0,
      activeModel: modelId,
    };

    const ctx: MinimaxToolsContext = {
      cwd: req.cwd,
      conversationRegistry: req.conversationRegistry as
        | ConversationOverlayRegistry
        | undefined,
      workbenchUrl: req.workbenchUrl,
      onCanUseTool: req.onCanUseTool,
      getTaskManager: req.getTaskManager as
        | (() => BackgroundTaskManager | null)
        | undefined,
      getMessagePublisher: req.getMessagePublisher as
        | (() => MessagePublisher | null)
        | undefined,
      getMessageQueue: req.getMessageQueue as
        | (() => MessageQueue | null)
        | undefined,
      projectRoot: req.projectRoot,
      agentId: req.agentId,
      anchorId: req.anchorId,
      onToolOutput: req.onToolOutput,
      onTaskCompleted: async (
        taskId: string,
        result_summary?: string | null
      ) => {
        await this.pruneTaskLogs(
          taskId,
          result_summary,
          sessionId,
          req.cwd || req.projectRoot || process.cwd(),
          history
        );
      },
      getActiveTaskId: () =>
        req.anchorId
          ? getActiveTaskId(
              req.anchorId,
              req.cwd || req.projectRoot || process.cwd()
            )
          : null,
      mode: req.mode,
      currentPromptTokens: pt,
    };
    const tools = getMinimaxTools(ctx);
    const groundingContext = await getGroundingContext(req);
    const system =
      buildSystemPrompt(req, req.model || this.defaultModel, 'Minimax Agent') +
      (groundingContext
        ? `\n\n## Automated Grounding Context\n${groundingContext}`
        : '');

    while (turns++ < maxTurns) {
      if (abortSignal.aborted) break;

      try {
        const stream = await this.client.messages.stream(
          {
            model: modelId,
            max_tokens: req.maxTokens || 4096,
            temperature: Math.min(Math.max(req.temperature || 1, 0.01), 1.0),
            system,
            messages: history,
            tools:
              tools as unknown as Anthropic.MessageCreateParamsNonStreaming['tools'],
          },
          { signal: abortSignal }
        );

        const currentAssistantContent: Anthropic.ContentBlockParam[] = [];

        for await (const ev of stream) {
          if (abortSignal.aborted) break;

          if (ev.type === 'message_start') {
            pt = ev.message.usage.input_tokens;
          } else if (ev.type === 'content_block_start') {
            const index = ev.index;
            if (ev.content_block.type === 'text') {
              currentAssistantContent[index] = { type: 'text', text: '' };
            } else if (
              (ev.content_block as MinimaxContentBlock).type === 'thinking'
            ) {
              currentAssistantContent[index] = {
                type: 'thinking',
                thinking: '',
              } as ThinkingBlock as Anthropic.ContentBlockParam;
            } else if (ev.content_block.type === 'tool_use') {
              currentAssistantContent[index] = {
                type: 'tool_use',
                id: ev.content_block.id,
                name: ev.content_block.name,
                input: {},
              };
              messages.push({
                id: ev.content_block.id,
                type: 'tool_use',
                role: 'assistant',
                content: '',
                timestamp: new Date(),
                toolName: ev.content_block.name,
                toolInput: {},
              });
              yield {
                messages: [...messages],
                sessionId: req.resumeSessionId || `mm-${Date.now()}`,
                tokens: { prompt: pt, completion: ct, total: pt + ct },
                finishReason: 'tool_use',
                numTurns: turns,
                activeModel: modelId,
              };
            }
          } else if (ev.type === 'content_block_delta') {
            const index = ev.index;
            if (ev.delta.type === 'text_delta') {
              (
                currentAssistantContent[index] as Anthropic.TextBlockParam
              ).text += ev.delta.text;
              messages.push({
                id: `a-${Date.now()}-delta`,
                type: 'assistant',
                role: 'assistant',
                content: ev.delta.text,
                timestamp: new Date(),
              });
              yield {
                messages: [...messages],
                sessionId: req.resumeSessionId || `mm-${Date.now()}`,
                tokens: { prompt: pt, completion: ct, total: pt + ct },
                numTurns: turns,
                activeModel: modelId,
              };
            } else if (
              (ev.delta as MinimaxContentBlockDelta).type === 'thinking_delta'
            ) {
              const thinking = (ev.delta as ThinkingDelta).thinking;
              (currentAssistantContent[index] as ThinkingBlock).thinking +=
                thinking;
              messages.push({
                id: `t-${Date.now()}-delta`,
                type: 'thinking',
                role: 'assistant',
                content: thinking,
                thinking: thinking,
                timestamp: new Date(),
              });
              yield {
                messages: [...messages],
                sessionId: req.resumeSessionId || `mm-${Date.now()}`,
                tokens: { prompt: pt, completion: ct, total: pt + ct },
                numTurns: turns,
                activeModel: modelId,
              };
            } else if (ev.delta.type === 'input_json_delta') {
              const block = currentAssistantContent[index];
              if (block.type === 'tool_use') {
                const b = block as Anthropic.ToolUseBlockParam & {
                  input_accumulator?: string;
                };
                b.input_accumulator =
                  (b.input_accumulator || '') + ev.delta.partial_json;
              }
            }
          } else if (ev.type === 'message_delta') {
            ct += ev.usage.output_tokens;
          }
        }

        await stream.finalMessage();

        // Use manually accumulated content to preserve 'thinking' blocks
        // which might be stripped by the SDK's finalMessage()
        history.push({
          role: 'assistant',
          content: currentAssistantContent.filter((block) => {
            if (block.type === 'text' && !block.text) return false;
            return true;
          }),
        });

        const toolCalls = currentAssistantContent.filter(
          (b) => b.type === 'tool_use'
        ) as Anthropic.ToolUseBlock[];

        if (toolCalls.length > 0) {
          for (const blk of toolCalls) {
            const toolMsg = messages.find((m) => m.id === blk.id);
            if (toolMsg) toolMsg.toolInput = blk.input;

            const result = await executeMinimaxTool(blk.name, blk.input, ctx);
            messages.push({
              id: `r-${blk.id}`,
              type: 'tool_result',
              role: 'user',
              content: result,
              timestamp: new Date(),
              toolName: blk.name,
            });
            history.push({
              role: 'user',
              content: [
                {
                  type: 'tool_result' as const,
                  tool_use_id: blk.id,
                  content: result,
                },
              ],
            });
            yield {
              messages: [...messages],
              sessionId: req.resumeSessionId || `mm-${Date.now()}`,
              tokens: { prompt: pt, completion: ct, total: pt + ct },
              finishReason: 'tool_use',
              numTurns: turns,
              activeModel: modelId,
              toolResult: { name: blk.name, response: result },
            };
          }
        } else {
          break;
        }
      } catch (e) {
        if (abortSignal.aborted) break;
        const em = e instanceof Error ? e.message : String(e);
        systemLog('minimax', 'Error', { error: em }, 'error');
        messages.push({
          id: `e-${Date.now()}`,
          type: 'assistant',
          role: 'assistant',
          content: `Error: ${em}`,
          timestamp: new Date(),
        });
        yield {
          messages: [...messages],
          sessionId: req.resumeSessionId || `mm-${Date.now()}`,
          tokens: { prompt: pt, completion: ct, total: pt + ct },
          finishReason: 'error',
          numTurns: turns,
          activeModel: modelId,
        };
        return;
      }
    }

    yield {
      messages: [...messages],
      sessionId: req.resumeSessionId || `mm-${Date.now()}`,
      tokens: { prompt: pt, completion: ct, total: pt + ct },
      finishReason: 'stop',
      numTurns: turns,
      activeModel: modelId,
    };
  }

  async interrupt(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}
