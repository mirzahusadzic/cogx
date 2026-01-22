/**
 * Tool Formatter
 *
 * Formats tool calls for display in the TUI with intelligent, tool-specific formatting.
 * Provides special rendering for Edit (character-level diffs), SigmaTaskUpdate (status icons),
 * Bash (command display), memory tools, and background task management.
 *
 * DESIGN:
 * The Tool Formatter implements a strategy pattern where each tool type has custom
 * formatting logic to maximize readability and usefulness in the TUI:
 *
 * Tool-Specific Strategies:
 * 1. Edit: Character-level diff with colored backgrounds
 *    - Removed lines: Red background
 *    - Added lines: Green background
 *    - Unchanged lines: no highlighting
 *
 * 2. SigmaTaskUpdate: 📋 Tasks - Status icons with color coding
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
 *    - BashOutput: 📄 Check Output - shell <id>
 *    - Background Tasks: 📊 Background Tasks - checking status
 *
 * 6. Agent Messaging: Inter-agent communication tools
 *    - List Agents: 🤖 List Agents - discovering active agents
 *    - Send Message: 📨 Send Message - to <alias>: "<message preview>"
 *    - Broadcast: 📢 Broadcast - "<message preview>"
 *    - List Messages: 📬 List Messages - listing pending messages
 *    - Mark Read: ✅ Mark Read - <messageId> as <status>
 *    - Query Agent: ✨ Query Agent - <target>: "<question preview>"
 *
 * 7. Task Tool: Subagent launcher
 *    - 🚀 <subagent_type>: <description or prompt preview>
 *    - Example: 🚀 Explore: Find TypeScript test files
 *
 * 8. MCPSearch: MCP tool discovery and selection
 *    - 🔍 MCP Search: selecting <tool_name> (for direct selection)
 *    - 🔍 MCP Search: "<query>" (for keyword search)
 *
 * 9. Default: Generic tool icon (🔧) with JSON input
 *
 * ALGORITHM (formatToolUse):
 * 1. Initialize default icon (🔧)
 * 2. Check tool name and apply specific formatting:
 *    a. Memory recall: Brain icon + query text
 *    b. Bash: Command text from input.command
 *    c. Edit: Full diff with formatEditDiff()
 *    d. File operations: Show file path
 *    e. SigmaTaskUpdate: Format with formatSigmaTaskUpdate()
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
 * // Formatting a SigmaTaskUpdate tool use
 * const formatted = formatToolUse({
 *   name: 'SigmaTaskUpdate',
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
import * as fs from 'fs';
import * as path from 'path';
import stripAnsi from 'strip-ansi';
import {
  stripCursorSequences,
  hexToAnsi,
  hexToAnsiBg,
  ANSI_RESET,
} from '../../utils/ansi-utils.js';
import { TUITheme } from '../../theme.js';

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
 * Relativize an absolute path to a base directory (usually CWD).
 * Used to reduce clutter in tool output display.
 *
 * @param p - Path to relativize
 * @param basePath - Base directory for relativization (defaults to process.cwd())
 * @returns Relative path if possible, otherwise original path
 */
// Only relativize if the path doesn't go too many levels up (e.g., ../../../src/file.ts)
const MAX_PARENT_DIR_DEPTH_FOR_RELATIVE_PATH = 2; // e.g., ../../file.ts (2 levels up)

