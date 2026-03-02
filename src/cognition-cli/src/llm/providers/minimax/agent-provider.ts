/**
 * Minimax Agent Provider Implementation
 *
 * Implements AgentProvider using Anthropic SDK with Minimax's Anthropic-compatible API.
 */

import {
  AgentRequest,
  AgentMessage,
} from '../../core/interfaces/agent-provider.js';
import { UnifiedStreamingChunk } from '../../core/types.js';
import { systemLog } from '../../../utils/debug-logger.js';
import {
  CompletionRequest,
  CompletionResponse,
} from '../../core/interfaces/provider.js';
import Anthropic from '@anthropic-ai/sdk';
import { BaseAgentProvider } from '../../core/base-agent-provider.js';
import { ThinkingBudget } from '../../core/utils/thinking-utils.js';
import {
  archiveTaskLogs,
  TASK_LOG_EVICTION_THRESHOLD,
} from '../../core/utils/eviction-utils.js';

interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
}

interface ThinkingDelta {
  type: 'thinking_delta';
  thinking: string;
}

type MinimaxContentBlockDelta = Anthropic.RawContentBlockDelta | ThinkingDelta;
type MinimaxContentBlock = Anthropic.ContentBlockParam | ThinkingBlock;

/**
 * Minimax Agent Provider Implementation
 *
 * Implements AgentProvider by extending BaseAgentProvider.
 * Uses Anthropic SDK with Minimax's Anthropic-compatible API.
 */
export class MinimaxAgentProvider extends BaseAgentProvider {
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

