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
  json?: boolean;
  limit?: number;
  verbose?: boolean;
}

/**
 * Execute a lattice query: Boolean algebra over cognitive overlays
 *
 * Interprets lattice algebra expressions to compose queries across analytical overlays
 * using set operations (union, intersection, difference) and semantic operations (meet, project).
 *
 * Expression syntax supports:
 * - Set Operations: + | & - (union, intersection, difference)
 * - Semantic Ops: ~ -> (meet/alignment, project/guided traversal)
 * - Filters: O2[attacks] O2[severity=critical] (type and metadata filtering)
 * - Grouping: (O1 & O2) - O3 (parenthesized composition)
 *
 * Overlays available:
 * - O1: Structural (symbols, functions, classes)
 * - O2: Security (threats, mitigations)
 * - O3: Mathematical (proofs, lemmas)
 * - O4: Mission (concepts, principles)
 * - O5: Operational (workflows, patterns)
 * - O6: Lineage (dependencies)
 * - O7: Coherence (alignment scores)
 *
 * @param query - Lattice algebra expression (e.g., "O1 - O2" for gaps)
 * @param options - Display options (format, limit, verbose)
 * @throws Error if query syntax invalid, overlay missing, or parsing fails
 * @example
 * // Find code without security coverage
 * await latticeCommand("O1 - O2", { projectRoot: ".", format: "table" });
 *
 * @example
 * // Security threats aligned with mission principles
 * await latticeCommand("O2[threat] ~ O4[principle]", { projectRoot: ".", limit: 20 });
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
 * Display query results in appropriate format based on result type.
 *
 * Routes to specialized display functions:
 * - MeetResult: Pairwise semantic alignments with similarity scores
 * - SetOperationResult: Union/intersection/difference results with metadata
 * - OverlayItem[]: Simple list of items from single overlay
 *
 * @param result - Query result from lattice engine
 * @param options - Display options (format, limit, verbose)
 * @example
 * displayResults(queryResult, { format: 'table', limit: 50 });
 */
function displayResults(result: unknown, options: LatticeOptions): void {
  const format = options.json ? 'json' : options.format || 'table';
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
 * Display list of overlay items in requested format.
 *
 * Supports three formats:
 * - table: Detailed boxes with metadata fields
 * - json: Raw JSON output
 * - summary: Compact ID + text snippet format
 *
 * @param items - Array of overlay items to display
 * @param format - Output format (table, json, summary)
 * @param limit - Maximum items to show
 * @example
 * displayItemList(items, 'table', 50);
 */
function displayItemList(
  items: OverlayItem[],
  format: string,
  limit: number
): void {
  const useJson = format === 'json' || process.env.COGNITION_FORMAT === 'json';

  if (items.length === 0) {
    if (!useJson) {
      console.warn('No items found');
    } else {
      console.log(JSON.stringify([], null, 2));
    }
    return;
  }

  if (useJson) {
    console.log(JSON.stringify(items.slice(0, limit), null, 2));
    return;
  }

  console.log(`\nResults: ${items.length} item(s)\n`);

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
 * Display set operation result with metadata.
 *
 * Shows operation type (union/intersection/difference), source overlays,
 * and delegates to displayItemList for actual item rendering.
 *
 * @param result - Set operation result with items and metadata
 * @param format - Output format (table, json, summary)
 * @param limit - Maximum items to show
 * @example
 * displaySetOperationResult(result, 'table', 50);
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
 * Display meet results showing semantic alignments between overlays.
 *
 * For each MeetResult pair, displays:
 * - Similarity score (cosine distance)
 * - Item A with metadata
 * - Item B with metadata
 *
 * Useful for visualizing cross-overlay relationships and semantic coherence.
 *
 * @param results - Array of meet/alignment results
 * @param format - Output format (table, json, summary)
 * @param limit - Maximum results to show
 * @example
 * displayMeetResults(alignments, 'table', 50);
 */
function displayMeetResults(
  results: MeetResult<OverlayMetadata, OverlayMetadata>[],
  format: string,
  limit: number
): void {
  const useJson = format === 'json' || process.env.COGNITION_FORMAT === 'json';

  if (results.length === 0) {
    if (!useJson) {
      console.warn('No alignments found (try lowering --threshold)');
    } else {
      console.log(JSON.stringify([], null, 2));
    }
    return;
  }

  if (useJson) {
    console.log(JSON.stringify(results.slice(0, limit), null, 2));
    return;
  }

  console.log(`\nMeet Results: ${results.length} alignment(s)\n`);

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
 * Truncate text to maximum length with ellipsis.
 *
 * Utility for truncating long metadata text in output displays.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length including ellipsis
 * @returns Truncated text with '...' suffix if longer than maxLength
 * @example
 * truncate("Very long metadata here", 20); // "Very long metada..."
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
