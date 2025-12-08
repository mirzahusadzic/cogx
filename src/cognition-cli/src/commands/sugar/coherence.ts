/**
 * Strategic Coherence Sugar Commands (O₇ Strategic Coherence)
 *
 * Provides convenient access to O₇ (Strategic Coherence) overlay data,
 * which measures semantic alignment between code symbols (O₁) and mission
 * concepts (O₄). These commands use the CoherenceAlgebraAdapter for
 * integration with the lattice algebra system.
 *
 * COHERENCE CONCEPT:
 * Strategic coherence measures how well implementation aligns with mission:
 * - For each code symbol (function, class) in O₁
 * - Calculate embedding similarity with all mission concepts in O₄
 * - Store top alignment and overall coherence score in O₇
 * - Enables drift detection and mission-code integration tracking
 *
 * OVERLAY REFERENCE (O₇):
 * O₇ is a derived overlay containing:
 * - symbolName: Code symbol (from O₁)
 * - filePath: Location of symbol
 * - overallCoherence: Average alignment with mission (0.0-1.0)
 * - topConceptText: Most aligned mission concept
 * - topConceptScore: Similarity score for top concept
 *
 * COMMAND CATEGORIES:
 * 1. report: Overall coherence statistics (avg, median, distribution)
 * 2. aligned: High-scoring symbols (≥70% default, mission-aligned)
 * 3. drifted: Low-scoring symbols (<50% default, mission drift detected)
 * 4. list: All symbols with coherence scores
 *
 * DESIGN RATIONALE:
 * 1. Mission Integrity: Track whether code stays true to mission over time
 * 2. Refactoring Guidance: Identify drifted code for realignment
 * 3. Quality Metrics: Coherence as proxy for intentional design
 * 4. Algebra Integration: Use CoherenceAlgebraAdapter for lattice queries
 *
 * INTEGRATION WITH LATTICE:
 * While these sugar commands provide direct access to O₇, you can also
 * use lattice queries for cross-overlay analysis:
 * - `lattice "O7 ~ O2"` - Coherence vs security alignment
 * - `lattice "O7[overallCoherence > 0.8]"` - High coherence symbols
 *
 * @example
 * // Show overall coherence report
 * await coherenceReportCommand({ projectRoot: '.' });
 * // Shows:
 * // - Average coherence: 72.3%
 * // - Median: 75.1%
 * // - High alignment (≥70%): 42 symbols
 * // - Drifted (<50%): 8 symbols
 *
 * @example
 * // Find symbols that have drifted from mission
 * await coherenceDriftedCommand({
 *   projectRoot: '.',
 *   maxScore: 0.4,
 *   format: 'table'
 * });
 * // Shows symbols with coherence <40%, requiring attention
 *
 * @example
 * // List all symbols with coherence details
 * await coherenceListCommand({
 *   projectRoot: '.',
 *   format: 'summary',
 *   limit: 100
 * });
 */

import { intro, outro, spinner, log } from '@clack/prompts';
import chalk from 'chalk';
import path from 'path';
import { OverlayRegistry } from '../../core/algebra/overlay-registry.js';
import type {
  CoherenceMetadata,
  CoherenceAlgebraAdapter,
} from '../../core/overlays/strategic-coherence/algebra-adapter.js';
import { WorkspaceManager } from '../../core/workspace-manager.js';

interface CoherenceOptions {
  projectRoot: string;
  format?: 'table' | 'json' | 'summary';
  limit?: number;
  verbose?: boolean;
  minScore?: number;
  maxScore?: number;
}

/**
 * Resolve Grounded Context Pool (PGC) root directory
 *
 * @param startPath - Starting directory for the walk-up search
 * @returns Absolute path to .open_cognition directory
 * @throws {Error} Exits process if no workspace found
 */
function resolvePgcRoot(startPath: string): string {
  const workspaceManager = new WorkspaceManager();
  const projectRoot = workspaceManager.resolvePgcRoot(startPath);

  if (!projectRoot) {
    log.error(
      chalk.red(
        'No .open_cognition workspace found. Run "cognition-cli init" to create one.'
      )
    );
    process.exit(1);
  }

  return path.join(projectRoot, '.open_cognition');
}

/**
 * Display overall strategic coherence report
 *
 * Provides high-level statistics about code-mission alignment across
 * the entire codebase. Shows distribution of coherence scores and
 * identifies areas requiring attention.
 *
 * @param options - Command options
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json'
 * @param options.verbose - Enable verbose error output
 * @returns Promise that resolves when display is complete
 *
 * @example
 * await coherenceReportCommand({ projectRoot: '.' });
 * // Shows:
 * // Analysis Scope:
 * //   Code symbols analyzed: 156
 * // Coherence Metrics:
 * //   Average coherence: 72.3%
 * //   Median coherence: 75.1%
 * //   High alignment (≥70%): 98 symbols
 * //   Drifted (<50%): 12 symbols
 */
