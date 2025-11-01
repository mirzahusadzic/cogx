/**
 * Lattice Command
 *
 * Execute boolean algebra operations across cognitive overlays.
 *
 * EXAMPLES:
 *   cognition-cli lattice "O1 - O2"                     # Coverage gaps
 *   cognition-cli lattice "O2[critical] ~ O4"           # Critical attacks vs principles
 *   cognition-cli lattice "O5 -> O2"                    # Workflows to security
 *   cognition-cli lattice "(O2 ~ O4) - O2[vulnerability]" # Complex composition
 *
 * OPERATORS:
 *   Set Operations (exact matching):
 *     +, |, OR       Union (all items from both)
 *     &, AND         Intersection (items in both)
 *     -, \           Difference (in A, not in B)
 *     !, NOT         Complement
 *
 *   Semantic Operations (vector similarity):
 *     ~, MEET        Meet (find alignment)
 *     ->, TO         Project (query-guided)
 *
 *   Filters:
 *     O2[attacks]              Filter by type
 *     O2[severity=critical]    Filter by metadata
 *
 * OVERLAYS:
 *   O1  Structure     (code symbols, functions, classes)
 *   O2  Security      (threats, attacks, mitigations)
 *   O3  Lineage       (dependencies, call chains)
 *   O4  Mission       (concepts, principles, goals)
 *   O5  Operational   (workflows, patterns, depth rules)
 *   O6  Mathematical  (theorems, proofs, lemmas)
 *   O7  Coherence     (alignment scores)
 */

import { intro, outro, spinner, log } from '@clack/prompts';
import chalk from 'chalk';
import path from 'path';
import { createQueryEngine } from '../core/algebra/query-parser.js';
import { OverlayRegistry } from '../core/algebra/overlay-registry.js';
import {
  OverlayItem,
  OverlayMetadata,
  SetOperationResult,
  MeetResult,
} from '../core/algebra/overlay-algebra.js';
import { WorkspaceManager } from '../core/workspace-manager.js';

interface LatticeOptions {
  projectRoot: string;
  format?: 'table' | 'json' | 'summary';
  limit?: number;
  verbose?: boolean;
}

/**
 * Execute a lattice query
 */
