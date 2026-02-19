/**
 * Tool Definitions for Minimax Agent Provider
 *
 * Maps Cognition tools to Anthropic SDK tool format.
 * Uses shared tool executors from tool-executors.ts.
 */

import type { ConversationOverlayRegistry } from '../../sigma/conversation-registry.js';
import type { BackgroundTaskManager } from '../../tui/services/BackgroundTaskManager.js';
import type { MessagePublisher } from '../../ipc/MessagePublisher.js';
import type { MessageQueue } from '../../ipc/MessageQueue.js';
import type { OnCanUseTool } from './tool-helpers.js';
import type { AgentRequest } from '../agent-provider-interface.js';
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
import { queryConversationLattice } from '../../sigma/query-conversation.js';
import { getActiveAgents, resolveAgentId } from '../../ipc/agent-discovery.js';
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

export interface MinimaxToolsContext {
  cwd?: string;
  conversationRegistry?: ConversationOverlayRegistry;
  workbenchUrl?: string;
  onCanUseTool?: AgentRequest['onCanUseTool'];
  getTaskManager?: () => BackgroundTaskManager | null;
  getMessagePublisher?: () => MessagePublisher | null;
  getMessageQueue?: () => MessageQueue | null;
  projectRoot?: string;
  agentId?: string;
  anchorId?: string;
  onToolOutput?: (output: string) => void;
}

export interface MinimaxTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface MinimaxTodo {
  id: string;
  content: string;
  activeForm: string;
  status: string;
  acceptance_criteria?: string[];
  delegated_to?: string;
  context?: string;
  grounding?: unknown;
  grounding_evidence?: unknown;
}

interface MinimaxGrounding {
  id: string;
  strategy: 'pgc_first' | 'pgc_verify' | 'pgc_cite' | 'none';
  overlay_hints?: string[];
  query_hints?: string[];
  evidence_required?: boolean;
}

interface MinimaxGroundingEvidence {
  id: string;
  queries_executed?: string[];
  overlays_consulted?: string[];
  citations?: Array<{
    overlay: string;
    content: string;
    relevance: string;
    file_path: string;
  }>;
  grounding_confidence?: 'high' | 'medium' | 'low';
}

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

function createReadFileTool(): MinimaxTool {
  return {
    name: 'read_file',
    description:
      'Read the contents of a file, prioritizing partial reads. STANDARD WORKFLOW: 1. Use `grep` to find relevant line numbers. 2. Use this tool with `offset` and `limit` to read that specific section.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute path to the file to read',
        },
        offset: {
          type: 'number',
          description: 'Line number to start reading from (0-based)',
        },
        limit: { type: 'number', description: 'Number of lines to read' },
      },
      required: ['file_path'],
    },
  };
}

function createWriteFileTool(): MinimaxTool {
  return {
    name: 'write_file',
    description: 'Write content to a file at the given path',
    input_schema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Absolute path to write to' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['file_path', 'content'],
    },
  };
}

function createGlobTool(): MinimaxTool {
  return {
    name: 'glob',
    description:
      'Find files matching a glob pattern. EFFICIENCY TIP: Use this BEFORE read_file to find the right files first.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern (e.g., "**/*.ts")',
        },
        path: { type: 'string', description: 'Directory to search in' },
      },
      required: ['pattern'],
    },
  };
}

function createGrepTool(): MinimaxTool {
  return {
    name: 'grep',
    description:
      'Search for pattern in files using ripgrep. EFFICIENCY TIP: Use this BEFORE read_file to find exactly what you need.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regex pattern to search' },
        path: { type: 'string', description: 'Path to search in' },
        glob_filter: {
          type: 'string',
          description: 'File glob filter (e.g., "*.ts")',
        },
      },
      required: ['pattern'],
    },
  };
}

function createBashTool(): MinimaxTool {
  return {
    name: 'bash',
    description:
      'Execute shell commands in bash. REQUIRED for: git, npm/yarn (install/build/test), system commands, package managers, build tools. ALWAYS use this tool for ANY terminal/shell command.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command to execute' },
        timeout: {
          type: 'number',
          description: 'Timeout in ms (default 120000)',
        },
      },
      required: ['command'],
    },
  };
}

