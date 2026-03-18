import chalk from 'chalk';
import { log } from '@clack/prompts';
import { SugarCommandOptions } from './types.js';
import {
  OverlayItem,
  SetOperationResult,
  OverlayMetadata,
} from '../../core/algebra/overlay-algebra.js';

/**
 * Display a list of items from a query result.
 *
 * Supports displaying items from:
 * 1. Single overlay queries (e.g., "O6[theorem]")
 * 2. Set operation results (e.g., "O1 - O2")
 *
 * Handles JSON and human-readable output (summary or table).
 *
 * @param result - The execution result from the QueryEngine
 * @param label - Human-readable label for the items
 * @param options - UI and formatting options
 */
export function displayItemList(
  result: unknown,
  label: string,
  options: SugarCommandOptions
): void {
  const format = options.format || 'table';
  const limit = options.limit || 50;
  const useJson =
    options.format === 'json' || process.env.COGNITION_FORMAT === 'json';

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
    if (!useJson) {
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
    }
  } else if (isOverlayItemArray(result)) {
    items = result;
  }

  if (items.length === 0) {
    if (!useJson) {
      log.warn(chalk.yellow(`No ${label} found.`));
    } else {
      console.log(JSON.stringify([], null, 2));
    }
    return;
  }

  if (useJson) {
    console.log(JSON.stringify(items.slice(0, limit), null, 2));
    return;
  }

  log.info(chalk.bold(`Results: ${items.length} ${label}`));
  log.info('');

  if (format === 'summary') {
    log.info(
      chalk.dim(`Showing summary of ${Math.min(limit, items.length)} items`)
    );
    for (const item of items.slice(0, limit)) {
      log.info(`  ${chalk.cyan(item.id)}`);
      log.info(chalk.dim(`    ${item.metadata.text}`));
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
    log.info(chalk.dim(`  Statement: ${item.metadata.text}`));

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
 * Display results from a "meet" (~) or alignment query.
 *
 * Aligned pairs are deduplicated by text content.
 *
 * @param result - The execution result from the QueryEngine
 * @param label - Human-readable label for the alignments
 * @param options - UI and formatting options
 */
export function displayMeetResults(
  result: unknown,
  label: string,
  options: SugarCommandOptions
): void {
  const limit = options.limit || 50;
  const useJson =
    options.format === 'json' || process.env.COGNITION_FORMAT === 'json';

  // Type guard for MeetResult (allows empty arrays)
  const isMeetResultArray = (
    value: unknown
  ): value is Array<{
    itemA: OverlayItem;
    itemB: OverlayItem;
    similarity: number;
  }> => {
    if (!Array.isArray(value)) return false;
    // Empty array is a valid meet result (no alignments found)
    if (value.length === 0) return true;
    // Non-empty array must have the expected shape
    return (
      value[0] &&
      'itemA' in value[0] &&
      'itemB' in value[0] &&
      'similarity' in value[0]
    );
  };

  if (!isMeetResultArray(result)) {
    if (!useJson) {
      log.warn(chalk.yellow('Unexpected result format'));
    } else {
      console.log(JSON.stringify([], null, 2));
    }
    return;
  }

  if (result.length === 0) {
    if (!useJson) {
      log.warn(chalk.yellow(`No ${label} alignments found`));
    } else {
      console.log(JSON.stringify([], null, 2));
    }
    return;
  }

  // Deduplicate by text content (same proof-principle text pair)
  const seen = new Set<string>();
  const uniqueResults = result.filter(({ itemA, itemB }) => {
    const key = `${itemA.metadata.text}|||${itemB.metadata.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (useJson) {
    console.log(JSON.stringify(uniqueResults.slice(0, limit), null, 2));
    return;
  }

  log.info(
    chalk.bold(`\nMeet Results: ${uniqueResults.length} unique alignment(s)`)
  );
  if (uniqueResults.length < result.length) {
    log.info(chalk.dim(`  (deduplicated from ${result.length} raw matches)`));
  }
  log.info('');

  log.info(
    chalk.dim(
      `Showing ${Math.min(limit, uniqueResults.length)} of ${uniqueResults.length} pairs`
    )
  );
  log.info('');

  for (const { itemA, itemB, similarity } of uniqueResults.slice(0, limit)) {
    // Color code similarity
    const simColor =
      similarity >= 0.9
        ? chalk.green
        : similarity >= 0.7
          ? chalk.yellow
          : chalk.dim;

    log.info(simColor(`Similarity: ${(similarity * 100).toFixed(1)}%`));
    log.info(chalk.cyan(`  Source: ${itemA.metadata.text}`));
    log.info(chalk.magenta(`  Aligned: ${itemB.metadata.text}`));
    log.info('');
  }

  if (uniqueResults.length > limit) {
    log.info(
      chalk.dim(
        `... and ${uniqueResults.length - limit} more (use --limit to see more)`
      )
    );
  }
}
