import fs from 'fs';
import path from 'path';

export interface Command {
  name: string; // "quest-start"
  content: string; // Full markdown content
  description?: string; // Extracted from frontmatter or first # heading
  filePath: string; // Absolute path to .md file
  aliases?: string[]; // ["qs"] for /qs shortcut (future)
  category?: string; // "quest", "analyze", "security" (extracted from prefix)
}

export interface LoadCommandsResult {
  commands: Map<string, Command>;
  errors: Array<{ file: string; error: string }>;
  warnings: Array<{ file: string; warning: string }>;
}

/**
 * Load all commands from .claude/commands/ directory
 * with comprehensive validation and error reporting
 */
export async function loadCommands(
  projectRoot: string
): Promise<LoadCommandsResult> {
  const commands = new Map<string, Command>();
  const errors: Array<{ file: string; error: string }> = [];
  const warnings: Array<{ file: string; warning: string }> = [];

  const commandsDir = path.join(projectRoot, '.claude', 'commands');

  // 1. Handle missing directory gracefully
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
 * Tries first # heading, then falls back to first non-empty line
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
 * Returns all commands if prefix is empty
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
 * Supports: {{FILE_PATH}}, {{SYMBOL_NAME}}, {{ALL_ARGS}}
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
      console.warn(`Unknown placeholder: {{${key}}}`);
      return match;
    });

    // Also append context at end
    expanded += `\n\nUser provided context: ${args.join(' ')}`;
  }

  return expanded;
}
