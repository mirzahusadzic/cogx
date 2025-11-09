/**
 * SDK Query Manager
 *
 * Manages SDK query creation and configuration.
 * Handles resume logic, system prompts, and MCP server integration.
 *
 * Extracted from useClaudeAgent.ts as part of Week 2 Day 6-8 refactor.
 */

import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKQueryOptions } from './types.js';

/**
 * Create an SDK query with proper configuration
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
 */
export function isAuthenticationError(stderrLines: string[]): boolean {
  const stderrText = stderrLines.join(' ');
  return (
    stderrText.includes('401') &&
    (stderrText.includes('authentication_error') ||
      stderrText.includes('OAuth token has expired') ||
      stderrText.includes('token has expired'))
  );
}

/**
 * Format authentication error message
 */
export function formatAuthError(): string {
  return '⎿ API Error: 401 - OAuth token has expired. Please obtain a new token or refresh your existing token.\n· Please run /login';
}

/**
 * Format generic SDK error
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
