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

import { intro, outro, spinner as clackSpinner, log } from '@clack/prompts';
import chalk from 'chalk';
import { createSugarCommand } from './factory.js';
import { SugarCommandOptions } from './types.js';
import { displayItemList, displayMeetResults } from './utils.js';
import { environmentService } from '../../core/services/environment/EnvironmentService.js';
import { createQueryEngine } from '../../core/algebra/query-parser.js';

type WorkflowOptions = SugarCommandOptions & {
  secure?: boolean;
  aligned?: boolean;
};

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

  let pgcRoot;
  try {
    pgcRoot = environmentService.resolvePgcDir(options.projectRoot || '.');
  } catch {
    if (!useJson) log.error(chalk.red('No .open_cognition workspace found.'));
    process.exit(1);
  }

  const s = clackSpinner();

  let query = 'O5[workflow_pattern]';
  let description = 'Loading workflow patterns';

  if (options.secure) {
    query = 'O5[workflow_pattern] ~ O2[boundary]';
    description = 'Finding workflows aligned with security boundaries';
  } else if (options.aligned) {
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
      displayMeetResults(result, 'workflow alignment', options);
    } else {
      displayItemList(result, 'workflow patterns', options);
    }

    if (!useJson) {
      outro(chalk.green('✓ Workflow analysis complete'));
    }
  } catch (error) {
    if (!useJson) {
      s.stop(`Analysis failed: ${(error as Error).message}`);
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
export const workflowQuestsCommand = createSugarCommand({
  name: 'Workflow: Quest Structures',
  description: 'Loading quest structures',
  overlayType: 'O5',
  queryType: 'quest_structure',
  itemLabel: 'quest',
  pluralItemLabel: 'quests',
});

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
export const workflowDepthRulesCommand = createSugarCommand({
  name: 'Workflow: Depth Rules',
  description: 'Loading depth rules',
  overlayType: 'O5',
  queryType: 'depth_rule',
  itemLabel: 'rule',
  pluralItemLabel: 'rules',
});
