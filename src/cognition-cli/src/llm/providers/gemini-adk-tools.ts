/**
 * ADK Tool Definitions for Gemini Agent Provider
 *
 * Maps Cognition tools to Google ADK FunctionTool format.
 * Uses shared tool executors from tool-executors.ts and tool-helpers.ts.
 */

import { FunctionTool } from '@google/adk';
import { z } from 'zod';
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
import { formatTaskType, formatDuration } from './tool-helpers.js';
import {
  executeReadFile,
  executeWriteFile,
  executeGlob,
  executeGrep,
  executeBash,
  executeEditFile,
  executeTodoWrite,
} from './tool-executors.js';

/**
 * Read file tool - reads file contents
 */
export const readFileTool = new FunctionTool({
  name: 'read_file',
  description:
    'Reads a file, prioritizing partial reads. STANDARD WORKFLOW: 1. Use `grep` to find relevant line numbers. 2. Use this tool with `offset` and `limit` to read that specific section. Avoid reading whole files.',
  parameters: z.object({
    file_path: z.string().describe('Absolute path to the file to read'),
    limit: z
      .number()
      .optional()
      .describe('Max lines to read (use for large files!)'),
    offset: z.number().optional().describe('Line offset to start from'),
  }),
  execute: ({ file_path, limit, offset }) =>
    executeReadFile(file_path, limit, offset),
});

/**
 * Write file tool - writes content to a file
 */
export const writeFileTool = new FunctionTool({
  name: 'write_file',
  description: 'Write content to a file at the given path',
  parameters: z.object({
    file_path: z.string().describe('Absolute path to write to'),
    content: z.string().describe('Content to write'),
  }),
  execute: ({ file_path, content }) => executeWriteFile(file_path, content),
});

/**
 * Glob tool - find files matching a pattern
 */
export const globTool = new FunctionTool({
  name: 'glob',
  description:
    'Find files matching pattern. EFFICIENCY TIP: Use this BEFORE read_file to find the right files first.',
  parameters: z.object({
    pattern: z
      .string()
      .describe('Glob pattern (e.g., "**/*.ts", "src/**/*.py")'),
    cwd: z.string().optional().describe('Working directory'),
  }),
  execute: ({ pattern, cwd }) => executeGlob(pattern, cwd || process.cwd()),
});

/**
 * Grep tool - search file contents
 */
export const grepTool = new FunctionTool({
  name: 'grep',
  description:
    'Search for pattern in files using ripgrep. EFFICIENCY TIP: Use this BEFORE read_file to find exactly what you need.',
  parameters: z.object({
    pattern: z.string().describe('Regex pattern to search'),
    path: z.string().optional().describe('Path to search in'),
    glob_filter: z
      .string()
      .optional()
      .describe('File glob filter (e.g., "*.ts")'),
  }),
  execute: ({ pattern, path: searchPath, glob_filter }) =>
    executeGrep(pattern, searchPath, glob_filter, process.cwd()),
});

/**
 * Bash tool - execute shell commands
 */
export const bashTool = new FunctionTool({
  name: 'bash',
  description:
    'Execute bash command (git, npm, etc.). EFFICIENCY TIP: Pipe to head/tail for large outputs. Avoid verbose flags.',
  parameters: z.object({
    command: z.string().describe('The command to execute'),
    timeout: z.number().optional().describe('Timeout in ms (default 120000)'),
  }),
  execute: ({ command, timeout }) =>
    executeBash(command, timeout, process.cwd()),
});

/**
 * Edit tool - replace text in a file
 */
export const editFileTool = new FunctionTool({
  name: 'edit_file',
  description: 'Replace text in a file (old_string must be unique)',
  parameters: z.object({
    file_path: z.string().describe('Absolute path to the file'),
    old_string: z.string().describe('Text to replace'),
    new_string: z.string().describe('Replacement text'),
    replace_all: z.boolean().optional().describe('Replace all occurrences'),
  }),
  execute: ({ file_path, old_string, new_string, replace_all }) =>
    executeEditFile(file_path, old_string, new_string, replace_all),
});

/**
 * TodoWrite tool description - shared between standalone and bound versions
 */
