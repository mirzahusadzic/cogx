/**
 * Workflow Sugar Commands (O₅ Operational Patterns)
 *
 * Provides syntactic convenience for querying operational patterns from the
 * Grounded Context Pool (PGC). These "sugar" commands translate to lattice
 * algebra expressions, offering a simpler CLI interface for common O₅ queries.
 *
 * SUGAR CONCEPT:
 * Sugar commands wrap the lattice algebra query language with named commands
 * that are easier to remember and use. Instead of writing:
 *   `cognition-cli lattice "O5[workflow_pattern]"`
 * Users can simply write:
 *   `cognition-cli workflow patterns`
 *
 * This improves UX while maintaining the full power of the algebra layer.
 *
 * OVERLAY REFERENCE (O₅):
 * - workflow_pattern: Operational workflow templates and patterns
 * - quest_structure: Multi-step task structures with dependencies
 * - depth_rule: Rules governing operational depth and recursion limits
 *
 * DESIGN RATIONALE:
 * 1. User-Friendly Interface: Named commands are more discoverable than query syntax
 * 2. Guided Exploration: Each command has specific semantics (patterns vs quests vs rules)
 * 3. Cross-Overlay Queries: Supports semantic alignment with O₂ (security) and O₄ (mission)
 * 4. Consistent Output: Unified display functions work across all query types
 *
 * @example
 * // Show all workflow patterns in O₅
 * await workflowPatternsCommand({ projectRoot: '.' });
 * // Translates to: lattice "O5[workflow_pattern]"
 *
 * @example
 * // Show workflows aligned with security boundaries (O₂)
 * await workflowPatternsCommand({
 *   projectRoot: '.',
 *   secure: true
 * });
 * // Translates to: lattice "O5[workflow_pattern] ~ O2[boundary]"
 *
 * @example
 * // Show workflows aligned with mission principles (O₄)
 * await workflowPatternsCommand({
 *   projectRoot: '.',
 *   aligned: true
 * });
 * // Translates to: lattice "O5[workflow_pattern] ~ O4"
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

/**
 * Resolve Grounded Context Pool (PGC) root directory
 *
 * Walks up the directory tree from startPath to find the nearest
 * .open_cognition workspace. This enables running commands from any
 * subdirectory within a project.
 *
 * @param startPath - Starting directory for the walk-up search
 * @returns Absolute path to .open_cognition directory
 * @throws {Error} Exits process if no workspace found
 *
 * @example
 * const pgcRoot = resolvePgcRoot('/path/to/project/src');
 * // Returns: /path/to/project/.open_cognition
 */
function resolvePgcRoot(startPath: string, options?: WorkflowOptions): string {
  const workspaceManager = new WorkspaceManager();
  const projectRoot = workspaceManager.resolvePgcRoot(startPath);

  if (!projectRoot) {
    if (options?.format !== 'json' && process.env.COGNITION_FORMAT !== 'json') {
      log.error(
        chalk.red(
          'No .open_cognition workspace found. Run "cognition-cli init" to create one.'
        )
      );
    }
    process.exit(1);
  }

  return path.join(projectRoot, '.open_cognition');
}

interface WorkflowOptions {
  projectRoot: string;
  format?: 'table' | 'json' | 'summary';
  limit?: number;
  verbose?: boolean;
  secure?: boolean;
  aligned?: boolean;
}

/**
 * Display workflow patterns from O₅ overlay
 *
 * Retrieves and displays all workflow_pattern items from the operational
 * overlay (O₅). Optionally filters to show only workflows that align with
 * security boundaries (O₂) or mission principles (O₄).
 *
 * LATTICE TRANSLATION:
 * - Default: `O5[workflow_pattern]` (all patterns)
 * - With --secure: `O5[workflow_pattern] ~ O2[boundary]` (security-aligned)
 * - With --aligned: `O5[workflow_pattern] ~ O4` (mission-aligned)
 *
 * The ~ operator performs semantic alignment (meet operation) between overlays.
 *
 * @param options - Command options including project root and filters
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json' | 'summary'
 * @param options.limit - Maximum number of results to display
 * @param options.verbose - Enable verbose error output
 * @param options.secure - Filter to security-aligned workflows
 * @param options.aligned - Filter to mission-aligned workflows
 * @returns Promise that resolves when display is complete
 *
 * @example
 * // Show all workflow patterns
 * await workflowPatternsCommand({ projectRoot: '.' });
 *
 * @example
 * // Show workflows aligned with security boundaries
 * await workflowPatternsCommand({
 *   projectRoot: '.',
 *   secure: true,
 *   format: 'table',
 *   limit: 20
 * });
 */
