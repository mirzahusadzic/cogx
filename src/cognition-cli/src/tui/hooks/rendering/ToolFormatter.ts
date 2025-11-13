/**
 * Tool Formatter
 *
 * Formats tool calls for display in the TUI.
 * Handles special formatting for Edit (diffs), TodoWrite (status icons), and other tools.
 *
 * Extracted from useClaudeAgent.ts as part of Week 2 Day 9-10 refactor.
 */

import * as Diff from 'diff';

export interface ToolUse {
  name: string;
  input: Record<string, unknown>;
}

export interface FormattedTool {
  icon: string;
  name: string;
  description: string;
}

/**
 * Format a tool call for display
 */
export function formatToolUse(tool: ToolUse): FormattedTool {
  let inputDesc = '';
  let toolIcon = '🔧';

  // Special formatting for memory recall tool
  if (tool.name === 'mcp__conversation-memory__recall_past_conversation') {
    toolIcon = '🧠';
    if (tool.input.query) {
      inputDesc = `"${tool.input.query as string}"`;
    } else {
      inputDesc = JSON.stringify(tool.input);
    }
  } else if (tool.input.command) {
    // For Bash, show the actual command (not the description)
    inputDesc = `${tool.input.command as string}`;
  } else if (tool.input.description) {
    inputDesc = tool.input.description as string;
  } else if (tool.input.file_path) {
    // For Edit tool, show character-level diff with background colors
    if (
      tool.name === 'Edit' &&
      tool.input.old_string &&
      tool.input.new_string
    ) {
      inputDesc = formatEditDiff(
        tool.input.file_path as string,
        tool.input.old_string as string,
        tool.input.new_string as string
      );
    } else {
      inputDesc = `file: ${tool.input.file_path as string}`;
    }
  } else if (tool.input.pattern) {
    inputDesc = `pattern: ${tool.input.pattern as string}`;
  } else if (tool.name === 'TodoWrite' && tool.input.todos) {
    inputDesc = formatTodoWrite(
      tool.input.todos as Array<{
        content: string;
        status: string;
        activeForm: string;
      }>
    );
  } else {
    inputDesc = JSON.stringify(tool.input);
  }

  return {
    icon: toolIcon,
    name: tool.name,
    description: inputDesc,
  };
}

/**
 * Format Edit tool diff with colored backgrounds
 */
function formatEditDiff(
  filePath: string,
  oldString: string,
  newString: string
): string {
  const diffLines: string[] = [];
  diffLines.push(filePath);

  // Use diff library to get line changes
  const lineDiff = Diff.diffLines(oldString, newString);

  lineDiff.forEach((part) => {
    const lines = part.value
      .split('\n')
      .filter((line) => line.length > 0 || part.value.endsWith('\n'));

    if (part.added) {
      // Added lines - olive/dark green background with white text
      lines.forEach((line) => {
        if (line) {
          // \x1b[48;5;58m = dark olive background, \x1b[97m = bright white text
          diffLines.push(
            `  \x1b[32m+\x1b[0m \x1b[48;5;58m\x1b[97m${line}\x1b[0m`
          );
        }
      });
    } else if (part.removed) {
      // Removed lines - dark red background with white text
      lines.forEach((line) => {
        if (line) {
          // \x1b[48;5;52m = dark red background, \x1b[97m = bright white text
          diffLines.push(
            `  \x1b[31m-\x1b[0m \x1b[48;5;52m\x1b[97m${line}\x1b[0m`
          );
        }
      });
    } else {
      // Unchanged lines - no color
      lines.forEach((line) => {
        if (line) {
          diffLines.push(`   ${line}`);
        }
      });
    }
  });

  return diffLines.join('\n');
}

/**
 * Format TodoWrite with status icons
 */
function formatTodoWrite(
  todos: Array<{
    content: string;
    status: string;
    activeForm: string;
  }>
): string {
  const todoLines: string[] = [];

  todos.forEach((todo) => {
    let statusIcon = '';
    let statusColor = '';

    if (todo.status === 'completed') {
      statusIcon = '✓';
      statusColor = '\x1b[32m'; // green
    } else if (todo.status === 'in_progress') {
      statusIcon = '→';
      statusColor = '\x1b[33m'; // yellow
    } else {
      statusIcon = '○';
      statusColor = '\x1b[90m'; // gray
    }

    const displayText =
      todo.status === 'in_progress' ? todo.activeForm : todo.content;
    todoLines.push(`  ${statusColor}${statusIcon}\x1b[0m ${displayText}`);
  });

  return '\n' + todoLines.join('\n');
}

/**
 * Format tool use for display as a single string
 */
export function formatToolUseMessage(tool: ToolUse): string {
  const formatted = formatToolUse(tool);
  return `${formatted.icon} ${formatted.name}: ${formatted.description}`;
}