function createEditFileTool(): MinimaxTool {
  return {
    name: 'edit_file',
    description: 'Replace text in a file (old_string must be unique)',
    input_schema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Absolute path to the file' },
        old_string: { type: 'string', description: 'Text to replace' },
        new_string: { type: 'string', description: 'Replacement text' },
        replace_all: {
          type: 'boolean',
          description: 'Replace all occurrences',
        },
      },
      required: ['file_path', 'old_string', 'new_string'],
    },
  };
}

function createSigmaTaskUpdateTool(): MinimaxTool {
  return {
    name: 'SigmaTaskUpdate',
    description:
      'Update task list to track progress and maintain state across the session. Use this tool VERY frequently to ensure that you are tracking your tasks.',
    input_schema: {
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          description: 'The updated task list',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique stable identifier' },
              content: { type: 'string', description: 'Task description' },
              activeForm: {
                type: 'string',
                description: 'Present continuous form',
              },
              status: {
                type: 'string',
                enum: ['pending', 'in_progress', 'completed', 'delegated'],
                description: 'Task status',
              },
              acceptance_criteria: {
                type: 'array',
                items: { type: 'string' },
                description: 'Success criteria for delegation',
              },
              delegated_to: { type: 'string', description: 'Target agent ID' },
              context: { type: 'string', description: 'Delegation context' },
              result_summary: {
                type: 'string',
                description: 'Completion report',
              },
            },
            required: ['id', 'content', 'activeForm', 'status'],
          },
        },
        grounding: {
          type: 'array',
          description: 'Grounding strategy and hints for tasks',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              strategy: {
                type: 'string',
                enum: ['pgc_first', 'pgc_verify', 'pgc_cite', 'none'],
              },
              overlay_hints: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'],
                },
              },
              query_hints: { type: 'array', items: { type: 'string' } },
              evidence_required: { type: 'boolean' },
            },
            required: ['id'],
          },
        },
        grounding_evidence: {
          type: 'array',
          description: 'Structured evidence returned by worker',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              queries_executed: { type: 'array', items: { type: 'string' } },
              overlays_consulted: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'],
                },
              },
              citations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    overlay: { type: 'string' },
                    content: { type: 'string' },
                    relevance: { type: 'string' },
                    file_path: { type: 'string' },
                  },
                },
              },
              grounding_confidence: {
                type: 'string',
                enum: ['high', 'medium', 'low'],
              },
            },
            required: ['id'],
          },
        },
      },
      required: ['todos'],
    },
  };
}

function createFetchUrlTool(): MinimaxTool {
  return {
    name: 'fetch_url',
    description:
      'Fetch content from a URL to read documentation, APIs, or external resources. Returns text content with basic HTML stripping.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to fetch content from' },
      },
      required: ['url'],
    },
  };
}

function createWebSearchTool(): MinimaxTool {
  return {
    name: 'WebSearch',
    description:
      'Search the web for current information, news, facts, and real-time data using Google Search',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' },
      },
      required: ['query'],
    },
  };
}

function createRecallTool(): MinimaxTool {
  return {
    name: 'recall_past_conversation',
    description:
      'Retrieve FULL untruncated messages from conversation history. Searches all 7 overlays (O1-O7) in LanceDB with semantic search.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'What to search for in past conversation',
        },
      },
      required: ['query'],
    },
  };
}

function createBackgroundTasksTool(): MinimaxTool {
  return {
    name: 'get_background_tasks',
    description: 'Query status of background operations',
    input_schema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: ['all', 'active', 'completed', 'failed'],
          description: 'Filter tasks by status',
        },
      },
    },
  };
}

function createListAgentsTool(): MinimaxTool {
  return {
    name: 'list_agents',
    description: 'List active agents in the current project',
    input_schema: {
      type: 'object',
      properties: {},
    },
  };
}

function createSendMessageTool(): MinimaxTool {
  return {
    name: 'send_agent_message',
    description: 'Send a message to another agent',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Target agent alias or ID' },
        message: { type: 'string', description: 'Message content' },
      },
      required: ['to', 'message'],
    },
  };
}

