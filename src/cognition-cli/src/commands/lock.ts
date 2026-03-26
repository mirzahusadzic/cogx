import { Command } from 'commander';
import chalk from 'chalk';
import { intro, outro } from '@clack/prompts';
import { resolvePgcRoot } from './sugar/utils.js';
import { AgentLockManager } from '../core/watcher/agent-lock.js';

export function createLockCommand(): Command {
  const lock = new Command('lock').description(
    'Manage agent write locks for the PGC'
  );

  lock
    .command('acquire')
    .description(
      'Acquire a write lock (prevents watcher from triggering updates mid-write)'
    )
    .option(
      '--source <id>',
      'Identifier for the lock holder (e.g. claude-code)',
      'agent'
    )
    .option('--timeout <seconds>', 'Auto-expire timeout in seconds', '30')
    .option('--session <id>', 'Session identifier')
    .option('-p, --project-root <path>', 'Project root', process.cwd())
    .addHelpText(
      'after',
      '\nExamples:\n  $ cognition-cli lock acquire --source claude-code --timeout 60\n  $ cognition-cli lock acquire --source tui'
    )
    .action(async (options) => {
      intro(chalk.bold('PGC Agent Lock — Acquire'));
      const pgcRoot = resolvePgcRoot(options.projectRoot || '.');
      const manager = new AgentLockManager(pgcRoot);
      const timeoutSeconds = parseInt(options.timeout ?? '30', 10);

      try {
        await manager.acquire(options.source, timeoutSeconds, options.session);
        const state = await manager.readState();
        console.log(chalk.green('✓ Lock acquired'));
        if (state) {
          console.log(chalk.gray(`  Source:     ${state.source}`));
          console.log(chalk.gray(`  Acquired:   ${state.acquired_at}`));
          console.log(chalk.gray(`  Expires:    ${state.expires_at}`));
          if (state.session_id) {
            console.log(chalk.gray(`  Session:    ${state.session_id}`));
          }
        }
        outro(chalk.green('Lock acquired successfully'));
      } catch (err) {
        console.error(
          chalk.red('✗ ' + (err instanceof Error ? err.message : String(err)))
        );
        process.exit(1);
      }
    });

  lock
    .command('release')
    .description('Release an active write lock')
    .option('-p, --project-root <path>', 'Project root', process.cwd())
    .addHelpText('after', '\nExamples:\n  $ cognition-cli lock release')
    .action(async (options) => {
      intro(chalk.bold('PGC Agent Lock — Release'));
      const pgcRoot = resolvePgcRoot(options.projectRoot || '.');
      const manager = new AgentLockManager(pgcRoot);

      await manager.release();
      console.log(chalk.green('✓ Lock released'));
      outro(chalk.green('Done'));
    });

  lock
    .command('status')
    .description('Show current lock status')
    .option('-p, --project-root <path>', 'Project root', process.cwd())
    .action(async (options) => {
      intro(chalk.bold('PGC Agent Lock — Status'));
      const pgcRoot = resolvePgcRoot(options.projectRoot || '.');
      const manager = new AgentLockManager(pgcRoot);

      const locked = await manager.isLocked();
      const state = await manager.readState();

      if (!locked || state === null) {
        console.log(chalk.gray('No active lock'));
        outro(chalk.gray('Unlocked'));
        return;
      }

      const now = Date.now();
      const expiresMs = Date.parse(state.expires_at);
      const remainingSec = Math.max(0, Math.floor((expiresMs - now) / 1000));
      const expired = now > expiresMs;

      console.log(
        expired
          ? chalk.yellow('⚠  Lock exists but has expired')
          : chalk.green('● Lock is active')
      );
      console.log(chalk.gray(`  Source:     ${state.source}`));
      console.log(chalk.gray(`  Acquired:   ${state.acquired_at}`));
      console.log(chalk.gray(`  Expires:    ${state.expires_at}`));
      if (!expired) {
        console.log(chalk.gray(`  Remaining:  ${remainingSec}s`));
      }
      if (state.session_id) {
        console.log(chalk.gray(`  Session:    ${state.session_id}`));
      }

      outro(
        expired ? chalk.yellow('Expired lock') : chalk.green('Active lock')
      );
    });

  return lock;
}
