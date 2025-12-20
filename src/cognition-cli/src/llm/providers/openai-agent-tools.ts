/**
 * OpenAI Agent SDK Tool Definitions for Cognition
 *
 * Maps Cognition tools to @openai/agents tool() format.
 * Uses shared tool executors from tool-executors.ts and tool-helpers.ts.
 *
 * TOOL PARITY:
 * - Core: read_file, write_file, glob, grep, bash, edit_file
 * - Web: fetch_url, WebSearch
 * - Memory: recall_past_conversation
 * - Background: get_background_tasks
 * - IPC: list_agents, send_agent_message, broadcast_agent_message,
 *        list_pending_messages, mark_message_read
 */

import { tool } from '@openai/agents';
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
  executeFetchUrl,
  executeWebSearch,
  executeSigmaTaskUpdate,
} from './tool-executors.js';

/**
 * OpenAI tool type (return type of tool())
 */
type OpenAITool = ReturnType<typeof tool>;

/**
 * Create a tool executor wrapped with permission check
 */
function withPermissionCheck<T>(
  toolName: string,
  originalExecute: (input: T) => Promise<string>,
  onCanUseTool?: OnCanUseTool
): (input: T) => Promise<string> {
  if (!onCanUseTool) {
    return originalExecute;
  }

  return async (input: T) => {
    const decision = await onCanUseTool(toolName, input);

    if (decision.behavior === 'deny') {
      return 'User declined this action. Please continue with alternative approaches without asking why.';
    }

    const finalInput = (decision.updatedInput ?? input) as T;
    return originalExecute(finalInput);
  };
}

// ============================================================
// Core File Tools
// ============================================================

/**
 * Create read_file tool
 */
function createReadFileTool(cwd: string, workbenchUrl?: string): OpenAITool {
  return tool({
    name: 'read_file',
    description:
      'Reads a file, prioritizing partial reads. STANDARD WORKFLOW: 1. Use `grep` to find relevant line numbers. 2. Use this tool with `offset` and `limit` to read that specific section.',
    parameters: z.object({
      file_path: z.string().describe('Absolute path to the file to read'),
      limit: z.number().optional().describe('Max lines to read'),
      offset: z.number().optional().describe('Line offset to start from'),
    }),
    execute: ({ file_path, limit, offset }) =>
      executeReadFile(file_path, limit, offset, workbenchUrl),
  });
}

/**
 * Create write_file tool
 */
function createWriteFileTool(onCanUseTool?: OnCanUseTool): OpenAITool {
  const execute = ({
    file_path,
    content,
  }: {
    file_path: string;
    content: string;
  }) => executeWriteFile(file_path, content);

  return tool({
    name: 'write_file',
    description: 'Write content to a file at the given path',
    parameters: z.object({
      file_path: z.string().describe('Absolute path to write to'),
      content: z.string().describe('Content to write'),
    }),
    execute: withPermissionCheck('write_file', execute, onCanUseTool),
  });
}

/**
 * Create glob tool
 */
function createGlobTool(cwd: string): OpenAITool {
  return tool({
    name: 'glob',
    description:
      'Find files matching pattern. EFFICIENCY TIP: Use this BEFORE read_file to find the right files first.',
    parameters: z.object({
      pattern: z.string().describe('Glob pattern (e.g., "**/*.ts")'),
      search_cwd: z.string().optional().describe('Working directory'),
    }),
    execute: ({ pattern, search_cwd }) =>
      executeGlob(pattern, search_cwd || cwd),
  });
}

/**
 * Create grep tool
 */
function createGrepTool(cwd: string, workbenchUrl?: string): OpenAITool {
  return tool({
    name: 'grep',
    description:
      'Search for pattern in files using ripgrep. EFFICIENCY TIP: Use this BEFORE read_file.',
    parameters: z.object({
      pattern: z.string().describe('Regex pattern to search'),
      search_path: z.string().optional().describe('Path to search in'),
      glob_filter: z.string().optional().describe('File glob filter'),
    }),
    execute: ({ pattern, search_path, glob_filter }) =>
      executeGrep(pattern, search_path, glob_filter, cwd, workbenchUrl),
  });
}

/**
 * Create bash tool
 */
function createBashTool(
  cwd: string,
  workbenchUrl?: string,
  onCanUseTool?: OnCanUseTool
): OpenAITool {
  const execute = ({
    command,
    timeout,
  }: {
    command: string;
    timeout?: number;
  }) => executeBash(command, timeout, cwd, workbenchUrl);

  return tool({
    name: 'bash',
    description:
      'Execute shell commands in bash. REQUIRED for: git (status/diff/add/commit/push), npm/yarn (install/build/test), system commands (grep/ls/cd/mkdir/mv/cp), package managers, build tools. IMPORTANT: Always use this tool for ANY terminal/shell command - do not attempt to execute commands without it. EFFICIENCY TIP: Pipe to head/tail for large outputs.',
    parameters: z.object({
      command: z.string().describe('The command to execute'),
      timeout: z.number().optional().describe('Timeout in ms (default 120000)'),
    }),
    execute: withPermissionCheck('bash', execute, onCanUseTool),
  });
}

