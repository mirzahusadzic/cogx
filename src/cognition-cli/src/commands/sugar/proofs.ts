/**
 * Mathematical Proofs Sugar Commands (O₆ Mathematical Proofs)
 *
 * Provides syntactic convenience for querying mathematical statements from the
 * Grounded Context Pool (PGC). These "sugar" commands translate to lattice
 * algebra expressions, offering a simpler CLI interface for proof exploration.
 *
 * SUGAR CONCEPT:
 * Sugar commands wrap the lattice algebra query language with named commands
 * that are easier to remember and use. Instead of writing:
 *   `cognition-cli lattice "O6[theorem]"`
 * Users can simply write:
 *   `cognition-cli proofs theorems`
 *
 * This improves UX while maintaining the full power of the algebra layer.
 *
 * OVERLAY REFERENCE (O₆):
 * - theorem: Proven mathematical theorems
 * - lemma: Supporting mathematical lemmas
 * - axiom: Foundational mathematical axioms
 * - proof: Detailed proof structures
 * - identity: Mathematical identities and equivalences
 *
 * DESIGN RATIONALE:
 * 1. Mathematical Rigor: O₆ captures formal mathematical knowledge
 * 2. Proof Discovery: Find theorems/lemmas by semantic meaning
 * 3. Mission Alignment: Cross-reference proofs with mission principles (O₄)
 * 4. Type Categorization: Separate queries for different proof types
 *
 * USE CASES:
 * - Research: Find relevant theorems for a mathematical concept
 * - Verification: Check which lemmas support a given theorem
 * - Alignment: Identify proofs that embody mission principles
 * - Documentation: Export mathematical foundations as structured data
 *
 * @example
 * // List all theorems in the system
 * await proofsTheoremsCommand({ projectRoot: '.' });
 * // Translates to: lattice "O6[theorem]"
 *
 * @example
 * // Find proofs aligned with mission principles
 * await proofsAlignedCommand({ projectRoot: '.' });
 * // Translates to: lattice "O6 ~ O4[principle]"
 * // Shows which mathematical statements embody mission values
 *
 * @example
 * // List all mathematical statements (theorems, lemmas, axioms, etc.)
 * await proofsListCommand({
 *   projectRoot: '.',
 *   type: 'identity',
 *   format: 'json'
 * });
 * // Translates to: lattice "O6[identity]"
 */

import { intro, outro, spinner, log } from '@clack/prompts';
import chalk from 'chalk';
import path from 'path';
import { createQueryEngine } from '../../core/algebra/query-parser.js';
import {
  OverlayItem,
  OverlayMetadata,
  SetOperationResult,
} from '../../core/algebra/overlay-algebra.js';
import { WorkspaceManager } from '../../core/workspace-manager.js';

