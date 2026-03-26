import { Command } from 'commander';
import chalk from 'chalk';
import { intro, outro } from '@clack/prompts';
import { resolvePgcRoot } from './sugar/utils.js';
import { TransformLog } from '../core/pgc/transform-log.js';
import { ReverseDeps } from '../core/pgc/reverse-deps.js';
import { TransformDAG } from '../core/pgc/transform-dag.js';
import { TransformCompactor } from '../core/lineage/transform-compactor.js';

/**
 * Create the `transforms compact` subcommand.
 *
 * Scans the PGC transform log and compacts it by:
 * - Purging invalidated transforms
 * - Squashing intermediate transforms in a chain into a single summary record
 *
 * @returns Commander Command for `transforms compact`
 */
export function createTransformsCompactCommand(): Command {
  return new Command('compact')
    .description(
      'Compact the PGC transform log (purge invalidated, squash intermediates)'
    )
    .option(
      '--before <date>',
      'Only compact transforms older than this ISO date (e.g. 2025-01-01)'
    )
    .option(
      '--dry-run',
      'Show what would be done without making changes',
      false
    )
    .option(
      '--min-age <days>',
      'Minimum age in days for a transform to be eligible (default 90)',
      '90'
    )
    .action(
      async (options: {
        before?: string;
        dryRun?: boolean;
        minAge?: string;
      }) => {
        const isDryRun = options.dryRun ?? false;
        const minAgeDays = parseInt(options.minAge ?? '90', 10);
        const before = options.before ? new Date(options.before) : undefined;

        intro(chalk.bold('Transform Compaction'));

        if (before && isNaN(before.getTime())) {
          console.error(
            chalk.red(`✗ Invalid --before date: ${options.before}`)
          );
          process.exit(1);
        }

        const pgcRoot = resolvePgcRoot(process.cwd());
        const transformLog = new TransformLog(pgcRoot);
        const reverseDeps = new ReverseDeps(pgcRoot);
        const transformDAG = new TransformDAG(pgcRoot);
        const compactor = new TransformCompactor(
          transformLog,
          reverseDeps,
          transformDAG
        );

        console.log(chalk.dim('Scanning transform log…'));

        const plan = await compactor.scan({ before, minAgeDays });

        const totalEligible =
          plan.toInvalidated.length + plan.toIntermediate.length;
        const summaryCount = plan.squashGroups.size;

        console.log(
          chalk.bold(
            `\n${totalEligible.toLocaleString()} transforms eligible for compaction`
          )
        );
        console.log(
          chalk.dim(
            `  ${plan.toInvalidated.length.toLocaleString()} invalidated (will be purged)`
          )
        );
        console.log(
          chalk.dim(
            `  ${plan.toIntermediate.length.toLocaleString()} intermediate (will be squashed into ${summaryCount.toLocaleString()} summary transforms)`
          )
        );
        if (summaryCount > 0) {
          console.log(
            chalk.dim(
              `  Intent chains preserved: ${summaryCount.toLocaleString()} summary narratives generated`
            )
          );
        }
        if (plan.skippedAiAgent > 0) {
          console.log(
            chalk.dim(
              `  ${plan.skippedAiAgent.toLocaleString()} ai_agent transforms skipped (never compacted)`
            )
          );
        }
        if (plan.skippedTooRecent > 0) {
          console.log(
            chalk.dim(
              `  ${plan.skippedTooRecent.toLocaleString()} too-recent transforms skipped (< ${minAgeDays}d old)`
            )
          );
        }

        if (totalEligible === 0) {
          outro(chalk.gray('Nothing to compact'));
          return;
        }

        if (isDryRun) {
          outro(chalk.yellow('(dry run — no changes made)'));
          return;
        }

        console.log(chalk.dim('\nCompacting…'));

        const result = await compactor.compact(plan, { dryRun: false });

        console.log(
          chalk.green(
            `✓ Purged ${result.purged.toLocaleString()} invalidated transforms`
          )
        );
        if (result.squashed > 0) {
          console.log(
            chalk.green(
              `✓ Squashed ${result.squashed.toLocaleString()} intermediates into ${result.summariesGenerated.toLocaleString()} summary transforms`
            )
          );
        }
        if (result.endpointsPreserved > 0) {
          console.log(
            chalk.dim(
              `  ${result.endpointsPreserved.toLocaleString()} endpoint transforms preserved`
            )
          );
        }

        outro(chalk.green('Transform log compacted'));
      }
    );
}
