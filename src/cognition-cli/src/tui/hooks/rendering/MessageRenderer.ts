/**
 * Message Renderer
 *
 * Handles message rendering and ANSI code stripping.
 * Provides utilities for formatting messages from the SDK.
 *
 * Extracted from useClaudeAgent.ts as part of Week 2 Day 9-10 refactor.
 */

/**
 * Strip ALL ANSI codes from SDK output to prevent color bleeding.
 * We apply our own colors in ClaudePanelAgent instead.
 */
export function stripANSICodes(text: string): string {
  // Remove ALL ANSI escape codes (colors, bold, dim, etc.)
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Format a system message for display
 */
export function formatSystemMessage(content: string): string {
  return content;
}

/**
 * Format a user message for display
 */
export function formatUserMessage(content: string): string {
  return content;
}

/**
 * Format an assistant message for display
 */
export function formatAssistantMessage(content: string): string {
  return stripANSICodes(content);
}

/**
 * Format a tool progress message for display
 */
export function formatToolProgressMessage(content: string): string {
  return content;
}