interface ProofsOptions {
  projectRoot: string;
  format?: 'table' | 'json' | 'summary';
  limit?: number;
  verbose?: boolean;
  type?: 'theorem' | 'lemma' | 'axiom' | 'proof' | 'identity';
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
 * Display all mathematical theorems from O₆ overlay
 *
 * Retrieves and displays proven theorems from the mathematical proofs overlay.
 * Theorems represent established mathematical results with verified proofs.
 *
 * LATTICE TRANSLATION: `O6[theorem]`
 *
 * @param options - Command options
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json' | 'summary'
 * @param options.limit - Maximum theorems to display
 * @param options.verbose - Enable verbose error output
 * @returns Promise that resolves when display is complete
 *
 * @example
 * await proofsTheoremsCommand({
 *   projectRoot: '.',
 *   format: 'table',
 *   limit: 20
 * });
 */
export async function proofsTheoremsCommand(
  options: ProofsOptions
): Promise<void> {
  intro(chalk.bold('Proofs: Theorems'));

  const pgcRoot = resolvePgcRoot(options.projectRoot);

  const s = spinner();
  s.start('Loading theorems');

  try {
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
    const engine = createQueryEngine(pgcRoot, workbenchUrl);

    const query = 'O6[theorem]';
    const result = await engine.execute(query);

    s.stop('Analysis complete');

    displayItemList(result, options);
    outro(chalk.green('✓ Theorem analysis complete'));
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
 * Display all mathematical lemmas from O₆ overlay
 *
 * Retrieves and displays lemmas from the mathematical proofs overlay.
 * Lemmas are supporting mathematical results that help prove theorems.
 *
 * LATTICE TRANSLATION: `O6[lemma]`
 *
 * @param options - Command options
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json' | 'summary'
 * @param options.limit - Maximum lemmas to display
 * @param options.verbose - Enable verbose error output
 * @returns Promise that resolves when display is complete
 *
 * @example
 * await proofsLemmasCommand({
 *   projectRoot: '.',
 *   format: 'summary'
 * });
 */
export async function proofsLemmasCommand(
  options: ProofsOptions
): Promise<void> {
  intro(chalk.bold('Proofs: Lemmas'));

  const pgcRoot = resolvePgcRoot(options.projectRoot);

  const s = spinner();
  s.start('Loading lemmas');

  try {
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
    const engine = createQueryEngine(pgcRoot, workbenchUrl);

    const query = 'O6[lemma]';
    const result = await engine.execute(query);

    s.stop('Analysis complete');

    displayItemList(result, options);
    outro(chalk.green('✓ Lemma analysis complete'));
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
 * Display all mathematical statements from O₆ overlay
 *
 * Retrieves all mathematical content from O₆, including theorems, lemmas,
 * axioms, proofs, and identities. Optionally filters by specific type.
 *
 * LATTICE TRANSLATION:
 * - Default: `O6` (all mathematical statements)
 * - With type: `O6[<type>]` (e.g., O6[axiom])
 *
 * @param options - Command options
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json' | 'summary'
 * @param options.limit - Maximum items to display
 * @param options.verbose - Enable verbose error output
 * @param options.type - Filter by type: 'theorem' | 'lemma' | 'axiom' | 'proof' | 'identity'
 * @returns Promise that resolves when display is complete
 *
 * @example
 * // List all mathematical statements
 * await proofsListCommand({ projectRoot: '.' });
 *
 * @example
 * // List only mathematical identities
 * await proofsListCommand({
 *   projectRoot: '.',
 *   type: 'identity',
 *   format: 'json'
 * });
 */
export async function proofsListCommand(options: ProofsOptions): Promise<void> {
  intro(chalk.bold('Proofs: All Mathematical Statements'));

  const pgcRoot = resolvePgcRoot(options.projectRoot);

  const s = spinner();

  let query = 'O6';
  let description = 'Loading all mathematical statements';

  if (options.type) {
    query = `O6[${options.type}]`;
    description = `Loading ${options.type}s`;
  }

  s.start(description);

  try {
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
    const engine = createQueryEngine(pgcRoot, workbenchUrl);

    const result = await engine.execute(query);

    s.stop('Analysis complete');

    displayItemList(result, options);
    outro(chalk.green('✓ Mathematical analysis complete'));
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
 * Display mathematical proofs aligned with mission principles
 *
 * Performs semantic alignment between mathematical statements (O₆) and
 * mission principles (O₄) to identify proofs that embody or support
 * core mission values through formal mathematical reasoning.
 *
 * LATTICE TRANSLATION: `O6 ~ O4[principle]`
 *
 * The ~ (meet) operator finds semantic similarities between mathematical
 * content and mission principles, revealing philosophical-mathematical connections.
 *
 * @param options - Command options
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json'
 * @param options.limit - Maximum alignment pairs to display
 * @param options.verbose - Enable verbose error output
 * @returns Promise that resolves when display is complete
 *
 * @example
 * await proofsAlignedCommand({
 *   projectRoot: '.',
 *   format: 'table',
 *   limit: 10
 * });
 * // Shows:
 * // Similarity: 82.1%
 * //   Proof: commutativity_theorem
 * //     Demonstrates order-independence in operations
 * //   Principle: fairness
 * //     All inputs should be treated equally regardless of order
 */
export async function proofsAlignedCommand(
  options: ProofsOptions
): Promise<void> {
  intro(chalk.bold('Proofs: Aligned with Mission'));

  const pgcRoot = resolvePgcRoot(options.projectRoot);

  const s = spinner();
  s.start('Finding proofs aligned with mission principles');

  try {
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
    const engine = createQueryEngine(pgcRoot, workbenchUrl);

    const query = 'O6 ~ O4[principle]';
    const result = await engine.execute(query);

    s.stop('Analysis complete');

    displayMeetResults(result, options);
    outro(chalk.green('✓ Alignment analysis complete'));
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
function displayItemList(result: unknown, options: ProofsOptions): void {
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
    log.info(chalk.dim(`  Statement: ${truncate(item.metadata.text, 100)}`));

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
function displayMeetResults(result: unknown, options: ProofsOptions): void {
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
    log.info(chalk.cyan(`  Proof: ${itemA.id}`));
    log.info(chalk.dim(`    ${truncate(itemA.metadata.text, 80)}`));
    log.info(chalk.magenta(`  Principle: ${itemB.id}`));
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
