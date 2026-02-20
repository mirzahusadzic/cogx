/**
 * ADK Tool Definitions for Gemini Agent Provider
 *
 * Maps Cognition tools to Google ADK FunctionTool format.
 * Uses shared tool executors from tool-executors.ts and tool-helpers.ts.
 */

import { FunctionTool } from '@google/adk';
import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import { systemLog } from '../../utils/debug-logger.js';
import type { MessagePublisher } from '../../ipc/MessagePublisher.js';
import type { MessageQueue } from '../../ipc/MessageQueue.js';
import {
  formatListAgents,
  formatMessageSent,
  formatBroadcastSent,
  formatPendingMessages,
  formatMessageMarked,
  formatMessageContent,
  formatError,
  formatNotInitialized,
  formatNotFound,
} from '../../ipc/agent-messaging-formatters.js';
import { getActiveAgents, resolveAgentId } from '../../ipc/agent-discovery.js';
import type { ConversationOverlayRegistry } from '../../sigma/conversation-registry.js';
import { queryConversationLattice } from '../../sigma/query-conversation.js';
import type { BackgroundTaskManager } from '../../tui/services/BackgroundTaskManager.js';
import type { OnCanUseTool } from './tool-helpers.js';
import {
  formatTaskType,
  formatDuration,
  getSigmaTaskUpdateDescription,
} from './tool-helpers.js';
import {
  executeReadFile,
  executeWriteFile,
  executeGlob,
  executeGrep,
  executeBash,
  executeEditFile,
  executeSigmaTaskUpdate,
  executeFetchUrl,
} from './tool-executors.js';

/**
 * Helper to coerce string | number to number
 */
const coerceNumber = (val: string | number | undefined): number | undefined => {
  if (val === undefined) return undefined;
  if (typeof val === 'number') return val;
  const parsed = Number(val);
  return isNaN(parsed) ? undefined : parsed;
};

/**
 * Helper to coerce string | boolean to boolean
 */
const coerceBoolean = (
  val: string | boolean | undefined
): boolean | undefined => {
  if (val === undefined) return undefined;
  if (typeof val === 'boolean') return val;
  return val === 'true';
};

/**
 * Create recall conversation tool for Gemini
 *
 * Provides semantic search across conversation history (O1-O7 overlays).
 * Similar to Claude's recall_past_conversation MCP tool.
 */
export function createRecallTool(
  conversationRegistry: ConversationOverlayRegistry,
  workbenchUrl?: string
): FunctionTool {
  return new FunctionTool({
    name: 'recall_past_conversation',
    description:
      'Retrieve FULL untruncated messages from conversation history. The recap you see is truncated to 256 chars - when you see "..." it means more content is available. Use this tool to get complete details. Searches all 7 overlays (O1-O7) in LanceDB with semantic search. Ask about topics, not exact phrases.',
    parameters: z.object({
      query: z
        .string()
        .describe(
          'What to search for in past conversation (e.g., "What did we discuss about TUI scrolling?" or "What were the goals mentioned?")'
        ),
    }),
    execute: async ({ query }) => {
      if (process.env.DEBUG_GEMINI_TOOLS) {
        systemLog(
          'gemini-tools',
          'recall_past_conversation input',
          { query },
          'debug'
        );
      }
      try {
        // Query conversation lattice with SLM + LLM synthesis
        const answer = await queryConversationLattice(
          query,
          conversationRegistry,
          {
            workbenchUrl,
            topK: 10, // Increased from 5 for better coverage
            verbose: false,
          }
        );

        return `Found relevant context:\n\n${answer}`;
      } catch (err) {
        return `Failed to recall conversation: ${(err as Error).message}`;
      }
    },
  });
}

/**
 * Create a safe wrapper for a tool that calls onCanUseTool before execution
 *
 * This bridges the gap between ADK (which doesn't have built-in permission checks)
 * and our TUI's confirmation system (which expects onCanUseTool to be called).
 */
function wrapToolWithPermission<T extends z.ZodRawShape>(
  name: string,
  description: string,
  parameters: z.ZodObject<T>,
  originalExecute: (input: z.infer<z.ZodObject<T>>) => Promise<unknown>,
  onCanUseTool?: OnCanUseTool
): FunctionTool {
  if (!onCanUseTool) {
    // If no callback provided, return original tool
    return new FunctionTool({
      name,
      description,
      parameters,
      execute: originalExecute as (input: unknown) => Promise<unknown>,
    });
  }

  return new FunctionTool({
    name,
    description,
    parameters,
    execute: async (input: unknown) => {
      // Call permission callback
      const decision = await onCanUseTool(name, input);

      // If denied, return denial message
      if (decision.behavior === 'deny') {
        return `User declined this action. Please continue with alternative approaches without asking why.`;
      }

      // Execute with potentially updated input
      const finalInput = decision.updatedInput ?? input;
      return originalExecute(finalInput as z.infer<z.ZodObject<T>>);
    },
  });
}