function relativizePath(p: string, basePath: string = process.cwd()): string {
  if (typeof p !== 'string' || !p) return p;
  if (path.isAbsolute(p)) {
    const relative = path.relative(basePath, p);
    // Only return relative if it's not too many ".." levels up
    // and not absolute (path.relative might return absolute on some systems/edge cases)
    if (
      !relative.startsWith(
        '../'.repeat(MAX_PARENT_DIR_DEPTH_FOR_RELATIVE_PATH + 1)
      ) &&
      !path.isAbsolute(relative)
    ) {
      return relative;
    }
  }
  return p;
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
 *    e. SigmaTaskUpdate: Format todos using formatSigmaTaskUpdate()
 *    f. Pattern operations: Show search pattern
 *    g. Default: JSON stringify entire input
 * 3. Return FormattedTool with icon, name, and description
 *
 * @param tool - Tool use to format
 * @param cwd - Current working directory for path relativization (defaults to process.cwd())
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
export function formatToolUse(tool: ToolUse, cwd?: string): FormattedTool {
  let inputDesc = '';
  let toolIcon = '🔧';
  const effectiveCwd = cwd || process.cwd();

  // Normalize name for comparison (remove underscores, lowercase)
  const normName = tool.name.toLowerCase().replace(/_/g, '');

  // Robust handling for input (handle strings, nested input)
  let input = tool.input;
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input);
    } catch {
      // Not JSON, keep as string
    }
  }
  // Handle Gemini/MCP double wrapping if it occurs
  if (
    input &&
    typeof input === 'object' &&
    'input' in input &&
    Object.keys(input).length === 1
  ) {
    input = (input as Record<string, unknown>).input as Record<string, unknown>;
  }

  // Normalize tool name: snake_case → PascalCase (e.g., read_file → Read)
  const normalizeName = (name: string): string => {
    // Handle special cases first
    if (name === 'WebSearch' || name === 'WebFetch') return name;
    if (name.startsWith('mcp__')) {
      const parts = name.split('__');
      return parts[parts.length - 1];
    }

    // Special cases for common file tools to keep them short
    if (name === 'read_file') return 'Read';
    if (name === 'write_file') return 'Write';
    if (name === 'edit_file') return 'Edit';

    // Convert snake_case to PascalCase: sigma_task_update → SigmaTaskUpdate
    if (name.includes('_')) {
      return name
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
    }

    // Return as-is if already PascalCase
    return name;
  };

  let toolName = normalizeName(tool.name);

  // Special formatting for memory recall tool (both MCP and Gemini versions)
  if (
    normName === 'recallpastconversation' ||
    normName.includes('recallpastconversation')
  ) {
    toolIcon = '🧠';
    toolName = 'Recall';
    if (input.query) {
      inputDesc = `"${input.query as string}"`;
    } else {
      inputDesc = JSON.stringify(input);
    }
  } else if (normName === 'websearch') {
    toolIcon = '🔍';
    if (input.request) {
      inputDesc = `${input.request as string}`;
    } else if (input.query) {
      // Handle cases where 'query' might be used instead of 'request'
      inputDesc = `"${input.query as string}"`;
    } else {
      inputDesc = JSON.stringify(input);
    }
  } else if (normName === 'fetchurl') {
    toolIcon = '🌐';
    if (input.url) {
      inputDesc = `${input.url as string}`;
    } else {
      inputDesc = JSON.stringify(input);
    }
  } else if (input.command) {
    // For Bash, show the actual command (not the description).
    // Use a single space after the colon for same-line display.
    inputDesc = `\n${input.command as string}\n`;
  } else if (input.description && !input.todos) {
    // Show description if it's not a task update (which has its own formatting)
    inputDesc = input.description as string;
  } else if (input.file_path) {
    // For Edit tool, show character-level diff with background colors
    if (
      (normName === 'edit' || normName === 'editfile') &&
      input.old_string &&
      input.new_string
    ) {
      inputDesc = formatEditDiff(
        relativizePath(input.file_path as string, effectiveCwd),
        input.old_string as string,
        input.new_string as string
      );
    } else {
      let filePathDesc = `file: ${relativizePath(input.file_path as string, effectiveCwd)}`;
      if (typeof input.offset === 'number' && typeof input.limit === 'number') {
        filePathDesc += ` (offset: ${input.offset}, limit: ${input.limit})`;
      } else if (typeof input.offset === 'number') {
        filePathDesc += ` (offset: ${input.offset})`;
      } else if (typeof input.limit === 'number') {
        filePathDesc += ` (limit: ${input.limit})`;
      }
      inputDesc = filePathDesc;
    }
  } else if (normName === 'grep' && input.pattern) {
    let desc = `pattern: ${input.pattern as string}`;
    const searchPath = (input.search_path || input.path) as string;
    if (searchPath) {
      desc += ` in ${relativizePath(searchPath, effectiveCwd)}`;
    }
    inputDesc = desc;
  } else if (normName === 'glob' && input.pattern) {
    let desc = `pattern: ${input.pattern as string}`;
    const globCwd = (input.cwd || input.search_cwd) as string;
    if (globCwd) {
      desc += ` in ${relativizePath(globCwd, effectiveCwd)}`;
    }
    inputDesc = desc;
  } else if (input.pattern) {
    inputDesc = `pattern: ${input.pattern as string}`;
  } else if (
    normName === 'sigmataskupdate' ||
    normName.includes('sigmataskupdate')
  ) {
    const taskInput = input as SigmaTaskUpdateInput;
    if (taskInput.todos) {
      toolIcon = '📋';
      toolName = 'Tasks';
      const todos = taskInput.todos;
      const grounding = taskInput.grounding;
      const groundingEvidence = taskInput.grounding_evidence;

      inputDesc = formatSigmaTaskUpdate(todos, grounding, groundingEvidence);
    }
  } else if (normName === 'webfetch' && input.url) {
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
    toolIcon = '📄';
    toolName = 'Check Output';
    if (tool.input.bash_id) {
      inputDesc = `shell ${tool.input.bash_id as string}`;
    } else {
      inputDesc = 'background task';
    }
  } else if (
    tool.name === 'mcp__background-tasks__get_background_tasks' ||
    tool.name === 'get_background_tasks'
  ) {
    toolIcon = '📊';
    toolName = 'Background Tasks';
    const filter = (tool.input.filter as string) || 'all';
    inputDesc = filter === 'all' ? 'checking status' : `filter: ${filter}`;
  } else if (
    tool.name === 'mcp__agent-messaging__list_agents' ||
    tool.name === 'list_agents'
  ) {
    toolIcon = '🤖';
    toolName = 'List Agents';
    inputDesc = 'discovering active agents';
  } else if (
    tool.name === 'mcp__agent-messaging__send_agent_message' ||
    tool.name === 'send_agent_message'
  ) {
    toolIcon = '📨';
    toolName = 'Send Message';
    if (tool.input.to && tool.input.message) {
      const to = tool.input.to as string;
      const message = tool.input.message as string;
      const preview =
        message.length > 50 ? `${message.substring(0, 50)}...` : message;
      inputDesc = `to ${to}: "${preview}"`;
    } else {
      inputDesc = JSON.stringify(tool.input);
    }
  } else if (
    tool.name === 'mcp__agent-messaging__broadcast_agent_message' ||
    tool.name === 'broadcast_agent_message'
  ) {
    toolIcon = '📢';
    toolName = 'Broadcast';
    if (tool.input.message) {
      const message = tool.input.message as string;
      const preview =
        message.length > 50 ? `${message.substring(0, 50)}...` : message;
      inputDesc = `"${preview}"`;
    } else {
      inputDesc = JSON.stringify(tool.input);
    }
  } else if (
    tool.name === 'mcp__agent-messaging__list_pending_messages' ||
    tool.name === 'list_pending_messages'
  ) {
    toolIcon = '📬';
    toolName = 'List Messages';
    inputDesc = 'listing pending messages';
  } else if (
    tool.name === 'mcp__agent-messaging__mark_message_read' ||
    tool.name === 'mark_message_read'
  ) {
    toolIcon = '✅';
    toolName = 'Mark Read';
    if (tool.input.messageId) {
      const status = (tool.input.status as string) || 'injected';
      inputDesc = `${tool.input.messageId as string} as ${status}`;
    } else {
      inputDesc = JSON.stringify(tool.input);
    }
  } else if (
    tool.name === 'mcp__cross-project-query__query_agent' ||
    tool.name === 'query_agent'
  ) {
    toolIcon = '✨';
    toolName = 'Query Agent';
    if (tool.input.target_alias && tool.input.question) {
      const target = tool.input.target_alias as string;
      const question = tool.input.question as string;
      const preview =
        question.length > 50 ? `${question.substring(0, 50)}...` : question;
      inputDesc = `${target}: "${preview}"`;
    } else {
      inputDesc = JSON.stringify(tool.input);
    }
  } else if (tool.name === 'Task') {
    // Task tool launches subagents - show the agent type and a prompt preview
    toolIcon = '🚀';
    const subagentType = (tool.input.subagent_type as string) || 'Agent';
    toolName = subagentType;
    if (tool.input.description) {
      // Use the short description if available
      inputDesc = tool.input.description as string;
    } else if (tool.input.prompt) {
      // Otherwise show a preview of the prompt
      const prompt = tool.input.prompt as string;
      inputDesc = prompt.length > 60 ? `${prompt.substring(0, 60)}...` : prompt;
    } else {
      inputDesc = 'launching agent';
    }
  } else if (tool.name === 'MCPSearch') {
    // MCPSearch - search for or select MCP tools
    toolIcon = '🔍';
    toolName = 'MCP Search';
    if (tool.input.query) {
      const query = tool.input.query as string;
      // Format direct selection queries nicely
      if (query.startsWith('select:')) {
        const toolName = query.replace('select:', '');
        inputDesc = `selecting ${toolName}`;
      } else {
        // Regular search query
        inputDesc = `"${query}"`;
      }
    } else {
      inputDesc = JSON.stringify(tool.input);
    }
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
 *       - Apply green background
 *       - Use bright white text
 *    c. If removed:
 *       - Prefix with red '-' symbol
 *       - Apply red background
 *       - Use bright white text
 *    d. If unchanged:
 *       - No prefix or coloring
 * 4. Join lines and return formatted diff
 *
 * @param filePath - Path to file being edited
 * @param oldString - Original content being replaced
 * @param newString - New content being inserted
 * @returns Formatted diff string with ANSI color codes
 */
function formatEditDiff(
  filePath: string,
  oldString: string,
  newString: string
): string {
  const diffLines: string[] = [];
  const gray = hexToAnsi(TUITheme.text.secondary);
  diffLines.push(`${gray}${filePath}${ANSI_RESET}`);

  // Try to find the starting line number in the file
  let startLine = 1;
  try {
    if (fs.existsSync(filePath)) {
      // Avoid blocking the event loop with large files
      const stats = fs.statSync(filePath);
      const MAX_SYNC_READ_SIZE = 100 * 1024; // 100KB

      if (stats.size <= MAX_SYNC_READ_SIZE) {
        const content = fs.readFileSync(filePath, 'utf8');
        const index = content.indexOf(oldString);
        if (index !== -1) {
          startLine = content.substring(0, index).split('\n').length;
        }
      }
    }
  } catch {
    // Fall back to line 1 if file reading fails
  }

  // Use diff library to get line changes
  const lineDiff = Diff.diffLines(oldString, newString);

  let oldLine = startLine;
  let newLine = startLine;

  // Pre-calculate ANSI codes
  const lineNumColor = hexToAnsi(TUITheme.syntax.lineNumber); // Cyan for line numbers
  const addBg = hexToAnsiBg(TUITheme.syntax.diff.addBg); // Green BG
  const removeBg = hexToAnsiBg(TUITheme.syntax.diff.removeBg); // Red BG
  const addFg = hexToAnsi(TUITheme.syntax.diff.add); // Green Text
  const removeFg = hexToAnsi(TUITheme.syntax.diff.remove); // Red Text
  const whiteFg = '\x1b[38;2;255;255;255m'; // Pure white text for diff content pop
  const resetBg = '\x1b[49m'; // Reset background

  lineDiff.forEach((part) => {
    const lines = part.value.split('\n');
    // Remove last element if it's empty (trailing newline from split)
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    if (part.added) {
      // Added lines - green background with white text
      lines.forEach((line) => {
        const lineNum = `      ${newLine}`.slice(-6);
        diffLines.push(
          `${addFg}+${ANSI_RESET} ${lineNumColor}${lineNum}│${ANSI_RESET} ${addBg}${whiteFg}${line}${ANSI_RESET}${resetBg}`
        );
        newLine++;
      });
    } else if (part.removed) {
      // Removed lines - red background with white text
      lines.forEach((line) => {
        const lineNum = `      ${oldLine}`.slice(-6);
        diffLines.push(
          `${removeFg}-${ANSI_RESET} ${lineNumColor}${lineNum}│${ANSI_RESET} ${removeBg}${whiteFg}${line}${ANSI_RESET}${resetBg}`
        );
        oldLine++;
      });
    } else {
      // Unchanged lines - show only one line number for clarity
      lines.forEach((line) => {
        const newNum = `      ${newLine}`.slice(-6);
        diffLines.push(
          `  ${lineNumColor}${newNum}│${ANSI_RESET} ${gray}${line}${ANSI_RESET}`
        );
        oldLine++;
        newLine++;
      });
    }
  });

  // Ensure final reset to prevent color bleeding to subsequent messages
  return diffLines.join('\n') + ANSI_RESET;
}

/**
 * Format SigmaTaskUpdate with status icons
 *
 * Formats todo items with colored status icons to show task progress.
 * Uses different icons and colors for completed, in-progress, and pending tasks.
 */
interface SigmaTaskUpdateInput {
  todos?: SigmaTodo[];
  grounding?: SigmaGrounding[];
  grounding_evidence?: SigmaGroundingEvidence[];
}

interface SigmaTodo {
  id: string;
  content: string;
  status: string;
  activeForm: string;
  delegated_to?: string;
}

interface SigmaGrounding {
  id: string;
  strategy: string;
}

interface SigmaGroundingEvidence {
  id: string;
  grounding_confidence: string;
}

function formatSigmaTaskUpdate(
  todos: SigmaTodo[],
  grounding?: SigmaGrounding[],
  groundingEvidence?: SigmaGroundingEvidence[]
): string {
  const todoLines: string[] = [];

  const groundingMap = new Map<string, SigmaGrounding>();
  if (grounding) {
    grounding.forEach((g) => {
      if (g.id) groundingMap.set(g.id, g);
    });
  }

  const evidenceMap = new Map<string, SigmaGroundingEvidence>();
  if (groundingEvidence) {
    groundingEvidence.forEach((e) => {
      if (e.id) evidenceMap.set(e.id, e);
    });
  }

  // AIEcho Theme Mapping:
  // User = Amber (Active/Focus)
  // Tool = Green (Success/Operational)
  const successColor = hexToAnsi(TUITheme.roles.tool); // Green
  const activeColor = hexToAnsi(TUITheme.roles.user); // Amber
  const gray = hexToAnsi(TUITheme.text.secondary); // Gray
  const cyan = hexToAnsi(TUITheme.overlays.o7_strategic); // Cyan
  const red = hexToAnsi(TUITheme.text.error); // Red

  todos.forEach((todo) => {
    let statusIcon = '';
    let statusColor = '';
    let textColor = '';

    if (todo.status === 'completed') {
      statusIcon = '✓';
      statusColor = successColor;
      textColor = gray;
    } else if (todo.status === 'in_progress') {
      statusIcon = '→';
      statusColor = activeColor;
      textColor = activeColor;
    } else if (todo.status === 'delegated') {
      statusIcon = '🤖';
      statusColor = cyan;
      textColor = ''; // default
    } else {
      statusIcon = '○';
      statusColor = gray;
      textColor = gray;
    }

    let contentText =
      todo.status === 'in_progress' ? todo.activeForm : todo.content;

    if (todo.status === 'delegated' && todo.delegated_to) {
      contentText += ` (to: ${todo.delegated_to})`;
    }

    // Build the display text with grounding indicators first
    let displayText = contentText;

    // Add grounding indicators
    const gReq = groundingMap.get(todo.id);
    const gEv = evidenceMap.get(todo.id);

    if (gReq && gReq.strategy && gReq.strategy !== 'none') {
      displayText += ` ${gray}[PGC:${gReq.strategy}]${ANSI_RESET}`;
    }

    if (gEv && gEv.grounding_confidence) {
      const confColor =
        gEv.grounding_confidence === 'high'
          ? successColor
          : gEv.grounding_confidence === 'medium'
            ? activeColor
            : red;
      displayText += ` ${confColor}●${ANSI_RESET}`;
    }

    // Apply bold for in-progress tasks
    const boldText = todo.status === 'in_progress' ? '\x1b[1m' : '';

    // Use ANSI_RESET (full reset) to ensure terminal state is clean
    todoLines.push(
      `${statusColor}${statusIcon}${ANSI_RESET} ${textColor}${boldText}${displayText}${ANSI_RESET}`
    );
  });

  // Ensure final reset to prevent color bleeding (only if there are todos)
  if (todoLines.length === 0) {
    return '';
  }
  return '\n' + todoLines.join('\n') + ANSI_RESET;
}

/**
 * Format tool use for display as a single string
 *
 * Convenience function that formats a tool use and combines icon, name,
 * and description into a single display string.
 *
 * @param tool - Tool use to format
 * @param cwd - Current working directory (defaults to process.cwd())
 * @returns Single-line formatted string combining all formatted components
 *
 * @example
 * const message = formatToolUseMessage({
 *   name: 'Read',
 *   input: { file_path: '/src/config.ts' }
 * });
 * // Returns: "🔧 Read: file: /src/config.ts"
 */
export function formatToolUseMessage(tool: ToolUse, cwd?: string): string {
  const formatted = formatToolUse(tool, cwd);
  return `${formatted.icon} ${formatted.name}: ${formatted.description}`;
}

/**
 * Format a tool result for display
 *
 * Provides specialized formatting for tool outputs to show what the model received.
 * Currently supports Read (file content) with truncation.
 *
 * @param name - Tool name
 * @param result - Tool output
 * @param cwd - Current working directory (defaults to process.cwd())
 * @returns Formatted result string, or empty if no specialized formatting
 */
export function formatToolResult(
  name: string,
  result: unknown,
  cwd?: string
): string {
  // Normalize name to handle snake_case and various forms
  const normalizedName = name.toLowerCase().replace(/_/g, '');
  const effectiveCwd = cwd || process.cwd();

  if (
    normalizedName === 'readfile' ||
    normalizedName === 'read' ||
    normalizedName === 'grep' ||
    normalizedName === 'bash' ||
    normalizedName === 'shell' ||
    normalizedName === 'glob' ||
    normalizedName === 'fetchurl' ||
    normalizedName === 'webfetch' ||
    normalizedName === 'fetch_url' ||
    normalizedName === 'websearch'
  ) {
    let content = '';
    let processedResult = result;

    // Robust handling for JSON-encoded tool results (e.g. from Gemini ADK wrapping)
    if (typeof result === 'string' && result.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(result);
        if (parsed && typeof parsed === 'object') {
          processedResult = parsed;
        }
      } catch {
        // Not valid JSON or parsing failed, use original string
      }
    }

    if (typeof processedResult === 'string') {
      content = processedResult;
    } else if (processedResult && typeof processedResult === 'object') {
      const resObj = processedResult as Record<string, unknown>;
      // Handle MCP standard: { content: [{ type: 'text', text: '...' }] }
      if (
        Array.isArray(resObj.content) &&
        resObj.content.length > 0 &&
        resObj.content[0] &&
        typeof resObj.content[0] === 'object' &&
        (resObj.content[0] as Record<string, unknown>).type === 'text'
      ) {
        content = String(
          (resObj.content[0] as Record<string, unknown>).text || ''
        );
      } else if ('content' in resObj) {
        content = String(resObj.content);
      } else if ('result' in resObj) {
        content = String(resObj.result);
      } else {
        content = JSON.stringify(processedResult, null, 2);
      }
    } else {
      content = JSON.stringify(processedResult, null, 2);
    }

    // Layer 9: Aggressively strip cursor control sequences and ANSI from tool result content
    // to prevent terminal-intensive tools (like npm test) from showing the cursor
    // and to ensure that internal resets don't "brighten" muted output.
    content = stripAnsi(stripCursorSequences(content));

    const lines = content.split('\n');
    const MAX_LINES = 30;
    // Remove empty trailing lines
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }

    let truncatedLines: string[] = [];
    let wasTruncated = false;

    if (lines.length > MAX_LINES) {
      wasTruncated = true;
      // Show first 5 lines and last 25 lines
      const head = lines.slice(0, 5);
      const tail = lines.slice(-(MAX_LINES - 5));
      truncatedLines = [...head, '... (truncated) ...', ...tail];
    } else {
      truncatedLines = lines;
    }

    // Determine color scheme based on tool
    const isRead = normalizedName === 'readfile' || normalizedName === 'read';
    const isGrep = normalizedName === 'grep';
    const isGlob = normalizedName === 'glob';

    // ANSI Colors
    const lineNumColor = hexToAnsi(TUITheme.syntax.lineNumber);
    const cyan = hexToAnsi(TUITheme.syntax.code.block); // Keep cyan for glob/paths
    const gray = hexToAnsi(TUITheme.text.secondary);

    // Indent and format content for better visual separation
    const resultLines = truncatedLines.map((line) => {
      let formattedLine = line;

      if (isRead) {
        // executeReadFile adds line numbers like "      1│line content"
        const match = line.match(/^(\s*\d+│)(.*)$/);
        if (match) {
          const [, lineNum, content] = match;
          // Line numbers in custom color, content in muted gray
          formattedLine = `${lineNumColor}${lineNum}${ANSI_RESET} ${gray}${content}${ANSI_RESET}`;
        } else {
          formattedLine = `${gray}${line}${ANSI_RESET}`;
        }
      } else if (isGrep) {
        // Handle "line:content" (single file/context) - align line numbers
        const lineMatch = line.match(/^(\d+):(.*)$/);
        // Handle "path:line:content" (multi file) - distinct colors
        const pathMatch = line.match(/^(.+?):(\d+):(.*)$/);

        if (lineMatch) {
          const [, lineNum, content] = lineMatch;
          // Pad line number to 6 chars and add pipe
          const alignedLineNum = lineNum.padStart(6, ' ');
          formattedLine = `${lineNumColor}${alignedLineNum}│${ANSI_RESET} ${gray}${content}${ANSI_RESET}`;
        } else if (pathMatch) {
          const [, fullPath, lineNum, content] = pathMatch;
          const displayPath = relativizePath(fullPath, effectiveCwd);
          // Path in cyan, line number in gray, pipe separator
          formattedLine = `${cyan}${displayPath}:${lineNumColor}${lineNum}│${ANSI_RESET} ${gray}${content}${ANSI_RESET}`;
        } else {
          formattedLine = `${gray}${line}${ANSI_RESET}`;
        }
      } else if (isGlob) {
        // Glob output is paths - use cyan to match file prefixes in other tools
        formattedLine = `${cyan}${relativizePath(line, effectiveCwd)}${ANSI_RESET}`;
      } else {
        // Mute other output (bash, fetch, search) but keep it readable
        formattedLine = `${gray}${line}${ANSI_RESET}`;
      }

      return formattedLine;
    });

    if (wasTruncated) {
      // If we did our own head/tail truncation
      // (The marker was already added to truncatedLines array as a string, but needs formatting)
    } else if (lines.length > MAX_LINES) {
      // Legacy check (shouldn't be reached with new logic, but safe to keep)
      resultLines.push(
        `${gray}... (truncated ${lines.length - MAX_LINES} more lines)${ANSI_RESET}`
      );
    }

    return resultLines.length > 0 ? resultLines.join('\n') : '(empty)';
  }

  // Default: don't show result for other tools to keep UI clean
  return '';
}