export async function workflowPatternsCommand(
  options: WorkflowOptions
): Promise<void> {
  const useJson =
    options.format === 'json' || process.env.COGNITION_FORMAT === 'json';

  if (!useJson) {
    intro(chalk.bold('Workflow: Operational Patterns'));
  }

  const pgcRoot = resolvePgcRoot(options.projectRoot, options);

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

  if (!useJson) {
    s.start(description);
  }

  try {
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
    const engine = createQueryEngine(pgcRoot, workbenchUrl);

    const result = await engine.execute(query);

    if (!useJson) {
      s.stop('Analysis complete');
    }

    if (options.secure || options.aligned) {
      displayMeetResults(result, options);
    } else {
      displayItemList(result, options);
    }

    if (!useJson) {
      outro(chalk.green('✓ Workflow analysis complete'));
    }
  } catch (error) {
    if (!useJson) {
      s.stop('Analysis failed');
      log.error(chalk.red((error as Error).message));
    }
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Display quest structures from O₅ overlay
 *
 * Retrieves and displays all quest_structure items from the operational
 * overlay. Quest structures represent multi-step workflows with dependencies,
 * goals, and success criteria.
 *
 * LATTICE TRANSLATION: `O5[quest_structure]`
 *
 * @param options - Command options including project root and display settings
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json' | 'summary'
 * @param options.limit - Maximum number of results to display
 * @param options.verbose - Enable verbose error output
 * @returns Promise that resolves when display is complete
 *
 * @example
 * // Show all quest structures
 * await workflowQuestsCommand({
 *   projectRoot: '.',
 *   format: 'summary',
 *   limit: 10
 * });
 */
export async function workflowQuestsCommand(
  options: WorkflowOptions
): Promise<void> {
  const useJson =
    options.format === 'json' || process.env.COGNITION_FORMAT === 'json';

  if (!useJson) {
    intro(chalk.bold('Workflow: Quest Structures'));
  }

  const pgcRoot = resolvePgcRoot(options.projectRoot, options);

  const s = spinner();
  if (!useJson) {
    s.start('Loading quest structures');
  }

  try {
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
    const engine = createQueryEngine(pgcRoot, workbenchUrl);

    const query = 'O5[quest_structure]';
    const result = await engine.execute(query);

    if (!useJson) {
      s.stop('Analysis complete');
    }

    displayItemList(result, options);
    if (!useJson) {
      outro(chalk.green('✓ Quest analysis complete'));
    }
  } catch (error) {
    if (!useJson) {
      s.stop('Analysis failed');
      log.error(chalk.red((error as Error).message));
    }
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Display depth rules from O₅ overlay
 *
 * Retrieves and displays all depth_rule items from the operational overlay.
 * Depth rules govern operational recursion limits, nesting constraints, and
 * complexity boundaries for workflows.
 *
 * LATTICE TRANSLATION: `O5[depth_rule]`
 *
 * @param options - Command options including project root and display settings
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json' | 'summary'
 * @param options.limit - Maximum number of results to display
 * @param options.verbose - Enable verbose error output
 * @returns Promise that resolves when display is complete
 *
 * @example
 * // Show all depth rules
 * await workflowDepthRulesCommand({
 *   projectRoot: '.',
 *   format: 'table'
 * });
 */
export async function workflowDepthRulesCommand(
  options: WorkflowOptions
): Promise<void> {
  const useJson =
    options.format === 'json' || process.env.COGNITION_FORMAT === 'json';

  if (!useJson) {
    intro(chalk.bold('Workflow: Depth Rules'));
  }

  const pgcRoot = resolvePgcRoot(options.projectRoot, options);

  const s = spinner();
  if (!useJson) {
    s.start('Loading depth rules');
  }

  try {
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
    const engine = createQueryEngine(pgcRoot, workbenchUrl);

    const query = 'O5[depth_rule]';
    const result = await engine.execute(query);

    if (!useJson) {
      s.stop('Analysis complete');
    }

    displayItemList(result, options);
    if (!useJson) {
      outro(chalk.green('✓ Depth rule analysis complete'));
    }
  } catch (error) {
    if (!useJson) {
      s.stop('Analysis failed');
      log.error(chalk.red((error as Error).message));
    }
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Display list of overlay items (set operations or item arrays)
 *
 * Handles both direct OverlayItem arrays and SetOperationResult objects,
 * formatting output based on user preferences (table, json, or summary).
 * Supports multiple metadata fields with intelligent truncation.
 *
 * @param result - Query result (OverlayItem[] or SetOperationResult)
 * @param options - Display options including format and limit
 * @param options.format - Output format: 'table' | 'json' | 'summary'
 * @param options.limit - Maximum items to display (default: 50)
 *
 * @example
 * const items = await engine.execute('O5[workflow_pattern]');
 * displayItemList(items, { format: 'table', limit: 20 });
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
    if (format !== 'json' && process.env.COGNITION_FORMAT !== 'json') {
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
    if (format !== 'json' && process.env.COGNITION_FORMAT !== 'json') {
      log.warn(chalk.yellow('No items found'));
    } else if (format === 'json' || process.env.COGNITION_FORMAT === 'json') {
      console.log(JSON.stringify([], null, 2));
    }
    return;
  }

  if (format === 'json' || process.env.COGNITION_FORMAT === 'json') {
    console.log(JSON.stringify(items.slice(0, limit), null, 2));
    return;
  }

  log.info(chalk.bold(`Results: ${items.length} item(s)`));
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
    const itemType =
      item.metadata.type || item.metadata.patternType || 'unknown';
    log.info(chalk.dim(`  Type: ${itemType}`));
    log.info(chalk.dim(`  Text: ${item.metadata.text}`));

    // Show additional metadata
    const otherKeys = Object.keys(item.metadata).filter(
      (k) => !['text', 'type', 'weight', 'patternType'].includes(k)
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
 * Display semantic alignment results (meet operation)
 *
 * Formats and displays MeetResult arrays showing pairs of items from
 * different overlays with their similarity scores. Color-codes similarity
 * to highlight strong (>90%), moderate (70-90%), and weak (<70%) alignments.
 *
 * @param result - Meet operation result with itemA, itemB, and similarity
 * @param options - Display options including format and limit
 * @param options.format - Output format: 'table' | 'json'
 * @param options.limit - Maximum pairs to display (default: 50)
 *
 * @example
 * const aligned = await engine.execute('O5[workflow_pattern] ~ O2[boundary]');
 * displayMeetResults(aligned, { format: 'table', limit: 10 });
 * // Shows workflow-security alignment pairs with similarity scores
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
    if (format !== 'json' && process.env.COGNITION_FORMAT !== 'json') {
      log.warn(chalk.yellow('Unexpected result format'));
    } else {
      console.log(JSON.stringify([], null, 2));
    }
    return;
  }

  if (result.length === 0) {
    if (format !== 'json' && process.env.COGNITION_FORMAT !== 'json') {
      log.warn(chalk.yellow('No alignments found'));
    } else {
      console.log(JSON.stringify([], null, 2));
    }
    return;
  }

  if (format === 'json' || process.env.COGNITION_FORMAT === 'json') {
    console.log(JSON.stringify(result.slice(0, limit), null, 2));
    return;
  }

  log.info(chalk.bold(`\nMeet Results: ${result.length} alignment(s)`));
  log.info('');

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
    log.info(chalk.dim(`    ${itemA.metadata.text}`));
    log.info(chalk.magenta(`  Aligns with: ${itemB.id}`));
    log.info(chalk.dim(`    ${itemB.metadata.text}`));
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
