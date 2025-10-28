import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';

import { FileWatcher } from '../core/watcher/file-watcher.js';
import { ChangeEvent } from '../core/types/watcher.js';

/**
 * Creates the watch command for monitoring file changes and maintaining PGC coherence state.
 */
export function createWatchCommand(): Command {
  const cmd = new Command('watch');

  cmd
    .description('Watch files for changes and maintain PGC coherence state')
    .option('--untracked', 'Also watch for new untracked files', false)
    .option('--debounce <ms>', 'Debounce delay in milliseconds', '300')
    .option('--verbose', 'Show detailed change events', false)
    .action(async (options) => {
      try {
        await runWatch(options);
      } catch (error) {
        console.error(chalk.red('Error:'), error);
        process.exit(1);
      }
    });

  return cmd;
}

async function runWatch(options: {
  untracked?: boolean;
  debounce?: string;
  verbose?: boolean;
}): Promise<void> {
  const projectRoot = process.cwd();
  const pgcRoot = path.join(projectRoot, '.open_cognition');

  console.log(chalk.bold('🔭 Starting File Watcher'));
  console.log(chalk.gray(`Project: ${projectRoot}`));
  console.log(chalk.gray(`PGC: ${pgcRoot}`));
  console.log('');

  const watcher = new FileWatcher(pgcRoot, projectRoot, {
    watchUntracked: options.untracked,
    debounceMs: parseInt(options.debounce || '300', 10),
  });

  // Event handlers
  watcher.on('ready', () => {
    console.log(chalk.green('✓ Watcher ready'));
    console.log(chalk.gray('Press Ctrl+C to stop'));
    console.log('');
    console.log(chalk.bold('Watching for changes...'));
  });

  watcher.on('change', (event: ChangeEvent) => {
    const typeColors = {
      modified: chalk.yellow,
      added: chalk.cyan,
      deleted: chalk.red,
    };

    const typeSymbols = {
      modified: '✗',
      added: '+',
      deleted: '-',
    };

    const color = typeColors[event.type];
    const symbol = typeSymbols[event.type];

    console.log(
      `${color(symbol)} ${event.path}${options.verbose ? ` (${event.hash?.slice(0, 8) || 'deleted'})` : ''}`
    );
  });

  watcher.on('error', (error: Error) => {
    console.error(chalk.red('Watcher error:'), error.message);
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('');
    console.log(chalk.yellow('Stopping watcher...'));
    await watcher.stop();
    console.log(chalk.green('✓ Watcher stopped'));
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await watcher.stop();
    process.exit(0);
  });

  // Start watching
  await watcher.start();
}