/**
 * Create edit_file tool
 */
function createEditFileTool(onCanUseTool?: OnCanUseTool): OpenAITool {
  interface EditInput {
    file_path: string;
    old_string: string;
    new_string: string;
    replace_all?: boolean;
  }

  const execute = ({
    file_path,
    old_string,
    new_string,
    replace_all,
  }: EditInput) =>
    executeEditFile(file_path, old_string, new_string, replace_all);

  return tool({
    name: 'edit_file',
    description: 'Replace text in a file (old_string must be unique)',
    parameters: z.object({
      file_path: z.string().describe('Absolute path to the file'),
      old_string: z.string().describe('Text to replace'),
      new_string: z.string().describe('Replacement text'),
      replace_all: z.boolean().optional().describe('Replace all occurrences'),
    }),
    execute: withPermissionCheck('edit_file', execute, onCanUseTool),
  });
}

/**
 * Create SigmaTaskUpdate tool
 *
 * Manages a task list for tracking progress during multi-step operations.
 * Embeds tasks in session state file via anchorId.
 */
function createSigmaTaskUpdateTool(
  cwd: string,
  anchorId: string | undefined
): OpenAITool {
  interface TodoInput {
    todos: Array<{
      id: string;
      content: string;
      status: string;
      activeForm: string;
      // Delegation fields (Manager/Worker paradigm)
      acceptance_criteria?: string[];
      delegated_to?: string;
      context?: string;
      delegate_session_id?: string;
      result_summary?: string;
    }>;
  }

  const execute = ({ todos }: TodoInput) => {
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
          const text = t.status === 'in_progress' ? t.activeForm : t.content;
          const suffix =
            t.status === 'delegated' && t.delegated_to
              ? ` (→ ${t.delegated_to})`
              : '';
          return `[${icon}] ${text}${suffix}`;
        })
        .join('\n');
      return `Task list updated (${(todos || []).length} items) [NOT PERSISTED]:\n${summary}`;
    }
    return executeSigmaTaskUpdate(todos, cwd, anchorId);
  };

  return tool({
    name: 'SigmaTaskUpdate',
    description: `Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.

## When to Use This Tool
Use this tool proactively in these scenarios:
1. Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
3. User explicitly requests task list - When the user directly asks you to use the task list
4. User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)
5. After receiving new instructions - Immediately capture user requirements as tasks
6. When you start working on a task - Mark it as in_progress BEFORE beginning work. Ideally you should only have one task as in_progress at a time
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
- If you encounter errors or blockers, keep the task as in_progress and create a new task describing what needs to be resolved`,
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
        .describe('The updated task list'),
    }),
    execute,
  });
}

// ============================================================
// Web Tools (fetch_url, web_search)
// ============================================================

/**
 * Create fetch_url tool
 */
function createFetchUrlTool(): OpenAITool {
  return tool({
    name: 'fetch_url',
    description:
      'Fetch content from a URL to read documentation, APIs, or external resources. Returns text content with basic HTML stripping.',
    parameters: z.object({
      url: z.string().url().describe('The URL to fetch content from'),
    }),
    execute: ({ url }) => executeFetchUrl(url),
  });
}

/**
 * Create web_search tool
 */
function createWebSearchTool(workbenchUrl?: string): OpenAITool {
  return tool({
    name: 'WebSearch',
    description:
      'Search the web for information. Use this for current events, documentation, or any information beyond your knowledge cutoff. Returns search results with titles, URLs, and snippets.',
    parameters: z.object({
      query: z.string().describe('The search query'),
    }),
    execute: ({ query }) => executeWebSearch(query, workbenchUrl),
  });
}

// ============================================================
// Memory Tool (recall_past_conversation)
// ============================================================

/**
 * Create recall_past_conversation tool
 */
