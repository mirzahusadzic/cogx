/**
 * ADK Tool Definitions for Gemini Agent Provider
 *
 * Maps Cognition tools to Google ADK FunctionTool format.
 * Uses shared tool executors from tool-executors.ts and tool-helpers.ts.
 */

import { z } from 'zod';
import { FunctionTool, type ToolContext, type Session } from '@google/adk';
import { systemLog } from '../../../utils/debug-logger.js';
import { providerToolFactory } from '../../tools/factory.js';
import {
  readFileTool,
  writeFileTool,
  globTool,
  grepTool,
  bashTool,
  editFileTool,
  fetchUrlTool,
  recallPastConversationTool,
  getBackgroundTasksTool,
  sigmaTaskUpdateTool,
  listAgentsTool,
  sendAgentMessageTool,
  broadcastAgentMessageTool,
  listPendingMessagesTool,
  markMessageReadTool,
  queryAgentTool,
} from '../../tools/definitions.js';
import type { MessagePublisher } from '../../../ipc/MessagePublisher.js';
import type { MessageQueue, MessageStatus } from '../../../ipc/MessageQueue.js';
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
import type { ConversationOverlayRegistry } from '../../../sigma/conversation-registry.js';
import { queryConversationLattice } from '../../../sigma/query-conversation.js';
import type { BackgroundTaskManager } from '../../../tui/services/BackgroundTaskManager.js';
import type { OnCanUseTool } from '../tool-helpers.js';
import {
  formatTaskType,
  formatDuration,
  getSigmaTaskUpdateDescription,
  processSigmaTaskUpdateInput,
} from '../tool-helpers.js';
import {
  executeReadFile,
  executeWriteFile,
  executeGlob,
  executeGrep,
  executeBash,
  executeEditFile,
  executeSigmaTaskUpdate,
  executeFetchUrl,
} from '../tool-executors.js';

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
  return providerToolFactory.createGeminiTool(
    recallPastConversationTool,
    async (input) => {
      const { query } = input;
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
    }
  );
}

/**
 * Create background tasks tool for Gemini
 *
 * Allows Gemini to query status of background operations (genesis, overlay generation).
 */
