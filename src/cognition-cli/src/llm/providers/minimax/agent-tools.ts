/**
 * Tool Definitions for Minimax Agent Provider
 *
 * Uses unified tools from llm/tools/unified-tools.ts.
 */

import {
  getUnifiedTools,
  UnifiedToolsContext,
  UnifiedTool,
} from '../../tools/unified-tools.js';
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
  onTaskCompleted?: (
    taskId: string,
    result_summary?: string | null
  ) => Promise<void>;
  /** Callback to get the currently active task ID */
  getActiveTaskId?: () => string | null;
  /** Operation mode (solo = skip IPC/PGC tools) */
  mode?: 'solo' | 'full';
  /** Current prompt tokens for dynamic optimization */
  currentPromptTokens?: number;
}

export type MinimaxTool = UnifiedTool;

/**
 * Get the unified tools context for Minimax
 */
function getContext(context: MinimaxToolsContext): UnifiedToolsContext {
  return {
    cwd: context.cwd || process.cwd(),
    projectRoot: context.projectRoot,
    agentId: context.agentId,
    anchorId: context.anchorId,
    workbenchUrl: context.workbenchUrl,
    onToolOutput: context.onToolOutput,
    currentPromptTokens: context.currentPromptTokens,
    getActiveTaskId: context.getActiveTaskId,
    onCanUseTool: context.onCanUseTool,
    onTaskCompleted: context.onTaskCompleted,
    conversationRegistry: context.conversationRegistry,
    getTaskManager: context.getTaskManager,
    getMessagePublisher: context.getMessagePublisher,
    getMessageQueue: context.getMessageQueue,
    mode: context.mode,
  };
}

/**
 * Get all tools for Minimax
 */
export function getMinimaxTools(context: MinimaxToolsContext): MinimaxTool[] {
  return getUnifiedTools(getContext(context), 'minimax');
}

/**
 * Execute a tool for Minimax
 */
export async function executeMinimaxTool(
  toolName: string,
  input: unknown,
  context: MinimaxToolsContext
): Promise<string> {
  const tools = getMinimaxTools(context);
  const tool = tools.find((t) => t.name === toolName);

  if (!tool) {
    return `Tool ${toolName} not found.`;
  }

  try {
    const executableTool = tool as {
      execute?: (args: Record<string, unknown>) => Promise<string>;
    };
    if (executableTool.execute) {
      return await executableTool.execute(input as Record<string, unknown>);
    }
    return `Tool ${toolName} is not executable in this context.`;
  } catch (error) {
    return `Error executing tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`;
  }
}
