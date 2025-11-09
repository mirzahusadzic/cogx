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

import { spinner } from '@clack/prompts';
import path from 'path';
import { createQueryEngine } from '../core/algebra/query-parser.js';
import {
  OverlayItem,
  OverlayMetadata,
  SetOperationResult,
  MeetResult,
} from '../core/algebra/overlay-algebra.js';
import { WorkspaceManager } from '../core/workspace-manager.js';
import {
  formatId,
  cleanText,
  colorSimilarity,
  colorSeverity,
  createBox,
  formatKeyValue,
} from '../utils/formatter.js';

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
  let s = spinner();

  try {
    // Find .open_cognition by walking up directory tree
    const workspaceManager = new WorkspaceManager();
    const projectRoot = workspaceManager.resolvePgcRoot(options.projectRoot);

    if (!projectRoot) {
      console.error(
        'No .open_cognition workspace found. Run "cognition-cli init" to create one.'
      );
      process.exit(1);
    }

    const pgcRoot = path.join(projectRoot, '.open_cognition');

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
  } catch (error) {
    if (s) {
      s.stop('Query failed');
    }
    console.error((error as Error).message);
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
    console.warn('Unknown result format');
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
    console.warn('No items found');
    return;
  }

  console.log(`\nResults: ${items.length} item(s)\n`);

  if (format === 'json') {
    console.log(JSON.stringify(items.slice(0, limit), null, 2));
    return;
  }

  if (format === 'summary') {
    console.log(`Showing summary of ${Math.min(limit, items.length)} items`);
    for (const item of items.slice(0, limit)) {
      console.log(`  ${item.id}`);
      console.log(`    ${truncate(item.metadata.text, 80)}`);
    }
    return;
  }

  // Table format (default)
  console.log(
    `Showing ${Math.min(limit, items.length)} of ${items.length} items\n`
  );

  for (const item of items.slice(0, limit)) {
    const content = [formatId(item.id)];

    // Type
    if (item.metadata.type) {
      content.push(formatKeyValue('Type', item.metadata.type));
    }

    // Text (clean up, box will wrap)
    content.push(formatKeyValue('Text', cleanText(item.metadata.text)));

    // Additional metadata (severity, section, etc.)
    const otherKeys = Object.keys(item.metadata).filter(
      (k) => !['text', 'type', 'weight'].includes(k)
    );
    if (otherKeys.length > 0) {
      for (const key of otherKeys.slice(0, 3)) {
        const rawValue = item.metadata[key];
        const value =
          key === 'severity'
            ? colorSeverity(String(rawValue))
            : String(rawValue);
        content.push(formatKeyValue(key, value));
      }
    }

    console.log(createBox(content));
    console.log('');
  }

  if (items.length > limit) {
    console.log(
      `... and ${items.length - limit} more (use --limit to see more)`
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

  console.log(
    `\n${metadata.operation.toUpperCase()}: ${metadata.itemCount} item(s)`
  );
  console.log(`  Source overlays: ${metadata.sourceOverlays.join(', ')}\n`);

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
    console.warn('No alignments found (try lowering --threshold)');
    return;
  }

  console.log(`\nMeet Results: ${results.length} alignment(s)\n`);

  if (format === 'json') {
    console.log(JSON.stringify(results.slice(0, limit), null, 2));
    return;
  }

  console.log(
    `Showing ${Math.min(limit, results.length)} of ${results.length} pairs\n`
  );

  results.slice(0, limit).forEach((result, index) => {
    const { itemA, itemB, similarity } = result;
    const content = [
      formatKeyValue('Match', colorSimilarity(similarity)),
      '',
      formatKeyValue('Item A', formatId(itemA.id)),
      `  ${cleanText(itemA.metadata.text)}`,
      '',
      formatKeyValue('Item B', formatId(itemB.id)),
      `  ${cleanText(itemB.metadata.text)}`,
    ];

    console.log(createBox(content, `Alignment ${index + 1}`));
    console.log('');
  });

  if (results.length > limit) {
    console.log(
      `... and ${results.length - limit} more (use --limit to see more)`
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