function createRecallTool(
  conversationRegistry: ConversationOverlayRegistry,
  workbenchUrl?: string
): OpenAITool {
  return tool({
    name: 'recall_past_conversation',
    description:
      'Retrieve FULL untruncated messages from conversation history. The recap you see is truncated - when you see "..." it means more content is available. Use this tool to get complete details. Searches all 7 overlays (O1-O7) in LanceDB with semantic search.',
    parameters: z.object({
      query: z.string().describe('What to search for in past conversation'),
    }),
    execute: async ({ query }) => {
      try {
        const answer = await queryConversationLattice(
          query,
          conversationRegistry,
          {
            workbenchUrl,
            topK: 10,
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

// ============================================================
// Background Tasks Tool
// ============================================================

/**
 * Create get_background_tasks tool
 */
function createBackgroundTasksTool(
  getTaskManager: () => BackgroundTaskManager | null
): OpenAITool {
  return tool({
    name: 'get_background_tasks',
    description:
      'Query status of background operations (genesis, overlay generation). Use this to check if work is in progress, view progress percentage, or see completed/failed tasks.',
    parameters: z.object({
      filter: z
        .enum(['all', 'active', 'completed', 'failed'])
        .optional()
        .describe('Filter tasks by status'),
    }),
    execute: async ({ filter: filterArg }) => {
      const filter = filterArg || 'all';
      try {
        const taskManager = getTaskManager();

        if (!taskManager) {
          return 'Background task manager not initialized. No background operations are running.';
        }

        const allTasks = taskManager.getAllTasks();

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

// ============================================================
// Agent Messaging Tools (IPC)
// ============================================================

/**
 * Create list_agents tool
 */
function createListAgentsTool(
  projectRoot: string,
  currentAgentId: string
): OpenAITool {
  return tool({
    name: 'list_agents',
    description:
      'List all active agents in the IPC bus. Returns agent aliases, models, and status. Use this to discover other agents before sending messages.',
    parameters: z.object({}),
    execute: async () => {
      try {
        const agents = getActiveAgents(projectRoot, currentAgentId);
        return formatListAgents(agents);
      } catch (err) {
        return formatError('list agents', (err as Error).message);
      }
    },
  });
}

/**
 * Create send_agent_message tool
 */
function createSendMessageTool(
  getMessagePublisher: () => MessagePublisher | null,
  projectRoot: string,
  onCanUseTool?: OnCanUseTool
): OpenAITool {
  const execute = async ({ to, message }: { to: string; message: string }) => {
    try {
      const publisher = getMessagePublisher();

      if (!publisher) {
        return formatNotInitialized('Message publisher');
      }

      const targetAgentId = resolveAgentId(projectRoot, to);

      if (!targetAgentId) {
        return formatNotFound('agent', to);
      }

      await publisher.sendMessage(targetAgentId, message);

      return formatMessageSent(to, targetAgentId, message);
    } catch (err) {
      return formatError('send message', (err as Error).message);
    }
  };

  return tool({
    name: 'send_agent_message',
    description:
      'Send a message to another agent. The recipient will see it in their pending messages. Use list_agents first to discover available agents.',
    parameters: z.object({
      to: z.string().describe('Target agent alias or full agent ID'),
      message: z.string().describe('The message content to send'),
    }),
    execute: withPermissionCheck('send_agent_message', execute, onCanUseTool),
  });
}

/**
 * Create broadcast_agent_message tool
 */
function createBroadcastTool(
  getMessagePublisher: () => MessagePublisher | null,
  projectRoot: string,
  currentAgentId: string,
  onCanUseTool?: OnCanUseTool
): OpenAITool {
  const execute = async ({ message }: { message: string }) => {
    try {
      const publisher = getMessagePublisher();

      if (!publisher) {
        return formatNotInitialized('Message publisher');
      }

      await publisher.broadcast('agent.message', {
        type: 'text',
        message,
      });

      const agents = getActiveAgents(projectRoot, currentAgentId);

      return formatBroadcastSent(agents.length, message);
    } catch (err) {
      return formatError('broadcast message', (err as Error).message);
    }
  };

  return tool({
    name: 'broadcast_agent_message',
    description:
      'Broadcast a message to ALL active agents. Use sparingly - prefer send_agent_message for targeted communication.',
    parameters: z.object({
      message: z.string().describe('The message content to broadcast'),
    }),
    execute: withPermissionCheck(
      'broadcast_agent_message',
      execute,
      onCanUseTool
    ),
  });
}

/**
 * Create list_pending_messages tool
 */
function createListPendingMessagesTool(
  getMessageQueue: () => MessageQueue | null
): OpenAITool {
  return tool({
    name: 'list_pending_messages',
    description:
      'List all pending messages in your message queue. These are messages from other agents that you have not yet processed. DO NOT poll this tool - the system will notify you automatically when a new message arrives.',
    parameters: z.object({}),
    execute: async () => {
      try {
        const queue = getMessageQueue();

        if (!queue) {
          return formatNotInitialized('Message queue');
        }

        const messages = await queue.getMessages('pending');

        return formatPendingMessages(messages);
      } catch (err) {
        return formatError('list pending messages', (err as Error).message);
      }
    },
  });
}

/**
 * Create mark_message_read tool
 */
function createMarkMessageReadTool(
  getMessageQueue: () => MessageQueue | null,
  onCanUseTool?: OnCanUseTool
): OpenAITool {
  interface MarkInput {
    messageId: string;
    status?: 'read' | 'injected' | 'dismissed';
  }

  const execute = async ({ messageId, status }: MarkInput) => {
    try {
      const queue = getMessageQueue();

      if (!queue) {
        return formatNotInitialized('Message queue');
      }

      const message = await queue.getMessage(messageId);

      if (!message) {
        return formatNotFound('Message', messageId);
      }

      const newStatus = status || 'injected';
      await queue.updateStatus(messageId, newStatus);

      return formatMessageMarked(
        messageId,
        newStatus,
        message.from,
        formatMessageContent(message)
      );
    } catch (err) {
      return formatError('mark message', (err as Error).message);
    }
  };

  return tool({
    name: 'mark_message_read',
    description:
      'Mark a pending message as read/processed. Use this after you have handled a message from another agent.',
    parameters: z.object({
      messageId: z.string().describe('The message ID to mark as read'),
      status: z
        .enum(['read', 'injected', 'dismissed'])
        .optional()
        .describe('New status (default: injected)'),
    }),
    execute: withPermissionCheck('mark_message_read', execute, onCanUseTool),
  });
}

// ============================================================
// Main Export: Build All Tools
// ============================================================

/**
 * Context for building OpenAI agent tools
 */
export interface OpenAIToolsContext {
  /** Working directory */
  cwd: string;
  /** Workbench URL for eGemma API */
  workbenchUrl?: string;
  /** Tool permission callback */
  onCanUseTool?: OnCanUseTool;
  /** Conversation registry for recall tool */
  conversationRegistry?: ConversationOverlayRegistry;
  /** Background task manager getter */
  getTaskManager?: () => BackgroundTaskManager | null;
  /** Message publisher getter */
  getMessagePublisher?: () => MessagePublisher | null;
  /** Message queue getter */
  getMessageQueue?: () => MessageQueue | null;
  /** Project root for agent discovery */
  projectRoot?: string;
  /** Current agent ID */
  agentId?: string;
  /** Session anchor ID for SigmaTaskUpdate state persistence */
  anchorId?: string;
}

/**
 * Get all OpenAI tools for Cognition
 *
 * Returns array of tools compatible with @openai/agents SDK.
 * Tool safety is handled via onCanUseTool callback.
 */
export function getOpenAITools(context: OpenAIToolsContext): OpenAITool[] {
  const {
    cwd,
    workbenchUrl,
    onCanUseTool,
    conversationRegistry,
    getTaskManager,
    getMessagePublisher,
    getMessageQueue,
    projectRoot,
    agentId,
    anchorId,
  } = context;

  const tools: OpenAITool[] = [];

  // Core file tools (read-only - no permission check needed)
  tools.push(createReadFileTool(cwd, workbenchUrl));
  tools.push(createGlobTool(cwd));
  tools.push(createGrepTool(cwd, workbenchUrl));

  // Mutating tools (with permission check built-in)
  tools.push(createWriteFileTool(onCanUseTool));
  tools.push(createBashTool(cwd, workbenchUrl, onCanUseTool));
  tools.push(createEditFileTool(onCanUseTool));

  // SigmaTaskUpdate tool (state management) - optional anchorId with fallback
  if (!anchorId) {
    console.warn(
      '[Sigma] SigmaTaskUpdate initialized without anchorId. Tasks will NOT be persisted across sessions.'
    );
  }
  tools.push(createSigmaTaskUpdateTool(cwd, anchorId));

  // Web tools (read-only)
  tools.push(createFetchUrlTool());
  tools.push(createWebSearchTool(workbenchUrl));

  // Add recall tool if conversation registry is available
  if (conversationRegistry) {
    tools.push(createRecallTool(conversationRegistry, workbenchUrl));
  }

  // Add background tasks tool if task manager is available
  if (getTaskManager) {
    tools.push(createBackgroundTasksTool(getTaskManager));
  }

  // Add agent messaging tools if IPC context is available
  if (getMessagePublisher && getMessageQueue && projectRoot && agentId) {
    // Read-only tools (no permission check)
    tools.push(createListAgentsTool(projectRoot, agentId));
    tools.push(createListPendingMessagesTool(getMessageQueue));

    // Mutating tools (with permission check)
    tools.push(
      createSendMessageTool(getMessagePublisher, projectRoot, onCanUseTool)
    );
    tools.push(
      createBroadcastTool(
        getMessagePublisher,
        projectRoot,
        agentId,
        onCanUseTool
      )
    );
    tools.push(createMarkMessageReadTool(getMessageQueue, onCanUseTool));
  }

  return tools;
}