function createBroadcastTool(): MinimaxTool {
  return {
    name: 'broadcast_agent_message',
    description: 'Broadcast a message to ALL active agents',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message content' },
      },
      required: ['message'],
    },
  };
}

function createListPendingMessagesTool(): MinimaxTool {
  return {
    name: 'list_pending_messages',
    description: 'List pending messages in your queue',
    input_schema: {
      type: 'object',
      properties: {},
    },
  };
}

function createMarkMessageReadTool(): MinimaxTool {
  return {
    name: 'mark_message_read',
    description: 'Mark a pending message as read/processed',
    input_schema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'Message ID' },
        status: {
          type: 'string',
          enum: ['read', 'injected', 'dismissed'],
          description: 'New status',
        },
      },
      required: ['messageId'],
    },
  };
}

function createQueryAgentTool(): MinimaxTool {
  return {
    name: 'query_agent',
    description: 'Ask a semantic question to another agent',
    input_schema: {
      type: 'object',
      properties: {
        target_alias: { type: 'string', description: 'Target agent alias' },
        question: { type: 'string', description: 'The question to ask' },
      },
      required: ['target_alias', 'question'],
    },
  };
}

function coerceNumber(val: string | number | undefined): number | undefined {
  if (val === undefined) return undefined;
  if (typeof val === 'number') return val;
  const parsed = Number(val);
  return isNaN(parsed) ? undefined : parsed;
}

function coerceBoolean(val: string | boolean | undefined): boolean | undefined {
  if (val === undefined) return undefined;
  if (typeof val === 'boolean') return val;
  return val === 'true';
}

export function getMinimaxTools(context: MinimaxToolsContext): MinimaxTool[] {
  const {
    conversationRegistry,
    getTaskManager,
    getMessagePublisher,
    getMessageQueue,
    projectRoot,
    agentId,
  } = context;
  const tools: MinimaxTool[] = [];

  // Core file tools (read-only)
  tools.push(createReadFileTool());
  tools.push(createGlobTool());
  tools.push(createGrepTool());

  // Mutating tools (with permission check)
  tools.push(createWriteFileTool());
  tools.push(createBashTool());
  tools.push(createEditFileTool());

  // SigmaTaskUpdate tool
  tools.push(createSigmaTaskUpdateTool());

  // Web tools
  tools.push(createFetchUrlTool());
  tools.push(createWebSearchTool());

  // Recall tool (if conversation registry available)
  if (conversationRegistry) {
    tools.push(createRecallTool());
  }

  // Background tasks tool (if task manager available)
  if (getTaskManager) {
    tools.push(createBackgroundTasksTool());
  }

  // Agent messaging tools (IPC)
  if (getMessagePublisher && getMessageQueue && projectRoot && agentId) {
    tools.push(createListAgentsTool());
    tools.push(createSendMessageTool());
    tools.push(createBroadcastTool());
    tools.push(createListPendingMessagesTool());
    tools.push(createMarkMessageReadTool());
    tools.push(createQueryAgentTool());
  }

  return tools;
}

