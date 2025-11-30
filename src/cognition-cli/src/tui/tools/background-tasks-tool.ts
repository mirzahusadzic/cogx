/**
 * Background Tasks Tool
 *
 * MCP tool that allows Claude to query status of background operations
 * (genesis, overlay generation, file watching).
 *
 * This enables the agent to be aware of ongoing work and provide
 * context-appropriate responses (e.g., "Genesis is 67% complete").
 */

import { z } from 'zod';
import type {
  BackgroundTask,
  BackgroundTaskManager,
} from '../services/BackgroundTaskManager.js';

type ClaudeAgentSdk = {
  tool: (
    name: string,
    description: string,
    inputSchema: unknown,
    action: unknown
  ) => unknown;
  createSdkMcpServer: (config: unknown) => unknown;
};

/**
 * Create background tasks MCP server
 *
 * This MCP server provides Claude with awareness of background operations.
 * The agent can query task status to provide informed responses.
 *
 * DESIGN:
 * - MCP tool integration via SDK's createSdkMcpServer
 * - Filter by status: 'all', 'active', 'completed', 'failed'
 * - Returns task list with progress and summary statistics
 *
 * @param getTaskManager - Function to get the BackgroundTaskManager instance
 * @param claudeAgentSdk - The dynamically imported Claude Agent SDK module
 * @returns MCP server instance with get_background_tasks tool
 *
 * @example
 * const server = createBackgroundTasksMcpServer(() => taskManager, claudeSdk);
 * // Claude can now use: "get_background_tasks" tool to check status
 */
export function createBackgroundTasksMcpServer(
  getTaskManager: () => BackgroundTaskManager | null,
  claudeAgentSdk: ClaudeAgentSdk | undefined
) {
  if (!claudeAgentSdk) {
    return undefined;
  }

  const { tool, createSdkMcpServer } = claudeAgentSdk;

  const backgroundTasksTool = tool(
    'get_background_tasks',
    'Query status of background operations (genesis, overlay generation). Use this to check if work is in progress, view progress percentage, or see completed/failed tasks.',
    {
      filter: z
        .enum(['all', 'active', 'completed', 'failed'])
        .default('all')
        .describe(
          'Filter tasks by status: "all" for everything, "active" for running/pending, "completed" for finished, "failed" for errors'
        ),
    },
    async (args: { filter?: string }) => {
      try {
        const taskManager = getTaskManager();

        if (!taskManager) {
          return {
            content: [
              {
                type: 'text',
                text: 'Background task manager not initialized. No background operations are running.',
              },
            ],
          };
        }

        const allTasks = taskManager.getAllTasks();
        const filter = args.filter || 'all';

        // Filter tasks based on requested filter
        let filteredTasks: BackgroundTask[];
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

        // Format response for Claude
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

        return {
          content: [
            {
              type: 'text',
              text,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to get background tasks: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return createSdkMcpServer({
    name: 'background-tasks',
    version: '1.0.0',
    tools: [backgroundTasksTool],
  });
}

/**
 * Format task type for display
 */
function formatTaskType(task: BackgroundTask): string {
  switch (task.type) {
    case 'genesis':
      return 'Genesis (code analysis)';
    case 'genesis-docs':
      return 'Document Ingestion';
    case 'overlay':
      return task.overlay
        ? `${task.overlay} Overlay Generation`
        : 'Overlay Generation';
    default:
      return 'Background Task';
  }
}

/**
 * Format duration between two dates
 */
function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}
