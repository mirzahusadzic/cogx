/**
 * SDK Query Manager
 *
 * Manages SDK query creation, configuration, and error handling for the Claude Agent SDK.
 * Provides utilities for session resumption, system prompt configuration, and
 * authentication error detection.
 *
 * DESIGN:
 * This module encapsulates SDK query configuration logic to:
 * 1. Centralize query creation with consistent defaults
 * 2. Enable session resumption for multi-turn conversations
 * 3. Configure system prompts (always using 'claude_code' preset)
 * 4. Handle extended thinking via maxThinkingTokens
 * 5. Detect and format authentication errors for user feedback
 * 6. (NEW) Use provider abstraction for multi-provider support
 *
 * The SDK query is the primary interface for communicating with Claude's API.
 * It accepts a prompt and options, returning an async iterator of SDK messages.
 *
 * Session Resumption:
 * - resumeSessionId = undefined: Start fresh session
 * - resumeSessionId = "session-xyz": Continue existing conversation
 *
 * This enables multi-turn workflows where context persists across queries.
 *
 * Provider Abstraction:
 * By default, uses the Claude Agent SDK directly (COGNITION_USE_PROVIDER_ABSTRACTION=false).
 * When COGNITION_USE_PROVIDER_ABSTRACTION=true, uses the provider registry.
 * This enables gradual migration to multi-provider support.
 *
 * @example
 * // Creating a fresh query
 * const query = createSDKQuery({
 *   prompt: "Analyze this codebase",
 *   cwd: process.cwd(),
 *   mcpServers: { memory: memoryServer }
 * });
 *
 * @example
 * // Resuming an existing session
 * const query = createSDKQuery({
 *   prompt: "Now check security implications",
 *   cwd: process.cwd(),
 *   resumeSessionId: "session-abc123",
 *   maxThinkingTokens: 10000
 * });
 *
 * @example
 * // Handling authentication errors
 * if (isAuthenticationError(stderrLines)) {
 *   console.error(formatAuthError());
 *   redirectToLogin();
 * }
 *
 * Extracted from useClaudeAgent.ts as part of Week 2 Day 6-8 refactor.
 * Updated to support provider abstraction layer.
 */

import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKQueryOptions } from './types.js';

// Feature flag for provider abstraction (default: false for backward compatibility)
const USE_PROVIDER_ABSTRACTION =
  process.env.COGNITION_USE_PROVIDER_ABSTRACTION === 'true';

/**
 * Create an SDK query with proper configuration
 *
 * Constructs a configured Query instance for the Claude Agent SDK.
 * Applies consistent defaults and handles session resumption.
 *
 * ALGORITHM:
 * 1. Extract options from SDKQueryOptions
 * 2. Configure SDK query with:
 *    - User prompt
 *    - Working directory for tool execution
 *    - Session resumption (if resumeSessionId provided)
 *    - System prompt (always 'claude_code' preset)
 *    - Streaming enabled (includePartialMessages: true)
 *    - Extended thinking (if maxThinkingTokens specified)
 *    - Error callbacks (stderr, canUseTool)
 *    - MCP server configurations
 * 3. Return Query instance for message iteration
 *
 * @param options - Query configuration options
 * @returns Configured Query instance ready for iteration
 *
 * @example
 * const query = createSDKQuery({
 *   prompt: "Review code for bugs",
 *   cwd: "/home/user/project",
 *   resumeSessionId: previousSessionId,
 *   maxThinkingTokens: 5000,
 *   onStderr: (err) => console.error(err)
 * });
 *
 * for await (const message of query) {
 *   processMessage(message);
 * }
 */
export function createSDKQuery(options: SDKQueryOptions): Query {
  const {
    prompt,
    cwd,
    resumeSessionId,
    maxThinkingTokens,
    mcpServers,
    onStderr,
    onCanUseTool,
  } = options;

  return query({
    prompt,
    options: {
      cwd,
      resume: resumeSessionId, // undefined = fresh session, string = resume
      systemPrompt: { type: 'preset', preset: 'claude_code' }, // Always use claude_code preset
      includePartialMessages: true, // Get streaming updates
      maxThinkingTokens, // Enable extended thinking if specified
      stderr: onStderr,
      canUseTool: onCanUseTool,
      mcpServers,
    },
  });
}

/**
 * Check if authentication error from stderr
 *
 * Detects authentication failures from SDK stderr output.
 * Used to provide user-friendly error messages and trigger re-authentication.
 *
 * ALGORITHM:
 * 1. Join stderr lines into single string
 * 2. Check for HTTP 401 status code
 * 3. Check for authentication-related error messages:
 *    - "authentication_error"
 *    - "OAuth token has expired"
 *    - "token has expired"
 * 4. Return true if both 401 and error message found
 *
 * @param stderrLines - Array of stderr output lines from SDK
 * @returns True if authentication error detected
 *
 * @example
 * const stderrLines = ["Error: 401 - OAuth token has expired"];
 * if (isAuthenticationError(stderrLines)) {
 *   showLoginPrompt();
 * }
 */
export function isAuthenticationError(stderrLines: string[]): boolean {
  const stderrText = stderrLines.join(' ').toLowerCase();

  // Check for various OAuth/auth error patterns
  return (
    // HTTP 401 status
    (stderrText.includes('401') &&
      (stderrText.includes('authentication_error') ||
        stderrText.includes('oauth') ||
        stderrText.includes('token') ||
        stderrText.includes('unauthorized'))) ||
    // Explicit OAuth expiration messages
    stderrText.includes('oauth token has expired') ||
    stderrText.includes('token has expired') ||
    stderrText.includes('token expired') ||
    stderrText.includes('authentication failed') ||
    stderrText.includes('invalid_grant') ||
    stderrText.includes('credentials have expired') ||
    // Claude/Anthropic specific errors
    stderrText.includes('anthropic_api_error') ||
    stderrText.includes('authentication error')
  );
}

/**
 * Format authentication error message
 *
 * Returns a user-friendly error message for authentication failures.
 * Includes instructions for re-authentication via /login command.
 *
 * @returns Formatted authentication error message
 *
 * @example
 * if (isAuthenticationError(stderr)) {
 *   displayError(formatAuthError());
 * }
 */
export function formatAuthError(): string {
  return '⎿ API Error: 401 - OAuth token has expired. Please obtain a new token or refresh your existing token.\n· Please run /login';
}

/**
 * Format generic SDK error
 *
 * Formats SDK error messages for display to user.
 * Handles special case of empty responses (likely authentication issues).
 *
 * ALGORITHM:
 * 1. Check if no stderr and no messages received
 *    - Suggests authentication problem
 *    - Return generic auth check message
 * 2. Otherwise, join stderr lines and return as error
 *
 * @param stderrLines - Array of stderr output lines
 * @param hadMessages - Whether any messages were received from SDK
 * @returns Formatted error message
 *
 * @example
 * const error = formatSDKError(
 *   ["Network error: ECONNREFUSED"],
 *   false
 * );
 * console.error(error);
 */
export function formatSDKError(
  stderrLines: string[],
  hadMessages: boolean
): string {
  if (stderrLines.length === 0 && !hadMessages) {
    return 'SDK completed without response - check authentication';
  }
  return `SDK error: ${stderrLines.join(' ')}`;
}
