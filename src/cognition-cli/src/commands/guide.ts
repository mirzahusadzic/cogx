import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createGuideCommand(): Command {
  const cmd = new Command('guide');

  cmd
    .description('📚 Show colorful, candid guides for cognition-cli commands')
    .argument('[topic]', 'Guide topic (watch, status, explore-architecture, etc.)')
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

async function showGuideIndex(): Promise<void> {
  console.log(chalk.bold.cyan('📚 Cognition CLI Guides'));
  console.log('');
  console.log('Available guides (colorful & candid! 🎨):');
  console.log('');

  const guides = [
    { name: 'watch', emoji: '👀', desc: 'Monitor file changes & maintain dirty state' },
    { name: 'status', emoji: '🔍', desc: 'Check PGC coherence (< 10ms!)' },
    { name: 'explore-architecture', emoji: '🏗️', desc: 'Explore codebase architecture with PGC' },
    { name: 'analyze-symbol', emoji: '🔬', desc: 'Deep-dive into a specific symbol' },
    { name: 'trace-dependency', emoji: '🧭', desc: 'Follow dependency chains' },
    { name: 'analyze-impact', emoji: '💥', desc: 'Understand blast radius of changes' },
  ];

  for (const guide of guides) {
    console.log(`  ${guide.emoji}  ${chalk.cyan(guide.name.padEnd(25))} ${chalk.gray(guide.desc)}`);
  }

  console.log('');
  console.log(chalk.gray('Usage:'));
  console.log(chalk.gray(`  $ cognition-cli guide ${chalk.cyan('<topic>')}`));
  console.log('');
  console.log(chalk.gray('Example:'));
  console.log(chalk.gray(`  $ cognition-cli guide ${chalk.cyan('watch')}`));
}

async function showGuide(topic: string): Promise<void> {
  // Try to find guide in .claude/commands/ directory (from project root)
  const projectRoot = process.cwd();
  const guidePath = path.join(projectRoot, '.claude', 'commands', `${topic}.md`);

  // Fallback to built-in guides if project doesn't have .claude/commands
  const builtinGuidePath = path.join(
    path.dirname(path.dirname(__dirname)), // Go up from dist/commands to project root
    '.claude',
    'commands',
    `${topic}.md`
  );

  let content: string;
  let sourcePath: string;

  if (await fs.pathExists(guidePath)) {
    content = await fs.readFile(guidePath, 'utf-8');
    sourcePath = guidePath;
  } else if (await fs.pathExists(builtinGuidePath)) {
    content = await fs.readFile(builtinGuidePath, 'utf-8');
    sourcePath = builtinGuidePath;
  } else {
    console.log(chalk.red(`❌ Guide not found: ${topic}`));
    console.log('');
    console.log(chalk.gray('Available guides:'));
    await showGuideIndex();
    process.exit(1);
    return;
  }

  // Render markdown with basic formatting
  const rendered = renderMarkdown(content);
  console.log(rendered);
  console.log('');
  console.log(chalk.gray(`📖 Source: ${sourcePath}`));
}

function renderMarkdown(content: string): string {
  const lines = content.split('\n');
  const output: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers
    if (line.startsWith('# ')) {
      output.push('');
      output.push(chalk.bold.cyan(line.slice(2)));
      output.push('');
    } else if (line.startsWith('## ')) {
      output.push('');
      output.push(chalk.bold.yellow(line.slice(3)));
      output.push('');
    } else if (line.startsWith('### ')) {
      output.push('');
      output.push(chalk.bold(line.slice(4)));
    } else if (line.startsWith('```')) {
      // Code blocks
      const lang = line.slice(3);
      i++; // Skip opening ```
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(chalk.gray(lines[i]));
        i++;
      }
      output.push('');
      output.push(codeLines.join('\n'));
      output.push('');
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      // Lists
      output.push(chalk.cyan('  •') + line.slice(1));
    } else if (line.match(/^\d+\./)) {
      // Numbered lists
      output.push(chalk.cyan(line));
    } else if (line.trim() === '') {
      // Empty lines
      output.push('');
    } else if (line.startsWith('>')) {
      // Blockquotes
      output.push(chalk.italic.gray(line.slice(1).trim()));
    } else {
      // Regular text - preserve emojis and formatting
      let formatted = line;

      // Bold (**text** or __text__)
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, (_, text) => chalk.bold(text));
      formatted = formatted.replace(/__(.*?)__/g, (_, text) => chalk.bold(text));

      // Italic (*text* or _text_)
      formatted = formatted.replace(/\*(.*?)\*/g, (_, text) => chalk.italic(text));
      formatted = formatted.replace(/_(.*?)_/g, (_, text) => chalk.italic(text));

      // Inline code (`code`)
      formatted = formatted.replace(/`([^`]+)`/g, (_, code) => chalk.cyan(code));

      output.push(formatted);
    }
  }

  return output.join('\n');
}
