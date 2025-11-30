/**
 * Tool Formatter
 *
 * Formats tool calls for display in the TUI with intelligent, tool-specific formatting.
 * Provides special rendering for Edit (character-level diffs), TodoWrite (status icons),
 * Bash (command display), memory tools, and background task management.
 *
 * DESIGN:
 * The Tool Formatter implements a strategy pattern where each tool type has custom
 * formatting logic to maximize readability and usefulness in the TUI:
 *
 * Tool-Specific Strategies:
 * 1. Edit: Character-level diff with colored backgrounds
 *    - Removed lines: dark red background (\x1b[48;5;52m)
 *    - Added lines: dark olive background (\x1b[48;5;58m)
 *    - Unchanged lines: no highlighting
 *
 * 2. TodoWrite: Status icons with color coding
 *    - Completed: ✓ (green)
 *    - In Progress: → (yellow)
 *    - Pending: ○ (gray)
 *
 * 3. Bash: Display actual command (not description)
 *    - Shows command being executed for transparency
 *
 * 4. Memory Tools: Special brain icon (🧠) for recall operations
 *
 * 5. Background Tasks: Clean, human-readable output (no JSON)
 *    - KillShell: 🛑 Stop Shell - shell <id>
 *    - BashOutput: 📋 Check Output - shell <id>
 *    - Background Tasks: 📊 Background Tasks - checking status
 *
 * 6. Default: Generic tool icon (🔧) with JSON input
 *
 * ALGORITHM (formatToolUse):
 * 1. Initialize default icon (🔧)
 * 2. Check tool name and apply specific formatting:
 *    a. Memory recall: Brain icon + query text
 *    b. Bash: Command text from input.command
 *    c. Edit: Full diff with formatEditDiff()
 *    d. File operations: Show file path
 *    e. TodoWrite: Format with formatTodoWrite()
 *    f. Pattern operations: Show pattern
 *    g. Default: JSON stringify input
 * 3. Return FormattedTool with icon, name, and description
 *
 * @example
 * // Formatting an Edit tool use
 * const formatted = formatToolUse({
 *   name: 'Edit',
 *   input: {
 *     file_path: '/src/app.ts',
 *     old_string: 'const x = 1;',
 *     new_string: 'const x = 2;'
 *   }
 * });
 * // Returns diff with colored backgrounds showing change
 *
 * @example
 * // Formatting a TodoWrite tool use
 * const formatted = formatToolUse({
 *   name: 'TodoWrite',
 *   input: {
 *     todos: [
 *       { content: 'Write tests', status: 'completed', activeForm: 'Writing tests' },
 *       { content: 'Deploy', status: 'in_progress', activeForm: 'Deploying' }
 *     ]
 *   }
 * });
 * // Returns formatted todo list with status icons
 *
 * Extracted from useClaudeAgent.ts as part of Week 2 Day 9-10 refactor.
 */

import * as Diff from 'diff';

/**
 * Tool use input from SDK
 *
 * Represents a tool invocation from Claude with name and input parameters.
 */
export interface ToolUse {
  /**
   * Name of the tool being invoked
   */
  name: string;

  /**
   * Tool input parameters (structure varies by tool)
   */
  input: Record<string, unknown>;
}

/**
 * Formatted tool representation for display
 *
 * Result of formatting a tool use with icon, name, and human-readable description.
 */
export interface FormattedTool {
  /**
   * Icon representing the tool type (e.g., 🔧, 🧠, etc.)
   */
  icon: string;

  /**
   * Tool name
   */
  name: string;

  /**
   * Human-readable description of what the tool is doing
   * (may include diffs, command text, or formatted input)
   */
  description: string;
}

/**
 * Format a tool call for display
 *
 * Main formatting function that applies tool-specific formatting strategies
 * to create a human-readable representation of the tool invocation.
 *
 * ALGORITHM:
 * 1. Initialize default icon (🔧)
 * 2. Check tool name against known patterns:
 *    a. Memory recall: Extract query, use brain icon
 *    b. Bash: Extract command from input.command
 *    c. Edit: Generate diff using formatEditDiff()
 *    d. File operations: Show file path
 *    e. TodoWrite: Format todos using formatTodoWrite()
 *    f. Pattern operations: Show search pattern
 *    g. Default: JSON stringify entire input
 * 3. Return FormattedTool with icon, name, and description
 *
 * @param tool - Tool use to format
 * @returns Formatted tool with icon, name, and description
 *
 * @example
 * const formatted = formatToolUse({
 *   name: 'Bash',
 *   input: { command: 'npm test', description: 'Run tests' }
 * });
 * // Returns: { icon: '🔧', name: 'Bash', description: 'npm test' }
 *
 * @example
 * const formatted = formatToolUse({
 *   name: 'Edit',
 *   input: {
 *     file_path: 'app.ts',
 *     old_string: 'hello',
 *     new_string: 'world'
 *   }
 * });
 * // Returns: { icon: '🔧', name: 'Edit', description: 'app.ts\n...(diff)...' }
 */
