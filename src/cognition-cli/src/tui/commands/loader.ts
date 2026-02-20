/**
 * TUI Command Loader - Slash Command Discovery and Expansion
 *
 * Loads custom slash commands from `.claude/commands/` directory and provides
 * utilities for command discovery, validation, and expansion with placeholder
 * substitution.
 *
 * DESIGN:
 * Commands are stored as Markdown files in `.claude/commands/`:
 * - Filename becomes command name (e.g., `quest-start.md` → `/quest-start`)
 * - First `#` heading or first line becomes description
 * - Prefix before `-` becomes category (e.g., `quest-start` → category: "quest")
 * - Content can include placeholders: {{FILE_PATH}}, {{SYMBOL_NAME}}, {{ALL_ARGS}}
 *
 * SECURITY:
 * - Directory traversal prevention via path normalization
 * - README.md is excluded (reserved for documentation)
 * - Invalid files are logged as warnings, not errors (graceful degradation)
 *
 * PLACEHOLDER EXPANSION:
 * Commands support dynamic argument substitution:
 * - {{FILE_PATH}}: First argument (useful for file-related commands)
 * - {{SYMBOL_NAME}}: Second argument or first if second missing
 * - {{ALL_ARGS}}: All arguments joined with spaces
 *
 * @example
 * // Directory structure:
 * // .claude/commands/
 * //   quest-start.md
 * //   analyze-symbol.md
 * //   security-audit.md
 *
 * const { commands, errors, warnings } = await loadCommands('/home/user/project');
 * systemLog('tui', `Loaded ${commands.size} commands`);
 *
 * @example
 * // Command with placeholders (analyze-symbol.md):
 * // # Analyze Symbol
 * // Provide detailed analysis of {{SYMBOL_NAME}} in {{FILE_PATH}}
 *
 * const expanded = expandCommand('/analyze-symbol src/foo.ts myFunction', commands);
 * // → "Provide detailed analysis of myFunction in src/foo.ts\n\nUser provided context: src/foo.ts myFunction"
 */

import fs from 'fs';
import path from 'path';
import { systemLog } from '../../utils/debug-logger.js';

/**
 * Command metadata and content
 *
 * Represents a loaded slash command with its content and extracted metadata.
 */
export interface Command {
  /** Command name derived from filename (e.g., "quest-start") */
  name: string;
  /** Full markdown content of the command file */
  content: string;
  /** Description extracted from first # heading or first line */
  description?: string;
  /** Absolute path to the .md file */
  filePath: string;
  /** Future: Command aliases (e.g., ["qs"] for /qs shortcut) */
  aliases?: string[];
  /** Category extracted from prefix (e.g., "quest" from "quest-start") */
  category?: string;
}

/**
 * Result from loading commands
 *
 * Contains successfully loaded commands plus any errors/warnings encountered
 * during loading. Errors are fatal (file couldn't be read), warnings are
 * non-fatal (invalid content but loading continues).
 */
export interface LoadCommandsResult {
  /** Map of command name → Command */
  commands: Map<string, Command>;
  /** Fatal errors that prevented file loading */
  errors: Array<{ file: string; error: string }>;
  /** Non-fatal warnings (validation failures, duplicates) */
  warnings: Array<{ file: string; warning: string }>;
}

/**
 * Load all commands from .claude/commands/ directory
 *
 * Discovers and loads all `.md` files from the commands directory, validating
 * each one and extracting metadata. Handles missing directories gracefully
 * and continues loading even if individual files are invalid.
 *
 * ALGORITHM:
 * 1. Check if .claude/commands/ exists → return empty if not
 * 2. Read all .md files (exclude README.md)
 * 3. For each file:
 *    a. Validate path (prevent directory traversal)
 *    b. Read content
 *    c. Validate content (not empty, has headings or sufficient length)
 *    d. Extract metadata (name, description, category)
 *    e. Add to commands map (or log warning if duplicate)
 * 4. Return commands, errors, warnings
 *
 * ERROR HANDLING:
 * - Missing directory: Returns empty result (not an error)
 * - Unreadable directory: Returns error
 * - Invalid file: Logs warning, continues loading
 * - Duplicate command: Logs warning, overwrites previous
 *
 * @param projectRoot - Absolute path to project root
 * @returns Result with loaded commands and any errors/warnings
 *
 * @example
 * const result = await loadCommands('/home/user/project');
 * systemLog('tui', `Loaded ${result.commands.size} commands`);
 * if (result.errors.length > 0) {
 *   systemLog('tui', 'Errors: ' + JSON.stringify(result.errors), undefined, 'error');
 * }
 * if (result.warnings.length > 0) {
 *   systemLog('tui', 'Warnings: ' + JSON.stringify(result.warnings), undefined, 'warn');
 * }
 *
 * @example
 * // Accessing loaded commands
 * const { commands } = await loadCommands('/home/user/project');
 * const questStart = commands.get('quest-start');
 * if (questStart) {
 *   systemLog('tui', questStart.description || '');
 *   systemLog('tui', questStart.category || ''); // "quest"
 * }
 */
