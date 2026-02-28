import { z } from 'zod';
import { tool } from '@openai/agents';
import { FunctionTool, type ToolContext, type Session } from '@google/adk';
import { providerToolFactory } from './factory.js';
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
  sigmaTaskUpdateTool,
  listAgentsTool,
  listPendingMessagesTool,
  sendAgentMessageTool,
  broadcastAgentMessageTool,
  markMessageReadTool,
  queryAgentTool,
} from './definitions.js';
import type { ToolDefinition } from './definitions.js';
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
} from '../providers/tool-executors.js';
import type { ConversationOverlayRegistry } from '../../sigma/conversation-registry.js';
import { queryConversationLattice } from '../../sigma/query-conversation.js';
import type { BackgroundTaskManager } from '../../tui/services/BackgroundTaskManager.js';
import type { MessagePublisher } from '../../ipc/MessagePublisher.js';
import type { MessageQueue, MessageStatus } from '../../ipc/MessageQueue.js';
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
import {
  formatTaskType,
  formatDuration,
  processSigmaTaskUpdateInput,
  type OnCanUseTool,
} from '../providers/tool-helpers.js';

/**
 * Type representing any of the supported tool formats.
 */
export type UnifiedTool =
  | FunctionTool
  | ReturnType<typeof tool>
  | {
      name: string;
      description: string;
      input_schema: unknown;
      execute?: (
        args: Record<string, unknown>,
        toolContext?: ToolContext
      ) => Promise<string>;
    };

/**
 * Comprehensive context required by all tools across different providers.
 */
export interface UnifiedToolsContext {
  // Core
  cwd: string;
  projectRoot?: string;
  agentId?: string;
  anchorId?: string;

  // UI/Environment
  workbenchUrl?: string;
  onToolOutput?: (output: string) => void;
  currentPromptTokens?: number;
  getActiveTaskId?: () => string | null;

  // Callbacks
  onCanUseTool?: OnCanUseTool;
  onTaskCompleted?: (
    taskId: string,
    result_summary?: string | null,
    session?: Session
  ) => Promise<void>;

  // Feature Services
  conversationRegistry?: ConversationOverlayRegistry;
  getTaskManager?: () => BackgroundTaskManager | null;
  getMessagePublisher?: () => MessagePublisher | null;
  getMessageQueue?: () => MessageQueue | null;

  // Config
  mode?: 'solo' | 'full';
}

/**
 * Provider types supported by the unified tool factory.
 */
export type ProviderType = 'gemini' | 'openai' | 'minimax';

/**
 * Get the full list of tools for a specific provider using unified logic.
 */