export function formatToolUse(tool: ToolUse): FormattedTool {
  let inputDesc = '';
  let toolIcon = '🔧';

  // Normalize tool name: snake_case → PascalCase (e.g., read_file → Read)
  const normalizeName = (name: string): string => {
    // Handle special cases first
    if (name === 'WebSearch' || name === 'WebFetch') return name;
    if (name.startsWith('mcp__')) return name;

    // Convert snake_case to PascalCase: read_file → Read, write_file → Write
    if (name.includes('_')) {
      const base = name.split('_')[0]; // read_file → read
      return base.charAt(0).toUpperCase() + base.slice(1); // read → Read
    }

    // Return as-is if already PascalCase
    return name;
  };

  let toolName = normalizeName(tool.name);

  // Special formatting for memory recall tool (both MCP and Gemini versions)
  if (
    tool.name === 'mcp__conversation-memory__recall_past_conversation' ||
    tool.name === 'recall_past_conversation'
  ) {
    toolIcon = '🧠';
    toolName = 'Recall';
    if (tool.input.query) {
      inputDesc = `"${tool.input.query as string}"`;
    } else {
      inputDesc = JSON.stringify(tool.input);
    }
  } else if (tool.name === 'WebSearch') {
    toolIcon = '🔍';
    if (tool.input.request) {
      inputDesc = `${tool.input.request as string}`;
    } else if (tool.input.query) {
      // Handle cases where 'query' might be used instead of 'request'
      inputDesc = `"${tool.input.query as string}"`;
    } else {
      inputDesc = JSON.stringify(tool.input);
    }
  } else if (tool.name === 'fetch_url') {
    toolIcon = '🌐';
    if (tool.input.url) {
      inputDesc = `${tool.input.url as string}`;
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
      (tool.name === 'Edit' || tool.name === 'edit_file') &&
      tool.input.old_string &&
      tool.input.new_string
    ) {
      inputDesc = formatEditDiff(
        tool.input.file_path as string,
        tool.input.old_string as string,
        tool.input.new_string as string
      );
    } else {
      let filePathDesc = `file: ${tool.input.file_path as string}`;
      if (
        typeof tool.input.offset === 'number' &&
        typeof tool.input.limit === 'number'
      ) {
        filePathDesc += ` (offset: ${tool.input.offset}, limit: ${tool.input.limit})`;
      } else if (typeof tool.input.offset === 'number') {
        filePathDesc += ` (offset: ${tool.input.offset})`;
      } else if (typeof tool.input.limit === 'number') {
        filePathDesc += ` (limit: ${tool.input.limit})`;
      }
      inputDesc = filePathDesc;
    }
  } else if (tool.input.pattern) {
    inputDesc = `pattern: ${tool.input.pattern as string}`;
  } else if (tool.name === 'TodoWrite' && tool.input.todos) {
    toolName = 'Tasks';
    inputDesc = formatTodoWrite(
      tool.input.todos as Array<{
        content: string;
        status: string;
        activeForm: string;
      }>
    );
  } else if (tool.name === 'WebFetch' && tool.input.url) {
    toolIcon = '🌐';
    inputDesc = tool.input.url as string;
  } else if (tool.name === 'KillShell') {
    toolIcon = '🛑';
    toolName = 'Stop Shell';
    if (tool.input.shell_id) {
      inputDesc = `shell ${tool.input.shell_id as string}`;
    } else {
      inputDesc = 'background task';
    }
  } else if (tool.name === 'BashOutput') {
    toolIcon = '📋';
    toolName = 'Check Output';
    if (tool.input.bash_id) {
      inputDesc = `shell ${tool.input.bash_id as string}`;
    } else {
      inputDesc = 'background task';
    }
  } else if (tool.name === 'mcp__background-tasks__get_background_tasks') {
    toolIcon = '📊';
    toolName = 'Background Tasks';
    const filter = (tool.input.filter as string) || 'all';
    inputDesc = filter === 'all' ? 'checking status' : `filter: ${filter}`;
  } else {
    inputDesc = JSON.stringify(tool.input);
  }

  return {
    icon: toolIcon,
    name: toolName,
    description: inputDesc,
  };
}

