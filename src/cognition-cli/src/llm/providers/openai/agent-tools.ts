/**
 * OpenAI Agent SDK Tool Definitions for Cognition
 *
 * Maps Cognition tools to @openai/agents tool() format using the unified factory.
 */

import type { ConversationOverlayRegistry } from '../../../sigma/conversation-registry.js';
import type { BackgroundTaskManager } from '../../../tui/services/BackgroundTaskManager.js';
import { z } from 'zod';
import { systemLog } from '../../../utils/debug-logger.js';
import { tool } from '@openai/agents';
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
  sigmaTaskUpdateTool,
  listAgentsTool,
  listPendingMessagesTool,
  sendAgentMessageTool,
  broadcastAgentMessageTool,
  markMessageReadTool,
  queryAgentTool,
} from '../../tools/definitions.js';
import type { MessagePublisher } from '../../../ipc/MessagePublisher.js';
import type { MessageQueue } from '../../../ipc/MessageQueue.js';
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
import {
  getActiveAgents,
  resolveAgentId,
} from '../../../ipc/agent-discovery.js';
import { queryConversationLattice } from '../../../sigma/query-conversation.js';
import {
  formatTaskType,
  formatDuration,
  processSigmaTaskUpdateInput,
} from '../tool-helpers.js';
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
import type { OnCanUseTool } from '../tool-helpers.js';

/**
 * OpenAI tool type (return type of tool())
 */
type OpenAITool = ReturnType<typeof tool>;

export interface OpenAIToolsContext {
  cwd: string;
  workbenchUrl?: string;
  onCanUseTool?: OnCanUseTool;
  onToolOutput?: (output: string) => void;
  currentPromptTokens?: number;
  conversationRegistry?: ConversationOverlayRegistry;
  getTaskManager?: () => BackgroundTaskManager | null;
  getActiveTaskId?: () => string | null;
  publisher?: MessagePublisher;
  mode?: 'solo' | 'full';
  projectRoot?: string;
  agentId?: string;
  anchorId?: string;
  onTaskCompleted?: (
    taskId: string,
    result_summary?: string | null
  ) => Promise<void>;
  getMessagePublisher?: () => MessagePublisher | null;
  getMessageQueue?: () => MessageQueue | null;
}

// ============================================================
// Tool Creators
// ============================================================

function createSigmaTaskUpdateTool(
  cwd: string,
  anchorId: string | undefined,
  onTaskCompleted?: (
    taskId: string,
    result_summary?: string | null
  ) => Promise<void>
): OpenAITool {
  return providerToolFactory.createOpenAITool(
    sigmaTaskUpdateTool,
    async (input: z.infer<typeof sigmaTaskUpdateTool.parameters>) => {
      // Process input to merge grounding/evidence and clean nulls
      const processedTodos = processSigmaTaskUpdateInput(input);

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
            const text = t.status === 'in_progress' ? t.activeForm : t.content;
            const suffix =
              t.status === 'delegated' && t.delegated_to
                ? ` (→ ${t.delegated_to})`
                : '';
            return `[${icon}] ${text}${suffix}`;
          })
          .join('\n');
        return `Task list updated (${processedTodos.length} items) [NOT PERSISTED]:\n${summary}`;
      }

      const result = await executeSigmaTaskUpdate(
        processedTodos,
        cwd,
        anchorId
      );

      if (onTaskCompleted) {
        const { loadSessionState } =
          await import('../../../sigma/session-state.js');
        const finalState = loadSessionState(anchorId, cwd);

        for (const todo of processedTodos) {
          if (todo.status === 'completed') {
            const validatedTask = finalState?.todos?.find(
              (t) => t.id === todo.id
            );
            const summaryToPass =
              validatedTask?.result_summary || todo.result_summary;
            await onTaskCompleted(todo.id, summaryToPass);
          }
        }
      }

      return result;
    }
  );
}

