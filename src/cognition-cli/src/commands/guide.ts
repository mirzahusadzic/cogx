/**
 * Interactive Guide Command
 *
 * Provides colorful, candid guides for using cognition-cli commands. Guides are
 * written in Markdown and rendered directly in the terminal with syntax highlighting,
 * code blocks, and emoji support.
 *
 * GUIDE LOCATIONS:
 * Guides are stored as Markdown files in .claude/commands/:
 * - Project-specific guides: <project>/.claude/commands/<topic>.md
 * - Built-in guides: cognition-cli/.claude/commands/<topic>.md
 * - Fallback to built-in if project-specific guide doesn't exist
 *
 * AVAILABLE GUIDES:
 * - watch: Monitor file changes & maintain dirty state
 * - status: Check PGC coherence (< 10ms!)
 * - explore-architecture: Explore codebase architecture with PGC
 * - analyze-symbol: Deep-dive into a specific symbol
 * - trace-dependency: Follow dependency chains
 * - analyze-impact: Understand blast radius of changes
 *
 * MARKDOWN RENDERING:
 * The guide renderer supports:
 * - Headers (# ## ###)
 * - Code blocks (\`\`\`)
 * - Lists (- * 1.)
 * - Blockquotes (>)
 * - Inline code (\`code\`)
 * - Bold (**text**) and italic (*text*)
 * - Emojis (preserved as-is)
 *
 * DESIGN:
 * Guides serve as in-terminal documentation that is:
 * - More accessible than external docs (no context switching)
 * - Richer than --help text (examples, explanations)
 * - Project-customizable (override built-in guides)
 *
 * @example
 * // Show guide index
 * cognition-cli guide
 * // → Lists all available guides
 *
 * @example
 * // Show specific guide
 * cognition-cli guide watch
 * // → Renders watch.md with colors and formatting
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { terminalFormatter } from '../core/services/terminal-formatter/TerminalFormatterService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates the guide command for displaying colorful, candid guides for CLI commands
 *
 * @returns Commander command instance configured to show guides
 */
export function createGuideCommand(): Command {
  const cmd = new Command('guide');

  cmd
    .description('📚 Show colorful, candid guides for cognition-cli commands')
    .argument(
      '[topic]',
      'Guide topic (watch, status, explore-architecture, etc.)'
    )
    .action(async (topic?: string) => {
      try {
        if (!topic) {
          await showGuideIndex();
        } else {
          await showGuide(topic);
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error);
        process.exit(1);
      }
    });

  return cmd;
}

/**
 * Displays the guide index listing all available guides
 *
 * Shows a formatted list of guide topics with emojis and descriptions.
 * This is the default view when no topic is specified.
 *
 * @example
 * await showGuideIndex();
 * // → "📚 Cognition CLI Guides\n Available guides:\n  👀 watch  Monitor file changes..."
 */
async function showGuideIndex(): Promise<void> {
  console.log(chalk.bold.cyan('📚 Cognition CLI Guides'));
  console.log('');

  const builtInGuidesDir = path.join(__dirname, '../../.claude/commands');
  const projectGuidesDir = path.join(process.cwd(), '.claude/commands');

  const topics = new Set<string>();

  if (await fs.pathExists(builtInGuidesDir)) {
    const files = await fs.readdir(builtInGuidesDir);
    files
      .filter((f) => f.endsWith('.md'))
      .forEach((f) => topics.add(f.replace('.md', '')));
  }

  if (await fs.pathExists(projectGuidesDir)) {
    const files = await fs.readdir(projectGuidesDir);
    files
      .filter((f) => f.endsWith('.md'))
      .forEach((f) => topics.add(f.replace('.md', '')));
  }

  if (topics.size === 0) {
    console.log(chalk.yellow('No guides found.'));
    return;
  }

  console.log('Available guides:');
  const sortedTopics = Array.from(topics).sort();

  for (const topic of sortedTopics) {
    const content = await getGuideContent(topic);
    const firstLine = content?.split('\n')[0] || '';
    const description = firstLine.startsWith('# ')
      ? firstLine.slice(2).trim()
      : topic;

    // Extract emoji if present
    const emojiMatch = description.match(
      /^(\p{Emoji_Presentation}|\p{Emoji})/u
    );
    const emoji = emojiMatch ? emojiMatch[0] : '📄';
    const text = emojiMatch
      ? description.slice(emoji.length).trim()
      : description;

    console.log(
      `  ${emoji} ${chalk.bold(topic.padEnd(12))} ${chalk.gray(text)}`
    );
  }

  console.log('');
  console.log(
    `Run ${chalk.cyan('cognition-cli guide <topic>')} to read a guide.`
  );
}

/**
 * Loads and displays a specific guide topic
 *
 * @param topic - Guide topic to display
 */
async function showGuide(topic: string): Promise<void> {
  const content = await getGuideContent(topic);

  if (!content) {
    console.error(chalk.red(`Guide not found: ${topic}`));
    console.log(
      `Run ${chalk.cyan('cognition-cli guide')} to see available guides.`
    );
    return;
  }

  console.log(renderMarkdown(content));
}

/**
 * Retrieves the content of a guide file, checking project then built-in locations
 *
 * @param topic - Guide topic
 * @returns Markdown content or null if not found
 */
async function getGuideContent(topic: string): Promise<string | null> {
  const projectPath = path.join(
    process.cwd(),
    '.claude/commands',
    `${topic}.md`
  );
  const builtInPath = path.join(
    __dirname,
    '../../.claude/commands',
    `${topic}.md`
  );

  if (await fs.pathExists(projectPath)) {
    return fs.readFile(projectPath, 'utf8');
  }

  if (await fs.pathExists(builtInPath)) {
    return fs.readFile(builtInPath, 'utf8');
  }

  return null;
}

/**
 * Renders Markdown content to ANSI-formatted string
 *
 * @param content - Raw Markdown content to render
 * @returns Formatted string with ANSI color codes
 *
 * @deprecated Use terminalFormatter.renderMarkdown instead.
 */
function renderMarkdown(content: string): string {
  return terminalFormatter.renderMarkdown(content);
}