export function getUnifiedTools(
  context: UnifiedToolsContext,
  provider: ProviderType
): UnifiedTool[] {
  const tools: UnifiedTool[] = [];
  const factory = providerToolFactory;

  // Helper to create tool based on provider type
  const createTool = <T extends z.ZodObject<z.ZodRawShape>>(
    definition: ToolDefinition<T>,
    executor: (args: z.infer<T>, toolContext?: ToolContext) => Promise<string>,
    onCanUseTool?: OnCanUseTool
  ): UnifiedTool => {
    switch (provider) {
      case 'gemini':
        return factory.createGeminiTool(definition, executor, onCanUseTool);
      case 'openai':
        return factory.createOpenAITool(definition, executor, onCanUseTool);
      case 'minimax':
        // Minimax currently uses the tool definition directly as it maps to its own format
        // We'll return the definition with an attached executor for Minimax to use
        return { ...factory.createMinimaxTool(definition), execute: executor };
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  };

  // --- Core File Tools ---

  tools.push(
    createTool(readFileTool, (args) =>
      executeReadFile(
        args.file_path,
        args.limit,
        args.offset,
        context.workbenchUrl,
        context.currentPromptTokens,
        context.getActiveTaskId
      )
    )
  );

  tools.push(
    createTool(
      writeFileTool,
      (args) =>
        executeWriteFile(args.file_path, args.content, context.getActiveTaskId),
      context.onCanUseTool
    )
  );

  tools.push(
    createTool(globTool, (args) =>
      executeGlob(
        args.pattern,
        args.path || context.cwd,
        context.getActiveTaskId
      )
    )
  );

  tools.push(
    createTool(grepTool, (args) =>
      executeGrep(
        args.pattern,
        args.path || context.cwd,
        args.glob_filter,
        context.cwd,
        context.workbenchUrl,
        context.currentPromptTokens,
        context.getActiveTaskId
      )
    )
  );

  tools.push(
    createTool(
      bashTool,
      (args) =>
        executeBash(
          args.command,
          args.timeout,
          context.cwd,
          context.onToolOutput,
          context.workbenchUrl,
          context.currentPromptTokens,
          context.getActiveTaskId
        ),
      context.onCanUseTool
    )
  );

  tools.push(
    createTool(
      editFileTool,
      (args) =>
        executeEditFile(
          args.file_path,
          args.old_string,
          args.new_string,
          args.replace_all,
          context.getActiveTaskId
        ),
      context.onCanUseTool
    )
  );

  // --- Web Tools ---

  tools.push(
    createTool(fetchUrlTool, (args) =>
      executeFetchUrl(args.url, context.getActiveTaskId)
    )
  );

  // Gemini uses a specialized WebSearch agent-tool in GeminiAgentProvider
  // to leverage native Google Search integration. We skip the generic one here.
  if (provider !== 'gemini') {
    tools.push(
      createTool(webSearchTool, (args) =>
        executeWebSearch(args.request, context.workbenchUrl)
      )
    );
  }

  // --- SigmaTaskUpdate ---

  tools.push(
    createTool(sigmaTaskUpdateTool, async (args, toolContext) => {
      const processedTodos = processSigmaTaskUpdateInput(args);
      const anchorId = context.anchorId;
      const cwd = context.projectRoot || context.cwd;

      if (!anchorId) {
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
            const text = t.status === 'in_progress' ? t.activeForm : t.content;
            return `[${icon}] ${text}${t.status === 'delegated' && t.delegated_to ? ` (→ ${t.delegated_to})` : ''}`;
          })
          .join('\n');
        return `Task list updated (${processedTodos.length} items) [NOT PERSISTED]:\n${summary}`;
      }

      const result = await executeSigmaTaskUpdate(
        processedTodos,
        cwd,
        anchorId
      );

      if (context.onTaskCompleted) {
        const { loadSessionState } =
          await import('../../sigma/session-state.js');
        const finalState = loadSessionState(anchorId, cwd);

        for (const todo of processedTodos) {
          if (todo.status === 'completed') {
            const validatedTask = finalState?.todos?.find(
              (t) => t.id === todo.id
            );
            const summaryToPass =
              validatedTask?.result_summary || todo.result_summary;

            // Pass session for Gemini ADK if available
            const session = (
              toolContext as {
                invocationContext?: { session?: Session };
              } | null
            )?.invocationContext?.session;
            await context.onTaskCompleted(todo.id, summaryToPass, session);
          }
        }
      }

      return result;
    })
  );

  // --- Memory Tools ---

  if (context.conversationRegistry) {
    tools.push(
      createTool(recallPastConversationTool, async (args) => {
        try {
          const answer = await queryConversationLattice(
            args.query,
            context.conversationRegistry!,
            {
              workbenchUrl: context.workbenchUrl,
              topK: 10,
              verbose: false,
            }
          );
          return `Found relevant context:\n\n${answer}`;
        } catch (err) {
          return `Failed to recall conversation: ${(err as Error).message}`;
        }
      })
    );
  }

  // --- Background Tools ---

  if (context.getTaskManager) {
    tools.push(
      createTool(getBackgroundTasksTool, async (args) => {
        const filter = args.filter || 'all';
        try {
          const taskManager = context.getTaskManager!();
          if (!taskManager) return 'Background task manager not initialized.';

          const allTasks = taskManager.getAllTasks();
          let filteredTasks = allTasks;
          if (filter === 'active')
            filteredTasks = allTasks.filter(
              (t) => t.status === 'running' || t.status === 'pending'
            );
          else if (filter === 'completed')
            filteredTasks = allTasks.filter((t) => t.status === 'completed');
          else if (filter === 'failed')
            filteredTasks = allTasks.filter(
              (t) => t.status === 'failed' || t.status === 'cancelled'
            );

          const summary = taskManager.getSummary();
          const activeTask = taskManager.getActiveTask();

          let text = '';
          if (activeTask) {
            const progress =
              activeTask.progress !== undefined
                ? ` (${Math.round(activeTask.progress)}%)`
                : '';
            text += `**Active Task**: ${formatTaskType(activeTask)}${progress}\n`;
            if (activeTask.message) text += `  Status: ${activeTask.message}\n`;
            text += '\n';
          } else {
            text += '**No active tasks**\n\n';
          }

          text += `**Summary**: ${summary.total} total, ${summary.active} active, ${summary.completed} completed, ${summary.failed} failed\n\n`;

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
            }
          }
          return text;
        } catch (err) {
          return `Failed to get background tasks: ${(err as Error).message}`;
        }
      })
    );
  }

  // --- IPC Tools ---

  if (
    context.mode !== 'solo' &&
    context.getMessagePublisher &&
    context.getMessageQueue &&
    context.projectRoot &&
    context.agentId
  ) {
    const projectRoot = context.projectRoot;
    const currentAgentId = context.agentId;

    tools.push(
      createTool(listAgentsTool, async () => {
        try {
          const agents = getActiveAgents(projectRoot, currentAgentId);
          return formatListAgents(agents);
        } catch (err) {
          return formatError('list agents', (err as Error).message);
        }
      })
    );

    tools.push(
      createTool(listPendingMessagesTool, async (args) => {
        try {
          const queue = context.getMessageQueue!();
          if (!queue) return formatNotInitialized('Message queue');
          const messages = await queue.getMessages(
            (args.filter as MessageStatus) || 'pending'
          );
          return formatPendingMessages(messages);
        } catch (err) {
          return formatError('list messages', (err as Error).message);
        }
      })
    );

    tools.push(
      createTool(
        sendAgentMessageTool,
        async (args) => {
          try {
            const publisher = context.getMessagePublisher!();
            if (!publisher) return formatNotInitialized('Message publisher');
            const targetAgentId = resolveAgentId(projectRoot, args.to);
            if (!targetAgentId) return formatNotFound('agent', args.to);
            await publisher.sendMessage(targetAgentId, args.message);
            return formatMessageSent(args.to, targetAgentId, args.message);
          } catch (err) {
            return formatError('send message', (err as Error).message);
          }
        },
        context.onCanUseTool
      )
    );

    tools.push(
      createTool(
        broadcastAgentMessageTool,
        async (args) => {
          try {
            const publisher = context.getMessagePublisher!();
            if (!publisher) return formatNotInitialized('Message publisher');
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
        context.onCanUseTool
      )
    );

    tools.push(
      createTool(
        markMessageReadTool,
        async (args) => {
          try {
            const queue = context.getMessageQueue!();
            if (!queue) return formatNotInitialized('Message queue');
            const message = await queue.getMessage(args.messageId);
            if (!message) return formatNotFound('Message', args.messageId);
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
        context.onCanUseTool
      )
    );

    tools.push(
      createTool(
        queryAgentTool,
        async (args) => {
          try {
            const publisher = context.getMessagePublisher!();
            const queue = context.getMessageQueue!();
            if (!publisher || !queue)
              return formatNotInitialized('Message publisher or queue');
            const targetAgentId = resolveAgentId(projectRoot, args.agentId);
            if (!targetAgentId) return formatNotFound('agent', args.agentId);
            const queryId = crypto.randomUUID();
            await publisher.sendMessage(
              targetAgentId,
              JSON.stringify({
                type: 'query_request',
                queryId,
                question: args.query,
              })
            );

            const TIMEOUT_MS = 60000;
            const startTime = Date.now();
            while (Date.now() - startTime < TIMEOUT_MS) {
              const messages = await queue.getMessages('pending');
              for (const msg of messages) {
                let responseAnswer: string | null = null;
                const content = msg.content as Record<string, unknown> | null;

                if (content && typeof content === 'object') {
                  if (
                    content.type === 'query_response' &&
                    content.queryId === queryId
                  ) {
                    responseAnswer = content.answer as string;
                  } else if (
                    content.type === 'text' &&
                    typeof content.message === 'string'
                  ) {
                    try {
                      const parsed = JSON.parse(content.message);
                      if (
                        parsed.type === 'query_response' &&
                        parsed.queryId === queryId
                      ) {
                        responseAnswer = parsed.answer;
                      }
                    } catch {
                      // Not a JSON query response, ignore
                    }
                  }
                }

                if (responseAnswer) {
                  await queue.updateStatus(msg.id, 'injected');
                  return `Query: "${args.query}"\n\nAnswer from ${args.agentId}:\n\n${responseAnswer}`;
                }
              }
              await new Promise((r) => setTimeout(r, 500));
            }
            return `⏱️ Timeout: No response from ${args.agentId}.`;
          } catch (err) {
            return formatError('query agent', (err as Error).message);
          }
        },
        context.onCanUseTool
      )
    );
  }

  return tools;
}