function createReadFileTool(
  workbenchUrl?: string,
  currentPromptTokens?: number,
  getActiveTaskId?: () => string | null
): OpenAITool {
  return providerToolFactory.createOpenAITool(
    readFileTool,
    (input: z.infer<typeof readFileTool.parameters>) =>
      executeReadFile(
        input.file_path,
        input.limit,
        input.offset,
        workbenchUrl,
        currentPromptTokens,
        getActiveTaskId
      )
  );
}

function createGlobTool(
  cwd: string,
  getActiveTaskId?: () => string | null
): OpenAITool {
  return providerToolFactory.createOpenAITool(
    globTool,
    (input: z.infer<typeof globTool.parameters>) =>
      executeGlob(input.pattern, input.path || cwd, getActiveTaskId)
  );
}

function createGrepTool(
  cwd: string,
  workbenchUrl?: string,
  currentPromptTokens?: number,
  getActiveTaskId?: () => string | null
): OpenAITool {
  return providerToolFactory.createOpenAITool(
    grepTool,
    (input: z.infer<typeof grepTool.parameters>) =>
      executeGrep(
        input.pattern,
        input.path || cwd,
        input.glob_filter,
        cwd,
        workbenchUrl,
        currentPromptTokens,
        getActiveTaskId
      )
  );
}

function createWriteFileTool(
  onCanUseTool?: OnCanUseTool,
  getActiveTaskId?: () => string | null
): OpenAITool {
  return providerToolFactory.createOpenAITool(
    writeFileTool,
    (input: z.infer<typeof writeFileTool.parameters>) =>
      executeWriteFile(input.file_path, input.content, getActiveTaskId),
    onCanUseTool
  );
}

function createBashTool(
  cwd: string,
  workbenchUrl?: string,
  onCanUseTool?: OnCanUseTool,
  onToolOutput?: (output: string) => void,
  currentPromptTokens?: number,
  getActiveTaskId?: () => string | null
): OpenAITool {
  return providerToolFactory.createOpenAITool(
    bashTool,
    (input: z.infer<typeof bashTool.parameters>) =>
      executeBash(
        input.command,
        input.timeout,
        cwd,
        onToolOutput,
        workbenchUrl,
        currentPromptTokens,
        getActiveTaskId
      ),
    onCanUseTool
  );
}

function createEditFileTool(
  onCanUseTool?: OnCanUseTool,
  getActiveTaskId?: () => string | null
): OpenAITool {
  return providerToolFactory.createOpenAITool(
    editFileTool,
    (input: z.infer<typeof editFileTool.parameters>) =>
      executeEditFile(
        input.file_path,
        input.old_string,
        input.new_string,
        input.replace_all,
        getActiveTaskId
      ),
    onCanUseTool
  );
}

function createFetchUrlTool(getActiveTaskId?: () => string | null): OpenAITool {
  return providerToolFactory.createOpenAITool(
    fetchUrlTool,
    (input: z.infer<typeof fetchUrlTool.parameters>) =>
      executeFetchUrl(input.url, getActiveTaskId)
  );
}

function createWebSearchTool(workbenchUrl?: string): OpenAITool {
  return providerToolFactory.createOpenAITool(
    webSearchTool,
    (input: z.infer<typeof webSearchTool.parameters>) =>
      executeWebSearch(input.request, workbenchUrl)
  );
}