export async function executeMinimaxTool(
  toolName: string,
  input: unknown,
  context: MinimaxToolsContext
): Promise<string> {
  const inputObj = input as Record<string, unknown>;
  const {
    cwd,
    conversationRegistry,
    workbenchUrl,
    onCanUseTool,
    getTaskManager,
    getMessagePublisher,
    getMessageQueue,
    projectRoot,
    agentId,
    anchorId,
  } = context;

  switch (toolName) {
    case 'read_file': {
      return executeReadFile(
        inputObj.file_path as string,
        coerceNumber(inputObj.limit as number | string),
        coerceNumber(inputObj.offset as number | string),
        workbenchUrl
      );
    }
    case 'write_file': {
      const execute = withPermissionCheck(
        'write_file',
        () =>
          executeWriteFile(
            inputObj.file_path as string,
            inputObj.content as string
          ),
        onCanUseTool
      );
      return execute({
        file_path: inputObj.file_path as string,
        content: inputObj.content as string,
      });
    }
    case 'glob': {
      return executeGlob(
        inputObj.pattern as string,
        (inputObj.path as string) || cwd || process.cwd()
      );
    }
    case 'grep': {
      return executeGrep(
        inputObj.pattern as string,
        inputObj.path as string | undefined,
        inputObj.glob_filter as string | undefined,
        cwd || process.cwd(),
        workbenchUrl
      );
    }
    case 'bash': {
      const timeout = coerceNumber(
        inputObj.timeout as string | number | undefined
      );
      const execute = withPermissionCheck(
        'bash',
        () =>
          executeBash(
            inputObj.command as string,
            timeout,
            cwd || process.cwd(),
            context.onToolOutput,
            workbenchUrl
          ),
        onCanUseTool
      );
      return execute({ command: inputObj.command as string, timeout });
    }
    case 'edit_file': {
      const replaceAll = coerceBoolean(
        inputObj.replace_all as string | boolean | undefined
      );
      const execute = withPermissionCheck(
        'edit_file',
        () =>
          executeEditFile(
            inputObj.file_path as string,
            inputObj.old_string as string,
            inputObj.new_string as string,
            replaceAll
          ),
        onCanUseTool
      );
      return execute({
        file_path: inputObj.file_path as string,
        old_string: inputObj.old_string as string,
        new_string: inputObj.new_string as string,
        replace_all: replaceAll,
      });
    }
    case 'SigmaTaskUpdate': {
      // Process grounding/evidence into the format expected by executeSigmaTaskUpdate
      const inputTodos = (inputObj.todos as MinimaxTodo[]) || [];
      const inputGrounding = (inputObj.grounding as MinimaxGrounding[]) || [];
      const inputEvidence =
        (inputObj.grounding_evidence as MinimaxGroundingEvidence[]) || [];

      const todos = inputTodos.map((todo) => {
        const cleanTodo = { ...todo };
        const grounding = inputGrounding.find((g) => g.id === todo.id);
        if (grounding) cleanTodo.grounding = grounding;
        const evidence = inputEvidence.find((e) => e.id === todo.id);
        if (evidence) cleanTodo.grounding_evidence = evidence;
        return cleanTodo;
      });

      return executeSigmaTaskUpdate(
        todos as Parameters<typeof executeSigmaTaskUpdate>[0],
        cwd || process.cwd(),
        anchorId || 'default'
      );
    }
    case 'fetch_url': {
      return executeFetchUrl(inputObj.url as string);
    }
    case 'WebSearch': {
      return executeWebSearch(inputObj.query as string, workbenchUrl);
    }
    case 'recall_past_conversation': {
      if (!conversationRegistry) return 'Conversation registry not available';
      try {
        const result = await queryConversationLattice(
          inputObj.query as string,
          conversationRegistry,
          { workbenchUrl, topK: 10, verbose: false }
        );
        return `Found relevant context:\n\n${result}`;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    case 'get_background_tasks': {
      if (!getTaskManager) return 'Background task manager not available';
      const tm = getTaskManager();
      if (!tm) return 'Background task manager not initialized';
      const filter = (inputObj.filter as string) || 'all';
      const all = tm.getAllTasks();
      let filtered = all;
      if (filter === 'active')
        filtered = all.filter(
          (t) => t.status === 'running' || t.status === 'pending'
        );
      else if (filter === 'completed')
        filtered = all.filter((t) => t.status === 'completed');
      else if (filter === 'failed')
        filtered = all.filter(
          (t) => t.status === 'failed' || t.status === 'cancelled'
        );
      if (filtered.length === 0) return `No ${filter} background tasks`;
      return `Background tasks (${filter}):\n${filtered.map((t) => `- ${t.id}: ${t.status} (${t.progress || 0}%)`).join('\n')}`;
    }
    case 'list_agents': {
      if (!projectRoot) return 'Project root not available';
      try {
        const agents = await getActiveAgents(projectRoot, agentId || '');
        return formatListAgents(agents.filter((a) => a.agentId !== agentId));
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    case 'send_agent_message': {
      if (!getMessagePublisher || !projectRoot)
        return 'IPC publisher or project root not available';
      const pub = getMessagePublisher();
      if (!pub) return formatNotInitialized('Message publisher');
      const targetAgentId = resolveAgentId(projectRoot, inputObj.to as string);
      if (!targetAgentId) return formatNotFound('agent', inputObj.to as string);
      const execute = withPermissionCheck(
        'send_agent_message',
        async () => {
          await pub.sendMessage(targetAgentId, inputObj.message as string);
          return formatMessageSent(
            inputObj.to as string,
            targetAgentId,
            inputObj.message as string
          );
        },
        onCanUseTool
      );
      return execute(inputObj);
    }
    case 'broadcast_agent_message': {
      if (!getMessagePublisher || !projectRoot)
        return 'IPC publisher or project root not available';
      const pub = getMessagePublisher();
      if (!pub) return formatNotInitialized('Message publisher');
      const execute = withPermissionCheck(
        'broadcast_agent_message',
        async () => {
          await pub.broadcast('agent.message', {
            type: 'text',
            message: inputObj.message as string,
          });
          const agents = await getActiveAgents(projectRoot, agentId || '');
          return formatBroadcastSent(agents.length, inputObj.message as string);
        },
        onCanUseTool
      );
      return execute(inputObj);
    }
    case 'list_pending_messages': {
      if (!getMessageQueue) return 'Message queue not available';
      const queue = getMessageQueue();
      if (!queue) return formatNotInitialized('Message queue');
      try {
        const msgs = await queue.getMessages('pending');
        return formatPendingMessages(msgs);
      } catch (err) {
        return formatError('list pending messages', (err as Error).message);
      }
    }
    case 'mark_message_read': {
      if (!getMessageQueue) return 'Message queue not available';
      const queue = getMessageQueue();
      if (!queue) return formatNotInitialized('Message queue');
      const execute = withPermissionCheck(
        'mark_message_read',
        async () => {
          const msg = await queue.getMessage(inputObj.messageId as string);
          if (!msg)
            return formatNotFound('Message', inputObj.messageId as string);
          const status =
            (inputObj.status as 'read' | 'injected' | 'dismissed') || 'read';
          await queue.updateStatus(inputObj.messageId as string, status);
          return formatMessageMarked(
            inputObj.messageId as string,
            status,
            msg.from,
            formatMessageContent(msg)
          );
        },
        onCanUseTool
      );
      return execute(inputObj);
    }
    case 'query_agent': {
      if (!getMessagePublisher || !getMessageQueue || !projectRoot)
        return 'IPC publisher, queue or project root not available';
      const pub = getMessagePublisher();
      const queue = getMessageQueue();
      if (!pub || !queue) return 'IPC not initialized';
      const execute = withPermissionCheck(
        'query_agent',
        async () => {
          const targetId = resolveAgentId(
            projectRoot,
            inputObj.target_alias as string
          );
          if (!targetId)
            return formatNotFound('agent', inputObj.target_alias as string);
          const queryId = crypto.randomUUID();
          await pub.sendMessage(
            targetId,
            JSON.stringify({
              type: 'query_request',
              queryId,
              question: inputObj.question as string,
            })
          );
          const start = Date.now();
          while (Date.now() - start < 60000) {
            const msgs = await queue.getMessages('pending');
            for (const m of msgs) {
              try {
                const p =
                  typeof m.content === 'string'
                    ? JSON.parse(m.content)
                    : m.content;
                if (
                  (p.type === 'query_response' || p.type === 'text') &&
                  p.queryId === queryId
                ) {
                  await queue.updateStatus(m.id, 'injected');
                  return `Answer from ${inputObj.target_alias}:\n\n${p.answer || p.message}`;
                }
              } catch {
                /* ignore */
              }
            }
            await new Promise((r) => setTimeout(r, 1000));
          }
          return 'Timeout waiting for response';
        },
        onCanUseTool
      );
      return execute(inputObj);
    }
    default:
      return `Tool ${toolName} not found`;
  }
}
