/**
 * Tool Definitions for Minimax Agent Provider
 *
 * Maps Cognition tools to Anthropic SDK tool format.
 * Uses shared tool executors from tool-executors.ts and the unified tool factory.
 */

import crypto from 'node:crypto';
import { providerToolFactory } from '../../tools/factory.js';
import {
  readFileTool,
  writeFileTool,
  globTool,
  grepTool,
  bashTool,
  editFileTool,
  fetchUrlTool,
  webSearchTool,
  recallPastConversationTool,
  getBackgroundTasksTool,
  listAgentsTool,
  listPendingMessagesTool,
  sendAgentMessageTool,
  broadcastAgentMessageTool,
  markMessageReadTool,
  queryAgentTool,
  sigmaTaskUpdateTool,
} from '../../tools/definitions.js';
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
} from '../tool-executors.js';
import {
  processSigmaTaskUpdateInput,
  getSigmaTaskUpdateDescription,
} from '../tool-helpers.js';
import { queryConversationLattice } from '../../../sigma/query-conversation.js';
import {
  getActiveAgents,
  resolveAgentId,
} from '../../../ipc/agent-discovery.js';
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
} from '../../../ipc/agent-messaging-formatters.js';
import type { MessageStatus } from '../../../ipc/MessageQueue.js';
import type { ConversationOverlayRegistry } from '../../../sigma/conversation-registry.js';
import type { BackgroundTaskManager } from '../../../tui/services/BackgroundTaskManager.js';
import type { MessagePublisher } from '../../../ipc/MessagePublisher.js';
import type { MessageQueue } from '../../../ipc/MessageQueue.js';
import type { AgentRequest } from '../../agent-provider-interface.js';

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
  /** Callback for when a task is completed (triggers surgical eviction) */
  onTaskCompleted?: (taskId: string, result_summary?: string) => Promise<void>;
  /** Callback to get the currently active task ID */
  getActiveTaskId?: () => string | null;
  /** Operation mode (solo = skip IPC/PGC tools) */
  mode?: 'solo' | 'full';
  /** Current prompt tokens for dynamic optimization */
  currentPromptTokens?: number;
}

export interface MinimaxTool {
  name: string;
  description: string;
  input_schema: unknown;
}

/**
 * Helper to wrap tool implementation with permission check
 */
async function withPermission<T>(
  name: string,
  input: T,
  execute: (input: T) => Promise<string>,
  onCanUseTool?: AgentRequest['onCanUseTool']
): Promise<string> {
  if (!onCanUseTool) {
    return execute(input);
  }

  const decision = await onCanUseTool(name, input);

  if (decision.behavior === 'deny') {
    return 'User declined this action. Please continue with alternative approaches without asking why.';
  }

  const finalInput = (decision.updatedInput ?? input) as T;
  return execute(finalInput);
}

export function getMinimaxTools(context: MinimaxToolsContext): MinimaxTool[] {
  const { conversationRegistry, getTaskManager, mode, projectRoot, agentId } =
    context;

  const tools: MinimaxTool[] = [];

  // Core tools
  tools.push(providerToolFactory.createMinimaxTool(readFileTool));
  tools.push(providerToolFactory.createMinimaxTool(globTool));
  tools.push(providerToolFactory.createMinimaxTool(grepTool));
  tools.push(providerToolFactory.createMinimaxTool(writeFileTool));
  tools.push(providerToolFactory.createMinimaxTool(bashTool));
  tools.push(providerToolFactory.createMinimaxTool(editFileTool));

  // SigmaTaskUpdate
  const sigmaTaskDescription = getSigmaTaskUpdateDescription(mode);
  tools.push(
    providerToolFactory.createMinimaxTool(sigmaTaskUpdateTool, undefined, {
      description: sigmaTaskDescription,
    })
  );

  // Web tools
  tools.push(providerToolFactory.createMinimaxTool(fetchUrlTool));
  tools.push(providerToolFactory.createMinimaxTool(webSearchTool));

  // Memory tools
  if (conversationRegistry) {
    tools.push(
      providerToolFactory.createMinimaxTool(recallPastConversationTool)
    );
  }

  // Background tools
  if (getTaskManager) {
    tools.push(providerToolFactory.createMinimaxTool(getBackgroundTasksTool));
  }

  // IPC tools
  if (mode !== 'solo' && projectRoot && agentId) {
    tools.push(providerToolFactory.createMinimaxTool(listAgentsTool));
    tools.push(providerToolFactory.createMinimaxTool(listPendingMessagesTool));
    tools.push(providerToolFactory.createMinimaxTool(sendAgentMessageTool));
    tools.push(
      providerToolFactory.createMinimaxTool(broadcastAgentMessageTool)
    );
    tools.push(providerToolFactory.createMinimaxTool(markMessageReadTool));
    tools.push(providerToolFactory.createMinimaxTool(queryAgentTool));
  }

  return tools;
}