const TODO_WRITE_DESCRIPTION = `Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.

## When to Use This Tool
Use this tool proactively in these scenarios:
1. Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
3. User explicitly requests todo list - When the user directly asks you to use the todo list
4. User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)
5. After receiving new instructions - Immediately capture user requirements as todos
6. When you start working on a task - Mark it as in_progress BEFORE beginning work. Ideally you should only have one todo as in_progress at a time
7. After completing a task - Mark it as completed and add any new follow-up tasks discovered during implementation

## When NOT to Use This Tool
Skip using this tool when:
1. There is only a single, straightforward task
2. The task is trivial and tracking it provides no organizational benefit
3. The task can be completed in less than 3 trivial steps
4. The task is purely conversational or informational

## Task States
- pending: Task not yet started
- in_progress: Currently working on (limit to ONE task at a time)
- completed: Task finished successfully
- delegated: Task assigned to another agent via IPC (Manager/Worker pattern)

## Delegation (Manager/Worker Pattern)
When delegating a task to another agent:
1. Set status to 'delegated' and provide delegated_to (agent ID like "flash1")
2. MUST include acceptance_criteria (array of strings defining success)
3. Optionally provide context (additional background for the worker)
4. Use send_agent_message to dispatch the task payload to the worker
5. Worker reports back via send_agent_message when complete
6. Manager verifies acceptance_criteria before marking task 'completed'

Benefits of delegation:
- Keeps Manager context clean (no linter noise, verbose outputs)
- Manager stays focused on architecture and planning
- Worker agents handle implementation details

## Important
- Each task MUST have a unique 'id' field (use nanoid, UUID, or semantic slug)
- Task descriptions must have two forms: content (imperative, e.g., "Run tests") and activeForm (present continuous, e.g., "Running tests")
- Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
- ONLY mark a task as completed when you have FULLY accomplished it
- If you encounter errors or blockers, keep the task as in_progress and create a new task describing what needs to be resolved`;

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
    async () => {
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
    async (args: { to: string; message: string }) => {
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
    async (args: { message: string }) => {
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
    async () => {
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
    async (args: {
      messageId: string;
      status?: 'read' | 'injected' | 'dismissed';
    }) => {
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

  return tools;
}

/**
 * Providers that support external TodoWrite implementation
 *
 * Claude has native TodoWrite in SDK - we don't override it.
 * Gemini and OpenAI don't have native TodoWrite - we provide it.
 */
const PROVIDERS_WITH_EXTERNAL_TODO: Record<string, boolean> = {
  gemini: true,
  openai: true,
  claude: false, // Native SDK support
};

/**
 * Options for getCognitionTools
 */
export interface CognitionToolsOptions {
  /** LLM provider name (gemini, openai, claude) */
  provider?: string;
  /** Session anchor ID for TodoWrite state persistence */
  anchorId?: string;
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
      timeout: z.number().optional().describe('Timeout in ms (default 120000)'),
    }),
    ({ command, timeout }) => executeBash(command, timeout, process.cwd()),
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
      replace_all: z.boolean().optional().describe('Replace all occurrences'),
    }),
    ({ file_path, old_string, new_string, replace_all }) =>
      executeEditFile(file_path, old_string, new_string, replace_all),
    onCanUseTool
  );

  const baseTools: FunctionTool[] = [
    readFileTool, // Read-only, no wrapping needed
    safeWriteFile,
    globTool, // Read-only, no wrapping needed
    grepTool, // Read-only, no wrapping needed
    safeBash,
    safeEditFile,
  ];

  // Add TodoWrite for providers without native support (Gemini, OpenAI)
  // Claude has native SDK TodoWrite - don't override
  const provider = options?.provider || 'gemini'; // Default to gemini for this ADK file
  if (PROVIDERS_WITH_EXTERNAL_TODO[provider]) {
    const anchorId = options?.anchorId;
    const cwd = projectRoot || process.cwd();

    // anchorId is required for TodoWrite state persistence.
    // In environments without session state (headless/legacy), we return a warning
    // instead of throwing to avoid crashing the tool initialization.
    if (!anchorId) {
      console.warn(
        '[Sigma] TodoWrite initialized without anchorId. Tasks will NOT be persisted across sessions.'
      );
    }

    // Create TodoWrite tool with anchorId bound for state file persistence
    const boundTodoWriteTool = new FunctionTool({
      name: 'TodoWrite',
      description: TODO_WRITE_DESCRIPTION,
      parameters: z.object({
        todos: z
          .array(
            z.object({
              id: z
                .string()
                .min(1)
                .describe(
                  'Unique stable identifier for this task (use nanoid, UUID, or semantic slug like "fix-ruff-api")'
                ),
              content: z
                .string()
                .min(1)
                .describe(
                  'The imperative form describing what needs to be done (e.g., "Run tests", "Build the project")'
                ),
              activeForm: z
                .string()
                .min(1)
                .describe(
                  'The present continuous form shown during execution (e.g., "Running tests", "Building the project")'
                ),
              status: z
                .enum(['pending', 'in_progress', 'completed', 'delegated'])
                .describe(
                  'Task status. Use "delegated" when assigning task to another agent via IPC'
                ),
              // Delegation fields (Manager/Worker paradigm)
              acceptance_criteria: z
                .array(z.string())
                .optional()
                .describe(
                  'Success criteria for task completion (e.g., ["Must pass \'npm test\'", "No breaking changes"]). Required when delegating.'
                ),
              delegated_to: z
                .string()
                .optional()
                .describe(
                  'Agent ID this task was delegated to (e.g., "flash1"). Set when status is "delegated".'
                ),
              context: z
                .string()
                .optional()
                .describe(
                  'Additional context for delegated worker (e.g., "Refactoring auth system - keep OAuth flow intact")'
                ),
              delegate_session_id: z
                .string()
                .optional()
                .describe("Worker's session ID (for audit trail)"),
              result_summary: z
                .string()
                .optional()
                .describe("Worker's completion report"),
            })
          )
          .describe('The updated todo list'),
      }),
      execute: async ({ todos }) => {
        if (!anchorId) {
          // Fallback summary for non-persistent mode
          const summary = (todos || [])
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
          return `Todo list updated (${(todos || []).length} items) [NOT PERSISTED]:\n${summary}`;
        }
        return executeTodoWrite(todos, cwd, anchorId);
      },
    });
    baseTools.push(boundTodoWriteTool);
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

  // Add agent messaging tools if publisher/queue are available
  if (getMessagePublisher && getMessageQueue && projectRoot && currentAgentId) {
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
