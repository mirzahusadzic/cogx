/**
 * Message Renderer
 *
 * Handles message rendering and ANSI code stripping for the TUI display layer.
 * Ensures clean text output by removing SDK-generated ANSI escape codes that
 * could interfere with the TUI's own color scheme.
 *
 * DESIGN:
 * The Message Renderer acts as a sanitization layer between raw SDK output
 * and the TUI's React-Ink rendering system. It prevents "color bleeding" where
 * SDK-generated colors persist into subsequent messages and UI elements.
 *
 * The primary operation is ANSI code stripping, which removes:
 * - Color codes (foreground and background)
 * - Text styling (bold, dim, underline, etc.)
 * - Cursor control sequences
 * - Other terminal escape sequences
 *
 * RATIONALE:
 * The TUI applies its own consistent color scheme via React-Ink's <Text> components.
 * SDK-generated ANSI codes can override these colors, creating visual inconsistency
 * and making text difficult to read. By stripping all ANSI codes, we ensure:
 * 1. Consistent color scheme throughout the TUI
 * 2. No color bleeding between messages
 * 3. Clean text that can be re-colored by TUI components
 *
 * Message Type Handlers:
 * - System: No processing (TUI applies system colors)
 * - User: No processing (TUI applies user colors)
 * - Assistant: Strip ANSI codes (assistant text may contain SDK colors)
 * - Tool Progress: No processing (TUI applies tool colors)
 *
 * @example
 * // Formatting assistant message
 * const formatted = formatAssistantMessage('\x1b[1mBold\x1b[0m text');
 * // Returns: "Bold text" (ANSI codes removed)
 *
 * Extracted from useClaudeAgent.ts as part of Week 2 Day 9-10 refactor.
 */

import stripAnsi from 'strip-ansi';

/**
 * Format a system message for display
 *
 * System messages are displayed as-is with no processing.
 * The TUI applies system-specific colors via React-Ink.
 *
 * @param content - System message content
 * @returns Unmodified content (TUI applies colors)
 *
 * @example
 * formatSystemMessage('Connected to Claude');
 * // Returns: "Connected to Claude"
 */
export function formatSystemMessage(content: string): string {
  return content;
}

/**
 * Format a user message for display
 *
 * User messages are displayed as-is with no processing.
 * The TUI applies user-specific colors via React-Ink.
 *
 * @param content - User message content
 * @returns Unmodified content (TUI applies colors)
 *
 * @example
 * formatUserMessage('Analyze this code');
 * // Returns: "Analyze this code"
 */
export function formatUserMessage(content: string): string {
  return content;
}

/**
 * Format an assistant message for display
 *
 * Assistant messages may contain SDK-generated ANSI codes,
 * so we strip them to enable consistent TUI coloring.
 *
 * @param content - Assistant message content (may have ANSI codes)
 * @returns Content with ANSI codes removed
 *
 * @example
 * formatAssistantMessage('\x1b[32mAnalysis complete\x1b[0m');
 * // Returns: "Analysis complete"
 */
export function formatAssistantMessage(content: string): string {
  return stripAnsi(content);
}

/**
 * Format a tool progress message for display
 *
 * Tool progress messages are displayed as-is with no processing.
 * The TUI applies tool-specific colors via React-Ink.
 *
 * @param content - Tool progress message content
 * @returns Unmodified content (TUI applies colors)
 *
 * @example
 * formatToolProgressMessage('Read: file.ts');
 * // Returns: "Read: file.ts"
 */
export function formatToolProgressMessage(content: string): string {
  return content;
}