function createBackgroundTasksTool(
  getTaskManager: () => BackgroundTaskManager | null
): FunctionTool {
  return providerToolFactory.createGeminiTool(
    getBackgroundTasksTool,
    async (input) => {
      const { filter: filterArg } = input;
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
    }
  );
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
  tools.push(
    providerToolFactory.createGeminiTool(
      listAgentsTool,
      async () => {
        try {
          const agents = getActiveAgents(projectRoot, currentAgentId);
          return formatListAgents(agents);
        } catch (err) {
          return formatError('list agents', (err as Error).message);
        }
      },
      onCanUseTool
    )
  );

  // Tool: Send message to agent
  tools.push(
    providerToolFactory.createGeminiTool(
      sendAgentMessageTool,
      async (args) => {
        if (process.env.DEBUG_GEMINI_TOOLS) {
          systemLog(
            'gemini-tools',
            'send_agent_message input',
            { args },
            'debug'
          );
        }
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
    )
  );

  // Tool: Broadcast message to all agents
  tools.push(
    providerToolFactory.createGeminiTool(
      broadcastAgentMessageTool,
      async (args) => {
        if (process.env.DEBUG_GEMINI_TOOLS) {
          systemLog(
            'gemini-tools',
            'broadcast_agent_message input',
            { args },
            'debug'
          );
        }
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
    )
  );

  // Tool: List pending messages
  tools.push(
    providerToolFactory.createGeminiTool(
      listPendingMessagesTool,
      async (args) => {
        if (process.env.DEBUG_GEMINI_TOOLS) {
          systemLog(
            'gemini-tools',
            'list_pending_messages input',
            { args },
            'debug'
          );
        }
        try {
          const queue = getMessageQueue ? getMessageQueue() : null;

          if (!queue) {
            return formatNotInitialized('Message queue');
          }

          const messages = await queue.getMessages(
            (args.filter as MessageStatus) || 'pending'
          );

          return formatPendingMessages(messages);
        } catch (err) {
          return formatError('list pending messages', (err as Error).message);
        }
      },
      onCanUseTool
    )
  );

  // Tool: Mark message as read/injected
  tools.push(
    providerToolFactory.createGeminiTool(
      markMessageReadTool,
      async (args) => {
        if (process.env.DEBUG_GEMINI_TOOLS) {
          systemLog(
            'gemini-tools',
            'mark_message_read input',
            { args },
            'debug'
          );
        }
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
    )
  );

  // Tool: Query another agent (cross-project semantic query)
  tools.push(
    providerToolFactory.createGeminiTool(
      queryAgentTool,
      async (args: z.infer<typeof queryAgentTool.parameters>) => {
        if (process.env.DEBUG_GEMINI_TOOLS) {
          systemLog('gemini-tools', 'query_agent input', { args }, 'debug');
        }
        try {
          const publisher = getMessagePublisher ? getMessagePublisher() : null;
          const queue = getMessageQueue ? getMessageQueue() : null;

          if (!publisher || !queue) {
            return formatNotInitialized('Message publisher or queue');
          }

          // Resolve alias to agent ID
          const targetAgentId = resolveAgentId(projectRoot, args.agentId);

          if (!targetAgentId) {
            return formatNotFound('agent', args.agentId);
          }

          // Generate unique query ID for request/response correlation
          const queryId = crypto.randomUUID();

          // Send the query to the target agent
          await publisher.sendMessage(
            targetAgentId,
            JSON.stringify({
              type: 'query_request',
              queryId,
              question: args.query,
            })
          );

          // Wait for response (60s timeout)
          const TIMEOUT_MS = 60000;
          const startTime = Date.now();

          while (Date.now() - startTime < TIMEOUT_MS) {
            const messages = await queue.getMessages('pending');

            for (const msg of messages) {
              let responseData: { queryId: string; answer: string } | null =
                null;

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
                responseData = msg.content as {
                  queryId: string;
                  answer: string;
                };
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

                return `Query: "${args.query}"\n\nAnswer from ${args.agentId}:\n\n${answer}`;
              }
            }

            // Poll every 500ms
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          // Timeout - no response received
          return `⏱️ Timeout: No response from ${args.agentId} after ${TIMEOUT_MS / 1000}s. The agent may be offline or busy.`;
        } catch (err) {
          return formatError('query agent', (err as Error).message);
        }
      }
    )
  );

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
  /** Callback when a task is completed (for log eviction) */
  onTaskCompleted?: (
    taskId: string,
    result_summary?: string | null,
    session?: Session
  ) => Promise<void>;
  /** Operation mode (solo = skip IPC/PGC tools) */
  mode?: 'solo' | 'full';
  /** Current prompt tokens for dynamic optimization */
  currentPromptTokens?: number;
  /** Fetch active task ID from memory to avoid disk I/O */
  getActiveTaskId?: () => string | null;
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
  const safeWriteFile = providerToolFactory.createGeminiTool(
    writeFileTool,
    ({ file_path, content }) =>
      executeWriteFile(file_path, content, options?.getActiveTaskId),
    onCanUseTool
  );

  // Create bash tool with permission check
  const safeBash = providerToolFactory.createGeminiTool(
    bashTool,
    ({ command, timeout }) =>
      executeBash(
        command,
        timeout,
        process.cwd(),
        options?.onToolOutput,
        undefined, // workbenchUrl
        options?.currentPromptTokens,
        options?.getActiveTaskId
      ),
    onCanUseTool
  );

  // Create edit_file tool with permission check
  const safeEditFile = providerToolFactory.createGeminiTool(
    editFileTool,
    ({ file_path, old_string, new_string, replace_all }) =>
      executeEditFile(
        file_path,
        old_string,
        new_string,
        replace_all,
        options?.getActiveTaskId
      ),
    onCanUseTool
  );

  const baseTools: FunctionTool[] = [
    providerToolFactory.createGeminiTool(
      readFileTool,
      ({ file_path, limit, offset }) =>
        executeReadFile(
          file_path,
          limit,
          offset,
          undefined, // workbenchUrl
          options?.currentPromptTokens,
          options?.getActiveTaskId
        ),
      onCanUseTool
    ),
    safeWriteFile,
    providerToolFactory.createGeminiTool(
      fetchUrlTool,
      ({ url }) => {
        if (process.env.DEBUG_GEMINI_TOOLS) {
          systemLog('gemini-tools', 'fetch_url input', { url }, 'debug');
        }
        return executeFetchUrl(url, options?.getActiveTaskId);
      },
      onCanUseTool
    ),
    providerToolFactory.createGeminiTool(
      globTool,
      (input) => {
        const { pattern, path: globCwd } = input;
        if (process.env.DEBUG_GEMINI_TOOLS) {
          systemLog(
            'gemini-tools',
            'glob input',
            { pattern, cwd: globCwd },
            'debug'
          );
        }
        return executeGlob(
          pattern,
          globCwd || process.cwd(),
          options?.getActiveTaskId
        );
      },
      onCanUseTool
    ),
    providerToolFactory.createGeminiTool(
      grepTool,
      ({ pattern, path: searchPath, glob_filter }) =>
        executeGrep(
          pattern,
          searchPath,
          glob_filter,
          process.cwd(),
          undefined, // workbenchUrl
          options?.currentPromptTokens,
          options?.getActiveTaskId
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
    const boundSigmaTaskUpdateTool = providerToolFactory.createGeminiTool(
      sigmaTaskUpdateTool,
      async (inputData, toolContext?: ToolContext) => {
        if (process.env.DEBUG_GEMINI_TOOLS) {
          systemLog(
            'gemini-tools',
            'SigmaTaskUpdate input',
            { inputData },
            'debug'
          );
        }

        // Process input to merge grounding/evidence and clean nulls
        const processedTodos = processSigmaTaskUpdateInput(inputData);

        if (process.env.DEBUG_GEMINI_TOOLS) {
          systemLog(
            'gemini-tools',
            'Processed todos',
            { processedTodos },
            'debug'
          );
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
        const result = await executeSigmaTaskUpdate(
          processedTodos,
          cwd,
          anchorId
        );

        // Notify provider of completed tasks for surgical token eviction
        if (options?.onTaskCompleted) {
          const { loadSessionState } =
            await import('../../../sigma/session-state.js');
          const finalState = loadSessionState(anchorId, cwd);

          const completedTasks = processedTodos.filter(
            (t) => t.status === 'completed'
          );
          for (const task of completedTasks) {
            try {
              const validatedTask = finalState?.todos?.find(
                (t) => t.id === task.id
              );
              const summaryToPass =
                validatedTask?.result_summary || task.result_summary;

              const activeSession = toolContext?.invocationContext?.session;
              await options.onTaskCompleted(
                task.id,
                summaryToPass,
                activeSession
              );
            } catch (err) {
              systemLog(
                'sigma',
                `Failed to trigger eviction for task ${task.id}`,
                { error: err instanceof Error ? err.message : String(err) },
                'error'
              );
            }
          }
        }

        return result;
      },
      undefined,
      { description: getSigmaTaskUpdateDescription(options?.mode) }
    );
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
