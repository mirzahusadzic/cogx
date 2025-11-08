/**
 * SDK Layer Types
 *
 * Type definitions for SDK query management and message handling.
 *
 * Extracted from useClaudeAgent.ts as part of Week 2 Day 6-8 refactor.
 */

import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk';

/**
 * Options for creating an SDK query
 */
export interface SDKQueryOptions {
  prompt: string;
  cwd: string;
  resumeSessionId?: string;
  mcpServers?: Record<string, McpSdkServerConfigWithInstance>;
  onStderr?: (data: string) => void;
  onCanUseTool?: (
    toolName: string,
    input: Record<string, unknown>
  ) => Promise<{ behavior: 'allow'; updatedInput: Record<string, unknown> }>;
}

/**
 * Message processing callbacks
 */
export interface MessageProcessingCallbacks {
  onSessionIdUpdate: (sessionId: string) => void;
  onTokenUpdate: (tokens: {
    input: number;
    output: number;
    total: number;
  }) => void;
  onToolUse: (tool: { name: string; input: Record<string, unknown> }) => void;
  onAssistantContent: (content: string) => void;
  onDebugLog?: (message: string) => void;
}

/**
 * SDK Message Handler Result
 */
export interface MessageHandlerResult {
  shouldUpdateResumeId: boolean;
  newSessionId?: string;
  hasTokenUpdate: boolean;
  tokenUpdate?: { input: number; output: number; total: number };
}

/**
 * Query execution result
 */
export interface QueryExecutionResult {
  success: boolean;
  hadAssistantMessage: boolean;
  messageCount: number;
  stderrLines: string[];
  error?: string;
}
