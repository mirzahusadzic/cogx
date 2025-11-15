/**
 * SDK Layer Types
 *
 * Type definitions for SDK query management and message handling within the TUI layer.
 * These types provide the contract between the React hooks (useClaudeAgent) and the
 * underlying Claude Agent SDK, enabling structured communication with Claude's API.
 *
 * DESIGN:
 * The SDK layer types follow a clear separation of concerns:
 * - SDKQueryOptions: Configuration for initiating SDK queries
 * - MessageProcessingCallbacks: Event handlers for SDK message stream
 * - MessageHandlerResult: Internal state tracking for message processing
 * - QueryExecutionResult: Final outcome of query execution
 *
 * This type system enables:
 * 1. Type-safe SDK query configuration
 * 2. Structured message stream processing
 * 3. Session resumption across queries
 * 4. Token usage tracking for Grounded Context Pool (PGC) integration
 * 5. MCP server configuration and tool interception
 *
 * @example
 * // Creating an SDK query with options
 * const options: SDKQueryOptions = {
 *   prompt: "Analyze the codebase",
 *   cwd: "/home/user/project",
 *   resumeSessionId: "session-123",
 *   maxThinkingTokens: 10000,
 *   onStderr: (data) => console.error(data)
 * };
 *
 * @example
 * // Setting up message processing callbacks
 * const callbacks: MessageProcessingCallbacks = {
 *   onSessionIdUpdate: (id) => setSessionId(id),
 *   onTokenUpdate: (tokens) => updatePGCUsage(tokens),
 *   onToolUse: (tool) => logToolExecution(tool),
 *   onAssistantContent: (text) => appendToDisplay(text)
 * };
 *
 * Extracted from useClaudeAgent.ts as part of Week 2 Day 6-8 refactor.
 */

import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk';

/**
 * Options for creating an SDK query
 *
 * Configuration object passed to the SDK to initiate a query to Claude.
 * Supports session resumption, thinking token limits, and MCP server integration.
 *
 * @example
 * const options: SDKQueryOptions = {
 *   prompt: "Review security implications",
 *   cwd: process.cwd(),
 *   resumeSessionId: previousSession?.id,
 *   maxThinkingTokens: 10000,
 *   mcpServers: { 'memory': memoryServerConfig },
 *   onStderr: (data) => console.error('SDK Error:', data)
 * };
 */
export interface SDKQueryOptions {
  /**
   * User prompt to send to Claude
   */
  prompt: string;

  /**
   * Current working directory for tool execution
   */
  cwd: string;

  /**
   * Session ID to resume from (undefined = new session)
   */
  resumeSessionId?: string;

  /**
   * Maximum thinking tokens for extended reasoning
   * When set, enables Claude to use extended thinking for complex tasks
   */
  maxThinkingTokens?: number;

  /**
   * MCP server configurations
   * Maps server name to configuration with instance
   */
  mcpServers?: Record<string, McpSdkServerConfigWithInstance>;

  /**
   * Callback for stderr output from SDK
   * Used to capture authentication errors and other SDK diagnostics
   */
  onStderr?: (data: string) => void;

  /**
   * Tool interception callback
   * Called before tool execution to allow modification or approval
   *
   * @param toolName - Name of the tool being invoked
   * @param input - Tool input parameters
   * @returns Promise resolving to behavior (allow) and potentially modified input
   */
  onCanUseTool?: (
    toolName: string,
    input: Record<string, unknown>
  ) => Promise<{ behavior: 'allow'; updatedInput: Record<string, unknown> }>;
}

/**
 * Message processing callbacks
 *
 * Event handlers invoked during SDK message stream processing.
 * These callbacks enable real-time updates to the UI as messages arrive.
 *
 * DESIGN:
 * Callbacks are separated by concern to enable independent UI updates:
 * - Session management (onSessionIdUpdate)
 * - Token tracking for PGC (onTokenUpdate)
 * - Tool execution display (onToolUse)
 * - Content streaming (onAssistantContent)
 * - Debug logging (onDebugLog)
 *
 * @example
 * const callbacks: MessageProcessingCallbacks = {
 *   onSessionIdUpdate: (id) => {
 *     setResumeSessionId(id);
 *     saveToLocalStorage('session', id);
 *   },
 *   onTokenUpdate: (tokens) => {
 *     setTokenCount(tokens.total);
 *     checkCompressionThreshold(tokens.total);
 *   },
 *   onToolUse: (tool) => {
 *     appendMessage({
 *       type: 'tool_progress',
 *       content: `${tool.name} executing...`
 *     });
 *   },
 *   onAssistantContent: (text) => {
 *     setStreamingText(prev => prev + text);
 *   }
 * };
 */
export interface MessageProcessingCallbacks {
  /**
   * Called when session ID is received or updated
   * Should store the session ID for resumption
   */
  onSessionIdUpdate: (sessionId: string) => void;

  /**
   * Called when token usage is reported
   * Used for PGC tracking and compression decisions
   */
  onTokenUpdate: (tokens: {
    input: number;
    output: number;
    total: number;
  }) => void;

  /**
   * Called when a tool is invoked by Claude
   * Used for displaying tool execution in UI
   */
  onToolUse: (tool: { name: string; input: Record<string, unknown> }) => void;

  /**
   * Called when assistant content is streamed
   * Used for real-time text display
   */
  onAssistantContent: (content: string) => void;

  /**
   * Optional debug logging callback
   * Used for development and troubleshooting
   */
  onDebugLog?: (message: string) => void;
}

/**
 * SDK Message Handler Result
 *
 * Internal result type returned by message handlers to coordinate state updates.
 * Used by the SDK message processing pipeline to determine what state changes
 * need to be propagated to the parent hook.
 *
 * DESIGN:
 * This type enables the message processor to be pure and stateless,
 * returning instructions for state updates rather than performing them directly.
 */
export interface MessageHandlerResult {
  /**
   * Whether the resume session ID should be updated
   */
  shouldUpdateResumeId: boolean;

  /**
   * New session ID to store (if shouldUpdateResumeId is true)
   */
  newSessionId?: string;

  /**
   * Whether token counts were updated
   */
  hasTokenUpdate: boolean;

  /**
   * New token counts (if hasTokenUpdate is true)
   */
  tokenUpdate?: { input: number; output: number; total: number };
}

/**
 * Query execution result
 *
 * Final outcome of executing a query through the SDK.
 * Contains success status, message metadata, and any errors encountered.
 *
 * DESIGN:
 * This result type distinguishes between:
 * - Technical failures (success: false, error set)
 * - Empty responses (success: true, messageCount: 0)
 * - Successful completions (success: true, hadAssistantMessage: true)
 *
 * @example
 * const result: QueryExecutionResult = {
 *   success: true,
 *   hadAssistantMessage: true,
 *   messageCount: 5,
 *   stderrLines: []
 * };
 *
 * if (!result.success) {
 *   handleError(result.error);
 * }
 */
export interface QueryExecutionResult {
  /**
   * Whether the query completed successfully
   */
  success: boolean;

  /**
   * Whether at least one assistant message was received
   */
  hadAssistantMessage: boolean;

  /**
   * Total number of messages processed
   */
  messageCount: number;

  /**
   * Lines captured from stderr during execution
   */
  stderrLines: string[];

  /**
   * Error message if query failed
   */
  error?: string;
}