/**
 * Format Edit tool diff with colored backgrounds
 *
 * Creates a character-level diff visualization with colored backgrounds
 * for added and removed content. Uses ANSI escape codes for terminal rendering.
 *
 * ALGORITHM:
 * 1. Initialize diff output with file path
 * 2. Generate line-level diff using diff library
 * 3. For each diff part:
 *    a. Split into lines
 *    b. If added:
 *       - Prefix with green '+' symbol
 *       - Apply dark olive background (\x1b[48;5;58m)
 *       - Use bright white text (\x1b[97m)
 *    c. If removed:
 *       - Prefix with red '-' symbol
 *       - Apply dark red background (\x1b[48;5;52m)
 *       - Use bright white text (\x1b[97m)
 *    d. If unchanged:
 *       - No prefix or coloring
 * 4. Join lines and return formatted diff
 *
 * Color Codes Used:
 * - \x1b[48;5;58m: Dark olive background (for additions)
 * - \x1b[48;5;52m: Dark red background (for deletions)
 * - \x1b[97m: Bright white text
 * - \x1b[32m: Green text (+ symbol)
 * - \x1b[31m: Red text (- symbol)
 * - \x1b[0m: Reset all formatting
 *
 * @param filePath - Path to file being edited
 * @param oldString - Original content being replaced
 * @param newString - New content being inserted
 * @returns Formatted diff string with ANSI color codes
 *
 * @example
 * const diff = formatEditDiff(
 *   'config.ts',
 *   'const port = 3000;',
 *   'const port = 8080;'
 * );
 * // Returns:
 * // config.ts
 * //   - const port = 3000; (with red background)
 * //   + const port = 8080; (with olive background)
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
          // \x1b[49m explicitly resets background to prevent bleed
          diffLines.push(
            `  \x1b[32m+\x1b[0m \x1b[48;5;58m\x1b[97m${line}\x1b[0m\x1b[49m`
          );
        }
      });
    } else if (part.removed) {
      // Removed lines - dark red background with white text
      lines.forEach((line) => {
        if (line) {
          // \x1b[48;5;52m = dark red background, \x1b[97m = bright white text
          // \x1b[49m explicitly resets background to prevent bleed
          diffLines.push(
            `  \x1b[31m-\x1b[0m \x1b[48;5;52m\x1b[97m${line}\x1b[0m\x1b[49m`
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

  // Ensure final reset to prevent color bleeding to subsequent messages
  // Use \x1b[49m (bg reset) + \x1b[39m (fg reset) instead of \x1b[0m (full reset)
  // to avoid clearing Ink's color codes when rendered in <Text color={...}>
  return diffLines.join('\n') + '\x1b[49m\x1b[39m';
}

/**
 * Format TodoWrite with status icons
 *
 * Formats todo items with colored status icons to show task progress.
 * Uses different icons and colors for completed, in-progress, and pending tasks.
 *
 * ALGORITHM:
 * 1. Initialize empty lines array
 * 2. For each todo:
 *    a. Determine status icon and color:
 *       - completed: ✓ (green \x1b[32m)
 *       - in_progress: → (yellow \x1b[33m)
 *       - pending: ○ (gray \x1b[90m)
 *    b. Choose display text:
 *       - in_progress: Use activeForm (e.g., "Running tests")
 *       - Other: Use content (e.g., "Run tests")
 *    c. Format line with colored icon and text
 *    d. Add to lines array
 * 3. Join with newlines and return
 *
 * Status Icons:
 * - ✓: Task completed
 * - →: Task in progress
 * - ○: Task pending
 *
 * @param todos - Array of todo items with status
 * @returns Formatted todo list string with newline-separated items
 *
 * @example
 * const formatted = formatTodoWrite([
 *   { content: 'Run tests', status: 'completed', activeForm: 'Running tests' },
 *   { content: 'Deploy', status: 'in_progress', activeForm: 'Deploying' },
 *   { content: 'Monitor', status: 'pending', activeForm: 'Monitoring' }
 * ]);
 * // Returns:
 * //   ✓ Run tests       (green)
 * //   → Deploying       (yellow)
 * //   ○ Monitor         (gray)
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
    // Use \x1b[39m (fg reset only) instead of \x1b[0m to avoid clearing Ink's codes
    todoLines.push(`  ${statusColor}${statusIcon}\x1b[39m ${displayText}`);
  });

  // Ensure final reset to prevent color bleeding (only if there are todos)
  // Use \x1b[39m (fg reset only) instead of \x1b[0m to avoid clearing Ink's codes
  if (todoLines.length === 0) {
    return '\n';
  }
  return '\n' + todoLines.join('\n') + '\x1b[39m';
}

/**
 * Format tool use for display as a single string
 *
 * Convenience function that formats a tool use and combines icon, name,
 * and description into a single display string.
 *
 * @param tool - Tool use to format
 * @returns Single-line formatted string combining all formatted components
 *
 * @example
 * const message = formatToolUseMessage({
 *   name: 'Read',
 *   input: { file_path: '/src/config.ts' }
 * });
 * // Returns: "🔧 Read: file: /src/config.ts"
 */
export function formatToolUseMessage(tool: ToolUse): string {
  const formatted = formatToolUse(tool);
  return `${formatted.icon} ${formatted.name}: ${formatted.description}`;
}