export async function coherenceReportCommand(
  options: CoherenceOptions
): Promise<void> {
  intro(chalk.bold('Strategic Coherence Report'));

  const pgcRoot = resolvePgcRoot(options.projectRoot);

  const s = spinner();
  s.start('Loading coherence data');

  try {
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
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
    const medianCoherence = sortedScores[Math.floor(sortedScores.length / 2)];
    const highAlignmentCount = scores.filter((s) => s >= 0.7).length;
    const driftedCount = scores.filter((s) => s < 0.5).length;

    if (options.format === 'json') {
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
      chalk.white(`    Code symbols analyzed:   ${chalk.cyan(items.length)}`)
    );
    log.info('');

    const avgPct = (avgCoherence * 100).toFixed(1);
    const medianPct = (medianCoherence * 100).toFixed(1);

    log.info(chalk.bold.white('  Coherence Metrics:'));
    log.info(
      chalk.white(`    Average coherence:       ${chalk.cyan(`${avgPct}%`)}`)
    );
    log.info(
      chalk.white(`    Median coherence:        ${chalk.cyan(`${medianPct}%`)}`)
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
      chalk.dim('    cognition-cli coherence aligned    # High-scoring symbols')
    );
    log.info(
      chalk.dim('    cognition-cli coherence drifted    # Low-scoring symbols')
    );
    log.info(chalk.dim('    cognition-cli coherence list       # All symbols'));
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
}

/**
 * Display symbols with high mission alignment
 *
 * Shows code symbols that strongly align with mission concepts.
 * These represent well-designed, mission-coherent implementations.
 *
 * @param options - Command options
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json' | 'summary'
 * @param options.limit - Maximum symbols to display
 * @param options.verbose - Enable verbose error output
 * @param options.minScore - Minimum coherence score (default: 0.7)
 * @returns Promise that resolves when display is complete
 *
 * @example
 * // Show symbols with ≥80% coherence
 * await coherenceAlignedCommand({
 *   projectRoot: '.',
 *   minScore: 0.8,
 *   format: 'table'
 * });
 * // Shows:
 * // MissionValidator [src/security/validator.ts]
 * //   ████████████████████ 87.2%
 * //   Top concept: verification and transparency (89.1%)
 */
export async function coherenceAlignedCommand(
  options: CoherenceOptions
): Promise<void> {
  intro(chalk.bold('Coherence: Aligned Symbols'));

  const pgcRoot = resolvePgcRoot(options.projectRoot);

  const s = spinner();
  s.start('Finding aligned symbols');

  try {
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
    const registry = new OverlayRegistry(pgcRoot, workbenchUrl);
    const coherenceAdapter = (await registry.get(
      'O7'
    )) as unknown as CoherenceAlgebraAdapter;

    // Sort by coherence score (descending)
    const sortedItems = await coherenceAdapter.getItemsByCoherence(true);

    s.stop('Analysis complete');

    const minScore = options.minScore || 0.7;
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
}

/**
 * Display symbols with low mission alignment (drift detected)
 *
 * Shows code symbols with weak alignment to mission concepts.
 * These may require refactoring or better documentation to restore
 * mission coherence.
 *
 * @param options - Command options
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json' | 'summary'
 * @param options.limit - Maximum symbols to display
 * @param options.verbose - Enable verbose error output
 * @param options.maxScore - Maximum coherence score (default: 0.5)
 * @returns Promise that resolves when display is complete
 *
 * @example
 * // Show symbols with <40% coherence
 * await coherenceDriftedCommand({
 *   projectRoot: '.',
 *   maxScore: 0.4,
 *   format: 'table'
 * });
 * // Shows:
 * // utilityFunction [src/utils/misc.ts]
 * //   ██████ 32.1%
 * //   Top concept: helper utilities (35.2%)
 * // WARNING: Low coherence indicates mission drift
 */
export async function coherenceDriftedCommand(
  options: CoherenceOptions
): Promise<void> {
  intro(chalk.bold('Coherence: Drifted Symbols'));

  const pgcRoot = resolvePgcRoot(options.projectRoot);

  const s = spinner();
  s.start('Finding drifted symbols');

  try {
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
    const registry = new OverlayRegistry(pgcRoot, workbenchUrl);
    const coherenceAdapter = (await registry.get(
      'O7'
    )) as unknown as CoherenceAlgebraAdapter;

    // Sort by coherence score (ascending - worst first)
    const sortedItems = await coherenceAdapter.getItemsByCoherence(false);

    s.stop('Analysis complete');

    const maxScore = options.maxScore || 0.5;
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
}

/**
 * Display all code symbols with coherence scores
 *
 * Lists all symbols from O₇ with their coherence metrics, sorted by
 * alignment score. Provides comprehensive view of code-mission integration.
 *
 * @param options - Command options
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json' | 'summary'
 * @param options.limit - Maximum symbols to display
 * @param options.verbose - Enable verbose error output
 * @returns Promise that resolves when display is complete
 *
 * @example
 * await coherenceListCommand({
 *   projectRoot: '.',
 *   format: 'summary',
 *   limit: 50
 * });
 * // Shows all symbols sorted by coherence with summary view
 */
export async function coherenceListCommand(
  options: CoherenceOptions
): Promise<void> {
  intro(chalk.bold('Coherence: All Symbols'));

  const pgcRoot = resolvePgcRoot(options.projectRoot);

  const s = spinner();
  s.start('Loading all symbols');

  try {
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
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
  options: CoherenceOptions,
  threshold?: number,
  isDrifted = false
): void {
  const format = options.format || 'table';
  const limit = options.limit || 50;

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
        `  Top concept: ${item.metadata.topConceptText} (${(item.metadata.topConceptScore * 100).toFixed(1)}%)`
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