function createRecallTool(
  conversationRegistry: ConversationOverlayRegistry,
  workbenchUrl?: string
): OpenAITool {
  return providerToolFactory.createOpenAITool(
    recallPastConversationTool,
    async (input: z.infer<typeof recallPastConversationTool.parameters>) => {
      try {
        const answer = await queryConversationLattice(
          input.query,
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
    }
  );
}

function createBackgroundTasksTool(
  getTaskManager: () => BackgroundTaskManager | null
): OpenAITool {
  return providerToolFactory.createOpenAITool(
    getBackgroundTasksTool,
    async (input: z.infer<typeof getBackgroundTasksTool.parameters>) => {
      const filter = input.filter || 'all';
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
    }
  );
}

function createListAgentsTool(
  projectRoot: string,
  currentAgentId: string
): OpenAITool {
  return providerToolFactory.createOpenAITool(listAgentsTool, async () => {
    try {
      const agents = getActiveAgents(projectRoot, currentAgentId);
      return formatListAgents(agents);
    } catch (err) {
      return formatError('list agents', (err as Error).message);
    }
  });
}

function createSendMessageTool(
  getMessagePublisher: () => MessagePublisher | null,
  projectRoot: string,
  onCanUseTool?: OnCanUseTool
): OpenAITool {
  return providerToolFactory.createOpenAITool(
    sendAgentMessageTool,
    async (input: z.infer<typeof sendAgentMessageTool.parameters>) => {
      try {
        const publisher = getMessagePublisher();
        if (!publisher) return formatNotInitialized('Message publisher');
        const targetAgentId = resolveAgentId(projectRoot, input.to);
        if (!targetAgentId) return formatNotFound('agent', input.to);
        await publisher.sendMessage(targetAgentId, input.message);
        return formatMessageSent(input.to, targetAgentId, input.message);
      } catch (err) {
        return formatError('send message', (err as Error).message);
      }
    },
    onCanUseTool
  );
}

function createBroadcastTool(
  getMessagePublisher: () => MessagePublisher | null,
  projectRoot: string,
  currentAgentId: string,
  onCanUseTool?: OnCanUseTool
): OpenAITool {
  return providerToolFactory.createOpenAITool(
    broadcastAgentMessageTool,
    async (input: z.infer<typeof broadcastAgentMessageTool.parameters>) => {
      try {
        const publisher = getMessagePublisher();
        if (!publisher) return formatNotInitialized('Message publisher');
        await publisher.broadcast('agent.message', {
          type: 'text',
          message: input.message,
        });
        const agents = getActiveAgents(projectRoot, currentAgentId);
        return formatBroadcastSent(agents.length, input.message);
      } catch (err) {
        return formatError('broadcast message', (err as Error).message);
      }
    },
    onCanUseTool
  );
}

function createListPendingMessagesTool(
  getMessageQueue: () => MessageQueue | null
): OpenAITool {
  return providerToolFactory.createOpenAITool(
    listPendingMessagesTool,
    async () => {
      try {
        const queue = getMessageQueue();
        if (!queue) return formatNotInitialized('Message queue');
        const messages = await queue.getMessages('pending');
        return formatPendingMessages(messages);
      } catch (err) {
        return formatError('list messages', (err as Error).message);
      }
    }
  );
}

function createMarkMessageReadTool(
  getMessageQueue: () => MessageQueue | null,
  onCanUseTool?: OnCanUseTool
): OpenAITool {
  return providerToolFactory.createOpenAITool(
    markMessageReadTool,
    async (input: z.infer<typeof markMessageReadTool.parameters>) => {
      try {
        const queue = getMessageQueue();
        if (!queue) return formatNotInitialized('Message queue');
        const message = await queue.getMessage(input.messageId);
        if (!message) return formatNotFound('Message', input.messageId);
        const newStatus = input.status || 'injected';
        await queue.updateStatus(input.messageId, newStatus);
        return formatMessageMarked(
          input.messageId,
          newStatus,
          message.from,
          formatMessageContent(message)
        );
      } catch (err) {
        return formatError('mark message read', (err as Error).message);
      }
    },
    onCanUseTool
  );
}

function createQueryAgentTool(
  getMessagePublisher: () => MessagePublisher | null,
  getMessageQueue: () => MessageQueue | null,
  projectRoot: string,
  onCanUseTool?: OnCanUseTool
): OpenAITool {
  return providerToolFactory.createOpenAITool(
    queryAgentTool,
    async (input: z.infer<typeof queryAgentTool.parameters>) => {
      try {
        const publisher = getMessagePublisher();
        const queue = getMessageQueue();
        if (!publisher || !queue)
          return formatNotInitialized('Message publisher or queue');
        const targetAgentId = resolveAgentId(projectRoot, input.agentId);
        if (!targetAgentId) return formatNotFound('agent', input.agentId);
        const queryId = crypto.randomUUID();
        await publisher.sendMessage(
          targetAgentId,
          JSON.stringify({
            type: 'query_request',
            queryId,
            question: input.query,
          })
        );
        const TIMEOUT_MS = 60000;
        const startTime = Date.now();
        while (Date.now() - startTime < TIMEOUT_MS) {
          const messages = await queue.getMessages('pending');
          for (const msg of messages) {
            let responseData: { queryId: string; answer: string } | null = null;
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
            } else if (
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
                // Ignore malformed JSON
              }
            }
            if (responseData) {
              await queue.updateStatus(msg.id, 'injected');
              return `Query: "${input.query}"\n\nAnswer from ${input.agentId}:\n\n${responseData.answer}`;
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        return `⏱️ Timeout: No response from ${input.agentId} after ${TIMEOUT_MS / 1000}s. The agent may be offline or busy.`;
      } catch (err) {
        return formatError('query agent', (err as Error).message);
      }
    },
    onCanUseTool
  );
}

// ============================================================
// Main Export
// ============================================================

export function getOpenAITools({
  cwd,
  workbenchUrl,
  onCanUseTool,
  onToolOutput,
  currentPromptTokens,
  conversationRegistry,
  getTaskManager,
  getActiveTaskId,
  mode,
  projectRoot,
  agentId,
  anchorId,
  onTaskCompleted,
  getMessagePublisher,
  getMessageQueue,
}: OpenAIToolsContext): OpenAITool[] {
  const tools: OpenAITool[] = [];

  // Core file tools
  tools.push(
    createReadFileTool(workbenchUrl, currentPromptTokens, getActiveTaskId)
  );
  tools.push(createGlobTool(cwd, getActiveTaskId));
  tools.push(
    createGrepTool(cwd, workbenchUrl, currentPromptTokens, getActiveTaskId)
  );

  // Mutating tools
  tools.push(createWriteFileTool(onCanUseTool, getActiveTaskId));
  tools.push(
    createBashTool(
      cwd,
      workbenchUrl,
      onCanUseTool,
      onToolOutput,
      currentPromptTokens,
      getActiveTaskId
    )
  );
  tools.push(createEditFileTool(onCanUseTool, getActiveTaskId));

  // SigmaTaskUpdate
  if (!anchorId) {
    systemLog(
      'sigma',
      'SigmaTaskUpdate initialized without anchorId. Tasks will NOT be persisted.',
      undefined,
      'warn'
    );
  }
  tools.push(createSigmaTaskUpdateTool(cwd, anchorId, onTaskCompleted));

  // Web tools
  tools.push(createFetchUrlTool(getActiveTaskId));
  tools.push(createWebSearchTool(workbenchUrl));

  // Memory tools
  if (conversationRegistry) {
    tools.push(createRecallTool(conversationRegistry, workbenchUrl));
  }

  // Background tools
  if (getTaskManager) {
    tools.push(createBackgroundTasksTool(getTaskManager));
  }

  // IPC tools
  if (
    mode !== 'solo' &&
    getMessagePublisher &&
    getMessageQueue &&
    projectRoot &&
    agentId
  ) {
    tools.push(createListAgentsTool(projectRoot, agentId));
    tools.push(createListPendingMessagesTool(getMessageQueue));
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
    tools.push(
      createQueryAgentTool(
        getMessagePublisher,
        getMessageQueue,
        projectRoot,
        onCanUseTool
      )
    );
  }

  return tools;
}
