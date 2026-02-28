/**
 * ADK Tool Definitions for Gemini Agent Provider
 *
 * Uses unified tools from llm/tools/unified-tools.ts.
 */

import { FunctionTool, type Session } from '@google/adk';
import type { ConversationOverlayRegistry } from '../../../sigma/conversation-registry.js';
import type { BackgroundTaskManager } from '../../../tui/services/BackgroundTaskManager.js';
import type { MessagePublisher } from '../../../ipc/MessagePublisher.js';
import type { MessageQueue } from '../../../ipc/MessageQueue.js';
import type { OnCanUseTool } from '../tool-helpers.js';
import {
  getUnifiedTools,
  UnifiedToolsContext,
} from '../../tools/unified-tools.js';

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
 * Wraps unified tools for Gemini ADK format.
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
  const context: UnifiedToolsContext = {
    cwd: process.cwd(),
    projectRoot,
    agentId: currentAgentId,
    anchorId: options?.anchorId,
    workbenchUrl,
    onToolOutput: options?.onToolOutput,
    currentPromptTokens: options?.currentPromptTokens,
    getActiveTaskId: options?.getActiveTaskId,
    onCanUseTool: onCanUseTool,
    onTaskCompleted: options?.onTaskCompleted,
    conversationRegistry,
    getTaskManager,
    getMessagePublisher,
    getMessageQueue,
    mode: options?.mode,
  };

  return getUnifiedTools(context, 'gemini') as FunctionTool[];
}
