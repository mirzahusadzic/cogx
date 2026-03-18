import chalk from 'chalk';
import { log } from '@clack/prompts';
import { SugarCommandOptions } from './types.js';
import {
  OverlayItem,
  SetOperationResult,
  OverlayMetadata,
} from '../../core/algebra/overlay-algebra.js';
import { environmentService } from '../../core/services/environment/EnvironmentService.js';

/**
 * Resolve Grounded Context Pool (PGC) root directory
 *
 * @param startPath - Starting directory for the walk-up search
 * @returns Absolute path to .open_cognition directory
 * @throws {Error} Exits process if no workspace found
 */
export function resolvePgcRoot(startPath: string = '.'): string {
  const projectRoot = environmentService.findProjectRoot(startPath);
  if (!projectRoot) {
    console.error(
      chalk.red(
        '\n✗ No .open_cognition workspace found. Run "cognition-cli init" to create one.\n'
      )
    );
    process.exit(1);
    return ''; // Should not reach here
  }
  return environmentService.resolvePgcDir(projectRoot);
}

/**
 * Render a visual score bar.
 *
 * @param score - Score between 0 and 1
 * @param width - Character width of the bar
 * @returns Formatted string with chalk colors
 */
export function renderScoreBar(score: number, width: number = 20): string {
  const bar = '█'.repeat(Math.round(score * width));
  const color =
    score >= 0.7 ? chalk.green : score >= 0.5 ? chalk.yellow : chalk.red;
  return color(bar);
}

/**
 * Truncate text to maximum length with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

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
      const metadata = item.metadata as Record<string, unknown>;
      const scoreKey =
        options.scoreField ||
        ['overallCoherence', 'weight', 'score', 'confidence'].find(
          (k) => typeof metadata[k] === 'number'
        );
      const scorePart =
        scoreKey && typeof metadata[scoreKey] === 'number'
          ? ` - ${((metadata[scoreKey] as number) * 100).toFixed(1)}%`
          : '';

      log.info(`  ${chalk.cyan(item.id)}${scorePart}`);
      log.info(
        chalk.dim(`    ${truncate((metadata.text as string) || '', 80)}`)
      );
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

  for (const [index, item] of items.slice(0, limit).entries()) {
    const metadata = item.metadata as Record<string, unknown>;

    // Detect score field
    const scoreKey =
      options.scoreField ||
      ['overallCoherence', 'weight', 'score', 'confidence'].find(
        (k) => typeof metadata[k] === 'number'
      );
    const score =
      scoreKey && typeof metadata[scoreKey] === 'number'
        ? (metadata[scoreKey] as number)
        : null;

    // Line 1: Index + ID/Name
    const displayName = (metadata.symbolName as string) || item.id;
    const locationPart = metadata.filePath ? ` [${metadata.filePath}]` : '';
    log.info(
      `${chalk.dim((index + 1).toString().padStart(3))}. ${chalk.cyan.bold(displayName)}${chalk.dim(locationPart)}`
    );

    // Line 2: Score Bar (if exists)
    if (score !== null) {
      const scoreBar = renderScoreBar(score, 30);
      const scorePct = (score * 100).toFixed(1);
      log.info(`     ${scoreBar} ${chalk.white(scorePct + '%')}`);
    }

    // Line 3: Statement/Text
    if (metadata.text && metadata.text !== displayName) {
      log.info(`     ${chalk.white(truncate(metadata.text as string, 120))}`);
    }

    // Line 4: Additional Metadata (Coherence / Concept specific)
    const extraInfo = [];
    if (metadata.topConceptText) {
      extraInfo.push(
        `Top concept: ${truncate(metadata.topConceptText as string, 40)} (${((metadata.topConceptScore as number) * 100).toFixed(1)}%)`
      );
    }
    if (metadata.section) {
      extraInfo.push(`Section: ${metadata.section}`);
    }
    if (metadata.occurrences) {
      extraInfo.push(`Occurrences: ${metadata.occurrences}`);
    }

    if (extraInfo.length > 0) {
      log.info(chalk.dim(`     ${extraInfo.join(' | ')}`));
    } else {
      // Fallback for other metadata
      const otherKeys = Object.keys(metadata).filter(
        (k) =>
          ![
            'text',
            'type',
            'weight',
            'symbolName',
            'filePath',
            'id',
            'overallCoherence',
            'topConceptText',
            'topConceptScore',
            'section',
            'occurrences',
          ].includes(k)
      );
      if (otherKeys.length > 0) {
        const otherInfo = otherKeys
          .slice(0, 3)
          .map((k) => `${k}: ${metadata[k]}`)
          .join(' | ');
        log.info(chalk.dim(`     ${otherInfo}`));
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