export async function latticeCommand(
  query: string,
  options: LatticeOptions
): Promise<void> {
  intro(chalk.bold('Lattice Algebra Query'));

  let s = spinner();

  try {
    // Find .open_cognition by walking up directory tree
    const workspaceManager = new WorkspaceManager();
    const projectRoot = workspaceManager.resolvePgcRoot(options.projectRoot);

    if (!projectRoot) {
      log.error(
        chalk.red(
          'No .open_cognition workspace found. Run "cognition-cli init" to create one.'
        )
      );
      process.exit(1);
    }

    const pgcRoot = path.join(projectRoot, '.open_cognition');

    // Display query
    log.info(chalk.dim(`Query: ${query}`));
    log.info('');

    // Parse and execute query
    s.start('Parsing query');
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
    const engine = createQueryEngine(pgcRoot, workbenchUrl);
    s.stop('Query parsed');

    s = spinner();
    s.start('Executing query');
    const result = await engine.execute(query);
    s.stop('Query executed');

    // Format and display results
    displayResults(result, options);

    outro(chalk.green('✓ Query complete'));
  } catch (error) {
    if (s) {
      s.stop('Query failed');
    }
    log.error(chalk.red((error as Error).message));
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Display query results
 */
function displayResults(result: unknown, options: LatticeOptions): void {
  const format = options.format || 'table';
  const limit = options.limit || 50;

  // Type guard for MeetResult
  const isMeetResult = (
    value: unknown
  ): value is MeetResult<OverlayMetadata, OverlayMetadata>[] => {
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value[0] &&
      'itemA' in value[0] &&
      'itemB' in value[0] &&
      'similarity' in value[0]
    );
  };

  // Type guard for OverlayItem array
  const isOverlayItemArray = (value: unknown): value is OverlayItem[] => {
    return (
      Array.isArray(value) &&
      (value.length === 0 ||
        (value[0] &&
          'id' in value[0] &&
          'embedding' in value[0] &&
          'metadata' in value[0]))
    );
  };

  // Type guard for SetOperationResult
  const isSetOperationResult = (
    value: unknown
  ): value is SetOperationResult<OverlayMetadata> => {
    return (
      value !== null &&
      typeof value === 'object' &&
      'items' in value &&
      'metadata' in value &&
      Array.isArray((value as SetOperationResult<OverlayMetadata>).items)
    );
  };

  // Handle different result types
  if (isMeetResult(result)) {
    displayMeetResults(result, format, limit);
  } else if (isSetOperationResult(result)) {
    displaySetOperationResult(result, format, limit);
  } else if (isOverlayItemArray(result)) {
    displayItemList(result, format, limit);
  } else {
    log.warn(chalk.yellow('Unknown result format'));
    console.log(JSON.stringify(result, null, 2));
  }
}

/**
 * Display list of overlay items
 */
function displayItemList(
  items: OverlayItem[],
  format: string,
  limit: number
): void {
  if (items.length === 0) {
    log.warn(chalk.yellow('No items found'));
    return;
  }

  log.info(chalk.bold(`\nResults: ${items.length} item(s)`));
  log.info('');

  if (format === 'json') {
    console.log(JSON.stringify(items.slice(0, limit), null, 2));
    return;
  }

  if (format === 'summary') {
    log.info(
      chalk.dim(`Showing summary of ${Math.min(limit, items.length)} items`)
    );
    for (const item of items.slice(0, limit)) {
      log.info(`  ${chalk.cyan(item.id)}`);
      log.info(chalk.dim(`    ${truncate(item.metadata.text, 80)}`));
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
    log.info(chalk.cyan(`${item.id}`));
    log.info(chalk.dim(`  Type: ${item.metadata.type || 'unknown'}`));
    log.info(chalk.dim(`  Text: ${truncate(item.metadata.text, 100)}`));

    // Show additional metadata
    const otherKeys = Object.keys(item.metadata).filter(
      (k) => !['text', 'type', 'weight'].includes(k)
    );
    if (otherKeys.length > 0) {
      for (const key of otherKeys.slice(0, 3)) {
        log.info(chalk.dim(`  ${key}: ${item.metadata[key]}`));
      }
    }
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
 * Display set operation result
 */
function displaySetOperationResult(
  result: SetOperationResult<OverlayMetadata>,
  format: string,
  limit: number
): void {
  const { items, metadata } = result;

  log.info(
    chalk.bold(
      `\n${metadata.operation.toUpperCase()}: ${metadata.itemCount} item(s)`
    )
  );
  log.info(
    chalk.dim(`  Source overlays: ${metadata.sourceOverlays.join(', ')}`)
  );
  log.info('');

  displayItemList(items, format, limit);
}

/**
 * Display meet results (semantic alignment)
 */
function displayMeetResults(
  results: MeetResult<OverlayMetadata, OverlayMetadata>[],
  format: string,
  limit: number
): void {
  if (results.length === 0) {
    log.warn(chalk.yellow('No alignments found (try lowering --threshold)'));
    return;
  }

  log.info(chalk.bold(`\nMeet Results: ${results.length} alignment(s)`));
  log.info('');

  if (format === 'json') {
    console.log(JSON.stringify(results.slice(0, limit), null, 2));
    return;
  }

  log.info(
    chalk.dim(
      `Showing ${Math.min(limit, results.length)} of ${results.length} pairs`
    )
  );
  log.info('');

  for (const { itemA, itemB, similarity } of results.slice(0, limit)) {
    // Color code similarity
    const simColor =
      similarity >= 0.9
        ? chalk.green
        : similarity >= 0.7
          ? chalk.yellow
          : chalk.dim;

    log.info(simColor(`Similarity: ${(similarity * 100).toFixed(1)}%`));
    log.info(chalk.cyan(`  A: ${itemA.id}`));
    log.info(chalk.dim(`     ${truncate(itemA.metadata.text, 80)}`));
    log.info(chalk.magenta(`  B: ${itemB.id}`));
    log.info(chalk.dim(`     ${truncate(itemB.metadata.text, 80)}`));
    log.info('');
  }

  if (results.length > limit) {
    log.info(
      chalk.dim(
        `... and ${results.length - limit} more (use --limit to see more)`
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

/**
 * Show available overlays with their data status
 */
export async function showOverlaysCommand(
  options: LatticeOptions
): Promise<void> {
  intro(chalk.bold('Available Overlays'));

  // Find .open_cognition by walking up directory tree
  const workspaceManager = new WorkspaceManager();
  const projectRoot = workspaceManager.resolvePgcRoot(options.projectRoot);

  if (!projectRoot) {
    log.error(
      chalk.red(
        'No .open_cognition workspace found. Run "cognition-cli init" to create one.'
      )
    );
    process.exit(1);
  }

  const pgcRoot = path.join(projectRoot, '.open_cognition');
  const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
  const registry = new OverlayRegistry(pgcRoot, workbenchUrl);

  const overlayInfo = registry.getOverlayInfo();

  log.info('');
  for (const info of overlayInfo) {
    const hasData = await registry.hasData(info.id);
    const status = hasData ? chalk.green('✓ HAS DATA') : chalk.dim('(empty)');

    // Use filled bullet (●) for data, hollow (○) for empty - via log.message vs log.info
    if (hasData) {
      log.info(`${chalk.cyan(info.id)} ${chalk.bold(info.name)} ${status}`);
      log.info(chalk.dim(`  ${info.description}`));
      log.info(chalk.dim(`  Types: ${info.supportedTypes.join(', ')}`));
    } else {
      // Use log.message for hollow bullet to avoid automatic filled bullet
      log.message(
        `○  ${chalk.cyan(info.id)} ${chalk.bold(info.name)} ${status}`
      );
      log.message(chalk.dim(`│  ${info.description}`));
      log.message(chalk.dim(`│  Types: ${info.supportedTypes.join(', ')}`));
    }
    log.info('');
  }

  outro(chalk.green('Use "cognition-cli lattice <query>" to query overlays'));
}