export async function loadCommands(
  projectRoot: string,
  solo: boolean = false
): Promise<LoadCommandsResult> {
  const commands = new Map<string, Command>();
  const errors: Array<{ file: string; error: string }> = [];
  const warnings: Array<{ file: string; warning: string }> = [];

  const commandsDir = path.join(projectRoot, '.claude', 'commands');

  // Add built-in IPC commands first (always available unless in solo mode)
  const builtInCommands: Array<{ name: string; description: string }> = solo
    ? []
    : [
        { name: 'send', description: 'Send message to another agent' },
        { name: 'agents', description: 'List active agents' },
        { name: 'pending', description: 'View pending messages' },
        { name: 'inject', description: 'Inject message into conversation' },
        { name: 'inject-all', description: 'Inject all pending messages' },
        { name: 'dismiss', description: 'Dismiss a message' },
      ];

  for (const builtIn of builtInCommands) {
    commands.set(builtIn.name, {
      name: builtIn.name,
      content: '', // Built-in commands don't use content
      description: builtIn.description,
      filePath: '', // No file path for built-in commands
      category: 'ipc',
    });
  }

  // 1. Handle missing directory gracefully (built-ins already added above)
  if (!fs.existsSync(commandsDir)) {
    return { commands, errors, warnings };
  }

  // 2. Read all .md files (exclude README.md)
  let files: string[];
  try {
    files = fs
      .readdirSync(commandsDir)
      .filter((f) => f.endsWith('.md') && f !== 'README.md');
  } catch (error) {
    errors.push({
      file: commandsDir,
      error: `Failed to read directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
    return { commands, errors, warnings };
  }

  for (const file of files) {
    const filePath = path.join(commandsDir, file);

    try {
      // 3. Security: Prevent directory traversal
      const normalizedPath = path.normalize(filePath);
      if (!normalizedPath.startsWith(commandsDir)) {
        errors.push({
          file,
          error: 'Invalid path (directory traversal attempt)',
        });
        continue;
      }

      // 4. Read content
      const content = fs.readFileSync(filePath, 'utf-8');

      // 5. Validate
      const validation = validateCommandFile(filePath, content);
      if (!validation.valid) {
        warnings.push({ file, warning: validation.error! });
        continue;
      }

      // 6. Extract command name from filename
      const commandName = path.basename(file, '.md');

      // 7. Extract description
      const description = extractDescription(content);

      // 8. Extract category from prefix (quest-*, analyze-*, etc.)
      const category = commandName.split('-')[0];

      // 9. Check for duplicates
      if (commands.has(commandName)) {
        warnings.push({
          file,
          warning: `Duplicate command '${commandName}', overwriting`,
        });
      }

      // 10. Add to map
      commands.set(commandName, {
        name: commandName,
        content,
        description,
        filePath,
        category,
      });
    } catch (error) {
      errors.push({
        file,
        error: `Failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  return { commands, errors, warnings };
}

/**
 * Validate command file for basic correctness
 *
 * Performs minimal validation to filter out obviously broken files.
 * Does NOT validate markdown structure deeply (we're lenient).
 *
 * VALIDATION RULES:
 * 1. Content must not be empty (after trimming whitespace)
 * 2. Must have at least one # heading OR be at least 20 characters long
 *
 * These rules are intentionally permissive to allow creative command formats.
 *
 * @param filePath - Path to the file (for error messages, unused in validation)
 * @param content - File content to validate
 * @returns Validation result with error message if invalid
 *
 * @example
 * const result = validateCommandFile('quest.md', '# Quest\nDo the thing');
 * // → { valid: true }
 *
 * @example
 * const result = validateCommandFile('bad.md', '');
 * // → { valid: false, error: 'Empty file' }
 */
function validateCommandFile(
  filePath: string,
  content: string
): { valid: boolean; error?: string } {
  // 1. Empty file
  if (content.trim().length === 0) {
    return { valid: false, error: 'Empty file' };
  }

  // 2. Basic markdown check (has at least one # or some content)
  if (!content.includes('#') && content.length < 20) {
    return { valid: false, error: 'Invalid markdown (too short, no headings)' };
  }

  return { valid: true };
}

/**
 * Extract description from markdown content
 *
 * Tries to find a concise description for the command, using this priority:
 * 1. First `#` heading (most common convention)
 * 2. First non-empty line (fallback for plain text commands)
 * 3. undefined (if content is empty)
 *
 * Descriptions are truncated to 80 characters to keep UI compact.
 *
 * @param content - Markdown content to extract description from
 * @returns Extracted description, or undefined if none found
 *
 * @example
 * const desc = extractDescription('# Quest Start\nBegin a new quest');
 * // → "Quest Start"
 *
 * @example
 * const desc = extractDescription('Do the thing\n\nMore details...');
 * // → "Do the thing"
 */
function extractDescription(content: string): string | undefined {
  // Try to find first # heading
  const match = content.match(/^#\s+(.+)$/m);
  if (match) {
    return match[1].trim();
  }

  // Fallback: use first non-empty line
  const firstLine = content.split('\n').find((line) => line.trim().length > 0);
  if (firstLine) {
    return firstLine.trim().slice(0, 80); // Max 80 chars
  }

  return undefined;
}

/**
 * Filter commands by prefix (case-insensitive)
 *
 * Used for command autocomplete and search. Returns all commands matching
 * the given prefix, or all commands if prefix is empty.
 *
 * MATCHING:
 * - Case-insensitive (converts both to lowercase)
 * - Prefix match only (not substring)
 * - Empty prefix returns all commands
 *
 * @param prefix - Prefix to filter by (e.g., "quest" matches "quest-start", "quest-end")
 * @param commands - Map of all available commands
 * @returns Array of matching commands
 *
 * @example
 * const matching = filterCommands('quest', commands);
 * // → [Command(quest-start), Command(quest-end)]
 *
 * @example
 * const all = filterCommands('', commands);
 * // → [All commands]
 */
export function filterCommands(
  prefix: string,
  commands: Map<string, Command>
): Command[] {
  if (prefix.trim() === '') {
    return Array.from(commands.values());
  }

  const lowerPrefix = prefix.toLowerCase();
  return Array.from(commands.values()).filter((cmd) =>
    cmd.name.toLowerCase().startsWith(lowerPrefix)
  );
}

/**
 * Expand command with argument substitution
 *
 * Takes a slash command invocation (e.g., `/analyze-symbol foo.ts bar`) and
 * expands it to the full command content with placeholders replaced.
 *
 * PLACEHOLDER MAPPING:
 * - {{FILE_PATH}}: args[0] (first argument)
 * - {{SYMBOL_NAME}}: args[1] || args[0] (second arg, or first if missing)
 * - {{ALL_ARGS}}: args.join(' ') (all arguments concatenated)
 *
 * EXPANSION ALGORITHM:
 * 1. Parse input: /command-name arg1 arg2 arg3
 * 2. Look up command in map → return null if not found
 * 3. Replace all {{PLACEHOLDER}} occurrences
 * 4. Append "User provided context: ..." for additional context
 *
 * UNKNOWN PLACEHOLDERS:
 * If a placeholder is not recognized, it's preserved in the output and a
 * warning is logged to systemLog. This allows for future placeholder extensions.
 *
 * @param input - Slash command invocation with arguments
 * @param commands - Map of available commands
 * @returns Expanded command content, or null if command not found
 *
 * @example
 * // Command: analyze-symbol.md
 * // Content: "Analyze {{SYMBOL_NAME}} in {{FILE_PATH}}"
 * const expanded = expandCommand('/analyze-symbol src/foo.ts myFunc', commands);
 * // → "Analyze myFunc in src/foo.ts\n\nUser provided context: src/foo.ts myFunc"
 *
 * @example
 * // No arguments
 * const expanded = expandCommand('/quest-start', commands);
 * // → [Original command content, no placeholder substitution]
 *
 * @example
 * // Unknown command
 * const expanded = expandCommand('/unknown-command', commands);
 * // → null
 */
export function expandCommand(
  input: string,
  commands: Map<string, Command>
): string | null {
  // Parse: /command-name arg1 arg2 arg3
  const parts = input.slice(1).split(' ');
  const commandName = parts[0];
  const args = parts.slice(1).filter((arg) => arg.trim().length > 0); // Filter empty args

  const command = commands.get(commandName);
  if (!command) {
    return null;
  }

  let expanded = command.content;

  // Structured placeholder replacement with type safety
  if (args.length > 0) {
    const placeholders: Record<string, string> = {
      FILE_PATH: args[0] || '',
      SYMBOL_NAME: args[1] || args[0] || '',
      ALL_ARGS: args.join(' '),
    };

    expanded = expanded.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (key in placeholders) {
        return placeholders[key];
      }
      // Log warning for unknown placeholder but keep it in output
      systemLog('tui', `Unknown placeholder: {{${key}}}`, undefined, 'warn');
      return match;
    });

    // Also append context at end
    expanded += `\n\nUser provided context: ${args.join(' ')}`;
  }

  return expanded;
}