/**
 * Create background tasks tool for Gemini
 *
 * Allows Gemini to query status of background operations (genesis, overlay generation).
 */
function createBackgroundTasksTool(
  getTaskManager: () => BackgroundTaskManager | null
): FunctionTool {
  return new FunctionTool({
    name: 'get_background_tasks',
    description:
      'Query status of background operations (genesis, overlay generation). Use this to check if work is in progress, view progress percentage, or see completed/failed tasks.',
    parameters: z.object({
      filter: z
        .enum(['all', 'active', 'completed', 'failed'])
        .optional()
        .describe(
          'Filter tasks by status: "all" (default) for everything, "active" for running/pending, "completed" for finished, "failed" for errors'
        ),
    }),
    execute: async ({ filter: filterArg }) => {
      if (process.env.DEBUG_GEMINI_TOOLS) {
        systemLog(
          'gemini-tools',
          'get_background_tasks input',
          { filter: filterArg },
          'debug'
        );
      }
      const filter = filterArg || 'all';
      try {
        const taskManager = getTaskManager();

        if (!taskManager) {
          return 'Background task manager not initialized. No background operations are running.';
        }

        const allTasks = taskManager.getAllTasks();

        // Filter tasks based on requested filter
        let filteredTasks;
        switch (filter) {
          case 'active':
            filteredTasks = allTasks.filter(
              (t) => t.status === 'running' || t.status === 'pending'
            );
            break;
          case 'completed':
            filteredTasks = allTasks.filter((t) => t.status === 'completed');
            break;
          case 'failed':
            filteredTasks = allTasks.filter(
              (t) => t.status === 'failed' || t.status === 'cancelled'
            );
            break;
          default:
            filteredTasks = allTasks;
        }

        const summary = taskManager.getSummary();
        const activeTask = taskManager.getActiveTask();

        // Format response for Gemini
        let text = '';

        if (activeTask) {
          const progress =
            activeTask.progress !== undefined
              ? ` (${Math.round(activeTask.progress)}%)`
              : '';
          text += `**Active Task**: ${formatTaskType(activeTask)}${progress}\n`;
          if (activeTask.message) {
            text += `  Status: ${activeTask.message}\n`;
          }
          text += '\n';
        } else {
          text += '**No active tasks** - all background operations idle.\n\n';
        }

        text += `**Summary**: ${summary.total} total tasks\n`;
        text += `  - Active: ${summary.active}\n`;
        text += `  - Completed: ${summary.completed}\n`;
        text += `  - Failed: ${summary.failed}\n`;
        text += `  - Cancelled: ${summary.cancelled}\n\n`;

        if (filteredTasks.length > 0 && filter !== 'all') {
          text += `**${filter.charAt(0).toUpperCase() + filter.slice(1)} Tasks** (${filteredTasks.length}):\n`;
          for (const task of filteredTasks) {
            const progress =
              task.progress !== undefined
                ? ` ${Math.round(task.progress)}%`
                : '';
            const duration = task.completedAt
              ? ` (${formatDuration(task.startedAt, task.completedAt)})`
              : '';
            text += `  - ${formatTaskType(task)}:${progress}${duration}\n`;
            if (task.error) {
              text += `    Error: ${task.error}\n`;
            }
          }
        }

        return text;
      } catch (err) {
        return `Failed to get background tasks: ${(err as Error).message}`;
      }
    },
  });
}

/**
 * Create agent messaging tools for Gemini
 *
 * Allows Gemini to discover other agents, send messages, and read pending messages.
 */
