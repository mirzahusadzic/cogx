/**
 * OpenAI Agent SDK Tool Definitions for Cognition
 *
 * Uses unified tools from llm/tools/unified-tools.ts.
 */

import type { ConversationOverlayRegistry } from '../../../sigma/conversation-registry.js';
import type { BackgroundTaskManager } from '../../../tui/services/BackgroundTaskManager.js';
import type { MessagePublisher } from '../../../ipc/MessagePublisher.js';
import type { MessageQueue } from '../../../ipc/MessageQueue.js';
import type { OnCanUseTool } from '../tool-helpers.js';
import {
  getUnifiedTools,
  UnifiedToolsContext,
  UnifiedTool,
} from '../../tools/unified-tools.js';

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

/**
 * Get all tools for OpenAI
 */
export function getOpenAITools(context: OpenAIToolsContext): UnifiedTool[] {
  const unifiedContext: UnifiedToolsContext = {
    cwd: context.cwd,
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

  return getUnifiedTools(unifiedContext, 'openai');
}
