/**
 * PGC File Watcher Command
 *
 * Provides real-time monitoring of file changes to maintain the Grounded Context Pool (PGC)
 * dirty state. The watcher tracks modifications, additions, and deletions of tracked files,
 * enabling downstream systems to detect when PGC synchronization is needed.
 *
 * COHERENCE TRACKING:
 * - Monitors all git-tracked files for changes
 * - Detects content modifications via SHA-256 hashing
 * - Identifies new untracked files (with --untracked flag)
 * - Updates dirty_state.json in real-time
 * - Provides visual feedback for each change event
 *
 * DESIGN:
 * The watcher uses git to identify tracked files, avoiding expensive filesystem traversals.
 * File changes are detected through:
 * 1. Git diff detection for modified files
 * 2. Hash comparison against index to detect actual content changes
 * 3. Git status for untracked files (optional)
 * 4. Debouncing to batch rapid changes (configurable via --debounce)
 *
 * INTEGRATION:
 * Works with the `status` command to provide real-time coherence state:
 * - Watch detects changes → Updates dirty_state.json
 * - Status reads dirty_state.json → Reports coherence (< 10ms)
 *
 * @example
 * // Start watching with default settings
 * cognition-cli watch
 * // → Monitors tracked files, 300ms debounce
 *
 * @example
 * // Watch including untracked files with verbose output
 * cognition-cli watch --untracked --verbose
 * // → Shows full hashes and change details
 */

import { Command } from 'commander';
import { getVerboseState } from '../utils/verbose.js';
import chalk from 'chalk';
import path from 'path';

import { FileWatcher } from '../core/watcher/file-watcher.js';
import { ChangeEvent } from '../core/types/watcher.js';
import { WorkspaceManager } from '../core/workspace-manager.js';

/**
 * Creates the watch command for monitoring file changes and maintaining PGC coherence state
 *
 * @returns Commander command instance configured with watch options
 */
export function createWatchCommand(): Command {
  const cmd = new Command('watch');

  cmd
    .description('Watch files for changes and maintain PGC coherence state')
    .option('--untracked', 'Also watch for new untracked files', false)
    .option('--debounce <ms>', 'Debounce delay in milliseconds', '300')
    .option('-v, --verbose', 'Show detailed change events', false)
    .action(async (options) => {
      try {
        await runWatch({
          ...options,
          verbose: getVerboseState(options),
        });
      } catch (error) {
        console.error(chalk.red('Error:'), error);
        process.exit(1);
      }
    });

  return cmd;
}

/**
 * Executes the watch command to monitor file changes
 *
 * Sets up a FileWatcher instance and registers event handlers for:
 * - 'ready': Watcher initialization complete
 * - 'change': File modification detected
 * - 'error': Watcher error occurred
 *
 * The function runs indefinitely until the user terminates with SIGINT/SIGTERM.
 * Graceful shutdown ensures dirty state is properly persisted.
 *
 * @param options - Watch command options
 * @param options.untracked - Include untracked files in watch (default: false)
 * @param options.debounce - Debounce delay in milliseconds (default: '300')
 * @param options.verbose - Show detailed change events including hashes (default: false)
 *
 * @example
 * // Watch tracked files only with 500ms debounce
 * await runWatch({ debounce: '500' });
 *
 * @example
 * // Watch all files including untracked, show full details
 * await runWatch({ untracked: true, verbose: true });
 */
async function runWatch(options: {
  untracked?: boolean;
  debounce?: string;
  verbose?: boolean;
}): Promise<void> {
  const workspaceManager = new WorkspaceManager();
  const projectRoot = workspaceManager.resolvePgcRoot(process.cwd());

  if (!projectRoot) {
    console.error(
      chalk.red(
        '\n✗ No .open_cognition workspace found. Run "cognition-cli init" to create one.\n'
      )
    );
    process.exit(1);
  }

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