function createAgentMessagingTools(
  getMessagePublisher: (() => MessagePublisher | null) | undefined,
  getMessageQueue: (() => MessageQueue | null) | undefined,
  projectRoot: string,
  currentAgentId: string,
  onCanUseTool?: OnCanUseTool
): FunctionTool[] {
  const tools: FunctionTool[] = [];

  // Tool: List active agents
  const listAgentsTool = wrapToolWithPermission(
    'list_agents',
    'List all active agents in the IPC bus. Returns agent aliases, models, and status. Use this to discover other agents before sending messages.',
    z.object({}),
    async (rawInput: unknown) => {
      if (process.env.DEBUG_GEMINI_TOOLS) {
        systemLog('gemini-tools', 'list_agents input', { rawInput }, 'debug');
      }
      try {
        const agents = getActiveAgents(projectRoot, currentAgentId);
        return formatListAgents(agents);
      } catch (err) {
        return formatError('list agents', (err as Error).message);
      }
    },
    onCanUseTool
  );
  tools.push(listAgentsTool);

  // Tool: Send message to agent
  const sendMessageTool = wrapToolWithPermission(
    'send_agent_message',
    'Send a message to another agent. The recipient will see it in their pending messages. Use list_agents first to discover available agents.',
    z.object({
      to: z
        .string()
        .describe(
          'Target agent alias (e.g., "opus1", "sonnet2") or full agent ID'
        ),
      message: z.string().describe('The message content to send'),
    }),
    async (rawInput: { to: string; message: string }) => {
      if (process.env.DEBUG_GEMINI_TOOLS) {
        systemLog(
          'gemini-tools',
          'send_agent_message input',
          { rawInput },
          'debug'
        );
      }
      const args = rawInput;
      try {
        const publisher = getMessagePublisher ? getMessagePublisher() : null;

        if (!publisher) {
          return formatNotInitialized('Message publisher');
        }

        // Resolve alias to agent ID
        const targetAgentId = resolveAgentId(projectRoot, args.to);

        if (!targetAgentId) {
          return formatNotFound('agent', args.to);
        }

        // Send the message
        await publisher.sendMessage(targetAgentId, args.message);

        return formatMessageSent(args.to, targetAgentId, args.message);
      } catch (err) {
        return formatError('send message', (err as Error).message);
      }
    },
    onCanUseTool
  );
  tools.push(sendMessageTool);

  // Tool: Broadcast message to all agents
  const broadcastTool = wrapToolWithPermission(
    'broadcast_agent_message',
    'Broadcast a message to ALL active agents. Use sparingly - prefer send_agent_message for targeted communication.',
    z.object({
      message: z.string().describe('The message content to broadcast'),
    }),
    async (rawInput: { message: string }) => {
      if (process.env.DEBUG_GEMINI_TOOLS) {
        systemLog(
          'gemini-tools',
          'broadcast_agent_message input',
          { rawInput },
          'debug'
        );
      }
      const args = rawInput;
      try {
        const publisher = getMessagePublisher ? getMessagePublisher() : null;

        if (!publisher) {
          return formatNotInitialized('Message publisher');
        }

        // Broadcast to all agents
        await publisher.broadcast('agent.message', {
          type: 'text',
          message: args.message,
        });

        const agents = getActiveAgents(projectRoot, currentAgentId);

        return formatBroadcastSent(agents.length, args.message);
      } catch (err) {
        return formatError('broadcast message', (err as Error).message);
      }
    },
    onCanUseTool
  );
  tools.push(broadcastTool);

  // Tool: List pending messages
  const listPendingMessagesTool = wrapToolWithPermission(
    'list_pending_messages',
    'List all pending messages in your message queue. These are messages from other agents that you have not yet processed. DO NOT poll this tool - the system will notify you automatically when a new message arrives.',
    z.object({}),
    async (rawInput: unknown) => {
      if (process.env.DEBUG_GEMINI_TOOLS) {
        systemLog(
          'gemini-tools',
          'list_pending_messages input',
          { rawInput },
          'debug'
        );
      }
      try {
        const queue = getMessageQueue ? getMessageQueue() : null;

        if (!queue) {
          return formatNotInitialized('Message queue');
        }

        const messages = await queue.getMessages('pending');

        return formatPendingMessages(messages);
      } catch (err) {
        return formatError('list pending messages', (err as Error).message);
      }
    },
    onCanUseTool
  );
  tools.push(listPendingMessagesTool);

  // Tool: Mark message as read/injected
  const markMessageReadTool = wrapToolWithPermission(
    'mark_message_read',
    'Mark a pending message as read/processed. Use this after you have handled a message from another agent.',
    z.object({
      messageId: z.string().describe('The message ID to mark as read'),
      status: z
        .enum(['read', 'injected', 'dismissed'])
        .optional()
        .describe(
          'New status: "injected" (default/processed), "read" (seen), or "dismissed" (ignored)'
        ),
    }),
    async (rawInput: {
      messageId: string;
      status?: 'read' | 'injected' | 'dismissed';
    }) => {
      if (process.env.DEBUG_GEMINI_TOOLS) {
        systemLog(
          'gemini-tools',
          'mark_message_read input',
          { rawInput },
          'debug'
        );
      }
      const args = rawInput;
      try {
        const queue = getMessageQueue ? getMessageQueue() : null;

        if (!queue) {
          return formatNotInitialized('Message queue');
        }

        const message = await queue.getMessage(args.messageId);

        if (!message) {
          return formatNotFound('Message', args.messageId);
        }

        const newStatus = args.status || 'injected';
        await queue.updateStatus(args.messageId, newStatus);

        return formatMessageMarked(
          args.messageId,
          newStatus,
          message.from,
          formatMessageContent(message)
        );
      } catch (err) {
        return formatError('mark message', (err as Error).message);
      }
    },
    onCanUseTool
  );
  tools.push(markMessageReadTool);

  // Tool: Query another agent (cross-project semantic query)
  const queryAgentTool = wrapToolWithPermission(
    'query_agent',
    'Ask a semantic question to another agent and get a grounded answer based on their Grounded Context Pool (PGC). Use this to query agents working in different repositories. Example: query_agent("egemma_agent", "How does the lattice merger handle conflicts?")',
    z.object({
      target_alias: z
        .string()
        .describe(
          'Target agent alias (e.g., "opus1", "sonnet2") or full agent ID'
        ),
      question: z
        .string()
        .describe('The semantic question to ask about their codebase'),
    }),
    async (rawInput: { target_alias: string; question: string }) => {
      if (process.env.DEBUG_GEMINI_TOOLS) {
        systemLog('gemini-tools', 'query_agent input', { rawInput }, 'debug');
      }
      const args = rawInput;
      try {
        const publisher = getMessagePublisher ? getMessagePublisher() : null;
        const queue = getMessageQueue ? getMessageQueue() : null;

        if (!publisher || !queue) {
          return formatNotInitialized('Message publisher or queue');
        }

        // Resolve alias to agent ID
        const targetAgentId = resolveAgentId(projectRoot, args.target_alias);

        if (!targetAgentId) {
          return formatNotFound('agent', args.target_alias);
        }

        // Generate unique query ID for request/response correlation
        const queryId = crypto.randomUUID();

        // Send the query to the target agent
        await publisher.sendMessage(
          targetAgentId,
          JSON.stringify({
            type: 'query_request',
            queryId,
            question: args.question,
          })
        );

        // Wait for response (60s timeout)
        const TIMEOUT_MS = 60000;
        const startTime = Date.now();

        while (Date.now() - startTime < TIMEOUT_MS) {
          const messages = await queue.getMessages('pending');

          for (const msg of messages) {
            let responseData: { queryId: string; answer: string } | null = null;

            // Check if it's a direct query_response object
            if (
              msg.content &&
              typeof msg.content === 'object' &&
              'type' in msg.content &&
              msg.content.type === 'query_response' &&
              'queryId' in msg.content &&
              msg.content.queryId === queryId &&
              'answer' in msg.content
            ) {
              responseData = msg.content as { queryId: string; answer: string };
            }
            // Check if it's a text message with JSON-encoded query_response
            else if (
              msg.content &&
              typeof msg.content === 'object' &&
              'type' in msg.content &&
              msg.content.type === 'text' &&
              'message' in msg.content &&
              typeof msg.content.message === 'string'
            ) {
              try {
                const parsed = JSON.parse(msg.content.message);
                if (
                  parsed.type === 'query_response' &&
                  parsed.queryId === queryId &&
                  parsed.answer
                ) {
                  responseData = parsed;
                }
              } catch {
                // Not JSON, continue
              }
            }

            if (responseData) {
              // Found our response!
              const answer = responseData.answer;

              // Mark message as processed
              await queue.updateStatus(msg.id, 'injected');

              return `Query: "${args.question}"\n\nAnswer from ${args.target_alias}:\n\n${answer}`;
            }
          }

          // Poll every 500ms
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Timeout - no response received
        return `⏱️ Timeout: No response from ${args.target_alias} after ${TIMEOUT_MS / 1000}s. The agent may be offline or busy.`;
      } catch (err) {
        return formatError('query agent', (err as Error).message);
      }
    },
    onCanUseTool
  );
  tools.push(queryAgentTool);

  return tools;
}

/**
 * Providers that support external SigmaTaskUpdate implementation
 *
 * All providers now use SigmaTaskUpdate for unified task management:
 * - Gemini: No native task tracking - uses SigmaTaskUpdate
 * - OpenAI: No native task tracking - uses SigmaTaskUpdate
 * - Claude: Has native TodoWrite in SDK, but we override it with SigmaTaskUpdate
 *           because native TodoWrite lacks delegation support needed for Manager/Worker pattern
 */
const PROVIDERS_WITH_EXTERNAL_TASK_UPDATE: Record<string, boolean> = {
  gemini: true,
  openai: true,
  claude: true,
};

/**
 * Options for getCognitionTools
 */
export interface CognitionToolsOptions {
  /** LLM provider name (gemini, openai, claude) */
  provider?: string;
  /** Session anchor ID for SigmaTaskUpdate state persistence */
  anchorId?: string;
  /** Callback for streaming tool output */
  onToolOutput?: (output: string) => void;
  /** Operation mode (solo = skip IPC/PGC tools) */
  mode?: 'solo' | 'full';
  /** Current prompt tokens for dynamic optimization */
  currentPromptTokens?: number;
}

/**
 * Get all ADK tools for Cognition
 *
 * Tool safety/confirmation is handled via onCanUseTool callback (matching Claude's behavior).
 * Each tool is wrapped to call onCanUseTool before execution.
 *
 * @param conversationRegistry - Optional conversation registry for recall tool
 * @param workbenchUrl - Optional workbench URL
 * @param onCanUseTool - Optional permission callback
 * @param getTaskManager - Optional task manager getter
 * @param getMessagePublisher - Optional message publisher getter
 * @param getMessageQueue - Optional message queue getter
 * @param projectRoot - Project root directory
 * @param currentAgentId - Current agent ID for messaging
 * @param options - Additional options (provider, anchorId)
 */
export function getCognitionTools(
  conversationRegistry?: ConversationOverlayRegistry,
  workbenchUrl?: string,
  onCanUseTool?: OnCanUseTool,
  getTaskManager?: () => BackgroundTaskManager | null,
  getMessagePublisher?: () => MessagePublisher | null,
  getMessageQueue?: () => MessageQueue | null,
  projectRoot?: string,
  currentAgentId?: string,
  options?: CognitionToolsOptions
): FunctionTool[] {
  // Create write_file tool with permission check
  const safeWriteFile = wrapToolWithPermission(
    'write_file',
    'Write content to a file at the given path',
    z.object({
      file_path: z.string().describe('Absolute path to write to'),
      content: z.string().describe('Content to write'),
    }),
    ({ file_path, content }) => executeWriteFile(file_path, content),
    onCanUseTool
  );

  // Create bash tool with permission check
  const safeBash = wrapToolWithPermission(
    'bash',
    'Execute a bash command (use for git, npm, etc.)',
    z.object({
      command: z.string().describe('The command to execute'),
      timeout: z
        .union([z.number(), z.string()])
        .optional()
        .describe('Timeout in ms (default 120000)'),
    }),
    ({ command, timeout }) =>
      executeBash(
        command,
        coerceNumber(timeout),
        process.cwd(),
        options?.onToolOutput,
        undefined, // workbenchUrl
        options?.currentPromptTokens
      ),
    onCanUseTool
  );

  // Create edit_file tool with permission check
  const safeEditFile = wrapToolWithPermission(
    'edit_file',
    'Replace text in a file (old_string must be unique)',
    z.object({
      file_path: z.string().describe('Absolute path to the file'),
      old_string: z.string().describe('Text to replace'),
      new_string: z.string().describe('Replacement text'),
      replace_all: z
        .union([z.boolean(), z.string()])
        .optional()
        .describe('Replace all occurrences'),
    }),
    ({ file_path, old_string, new_string, replace_all }) =>
      executeEditFile(
        file_path,
        old_string,
        new_string,
        coerceBoolean(replace_all)
      ),
    onCanUseTool
  );

  const baseTools: FunctionTool[] = [
    wrapToolWithPermission(
      'read_file',
      'Reads a file, prioritizing partial reads. STANDARD WORKFLOW: 1. Use `grep` to find relevant line numbers. 2. Use this tool with `offset` and `limit` to read that specific section. Avoid reading whole files.',
      z.object({
        file_path: z.string().describe('Absolute path to the file to read'),
        limit: z
          .union([z.number(), z.string()])
          .optional()
          .describe('Max lines to read (use for large files!)'),
        offset: z
          .union([z.number(), z.string()])
          .optional()
          .describe('Line offset to start from'),
      }),
      ({ file_path, limit, offset }) =>
        executeReadFile(
          file_path,
          coerceNumber(limit),
          coerceNumber(offset),
          undefined, // workbenchUrl
          options?.currentPromptTokens
        ),
      onCanUseTool
    ),
    safeWriteFile,
    new FunctionTool({
      name: 'fetch_url',
      description:
        'Fetch content from a URL to read documentation, APIs, or external resources. Returns text content with basic HTML stripping.',
      parameters: z.object({
        url: z.string().url().describe('The URL to fetch content from'),
      }),
      execute: async ({ url }) => {
        if (process.env.DEBUG_GEMINI_TOOLS) {
          systemLog('gemini-tools', 'fetch_url input', { url }, 'debug');
        }
        return executeFetchUrl(url);
      },
    }),
    new FunctionTool({
      name: 'glob',
      description:
        'Find files matching pattern. EFFICIENCY TIP: Use this BEFORE read_file to find the right files first.',
      parameters: z.object({
        pattern: z
          .string()
          .describe('Glob pattern (e.g., "**/*.ts", "src/**/*.py")'),
        cwd: z.string().optional().describe('Working directory'),
      }),
      execute: ({ pattern, cwd: globCwd }) => {
        if (process.env.DEBUG_GEMINI_TOOLS) {
          systemLog(
            'gemini-tools',
            'glob input',
            { pattern, cwd: globCwd },
            'debug'
          );
        }
        return executeGlob(pattern, globCwd || process.cwd());
      },
    }),
    wrapToolWithPermission(
      'grep',
      'Search for pattern in files using ripgrep. EFFICIENCY TIP: Use this BEFORE read_file to find exactly what you need.',
      z.object({
        pattern: z.string().describe('Regex pattern to search'),
        path: z.string().optional().describe('Path to search in'),
        glob_filter: z
          .string()
          .optional()
          .describe('File glob filter (e.g., "*.ts")'),
      }),
      ({ pattern, path: searchPath, glob_filter }) =>
        executeGrep(
          pattern,
          searchPath,
          glob_filter,
          process.cwd(),
          undefined, // workbenchUrl
          options?.currentPromptTokens
        ),
      onCanUseTool
    ),
    safeBash,
    safeEditFile,
  ];

  // Add SigmaTaskUpdate for providers without native support (Gemini, OpenAI)
  // Claude has native SDK SigmaTaskUpdate - don't override
  const provider = options?.provider || 'gemini'; // Default to gemini for this ADK file
  if (PROVIDERS_WITH_EXTERNAL_TASK_UPDATE[provider]) {
    const anchorId = options?.anchorId;
    const cwd = projectRoot || process.cwd();

    // anchorId is required for SigmaTaskUpdate state persistence.
    // In environments without session state (headless/legacy), we return a warning
    // instead of throwing to avoid crashing the tool initialization.
    if (!anchorId) {
      systemLog(
        'sigma',
        'SigmaTaskUpdate initialized without anchorId. Tasks will NOT be persisted across sessions.',
        undefined,
        'warn'
      );
    }

    // Create SigmaTaskUpdate tool with anchorId bound for state file persistence
    const boundSigmaTaskUpdateTool = new FunctionTool({
      name: 'SigmaTaskUpdate',
      description: getSigmaTaskUpdateDescription(options?.mode),
      parameters: {
        type: Type.OBJECT,
        properties: {
          todos: {
            type: Type.ARRAY,
            description: 'The updated task list',
            items: {
              type: Type.OBJECT,
              properties: {
                id: {
                  type: Type.STRING,
                  description:
                    'Unique stable identifier for this task (use nanoid, UUID, or semantic slug like "fix-ruff-api")',
                },
                content: {
                  type: Type.STRING,
                  description:
                    'The imperative form describing what needs to be done (e.g., "Run tests", "Build the project")',
                },
                activeForm: {
                  type: Type.STRING,
                  description:
                    'The present continuous form shown during execution (e.g., "Running tests", "Building the project")',
                },
                status: {
                  type: Type.STRING,
                  enum:
                    options?.mode === 'solo'
                      ? ['pending', 'in_progress', 'completed']
                      : ['pending', 'in_progress', 'completed', 'delegated'],
                  description:
                    'Task status. Use "delegated" when assigning task to another agent via IPC',
                },
                // Delegation fields (Manager/Worker paradigm)
                ...(options?.mode !== 'solo'
                  ? {
                      acceptance_criteria: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        nullable: true,
                        description:
                          'Success criteria for task completion (e.g., ["Must pass \'npm test\'", "No breaking changes"]). Required when delegating.',
                      },
                      delegated_to: {
                        type: Type.STRING,
                        nullable: true,
                        description:
                          'Agent ID this task was delegated to (e.g., "flash1"). Set when status is "delegated".',
                      },
                      context: {
                        type: Type.STRING,
                        nullable: true,
                        description:
                          'Additional context for delegated worker (e.g., "Refactoring auth system - keep OAuth flow intact")',
                      },
                      delegate_session_id: {
                        type: Type.STRING,
                        nullable: true,
                        description: "Worker's session ID (for audit trail)",
                      },
                      result_summary: {
                        type: Type.STRING,
                        nullable: true,
                        description: "Worker's completion report",
                      },
                    }
                  : {}),
              },
              required: ['id', 'content', 'activeForm', 'status'],
            },
          },
          ...(options?.mode !== 'solo'
            ? {
                grounding: {
                  type: Type.ARRAY,
                  nullable: true,
                  description:
                    'Grounding strategy and hints for tasks (correlate via id)',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      strategy: {
                        type: Type.STRING,
                        enum: ['pgc_first', 'pgc_verify', 'pgc_cite', 'none'],
                        nullable: true,
                        description: 'Grounding strategy to use',
                      },
                      overlay_hints: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.STRING,
                          enum: ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'],
                        },
                        nullable: true,
                        description: 'Hints for overlay selection',
                      },
                      query_hints: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        nullable: true,
                        description: 'Hints for semantic search queries',
                      },
                      evidence_required: {
                        anyOf: [{ type: Type.BOOLEAN }, { type: Type.STRING }],
                        nullable: true,
                        description: 'Whether evidence (citations) is required',
                      },
                    },
                    required: ['id'],
                  },
                },
                grounding_evidence: {
                  type: Type.ARRAY,
                  nullable: true,
                  description:
                    'Structured evidence returned by worker (correlate via id)',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      queries_executed: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      overlays_consulted: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.STRING,
                          enum: ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'],
                        },
                      },
                      citations: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            overlay: { type: Type.STRING },
                            content: { type: Type.STRING },
                            relevance: { type: Type.STRING },
                            file_path: { type: Type.STRING, nullable: true },
                          },
                        },
                      },
                      grounding_confidence: {
                        type: Type.STRING,
                        enum: ['high', 'medium', 'low'],
                      },
                      overlay_warnings: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        nullable: true,
                      },
                    },
                    required: ['id'],
                  },
                },
              }
            : {}),
        },
        required: ['todos'],
      } as Schema,
      execute: async (rawInput: unknown) => {
        if (process.env.DEBUG_GEMINI_TOOLS) {
          systemLog(
            'gemini-tools',
            'SigmaTaskUpdate input',
            { rawInput },
            'debug'
          );
        }
        // [Safety Handling] Gemini 2.5 Flash sometimes sends explicit nulls for optional fields
        // which Zod's .optional() (undefined | string) rejects.
        // We use a raw schema with nullable: true to allow this at the API level,
        // and then preprocess the input to remove any null values from the todo items.

        interface RawTodo {
          id: string;
          content: string;
          status: 'pending' | 'in_progress' | 'completed' | 'delegated';
          activeForm: string;
          acceptance_criteria?: string[] | null;
          delegated_to?: string | null;
          context?: string | null;
          delegate_session_id?: string | null;
          result_summary?: string | null;
        }

        interface RawGrounding {
          id: string;
          strategy?: 'pgc_first' | 'pgc_verify' | 'pgc_cite' | 'none' | null;
          overlay_hints?: string[] | null;
          query_hints?: string[] | null;
          evidence_required?: boolean | string | null;
        }

        interface RawEvidence {
          id: string;
          queries_executed: string[];
          overlays_consulted: string[];
          citations: Array<{
            overlay: string;
            content: string;
            relevance: string;
            file_path?: string;
          }>;
          grounding_confidence: 'high' | 'medium' | 'low';
          overlay_warnings?: string[];
        }

        const input = rawInput as {
          todos?: RawTodo[];
          grounding?: RawGrounding[];
          grounding_evidence?: RawEvidence[];
        };
        const rawTodos = input.todos;
        const rawGroundings = input.grounding || [];
        const rawEvidences = input.grounding_evidence || [];

        if (!rawTodos || !Array.isArray(rawTodos)) {
          return 'No tasks provided';
        }

        // Define target types for processed todos to satisfy linter and executor
        interface ProcessedEvidence {
          queries_executed: string[];
          overlays_consulted: Array<
            'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'
          >;
          citations: Array<{
            overlay: string;
            content: string;
            relevance: string;
            file_path?: string;
          }>;
          grounding_confidence: 'high' | 'medium' | 'low';
          overlay_warnings?: string[];
        }

        interface ProcessedGrounding {
          strategy: 'pgc_first' | 'pgc_verify' | 'pgc_cite' | 'none';
          overlay_hints?: Array<'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'>;
          query_hints?: string[];
          evidence_required?: boolean;
        }

        interface ProcessedTodo {
          id: string;
          content: string;
          status: 'pending' | 'in_progress' | 'completed' | 'delegated';
          activeForm: string;
          acceptance_criteria?: string[];
          delegated_to?: string;
          context?: string;
          delegate_session_id?: string;
          result_summary?: string;
          grounding?: ProcessedGrounding;
          grounding_evidence?: ProcessedEvidence;
        }

        const processedTodos = rawTodos.map((todo) => {
          const cleanTodo: ProcessedTodo = {
            id: todo.id,
            content: todo.content,
            status: todo.status,
            activeForm: todo.activeForm,
          };

          if (todo.acceptance_criteria)
            cleanTodo.acceptance_criteria = todo.acceptance_criteria;
          if (todo.delegated_to) cleanTodo.delegated_to = todo.delegated_to;
          if (todo.context) cleanTodo.context = todo.context;
          if (todo.delegate_session_id)
            cleanTodo.delegate_session_id = todo.delegate_session_id;
          if (todo.result_summary)
            cleanTodo.result_summary = todo.result_summary;

          // Merge grounding from separate array if present
          const groundingData = rawGroundings.find((g) => g.id === todo.id);
          if (groundingData) {
            const grounding: ProcessedGrounding = {
              strategy: groundingData.strategy || 'none',
            };

            if (groundingData.overlay_hints)
              grounding.overlay_hints = groundingData.overlay_hints as Array<
                'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'
              >;
            if (groundingData.query_hints)
              grounding.query_hints = groundingData.query_hints;

            // Coerce evidence_required if it's a string
            if (
              groundingData.evidence_required !== undefined &&
              groundingData.evidence_required !== null
            ) {
              grounding.evidence_required = coerceBoolean(
                groundingData.evidence_required as string | boolean
              );
            }

            cleanTodo.grounding = grounding;
          }

          // Merge grounding_evidence from separate array if present
          const evidenceData = rawEvidences.find((e) => e.id === todo.id);
          if (evidenceData) {
            const evidence: ProcessedEvidence = {
              queries_executed: evidenceData.queries_executed,
              overlays_consulted: evidenceData.overlays_consulted as Array<
                'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'
              >,
              citations: evidenceData.citations,
              grounding_confidence: evidenceData.grounding_confidence,
            };

            if (evidenceData.overlay_warnings) {
              evidence.overlay_warnings = evidenceData.overlay_warnings;
            }

            cleanTodo.grounding_evidence = evidence;
          }

          return cleanTodo as ProcessedTodo;
        });

        if (process.env.DEBUG_GEMINI_TOOLS) {
          systemLog(
            'gemini-tools',
            'Processed todos',
            { processedTodos },
            'debug'
          );
        }

        // Validate delegation requirements (moved from .refine() to support Gemini)
        for (const task of processedTodos) {
          if (task.status === 'delegated') {
            if (
              !task.acceptance_criteria ||
              task.acceptance_criteria.length === 0
            ) {
              throw new Error(
                `[DEBUG SigmaTaskUpdate] Delegation validation failed: Task "${task.id}" has status 'delegated' but missing 'acceptance_criteria'`
              );
            }
            if (!task.delegated_to || task.delegated_to.length === 0) {
              throw new Error(
                `[DEBUG SigmaTaskUpdate] Delegation validation failed: Task "${task.id}" has status 'delegated' but missing 'delegated_to'`
              );
            }
          }
        }

        if (!anchorId) {
          // Fallback summary for non-persistent mode
          const summary = processedTodos
            .map((t) => {
              const icon =
                t.status === 'completed'
                  ? '✓'
                  : t.status === 'in_progress'
                    ? '→'
                    : t.status === 'delegated'
                      ? '⇨'
                      : '○';
              const text =
                t.status === 'in_progress' ? t.activeForm : t.content;
              const suffix =
                t.status === 'delegated' && t.delegated_to
                  ? ` (→ ${t.delegated_to})`
                  : '';
              return `[${icon}] ${text}${suffix}`;
            })
            .join('\n');
          return `Task list updated (${processedTodos.length} items) [NOT PERSISTED]:\n${summary}`;
        }
        return executeSigmaTaskUpdate(processedTodos, cwd, anchorId);
      },
    });
    baseTools.push(boundSigmaTaskUpdateTool);
  }

  // Build final tool list with optional tools
  const tools = [...baseTools];

  // Add recall tool if conversation registry is available
  if (conversationRegistry) {
    const recallTool = createRecallTool(conversationRegistry, workbenchUrl);
    tools.push(recallTool);
  }

  // Add background tasks tool if task manager is available
  if (getTaskManager) {
    const backgroundTasksTool = createBackgroundTasksTool(getTaskManager);
    tools.push(backgroundTasksTool);
  }

  // Add agent messaging tools if publisher/queue are available AND not in solo mode
  if (
    options?.mode !== 'solo' &&
    getMessagePublisher &&
    getMessageQueue &&
    projectRoot &&
    currentAgentId
  ) {
    const agentMessagingTools = createAgentMessagingTools(
      getMessagePublisher,
      getMessageQueue,
      projectRoot,
      currentAgentId,
      onCanUseTool
    );
    tools.push(...agentMessagingTools);
  }

  return tools;
}
