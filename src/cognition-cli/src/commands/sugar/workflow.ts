/**
 * Workflow Sugar Commands
 *
 * Convenience wrappers around lattice algebra for operational pattern queries.
 * These commands translate to lattice expressions for better UX.
 */

import { intro, outro, spinner, log } from '@clack/prompts';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { createQueryEngine } from '../../core/algebra/query-parser.js';
import {
  OverlayItem,
  OverlayMetadata,
  SetOperationResult,
} from '../../core/algebra/overlay-algebra.js';

interface WorkflowOptions {
  projectRoot: string;
  format?: 'table' | 'json' | 'summary';
  limit?: number;
  verbose?: boolean;
  secure?: boolean;
  aligned?: boolean;
}

/**
 * Show all workflow patterns
 * Translates to: lattice "O5[workflow_pattern]"
 */
export async function workflowPatternsCommand(
  options: WorkflowOptions
): Promise<void> {
  intro(chalk.bold('Workflow: Operational Patterns'));

  const pgcRoot = path.join(options.projectRoot, '.open_cognition');
  if (!(await fs.pathExists(pgcRoot))) {
    log.error(
      chalk.red(`PGC not initialized. Run 'cognition-cli init' first.`)
    );
    process.exit(1);
  }

  const s = spinner();

  let query = 'O5[workflow_pattern]';
  let description = 'Loading workflow patterns';

  if (options.secure) {
    // Show workflows that align with security boundaries
    query = 'O5[workflow_pattern] ~ O2[boundary]';
    description = 'Finding workflows aligned with security boundaries';
  } else if (options.aligned) {
    // Show workflows aligned with mission
    query = 'O5[workflow_pattern] ~ O4';
    description = 'Finding workflows aligned with mission';
  }

  s.start(description);

  try {
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
    const engine = createQueryEngine(pgcRoot, workbenchUrl);

    const result = await engine.execute(query);

    s.stop('Analysis complete');

    if (options.secure || options.aligned) {
      displayMeetResults(result, options);
    } else {
      displayItemList(result, options);
    }

    outro(chalk.green('✓ Workflow analysis complete'));
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
 * Show quest structures
 * Translates to: lattice "O5[quest_structure]"
 */
export async function workflowQuestsCommand(
  options: WorkflowOptions
): Promise<void> {
  intro(chalk.bold('Workflow: Quest Structures'));

  const pgcRoot = path.join(options.projectRoot, '.open_cognition');
  if (!(await fs.pathExists(pgcRoot))) {
    log.error(
      chalk.red(`PGC not initialized. Run 'cognition-cli init' first.`)
    );
    process.exit(1);
  }

  const s = spinner();
  s.start('Loading quest structures');

  try {
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
    const engine = createQueryEngine(pgcRoot, workbenchUrl);

    const query = 'O5[quest_structure]';
    const result = await engine.execute(query);

    s.stop('Analysis complete');

    displayItemList(result, options);
    outro(chalk.green('✓ Quest analysis complete'));
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
 * Show depth rules
 * Translates to: lattice "O5[depth_rule]"
 */
export async function workflowDepthRulesCommand(
  options: WorkflowOptions
): Promise<void> {
  intro(chalk.bold('Workflow: Depth Rules'));

  const pgcRoot = path.join(options.projectRoot, '.open_cognition');
  if (!(await fs.pathExists(pgcRoot))) {
    log.error(
      chalk.red(`PGC not initialized. Run 'cognition-cli init' first.`)
    );
    process.exit(1);
  }

  const s = spinner();
  s.start('Loading depth rules');

  try {
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
    const engine = createQueryEngine(pgcRoot, workbenchUrl);

    const query = 'O5[depth_rule]';
    const result = await engine.execute(query);

    s.stop('Analysis complete');

    displayItemList(result, options);
    outro(chalk.green('✓ Depth rule analysis complete'));
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
 * Display results (handles different result types)
 */
function displayItemList(result: unknown, options: WorkflowOptions): void {
  const format = options.format || 'table';
  const limit = options.limit || 50;

  // Type guard for OverlayItem array or SetOperationResult
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

  const isSetOperationResult = (
    value: unknown
  ): value is SetOperationResult<OverlayMetadata> => {
    return (
      value !== null &&
      typeof value === 'object' &&
      'items' in value &&
      'metadata' in value
    );
  };

  let items: OverlayItem[] = [];

  if (isSetOperationResult(result)) {
    items = result.items;
    log.info(
      chalk.bold(
        `\n${result.metadata.operation.toUpperCase()}: ${result.metadata.itemCount} item(s)`
      )
    );
    log.info(
      chalk.dim(
        `  Source overlays: ${result.metadata.sourceOverlays.join(', ')}`
      )
    );
    log.info('');
  } else if (isOverlayItemArray(result)) {
    items = result;
  }

  if (items.length === 0) {
    log.warn(chalk.yellow('No items found'));
    return;
  }

  log.info(chalk.bold(`Results: ${items.length} item(s)`));
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
        const value = item.metadata[key];
        log.info(chalk.dim(`  ${key}: ${value}`));
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
 * Display Meet results (semantic alignment)
 */
function displayMeetResults(result: unknown, options: WorkflowOptions): void {
  const format = options.format || 'table';
  const limit = options.limit || 50;

  // Type guard for MeetResult
  const isMeetResultArray = (
    value: unknown
  ): value is Array<{
    itemA: OverlayItem;
    itemB: OverlayItem;
    similarity: number;
  }> => {
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value[0] &&
      'itemA' in value[0] &&
      'itemB' in value[0] &&
      'similarity' in value[0]
    );
  };

  if (!isMeetResultArray(result)) {
    log.warn(chalk.yellow('Unexpected result format'));
    return;
  }

  if (result.length === 0) {
    log.warn(chalk.yellow('No alignments found'));
    return;
  }

  log.info(chalk.bold(`\nMeet Results: ${result.length} alignment(s)`));
  log.info('');

  if (format === 'json') {
    console.log(JSON.stringify(result.slice(0, limit), null, 2));
    return;
  }

  log.info(
    chalk.dim(
      `Showing ${Math.min(limit, result.length)} of ${result.length} pairs`
    )
  );
  log.info('');

  for (const { itemA, itemB, similarity } of result.slice(0, limit)) {
    // Color code similarity
    const simColor =
      similarity >= 0.9
        ? chalk.green
        : similarity >= 0.7
          ? chalk.yellow
          : chalk.dim;

    log.info(simColor(`Similarity: ${(similarity * 100).toFixed(1)}%`));
    log.info(chalk.cyan(`  Workflow: ${itemA.id}`));
    log.info(chalk.dim(`    ${truncate(itemA.metadata.text, 80)}`));
    log.info(chalk.magenta(`  Aligns with: ${itemB.id}`));
    log.info(chalk.dim(`    ${truncate(itemB.metadata.text, 80)}`));
    log.info('');
  }

  if (result.length > limit) {
    log.info(
      chalk.dim(
        `... and ${result.length - limit} more (use --limit to see more)`
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
