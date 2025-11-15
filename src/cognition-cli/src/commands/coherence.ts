/**
 * Coherence Commands: Analyze Strategic Alignment with Mission
 *
 * The coherence command suite analyzes how well code symbols align with organizational mission,
 * principles, and constraints. It identifies both high-alignment components and drift risks.
 *
 * COHERENCE METRICS:
 * - Average Coherence: Equal-weighted alignment across all symbols
 * - Weighted Coherence: Centrality-adjusted (more used = more important)
 * - Lattice Coherence: Synthesized via Gaussian distribution + lattice algebra
 * - Distribution Analysis: Top/median/bottom quartile breakdown
 * - Drift Detection: Identifies symbols at risk of mission misalignment
 *
 * COMMANDS:
 * - coherence report: Dashboard with overall metrics and thresholds
 * - coherence aligned: List symbols meeting alignment threshold (default >= 0.7)
 * - coherence drifted: List symbols in bottom quartile (high risk)
 * - coherence list: All symbols with coherence scores
 *
 * THRESHOLDS:
 * - Alignment: >= 0.7 (configurable per overlay metadata)
 * - Drift: <= bottom_quartile_coherence (bottom 25% of distribution)
 *
 * @example
 * // View strategic coherence dashboard
 * cognition-cli coherence report
 *
 * @example
 * // Find well-aligned symbols
 * cognition-cli coherence aligned --min-score 0.8
 *
 * @example
 * // Identify at-risk components
 * cognition-cli coherence drifted
 *
 * @example
 * // Export coherence data as JSON
 * cognition-cli coherence list --format json --limit 1000
 */

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { OverlayRegistry } from '../core/algebra/overlay-registry.js';
import type {
  CoherenceMetadata,
  CoherenceAlgebraAdapter,
} from '../core/overlays/strategic-coherence/algebra-adapter.js';
import { WorkspaceManager } from '../core/workspace-manager.js';