  constructor(options: { apiKey?: string; model?: string } = {}) {
    super();
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

  protected async *internalStream(
    request: AgentRequest,
    context: {
      sessionId: string;
      groundingContext: string;
      thinkingBudget: ThinkingBudget;
      systemPrompt: string;
    }
  ): AsyncGenerator<UnifiedStreamingChunk, void, undefined> {
    const { sessionId, systemPrompt } = context;
    const modelId = request.model || this.defaultModel;

    // 1. Build Tools
    const tools = this.buildTools(
      request,
      'minimax',
      async (taskId: string, result_summary?: string | null) => {
        await this.pruneTaskLogs(
          taskId,
          result_summary,
          sessionId,
          request.cwd || request.projectRoot || process.cwd()
        );
      }
    ) as Anthropic.Tool[];

    let turns = 0;
    const maxTurns = 50;

    while (turns < maxTurns) {
      if (this.abortController?.signal.aborted) break;

      // Map this.messages to Anthropic history
      const history = this.mapMessagesToAnthropic(this.messages);

      try {
        const stream = await this.client.messages.stream(
          {
            model: modelId,
            max_tokens: request.maxTokens || 4096,
            temperature: Math.min(
              Math.max(request.temperature || 1, 0.01),
              1.0
            ),
            system: systemPrompt,
            messages: history,
            tools,
          },
          { signal: this.abortController?.signal }
        );

        let pt = 0;
        let ct = 0;

        for await (const ev of stream) {
          if (this.abortController?.signal.aborted) break;

          if (ev.type === 'message_start') {
            pt = ev.message.usage.input_tokens;
            yield {
              type: 'usage',
              usage: { prompt: pt, completion: 0, total: pt },
            };
          } else if (ev.type === 'content_block_delta') {
            if (ev.delta.type === 'text_delta') {
              yield {
                type: 'text',
                delta: ev.delta.text,
              };
            } else if (
              (ev.delta as MinimaxContentBlockDelta).type === 'thinking_delta'
            ) {
              yield {
                type: 'thinking',
                thought: (ev.delta as ThinkingDelta).thinking,
              };
            }
          } else if (ev.type === 'message_delta') {
            ct = ev.usage.output_tokens;
            yield {
              type: 'usage',
              usage: { prompt: pt, completion: ct, total: pt + ct },
            };
          }
        }

        const finalMsg = await stream.finalMessage();

        const toolCalls = finalMsg.content.filter(
          (c) => c.type === 'tool_use'
        ) as Anthropic.ToolUseBlock[];

        if (toolCalls.length > 0) {
          for (const tc of toolCalls) {
            yield {
              type: 'tool_call',
              toolCall: {
                name: tc.name,
                args: tc.input as Record<string, unknown>,
              },
            };

            // Execute tool
            const result = await this.executeTool(
              tc.name,
              tc.input as Record<string, unknown>,
              tools
            );

            yield {
              type: 'tool_response',
              toolResponse: {
                name: tc.name,
                response: result,
              },
            };

            // rolling prune after tool execution
            const taskId = this.getSigmaTaskId(tc.input);
            if (taskId) {
              await this.rollingPruneTaskLogs(
                taskId,
                sessionId,
                request.cwd || request.projectRoot || process.cwd()
              );
            }
          }
          turns++;
        } else {
          // No more tools, we're done
          break;
        }
      } catch (err) {
        if (this.abortController?.signal.aborted) break;
        throw err;
      }
    }
  }

  private mapMessagesToAnthropic(
    messages: AgentMessage[]
  ): Anthropic.MessageParam[] {
    const history: Anthropic.MessageParam[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      if (msg.type === 'user') {
        history.push({ role: 'user', content: msg.content as string });
      } else if (msg.type === 'assistant' || msg.type === 'thinking') {
        // Find existing assistant message to append to, or start a new one
        let last = history[history.length - 1];
        if (!last || last.role !== 'assistant') {
          last = { role: 'assistant', content: [] };
          history.push(last);
        }

        const content = last.content as MinimaxContentBlock[];
        const lastBlock = content[content.length - 1];

        if (msg.type === 'thinking') {
          if (lastBlock && lastBlock.type === 'thinking') {
            lastBlock.thinking += msg.content;
          } else {
            content.push({
              type: 'thinking',
              thinking: msg.content as string,
            } as ThinkingBlock);
          }
        } else {
          if (lastBlock && lastBlock.type === 'text') {
            lastBlock.text += msg.content;
          } else {
            content.push({ type: 'text', text: msg.content as string });
          }
        }
      } else if (msg.type === 'tool_use') {
        let last = history[history.length - 1];
        if (!last || last.role !== 'assistant') {
          last = { role: 'assistant', content: [] };
          history.push(last);
        }
        const content = last.content as Anthropic.ToolUseBlock[];
        content.push({
          type: 'tool_use',
          id: msg.id,
          name: msg.toolName!,
          input: msg.toolInput as Record<string, unknown>,
        });
      } else if (msg.type === 'tool_result') {
        history.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.id.startsWith('r-')
                ? msg.id.substring(2)
                : msg.id,
              content: msg.content as string,
            },
          ],
        });
      }
    }

    // Filter out empty assistant messages
    return history.filter((h) => {
      if (h.role === 'assistant' && Array.isArray(h.content)) {
        return h.content.length > 0;
      }
      return true;
    });
  }

  private async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    tools: Anthropic.Tool[]
  ): Promise<string> {
    const tool = tools.find((t) => t.name === toolName) as unknown as {
      execute?: (args: Record<string, unknown>) => Promise<string>;
    };
    if (!tool || !tool.execute) {
      return `Tool ${toolName} not found or not executable.`;
    }

    try {
      return await tool.execute(args);
    } catch (error) {
      return `Error executing tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private getSigmaTaskId(input: unknown): string | null {
    if (typeof input === 'object' && input !== null) {
      const inp = input as { todos?: Array<{ id: string }> };
      if (inp.todos && Array.isArray(inp.todos) && inp.todos.length > 0) {
        return inp.todos[0].id;
      }
    }
    return null;
  }

  private async rollingPruneTaskLogs(
    taskId: string,
    sessionId: string,
    projectRoot: string,
    threshold: number = TASK_LOG_EVICTION_THRESHOLD
  ) {
    // Note: Rolling prune for Minimax now works by modifying this.messages directly
    // since BaseAgentProvider manages history in memory.
    try {
      const tag = `<!-- sigma-task: ${taskId} -->`;
      const taggedIndices: number[] = [];

      for (let i = 0; i < this.messages.length; i++) {
        const msg = this.messages[i];
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
        const msg = this.messages[idx];
        evictedLogs.push(JSON.stringify(msg, null, 2));

        const toolTombstone = `[Tool output for task ${taskId} evicted (Rolling Prune) to keep context small. Use 'grep' on .sigma/archives/${sessionId}/${taskId}.log if previous logs are needed.]`;

        if (typeof msg.content === 'string') {
          this.messages[idx] = { ...msg, content: toolTombstone };
        }
        // Minimax doesn't currently use complex content blocks for tool results in AgentMessage
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

  private async pruneTaskLogs(
    taskId: string,
    result_summary: string | null | undefined,
    sessionId: string,
    projectRoot: string
  ) {
    try {
      const tag = `<!-- sigma-task: ${taskId} -->`;
      const evictedLogs: string[] = [];
      let evictedCount = 0;

      // Pass 0: Identify task range
      let startIndex = -1;
      for (let i = 0; i < this.messages.length; i++) {
        const msg = this.messages[i];
        if (msg.type === 'tool_use' && msg.toolName === 'SigmaTaskUpdate') {
          const input = msg.toolInput as {
            todos?: Array<{ id: string; status: string }>;
          };
          if (
            input.todos?.some(
              (t) => t.id === taskId && t.status === 'in_progress'
            )
          ) {
            startIndex = i;
          }
        }
      }

      const isTurnInRange = (index: number) => {
        if (startIndex === -1 || index <= startIndex) return false;
        const msg = this.messages[index];
        if (msg.role === 'user') return false;
        if (msg.type === 'tool_use' && msg.toolName === 'SigmaTaskUpdate') {
          const input = msg.toolInput as {
            todos?: Array<{ id: string; status: string }>;
          };
          if (
            input.todos?.some(
              (t) => t.id === taskId && t.status === 'completed'
            )
          ) {
            return false;
          }
        }
        return true;
      };

      for (let i = 0; i < this.messages.length; i++) {
        const msg = this.messages[i];
        const contentStr =
          typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content);

        if (contentStr.includes(tag) || isTurnInRange(i)) {
          evictedLogs.push(JSON.stringify(msg, null, 2));
          this.messages[i] = {
            ...msg,
            content: result_summary
              ? `[Task ${taskId} completed. Raw logs evicted to archive. \nSUMMARY: ${result_summary}]`
              : `[Task ${taskId} completed: output evicted to archive. Use 'grep' on .sigma/archives/${sessionId}/${taskId}.log if previous logs are needed.]`,
          };
          evictedCount++;
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
          `Surgically evicted ${evictedCount} log messages for task ${taskId} (Minimax).`
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
}
