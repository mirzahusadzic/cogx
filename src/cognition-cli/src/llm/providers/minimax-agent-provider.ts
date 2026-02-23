/**
 * Minimax Agent Provider Implementation
 *
 * Implements AgentProvider using Anthropic SDK with Minimax's Anthropic-compatible API.
 */

import { getGroundingContext } from './grounding-utils.js';
import { systemLog } from '../../utils/debug-logger.js';
import { getActiveTaskId } from '../../sigma/session-state.js';
import Anthropic from '@anthropic-ai/sdk';
import type { ConversationOverlayRegistry } from '../../sigma/conversation-registry.js';
import type { BackgroundTaskManager } from '../../tui/services/BackgroundTaskManager.js';
import type { MessagePublisher } from '../../ipc/MessagePublisher.js';
import type { MessageQueue } from '../../ipc/MessageQueue.js';
import type {
  AgentProvider,
  AgentRequest,
  AgentResponse,
  AgentMessage,
} from '../agent-provider-interface.js';
import type {
  CompletionRequest,
  CompletionResponse,
} from '../provider-interface.js';

import {
  getMinimaxTools,
  executeMinimaxTool,
  type MinimaxToolsContext,
} from './minimax-agent-tools.js';
import { archiveTaskLogs } from './eviction-utils.js';

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
   * Prune tool logs for a completed task and archive them.
   */
  private async pruneTaskLogs(
    taskId: string,
    result_summary: string | undefined,
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
      finishReason: 'stop',
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
      onTaskCompleted: async (taskId: string, result_summary?: string) => {
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
    const system = this.buildSystemPrompt(
      req,
      sessionId,
      await getGroundingContext(req)
    );

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
                finishReason: 'stop',
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
                finishReason: 'stop',
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

  private buildSystemPrompt(
    req: AgentRequest,
    sessionId: string,
    ground?: string
  ): string {
    const modelName = req.model || this.defaultModel;
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const toolSections: string[] = [];

    toolSections.push(`### Core File Tools
- **read_file**: Read file contents (use offset/limit for large files)
- **write_file**: Write content to files
- **glob**: Find files matching patterns (e.g., "**/*.ts")
- **grep**: Search code with ripgrep
- **bash**: Execute shell commands (git, npm, etc.)
- **edit_file**: Make targeted text replacements
- **SigmaTaskUpdate**: Update the task list to track progress and maintain state across the session

### Web Tools
- **fetch_url**: Fetch content from URLs (documentation, APIs, external resources)
- **WebSearch**: Search the web for current information`);

    if (req.conversationRegistry) {
      toolSections.push(`### Memory Tools
- **recall_past_conversation**: Retrieve FULL context from conversation history (uses semantic search across O1-O7 overlays)`);
    }

    if (req.getTaskManager) {
      toolSections.push(`### Background Tasks
- **get_background_tasks**: Query status of background operations`);
    }

    if (req.mode !== 'solo' && req.getMessagePublisher && req.getMessageQueue) {
      toolSections.push(`### Agent Messaging (IPC)
- **list_agents**: Discover other active agents
- **send_agent_message**: Send a message to a specific agent
- **broadcast_agent_message**: Broadcast to ALL agents
- **list_pending_messages**: List messages in your queue
- **mark_message_read**: Mark messages as processed
- **query_agent**: Query agents in other repositories`);
    }

    const appendInfo =
      req.systemPrompt?.type === 'preset' && req.systemPrompt.append
        ? req.systemPrompt.append
        : '';

    const isSolo = req.mode === 'solo';

    const delegationExample = isSolo
      ? ''
      : `
**Example 3: Delegating a task (Manager/Worker Pattern)**
User: "Delegate the database migration to gemini2"
You should:
1. List agents to confirm 'gemini2' exists and get their ID
2. Use SigmaTaskUpdate to create a task:
   - status: "delegated"
   - delegated_to: "gemini2"
   - acceptance_criteria: ["Migration script created", "Tests passed"]
   - content: "Create database migration for new schema"
3. Use send_agent_message to dispatch the task to gemini2
4. Wait for gemini2 to report back via IPC
5. Verify criteria and mark task as completed

### IPC Message Format for Delegation

When delegating via send_agent_message, use this structured format:

**Manager → Worker (Task Assignment):**
\`\`\`json
{
  "type": "task_assignment",
  "task_id": "migrate-db-schema",
  "content": "Create database migration for new user fields",
  "acceptance_criteria": [
    "Migration script created in migrations/",
    "All tests pass",
    "No breaking changes to existing API"
  ],
  "context": "Adding OAuth fields to user table - keep existing auth flow intact"
}
\`\`\`

**Worker → Manager (Task Completion):**
\`\`\`json
{
  "type": "task_completion",
  "task_id": "migrate-db-schema",
  "status": "completed",
  "result_summary": "Created migration 20250120_add_oauth_fields.sql. All 127 tests passing. No API changes required."
}
\`\`\`

**Worker → Manager (Task Blocked):**
\`\`\`json
{
  "type": "task_status",
  "task_id": "migrate-db-schema",
  "status": "blocked",
  "blocker": "Need database credentials for staging environment",
  "requested_action": "Please provide DB_HOST and DB_PASSWORD for staging"
}
\`\`\`
`;

    const memoryRules = `
### 🧠 MEMORY & EVICTION RULES (CRITICAL)
1. **The "Amnesia" Warning**: When you mark a task as \`completed\`, the system IMMEDIATELY deletes all tool outputs (file reads, grep results, bash logs) associated with that task.
2. **Distill Before Dying**: You are FORBIDDEN from completing a task until you have saved the *essential findings* into the \`result_summary\` field of \`SigmaTaskUpdate\`.
3. **Verification**: Before calling \`SigmaTaskUpdate(status='completed')\`, ask yourself: "If I lose all my previous logs right now, do I have enough info in the summary to continue?"
`;

    const taskStateRules = isSolo
      ? `### Task State Rules
1. **Task States**: pending (not started), in_progress (currently working), completed (finished)
2. **Task-First (Token Health)**: ALWAYS mark a task as \`in_progress\` BEFORE running tools (research, read_file, bash, etc.). This ensures tool outputs are tagged with the active task ID for surgical context eviction upon completion.
3. **One at a time**: Exactly ONE task should be in_progress at any time
4. **Immediate completion**: Mark tasks complete IMMEDIATELY after finishing to trigger log eviction and reclaim tokens. **CRITICAL: You must update the status of the specific task 'id' to 'completed'. Replacing the whole task list will NOT trigger eviction.**
5. **Persistence via Summary**: The raw logs of a completed task (file contents, grep results) WILL BE DELETED immediately.
   - You MUST distill all critical findings into the \`result_summary\` field of SigmaTaskUpdate.
   - Do not write "Done" or "Found it". Write "Found API key in config.ts line 45" or "UserController.ts handles auth logic".
   - If the \`result_summary\` is empty or vague, you will lose the knowledge required for subsequent tasks.
6. **Honest completion**: ONLY mark completed when FULLY accomplished - if blocked, keep in_progress and add a new task for the blocker.
7. **Both forms required**: Always provide content (imperative: "Fix bug") AND activeForm (continuous: "Fixing bug")`
      : `### Task State Rules
1. **Task States**: pending (not started), in_progress (currently working), completed (finished), delegated (assigned to another agent)
2. **Task-First (Token Health)**: ALWAYS mark a task as \`in_progress\` BEFORE running tools (research, read_file, bash, etc.). This ensures tool outputs are tagged with the active task ID for surgical context eviction upon completion.
3. **One at a time**: Exactly ONE task should be in_progress at any time
4. **Delegation**: When delegating, set status to 'delegated' AND send IPC message. Do not mark completed until worker reports back.
5. **Immediate completion**: Mark tasks complete IMMEDIATELY after finishing to trigger log eviction and reclaim tokens. **CRITICAL: You must update the status of the specific task 'id' to 'completed'. Replacing the whole task list will NOT trigger eviction.**
6. **Persistence via Summary**: The raw logs of a completed task (file contents, grep results) WILL BE DELETED immediately.
   - You MUST distill all critical findings into the \`result_summary\` field of SigmaTaskUpdate.
   - Do not write "Done" or "Found it". Write "Found API key in config.ts line 45" or "UserController.ts handles auth logic".
   - If the \`result_summary\` is empty or vague, you will lose the knowledge required for subsequent tasks.
7. **Honest completion**: ONLY mark completed when FULLY accomplished - if blocked, keep in_progress and add a new task for the blocker.
8. **Both forms required**: Always provide content (imperative: "Fix bug") AND activeForm (continuous: "Fixing bug")`;

    const base = `You are **${modelName}** running inside **Cognition Σ (Sigma) CLI** - a verifiable AI-human symbiosis architecture with dual-lattice knowledge representation.

**Current Date**: ${currentDate}

## What is Cognition Σ?
A portable cognitive layer that can be initialized in **any repository**. Creates \`.sigma/\` (conversation memory) and \`.open_cognition/\` (PGC project knowledge store) in the current working directory.

${memoryRules}

## Your Capabilities

${toolSections.join('\n\n')}

## Guidelines
- Be concise and helpful
- **Reasoning First**: For any complex operation or tool call (especially \`SigmaTaskUpdate\`, \`edit_file\`${isSolo ? '' : ', or IPC delegation'}), you MUST engage your internal reasoning/thinking process first to plan the action and validate parameters. **CRITICAL: NEVER include the JSON for SigmaTaskUpdate in your assistant response text. ONLY use it as the direct input to the SigmaTaskUpdate tool call.**
  When planning \`SigmaTaskUpdate\`, ensure your JSON structure matches the parallel array pattern (inside your internal thought block, not the response):
  \`\`\`json
  {
    "todos": [
      { "id": "task-1", "content": "Task description", "activeForm": "Doing task", "status": "completed", "result_summary": "Summary of findings (min 15 chars)" }
    ]${
      isSolo
        ? ''
        : `,
    "grounding": [
      { "id": "task-1", "strategy": "pgc_first" }
    ]`
    }
  }
  \`\`\`
- Use tools proactively to gather context before answering
- When making changes, explain what you're doing briefly
- Prefer editing existing files over creating new ones
- Run tests after making code changes
- **ALWAYS use the bash tool for shell commands** (git, npm, test, build, etc.)

## Task Management
You have access to the SigmaTaskUpdate tool to help you manage and plan tasks. Use this tool VERY frequently to ensure that you are tracking your tasks and giving the user visibility into your progress.
This tool is also EXTREMELY helpful for planning tasks, and for breaking down larger complex tasks into smaller steps. If you do not use this tool when planning, you may forget to do important tasks - and that is unacceptable.
**Planning in your internal thought blocks before calling SigmaTaskUpdate ensures reliable task tracking and prevents malformed tool arguments.**

It is critical that you mark tasks as completed as soon as you are done with a task. Do not batch up multiple tasks before marking them as completed.

### Semantic Checkpointing (TPM Optimization)
- **Trigger Compression**: Use \`SigmaTaskUpdate\` to mark a task as \`completed\` to trigger "Semantic Compression". This flushes implementation noise (logs, previous file reads) while keeping your high-level plan in context.
- **Proactive Management**: If you see a \`<token-pressure-warning>\`, it means your context is getting large (~50k+ tokens). You should aim to finish your current sub-task and mark it completed to clear the air before starting the next phase.

### Examples of Task Management

**Example 1: Multi-step task with tests**
User: "Run the build and fix any type errors"
You should:
1. Use SigmaTaskUpdate to create items: "Run the build", "Fix any type errors"
2. Run the build using bash
3. If you find 10 type errors, use SigmaTaskUpdate to add 10 items for each error
4. Mark the first task as in_progress
5. Work on the first item, then mark it as completed
6. Continue until all items are done

**Example 2: Feature implementation**
User: "Help me write a new feature that allows users to track their usage metrics and export them to various formats"
You should:
1. Use SigmaTaskUpdate to plan: Research existing metrics, Design system, Implement core tracking, Create export functionality
2. Start by researching the existing codebase
3. Mark items in_progress as you work, completed when done
${delegationExample}
**Example ${isSolo ? '3' : '4'}: When NOT to use SigmaTaskUpdate**
User: "How do I print 'Hello World' in Python?"
Do NOT use SigmaTaskUpdate - this is a simple, trivial task with no multi-step implementation.

User: "Add a comment to the calculateTotal function"
Do NOT use SigmaTaskUpdate - this is a single, straightforward task.

${taskStateRules}

IMPORTANT: Always use the SigmaTaskUpdate tool to plan and track tasks throughout the conversation.

## Token Economy (IMPORTANT - Each tool call costs tokens!)
- **NEVER re-read files you just edited**
- **Use glob/grep BEFORE read_file**
- **Batch operations** - plan which files first, then read them efficiently
- **Use limit/offset for large files**
- **Prefer git diff or reading specific line ranges; avoid reading full files.**
- **Summarize don't quote** - explain findings concisely rather than quoting entire file contents`;

    const sys = req.systemPrompt?.custom || base;
    return req.systemPrompt?.append
      ? `${sys}\n\n${appendInfo}`
      : ground
        ? `${sys}\n\n## Automated Grounding Context\n${ground}`
        : sys;
  }
}