/**
 * Adds strategic coherence query commands to the CLI program.
 *
 * Registers four subcommands:
 * - report: Overall metrics dashboard
 * - aligned: Filter by minimum coherence score
 * - drifted: Filter by maximum coherence score
 * - list: Show all symbols
 *
 * Each uses OverlayRegistry to access O7 (Strategic Coherence overlay) via algebra interface.
 *
 * @param program - Commander program instance to add commands to
 * @example
 * addCoherenceCommands(program);
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
      const workspaceManager = new WorkspaceManager();
      const projectRoot = workspaceManager.resolvePgcRoot(options.projectRoot);

      if (!projectRoot) {
        console.error(
          chalk.red(
            '\n✗ No .open_cognition workspace found. Run "cognition-cli init" to create one.\n'
          )
        );
        process.exit(1);
      }

      const pgcRoot = path.join(projectRoot, '.open_cognition');

      try {
        const workbenchUrl =
          process.env.WORKBENCH_URL || 'http://localhost:8000';
        const registry = new OverlayRegistry(pgcRoot, workbenchUrl);
        const coherenceAdapter = (await registry.get(
          'O7'
        )) as unknown as CoherenceAlgebraAdapter;

        // Get raw overlay data for detailed metrics
        const { StrategicCoherenceManager } = await import(
          '../core/overlays/strategic-coherence/manager.js'
        );
        const manager = new StrategicCoherenceManager(pgcRoot);
        const overlay = await manager.retrieve();

        const items = await coherenceAdapter.getAllItems();

        if (items.length === 0 || !overlay) {
          console.error(
            chalk.red(
              '\n✗ No strategic coherence overlay found. Run "cognition-cli overlay generate strategic_coherence" first.\n'
            )
          );
          process.exit(1);
        }

        // Calculate basic metrics
        const scores = items.map((item) => item.metadata.overallCoherence);
        const avgCoherence = scores.reduce((a, b) => a + b, 0) / scores.length;
        const sortedScores = [...scores].sort((a, b) => a - b);
        const medianCoherence =
          sortedScores[Math.floor(sortedScores.length / 2)];

        // Get thresholds from overlay metrics
        const alignmentThreshold =
          overlay.overall_metrics.high_alignment_threshold;
        const driftThreshold =
          overlay.overall_metrics.bottom_quartile_coherence;

        const highAlignmentCount = scores.filter(
          (s) => s >= alignmentThreshold
        ).length;
        const driftedCount = scores.filter((s) => s <= driftThreshold).length;

        // Get rich metrics from overlay
        const metrics = overlay.overall_metrics;

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
        console.log('');
        console.log(chalk.bold.cyan('📊 Strategic Coherence Report'));
        console.log(chalk.gray('━'.repeat(60)));
        console.log(
          chalk.white(
            `  Generated: ${chalk.dim(new Date(overlay.generated_at).toLocaleString())}`
          )
        );
        console.log(
          chalk.white(
            `  Mission documents: ${chalk.dim(overlay.mission_document_hashes.length)} (${overlay.mission_document_hashes.map((h: string) => h.slice(0, 8)).join(', ')}...)`
          )
        );
        console.log('');

        console.log(chalk.bold.white('  Analysis Scope:'));
        console.log(
          chalk.white(
            `    Code symbols analyzed:   ${chalk.cyan(items.length)}`
          )
        );
        console.log(
          chalk.white(
            `    Mission concepts:        ${chalk.cyan(overlay.mission_concepts_count)}`
          )
        );
        console.log('');

        // Convert to percentages for human readability
        const avgPct = (metrics.average_coherence * 100).toFixed(1);
        const weightedPct = (metrics.weighted_coherence * 100).toFixed(1);
        const latticePct = (metrics.lattice_coherence * 100).toFixed(1);
        const medianPct = (metrics.median_coherence * 100).toFixed(1);
        const topPct = (metrics.top_quartile_coherence * 100).toFixed(1);
        const bottomPct = (metrics.bottom_quartile_coherence * 100).toFixed(1);
        const stdDevPct = (metrics.std_deviation * 100).toFixed(1);
        const thresholdPct = (metrics.high_alignment_threshold * 100).toFixed(
          0
        );

        // Calculate deltas
        const weightedDelta = (
          (metrics.weighted_coherence - metrics.average_coherence) *
          100
        ).toFixed(1);
        const latticeDelta = (
          (metrics.lattice_coherence - metrics.average_coherence) *
          100
        ).toFixed(1);
        const weightedDeltaSign = parseFloat(weightedDelta) > 0 ? '+' : '';
        const latticeDeltaSign = parseFloat(latticeDelta) > 0 ? '+' : '';
        const weightedDeltaColor =
          parseFloat(weightedDelta) > 0 ? chalk.green : chalk.red;
        const latticeDeltaColor =
          parseFloat(latticeDelta) > 0 ? chalk.green : chalk.red;

        console.log(chalk.bold.white('  Coherence Metrics:'));
        console.log(
          chalk.white(
            `    Average coherence:       ${chalk.cyan(avgPct + '%')} ${chalk.dim('(all symbols equally weighted)')}`
          )
        );
        console.log(
          chalk.white(
            `    Weighted coherence:      ${chalk.cyan(weightedPct + '%')} ${weightedDeltaColor(`(${weightedDeltaSign}${weightedDelta}%)`)} ${chalk.dim('← centrality-based')}`
          )
        );
        console.log(
          chalk.white(
            `    Lattice coherence:       ${chalk.bold.cyan(latticePct + '%')} ${latticeDeltaColor(`(${latticeDeltaSign}${latticeDelta}%)`)} ${chalk.dim('← Gaussian + lattice synthesis')}`
          )
        );
        console.log('');

        console.log(chalk.bold.white('  Distribution:'));
        console.log(
          chalk.white(
            `    Top 25% (best):          ${chalk.green(topPct + '%')}`
          )
        );
        console.log(
          chalk.white(
            `    Median (typical):        ${chalk.cyan(medianPct + '%')}`
          )
        );
        console.log(
          chalk.white(
            `    Bottom 25% (concern):    ${chalk.yellow(bottomPct + '%')}`
          )
        );
        console.log(
          chalk.white(
            `    Std deviation (σ):       ${chalk.dim(stdDevPct + '%')} ${chalk.dim('(statistical spread)')}`
          )
        );
        console.log(
          chalk.white(
            `    Alignment threshold:     ${chalk.dim('≥ ' + thresholdPct + '%')}`
          )
        );
        console.log(
          chalk.white(
            `    Drift threshold:         ${chalk.dim('≤ ' + bottomPct + '%')} ${chalk.dim('(bottom 25%)')}`
          )
        );
        console.log('');

        console.log(chalk.bold.white('  Symbol Distribution:'));
        console.log(
          chalk.white(
            `    ✓ Aligned:               ${chalk.green(highAlignmentCount)} ${chalk.dim(`(${((highAlignmentCount / items.length) * 100).toFixed(1)}%)`)}`
          )
        );
        console.log(
          chalk.white(
            `    ⚠ Drifted:               ${chalk.yellow(driftedCount)} ${chalk.dim(`(${((driftedCount / items.length) * 100).toFixed(1)}%)`)}`
          )
        );
        console.log('');

        console.log(chalk.dim('  View details with:'));
        console.log(
          chalk.dim(
            '    cognition-cli coherence aligned     # High-aligned symbols'
          )
        );
        console.log(
          chalk.dim(
            '    cognition-cli coherence drifted     # Low-aligned symbols'
          )
        );
        console.log(
          chalk.dim('    cognition-cli coherence list        # All symbols')
        );
        console.log('');
      } catch (error) {
        console.error(chalk.red(`\n✗ ${(error as Error).message}\n`));
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
      const workspaceManager = new WorkspaceManager();
      const projectRoot = workspaceManager.resolvePgcRoot(options.projectRoot);

      if (!projectRoot) {
        console.error(
          chalk.red(
            '\n✗ No .open_cognition workspace found. Run "cognition-cli init" to create one.\n'
          )
        );
        process.exit(1);
      }

      const pgcRoot = path.join(projectRoot, '.open_cognition');

      try {
        const workbenchUrl =
          process.env.WORKBENCH_URL || 'http://localhost:8000';
        const registry = new OverlayRegistry(pgcRoot, workbenchUrl);
        const coherenceAdapter = (await registry.get(
          'O7'
        )) as unknown as CoherenceAlgebraAdapter;

        // Sort by coherence score (descending)
        const sortedItems = await coherenceAdapter.getItemsByCoherence(true);

        const minScore = parseFloat(options.minScore);
        const filtered = sortedItems.filter(
          (item) => item.metadata.overallCoherence >= minScore
        );

        if (filtered.length === 0) {
          console.log(
            chalk.yellow(
              `\nNo symbols found with coherence score ≥ ${minScore.toFixed(2)}\n`
            )
          );
          return;
        }

        displayCoherenceItems(filtered, options, minScore);
      } catch (error) {
        console.error(chalk.red(`\n✗ ${(error as Error).message}\n`));
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
    .description(
      'Show symbols that drifted from mission (bottom quartile by default)'
    )
    .option('-p, --project-root <path>', 'The root of the project.', '.')
    .option(
      '--max-score <score>',
      'Maximum coherence score (default: bottom quartile threshold)'
    )
    .option(
      '-f, --format <format>',
      'Output format: table, json, summary',
      'table'
    )
    .option('-l, --limit <number>', 'Maximum number of results to show', '50')
    .option('-v, --verbose', 'Show detailed error messages', false)
    .action(async (options) => {
      const workspaceManager = new WorkspaceManager();
      const projectRoot = workspaceManager.resolvePgcRoot(options.projectRoot);

      if (!projectRoot) {
        console.error(
          chalk.red(
            '\n✗ No .open_cognition workspace found. Run "cognition-cli init" to create one.\n'
          )
        );
        process.exit(1);
      }

      const pgcRoot = path.join(projectRoot, '.open_cognition');

      try {
        const workbenchUrl =
          process.env.WORKBENCH_URL || 'http://localhost:8000';
        const registry = new OverlayRegistry(pgcRoot, workbenchUrl);
        const coherenceAdapter = (await registry.get(
          'O7'
        )) as unknown as CoherenceAlgebraAdapter;

        // Get raw overlay data for bottom quartile threshold
        const { StrategicCoherenceManager } = await import(
          '../core/overlays/strategic-coherence/manager.js'
        );
        const manager = new StrategicCoherenceManager(pgcRoot);
        const overlay = await manager.retrieve();

        if (!overlay) {
          console.error(
            chalk.red(
              '\n✗ No strategic coherence overlay found. Run "cognition-cli overlay generate strategic_coherence" first.\n'
            )
          );
          process.exit(1);
        }

        // Sort by coherence score (ascending - worst first)
        const sortedItems = await coherenceAdapter.getItemsByCoherence(false);

        // Use bottom quartile as default threshold, or custom value if provided
        const maxScore = options.maxScore
          ? parseFloat(options.maxScore)
          : overlay.overall_metrics.bottom_quartile_coherence;

        const filtered = sortedItems.filter(
          (item) => item.metadata.overallCoherence <= maxScore
        );

        if (filtered.length === 0) {
          console.log(
            chalk.yellow(
              `\nNo symbols found with coherence score ≤ ${maxScore.toFixed(2)}\n`
            )
          );
          return;
        }

        displayCoherenceItems(filtered, options, maxScore, true);
      } catch (error) {
        console.error(chalk.red(`\n✗ ${(error as Error).message}\n`));
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
      const workspaceManager = new WorkspaceManager();
      const projectRoot = workspaceManager.resolvePgcRoot(options.projectRoot);

      if (!projectRoot) {
        console.error(
          chalk.red(
            '\n✗ No .open_cognition workspace found. Run "cognition-cli init" to create one.\n'
          )
        );
        process.exit(1);
      }

      const pgcRoot = path.join(projectRoot, '.open_cognition');

      try {
        const workbenchUrl =
          process.env.WORKBENCH_URL || 'http://localhost:8000';
        const registry = new OverlayRegistry(pgcRoot, workbenchUrl);
        const coherenceAdapter = (await registry.get(
          'O7'
        )) as unknown as CoherenceAlgebraAdapter;

        // Get all items sorted by coherence
        const items = await coherenceAdapter.getItemsByCoherence(true);

        if (items.length === 0) {
          console.log(chalk.yellow('\nNo coherence data found\n'));
          return;
        }

        displayCoherenceItems(items, options);
      } catch (error) {
        console.error(chalk.red(`\n✗ ${(error as Error).message}\n`));
        if (options.verbose) {
          console.error(error);
        }
        process.exit(1);
      }
    });
}

/**
 * Display coherence items in requested format.
 *
 * Supports three output formats:
 * - table: Visual progress bars and detailed metadata
 * - json: Raw JSON data suitable for further processing
 * - summary: Compact list of symbol names with scores
 *
 * @param items - Array of coherence items with metadata and embeddings
 * @param options - Display options (format, limit)
 * @param threshold - Optional threshold for filtering display message
 * @param isDrifted - Whether displaying drifted (low) symbols vs aligned (high)
 * @example
 * displayCoherenceItems(coherenceItems, { format: 'table', limit: '50' }, 0.7);
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

  console.log('');
  console.log(
    chalk.bold(
      isDrifted
        ? `⚠ Drifted Symbols (score ${threshold ? `< ${threshold.toFixed(2)}` : '< 0.5'})`
        : threshold
          ? `✓ Aligned Symbols (score ≥ ${threshold.toFixed(2)})`
          : `All Symbols (${items.length} total)`
    )
  );
  console.log(chalk.gray('━'.repeat(60)));

  if (format === 'json') {
    console.log(JSON.stringify(items.slice(0, limit), null, 2));
    return;
  }

  if (format === 'summary') {
    console.log(chalk.dim(`Showing ${Math.min(limit, items.length)} items`));
    for (const item of items.slice(0, limit)) {
      const score = (item.metadata.overallCoherence * 100).toFixed(1);
      console.log(`  ${chalk.cyan(item.metadata.symbolName)} - ${score}%`);
    }
    console.log('');
    return;
  }

  // Table format (default)
  console.log(
    chalk.dim(
      `Showing ${Math.min(limit, items.length)} of ${items.length} items`
    )
  );
  console.log('');

  for (const item of items.slice(0, limit)) {
    const score = item.metadata.overallCoherence;
    const scoreBar = '█'.repeat(Math.round(score * 20));
    const scorePct = (score * 100).toFixed(1);

    const scoreColor =
      score >= 0.7 ? chalk.green : score >= 0.5 ? chalk.yellow : chalk.red;

    console.log(
      `${chalk.cyan.bold(item.metadata.symbolName)} ${chalk.dim(`[${item.metadata.filePath}]`)}`
    );
    console.log(`  ${scoreColor(scoreBar)} ${scorePct}%`);
    console.log(
      chalk.dim(
        `  Top concept: ${truncate(item.metadata.topConceptText, 60)} (${(item.metadata.topConceptScore * 100).toFixed(1)}%)`
      )
    );
    console.log('');
  }

  if (items.length > limit) {
    console.log(
      chalk.dim(
        `... and ${items.length - limit} more (use --limit to see more)`
      )
    );
    console.log('');
  }
}

/**
 * Truncate text to maximum length with ellipsis.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length including ellipsis
 * @returns Truncated text with '...' if longer than maxLength
 * @example
 * truncate("Long concept text here", 20); // "Long concept tex..."
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