export async function executeMinimaxTool(
  toolName: string,
  input: unknown,
  context: MinimaxToolsContext
): Promise<string> {
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
    onToolOutput,
    currentPromptTokens,
    getActiveTaskId,
    onTaskCompleted,
  } = context;

  switch (toolName) {
    case 'read_file': {
      const args = readFileTool.parameters.parse(input);
      return executeReadFile(
        args.file_path,
        args.limit,
        args.offset,
        workbenchUrl,
        currentPromptTokens,
        getActiveTaskId
      );
    }

    case 'write_file': {
      const args = writeFileTool.parameters.parse(input);
      return withPermission(
        'write_file',
        args,
        (a) => executeWriteFile(a.file_path, a.content, getActiveTaskId),
        onCanUseTool
      );
    }

    case 'glob': {
      const args = globTool.parameters.parse(input);
      return executeGlob(
        args.pattern,
        args.path || cwd || process.cwd(),
        getActiveTaskId
      );
    }

    case 'grep': {
      const args = grepTool.parameters.parse(input);
      return executeGrep(
        args.pattern,
        args.path,
        args.glob_filter,
        cwd || process.cwd(),
        workbenchUrl,
        currentPromptTokens,
        getActiveTaskId
      );
    }

    case 'bash': {
      const args = bashTool.parameters.parse(input);
      return withPermission(
        'bash',
        args,
        (a) =>
          executeBash(
            a.command,
            a.timeout,
            cwd || process.cwd(),
            onToolOutput,
            workbenchUrl,
            currentPromptTokens,
            getActiveTaskId
          ),
        onCanUseTool
      );
    }

    case 'edit_file': {
      const args = editFileTool.parameters.parse(input);
      return withPermission(
        'edit_file',
        args,
        (a) =>
          executeEditFile(
            a.file_path,
            a.old_string,
            a.new_string,
            a.replace_all,
            getActiveTaskId
          ),
        onCanUseTool
      );
    }

    case 'SigmaTaskUpdate': {
      const args = sigmaTaskUpdateTool.parameters.parse(input);
      const processedTodos = processSigmaTaskUpdateInput(args);

      const result = await executeSigmaTaskUpdate(
        processedTodos,
        cwd || process.cwd(),
        anchorId || 'default'
      );

      if (onTaskCompleted) {
        for (const todo of processedTodos) {
          if (todo.status === 'completed') {
            await onTaskCompleted(todo.id, todo.result_summary ?? undefined);
          }
        }
      }

      return result;
    }

    case 'fetch_url': {
      const args = fetchUrlTool.parameters.parse(input);
      return executeFetchUrl(args.url, getActiveTaskId);
    }

    case 'WebSearch': {
      const args = webSearchTool.parameters.parse(input);
      return executeWebSearch(args.request, workbenchUrl);
    }

    case 'recall_past_conversation': {
      const args = recallPastConversationTool.parameters.parse(input);
      if (!conversationRegistry) return 'Conversation registry not available';
      try {
        const result = await queryConversationLattice(
          args.query,
          conversationRegistry,
          { workbenchUrl, topK: 10, verbose: false }
        );
        return `Found relevant context:\n\n${result}`;
      } catch (err) {
        return formatError('recall', (err as Error).message);
      }
    }

    case 'get_background_tasks': {
      const args = getBackgroundTasksTool.parameters.parse(input);
      if (!getTaskManager) return 'Background task manager not available';
      const tm = getTaskManager();
      if (!tm) return 'Background task manager not initialized';

      const filter = args.filter || 'all';
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
      return `Background tasks (${filter}):\n${filtered
        .map((t) => `- ${t.id}: ${t.status} (${t.progress || 0}%)`)
        .join('\n')}`;
    }

    case 'list_agents': {
      if (!projectRoot) return 'Project root not available';
      try {
        const agents = getActiveAgents(projectRoot, agentId || '');
        return formatListAgents(agents.filter((a) => a.agentId !== agentId));
      } catch (err) {
        return formatError('list agents', (err as Error).message);
      }
    }

    case 'send_agent_message': {
      const args = sendAgentMessageTool.parameters.parse(input);
      if (!getMessagePublisher || !projectRoot)
        return 'IPC publisher or project root not available';
      const pub = getMessagePublisher();
      if (!pub) return formatNotInitialized('Message publisher');

      return withPermission(
        'send_agent_message',
        args,
        async (a) => {
          const targetAgentId = resolveAgentId(projectRoot, a.to);
          if (!targetAgentId) return formatNotFound('agent', a.to);
          await pub.sendMessage(targetAgentId, a.message);
          return formatMessageSent(a.to, targetAgentId, a.message);
        },
        onCanUseTool
      );
    }

    case 'broadcast_agent_message': {
      const args = broadcastAgentMessageTool.parameters.parse(input);
      if (!getMessagePublisher || !projectRoot)
        return 'IPC publisher or project root not available';
      const pub = getMessagePublisher();
      if (!pub) return formatNotInitialized('Message publisher');

      return withPermission(
        'broadcast_agent_message',
        args,
        async (a) => {
          await pub.broadcast('agent.message', {
            type: 'text',
            message: a.message,
          });
          const agents = getActiveAgents(projectRoot, agentId || '');
          return formatBroadcastSent(agents.length, a.message);
        },
        onCanUseTool
      );
    }

    case 'list_pending_messages': {
      const args = listPendingMessagesTool.parameters.parse(input);
      if (!getMessageQueue) return 'Message queue not available';
      const queue = getMessageQueue();
      if (!queue) return formatNotInitialized('Message queue');
      try {
        const filter =
          args.filter === 'all'
            ? undefined
            : (args.filter as MessageStatus | undefined);
        const msgs = await queue.getMessages(filter);
        return formatPendingMessages(msgs);
      } catch (err) {
        return formatError('list pending messages', (err as Error).message);
      }
    }

    case 'mark_message_read': {
      const args = markMessageReadTool.parameters.parse(input);
      if (!getMessageQueue) return 'Message queue not available';
      const queue = getMessageQueue();
      if (!queue) return formatNotInitialized('Message queue');

      return withPermission(
        'mark_message_read',
        args,
        async (a) => {
          const msg = await queue.getMessage(a.messageId);
          if (!msg) return formatNotFound('Message', a.messageId);
          const status = (a.status || 'read') as MessageStatus;
          await queue.updateStatus(a.messageId, status);
          return formatMessageMarked(
            a.messageId,
            status,
            msg.from,
            formatMessageContent(msg)
          );
        },
        onCanUseTool
      );
    }

    case 'query_agent': {
      const args = queryAgentTool.parameters.parse(input);
      if (!getMessagePublisher || !getMessageQueue || !projectRoot)
        return 'IPC publisher, queue or project root not available';
      const pub = getMessagePublisher();
      const queue = getMessageQueue();
      if (!pub || !queue) return 'IPC not initialized';

      return withPermission(
        'query_agent',
        args,
        async (a) => {
          const targetId = resolveAgentId(projectRoot, a.agentId);
          if (!targetId) return formatNotFound('agent', a.agentId);
          const queryId = crypto.randomUUID();
          await pub.sendMessage(
            targetId,
            JSON.stringify({
              type: 'query_request',
              queryId,
              question: a.query,
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
                  return `Answer from ${a.agentId}:\n\n${p.answer || p.message}`;
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
    }

    default:
      return `Tool ${toolName} not found`;
  }
}
