/**
 * Coherence Commands (Refactored to use Algebra Layer)
 *
 * Uses CoherenceAlgebraAdapter instead of direct StrategicCoherenceManager.
 * This provides better integration with the lattice algebra system.
 */

import { Command } from 'commander';
import { intro, outro, spinner, log } from '@clack/prompts';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { OverlayRegistry } from '../core/algebra/overlay-registry.js';
import type {
  CoherenceMetadata,
  CoherenceAlgebraAdapter,
} from '../core/overlays/strategic-coherence/algebra-adapter.js';

/**
 * Adds strategic coherence query commands to the CLI program.
 */
export function addCoherenceCommands(program: Command) {
  const coherenceCommand = program
    .command('coherence')
    .description(
      'Commands for querying strategic coherence between code and mission (algebra-based).'
    );

  /**
   * coherence report
   * Display overall strategic coherence metrics dashboard
   */
  coherenceCommand
    .command('report')
    .description('Show overall strategic coherence metrics')
    .option('-p, --project-root <path>', 'The root of the project.', '.')
    .option('--json', 'Output raw JSON')
    .option('-v, --verbose', 'Show detailed error messages', false)
    .action(async (options) => {
      intro(chalk.bold('Strategic Coherence Report'));

      const pgcRoot = path.join(options.projectRoot, '.open_cognition');
      if (!(await fs.pathExists(pgcRoot))) {
        log.error(
          chalk.red(`PGC not initialized. Run 'cognition-cli init' first.`)
        );
        process.exit(1);
      }

      const s = spinner();
      s.start('Loading coherence data');

      try {
        const workbenchUrl =
          process.env.WORKBENCH_URL || 'http://localhost:8000';
        const registry = new OverlayRegistry(pgcRoot, workbenchUrl);
        const coherenceAdapter = (await registry.get(
          'O7'
        )) as unknown as CoherenceAlgebraAdapter;

        const items = await coherenceAdapter.getAllItems();

        s.stop('Analysis complete');

        if (items.length === 0) {
          log.warn(
            chalk.yellow(
              'No coherence data found. Run "cognition-cli overlay generate strategic_coherence" first.'
            )
          );
          process.exit(1);
        }

        // Calculate metrics
        const scores = items.map((item) => item.metadata.overallCoherence);
        const avgCoherence = scores.reduce((a, b) => a + b, 0) / scores.length;
        const sortedScores = [...scores].sort((a, b) => a - b);
        const medianCoherence =
          sortedScores[Math.floor(sortedScores.length / 2)];
        const highAlignmentCount = scores.filter((s) => s >= 0.7).length;
        const driftedCount = scores.filter((s) => s < 0.5).length;

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                symbol_count: items.length,
                average_coherence: avgCoherence,
                median_coherence: medianCoherence,
                high_alignment_count: highAlignmentCount,
                drifted_count: driftedCount,
              },
              null,
              2
            )
          );
          return;
        }

        // Display formatted report
        log.info('');
        log.info(chalk.bold.cyan('📊 Strategic Coherence Report'));
        log.info(chalk.gray('━'.repeat(60)));
        log.info('');

        log.info(chalk.bold.white('  Analysis Scope:'));
        log.info(
          chalk.white(
            `    Code symbols analyzed:   ${chalk.cyan(items.length)}`
          )
        );
        log.info('');

        const avgPct = (avgCoherence * 100).toFixed(1);
        const medianPct = (medianCoherence * 100).toFixed(1);

        log.info(chalk.bold.white('  Coherence Metrics:'));
        log.info(
          chalk.white(
            `    Average coherence:       ${chalk.cyan(`${avgPct}%`)}`
          )
        );
        log.info(
          chalk.white(
            `    Median coherence:        ${chalk.cyan(`${medianPct}%`)}`
          )
        );
        log.info(
          chalk.white(
            `    High alignment (≥70%):   ${chalk.green(`${highAlignmentCount} symbols`)}`
          )
        );
        log.info(
          chalk.white(
            `    Drifted (<50%):          ${chalk.yellow(`${driftedCount} symbols`)}`
          )
        );
        log.info('');

        log.info(chalk.dim('  Use these commands for more details:'));
        log.info(
          chalk.dim(
            '    cognition-cli coherence aligned    # High-scoring symbols'
          )
        );
        log.info(
          chalk.dim(
            '    cognition-cli coherence drifted    # Low-scoring symbols'
          )
        );
        log.info(
          chalk.dim('    cognition-cli coherence list       # All symbols')
        );
        log.info('');

        outro(chalk.green('✓ Report complete'));
      } catch (error) {
        s.stop('Analysis failed');
        log.error(chalk.red((error as Error).message));
        if (options.verbose) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  /**
   * coherence aligned
   * Show symbols aligned with mission (score >= threshold)
   */
  coherenceCommand
    .command('aligned')
    .description('Show symbols aligned with mission')
    .option('-p, --project-root <path>', 'The root of the project.', '.')
    .option(
      '--min-score <score>',
      'Minimum coherence score (default: 0.7)',
      '0.7'
    )
    .option(
      '-f, --format <format>',
      'Output format: table, json, summary',
      'table'
    )
    .option('-l, --limit <number>', 'Maximum number of results to show', '50')
    .option('-v, --verbose', 'Show detailed error messages', false)
    .action(async (options) => {
      intro(chalk.bold('Coherence: Aligned Symbols'));

      const pgcRoot = path.join(options.projectRoot, '.open_cognition');
      if (!(await fs.pathExists(pgcRoot))) {
        log.error(
          chalk.red(`PGC not initialized. Run 'cognition-cli init' first.`)
        );
        process.exit(1);
      }

      const s = spinner();
      s.start('Finding aligned symbols');

      try {
        const workbenchUrl =
          process.env.WORKBENCH_URL || 'http://localhost:8000';
        const registry = new OverlayRegistry(pgcRoot, workbenchUrl);
        const coherenceAdapter = (await registry.get(
          'O7'
        )) as unknown as CoherenceAlgebraAdapter;

        // Sort by coherence score (descending)
        const sortedItems = await coherenceAdapter.getItemsByCoherence(true);

        s.stop('Analysis complete');

        const minScore = parseFloat(options.minScore);
        const filtered = sortedItems.filter(
          (item) => item.metadata.overallCoherence >= minScore
        );

        if (filtered.length === 0) {
          log.warn(
            chalk.yellow(
              `No symbols found with coherence score ≥ ${minScore.toFixed(2)}`
            )
          );
          outro('');
          return;
        }

        displayCoherenceItems(filtered, options, minScore);
        outro(chalk.green('✓ Analysis complete'));
      } catch (error) {
        s.stop('Analysis failed');
        log.error(chalk.red((error as Error).message));
        if (options.verbose) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  /**
   * coherence drifted
   * Show symbols that drifted from mission (score < threshold)
   */
  coherenceCommand
    .command('drifted')
    .description('Show symbols that drifted from mission')
    .option('-p, --project-root <path>', 'The root of the project.', '.')
    .option(
      '--max-score <score>',
      'Maximum coherence score (default: 0.5)',
      '0.5'
    )
    .option(
      '-f, --format <format>',
      'Output format: table, json, summary',
      'table'
    )
    .option('-l, --limit <number>', 'Maximum number of results to show', '50')
    .option('-v, --verbose', 'Show detailed error messages', false)
    .action(async (options) => {
      intro(chalk.bold('Coherence: Drifted Symbols'));

      const pgcRoot = path.join(options.projectRoot, '.open_cognition');
      if (!(await fs.pathExists(pgcRoot))) {
        log.error(
          chalk.red(`PGC not initialized. Run 'cognition-cli init' first.`)
        );
        process.exit(1);
      }

      const s = spinner();
      s.start('Finding drifted symbols');

      try {
        const workbenchUrl =
          process.env.WORKBENCH_URL || 'http://localhost:8000';
        const registry = new OverlayRegistry(pgcRoot, workbenchUrl);
        const coherenceAdapter = (await registry.get(
          'O7'
        )) as unknown as CoherenceAlgebraAdapter;

        // Sort by coherence score (ascending - worst first)
        const sortedItems = await coherenceAdapter.getItemsByCoherence(false);

        s.stop('Analysis complete');

        const maxScore = parseFloat(options.maxScore);
        const filtered = sortedItems.filter(
          (item) => item.metadata.overallCoherence < maxScore
        );

        if (filtered.length === 0) {
          log.warn(
            chalk.yellow(
              `No symbols found with coherence score < ${maxScore.toFixed(2)}`
            )
          );
          outro('');
          return;
        }

        displayCoherenceItems(filtered, options, maxScore, true);
        outro(chalk.green('✓ Analysis complete'));
      } catch (error) {
        s.stop('Analysis failed');
        log.error(chalk.red((error as Error).message));
        if (options.verbose) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  /**
   * coherence list
   * List all symbols with coherence scores
   */
  coherenceCommand
    .command('list')
    .description('Show all symbols with coherence scores')
    .option('-p, --project-root <path>', 'The root of the project.', '.')
    .option(
      '-f, --format <format>',
      'Output format: table, json, summary',
      'table'
    )
    .option('-l, --limit <number>', 'Maximum number of results to show', '50')
    .option('-v, --verbose', 'Show detailed error messages', false)
    .action(async (options) => {
      intro(chalk.bold('Coherence: All Symbols'));

      const pgcRoot = path.join(options.projectRoot, '.open_cognition');
      if (!(await fs.pathExists(pgcRoot))) {
        log.error(
          chalk.red(`PGC not initialized. Run 'cognition-cli init' first.`)
        );
        process.exit(1);
      }

      const s = spinner();
      s.start('Loading all symbols');

      try {
        const workbenchUrl =
          process.env.WORKBENCH_URL || 'http://localhost:8000';
        const registry = new OverlayRegistry(pgcRoot, workbenchUrl);
        const coherenceAdapter = (await registry.get(
          'O7'
        )) as unknown as CoherenceAlgebraAdapter;

        // Get all items sorted by coherence
        const items = await coherenceAdapter.getItemsByCoherence(true);

        s.stop('Analysis complete');

        if (items.length === 0) {
          log.warn(chalk.yellow('No coherence data found'));
          outro('');
          return;
        }

        displayCoherenceItems(items, options);
        outro(chalk.green('✓ Analysis complete'));
      } catch (error) {
        s.stop('Analysis failed');
        log.error(chalk.red((error as Error).message));
        if (options.verbose) {
          console.error(error);
        }
        process.exit(1);
      }
    });
}

/**
 * Display coherence items
 */
function displayCoherenceItems(
  items: Array<{
    id: string;
    metadata: CoherenceMetadata;
    embedding: number[];
  }>,
  options: { format?: string; limit?: string },
  threshold?: number,
  isDrifted = false
): void {
  const format = options.format || 'table';
  const limit = parseInt(options.limit || '50');

  log.info('');
  log.info(
    chalk.bold(
      isDrifted
        ? `⚠ Drifted Symbols (score ${threshold ? `< ${threshold.toFixed(2)}` : '< 0.5'})`
        : threshold
          ? `✓ Aligned Symbols (score ≥ ${threshold.toFixed(2)})`
          : `All Symbols (${items.length} total)`
    )
  );
  log.info(chalk.gray('━'.repeat(60)));
  log.info('');

  if (format === 'json') {
    console.log(JSON.stringify(items.slice(0, limit), null, 2));
    return;
  }

  if (format === 'summary') {
    log.info(chalk.dim(`Showing ${Math.min(limit, items.length)} items`));
    for (const item of items.slice(0, limit)) {
      const score = (item.metadata.overallCoherence * 100).toFixed(1);
      log.info(`  ${chalk.cyan(item.metadata.symbolName)} - ${score}%`);
    }
    return;
  }

  // Table format (default)
  log.info(
    chalk.dim(
      `Showing ${Math.min(limit, items.length)} of ${items.length} items`
    )
  );
  log.info('');

  for (const item of items.slice(0, limit)) {
    const score = item.metadata.overallCoherence;
    const scoreBar = '█'.repeat(Math.round(score * 20));
    const scorePct = (score * 100).toFixed(1);

    const scoreColor =
      score >= 0.7 ? chalk.green : score >= 0.5 ? chalk.yellow : chalk.red;

    log.info(
      `${chalk.cyan.bold(item.metadata.symbolName)} ${chalk.dim(`[${item.metadata.filePath}]`)}`
    );
    log.info(`  ${scoreColor(scoreBar)} ${scorePct}%`);
    log.info(
      chalk.dim(
        `  Top concept: ${truncate(item.metadata.topConceptText, 60)} (${(item.metadata.topConceptScore * 100).toFixed(1)}%)`
      )
    );
    log.info('');
  }

  if (items.length > limit) {
    log.info(
      chalk.dim(
        `... and ${items.length - limit} more (use --limit to see more)`
      )
    );
  }
}

/**
 * Truncate text to max length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
