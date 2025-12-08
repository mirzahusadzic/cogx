/**
 * Security Sugar Commands (O₂ Security Guidelines)
 *
 * Provides syntactic convenience for querying security knowledge from the
 * Grounded Context Pool (PGC). These "sugar" commands translate to lattice
 * algebra expressions and direct O₂ queries, offering a simpler CLI interface
 * for security analysis.
 *
 * SUGAR CONCEPT:
 * Sugar commands wrap the lattice algebra query language with named commands
 * that are easier to remember and use. Instead of writing:
 *   `cognition-cli lattice "O2[attack_vector] ~ O4[principle]"`
 * Users can simply write:
 *   `cognition-cli security attacks`
 *
 * This improves UX while maintaining the full power of the algebra layer.
 *
 * OVERLAY REFERENCE (O₂):
 * - attack_vector: Security threats and attack patterns
 * - boundary: Security boundaries and trust zones
 * - constraint: Security constraints and requirements
 * - mitigation: Security mitigations and controls
 * - vulnerability: Known vulnerabilities and CVEs
 *
 * COMMAND CATEGORIES:
 * 1. Cross-Overlay Queries (lattice algebra):
 *    - attacks: O₂[attack_vector] ~ O₄[principle] (threats vs mission)
 *    - coverage-gaps: O₁ - O₂ (code without security coverage)
 *    - boundaries: O₂[boundary] | O₂[constraint] (security perimeter)
 *
 * 2. Direct O₂ Queries (overlay manager):
 *    - list: All security knowledge with filtering
 *    - cves: CVE tracking and vulnerability management
 *    - query: Semantic search within security knowledge
 *
 * DESIGN RATIONALE:
 * 1. Unified Interface: All security queries through one command family
 * 2. Smart Routing: Lattice queries for cross-overlay, manager for O₂-specific
 * 3. Type Safety: Strong typing for security metadata (severity, CVE IDs, etc.)
 * 4. Actionable Output: Color-coded severity, CVE details, mitigation guidance
 *
 * @example
 * // Find attack vectors that conflict with mission principles
 * await securityAttacksCommand({ projectRoot: '.' });
 * // Translates to: lattice "O2[attack_vector] ~ O4[principle]"
 * // Shows: Pairs of (attack, principle) with similarity scores
 *
 * @example
 * // Find code symbols without security coverage
 * await securityCoverageGapsCommand({ projectRoot: '.' });
 * // Translates to: lattice "O1 - O2"
 * // Shows: Functions/classes lacking security documentation
 *
 * @example
 * // List all critical security items
 * await securityListCommand({
 *   projectRoot: '.',
 *   severity: 'critical',
 *   format: 'table'
 * });
 * // Direct O₂ query with severity filter
 *
 * @example
 * // Track CVEs in the project
 * await securityCVEsCommand({ projectRoot: '.' });
 * // Shows: CVE IDs, affected versions, mitigations
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

interface SecurityOptions {
  projectRoot: string;
  format?: 'table' | 'json' | 'summary';
  limit?: number;
  verbose?: boolean;
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
 * Display attack vectors aligned with mission principles
 *
 * Performs semantic alignment between security attack vectors (O₂) and
 * mission principles (O₄) to identify threats that conflict with or
 * challenge core mission values.
 *
 * LATTICE TRANSLATION: `O2[attack_vector] ~ O4[principle]`
 *
 * The ~ (meet) operator finds semantic similarities between attack vectors
 * and principles, revealing which threats are most relevant to mission goals.
 *
 * @param options - Command options
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json' | 'summary'
 * @param options.limit - Maximum pairs to display
 * @param options.verbose - Enable verbose error output
 * @returns Promise that resolves when display is complete
 *
 * @example
 * await securityAttacksCommand({
 *   projectRoot: '.',
 *   format: 'table',
 *   limit: 20
 * });
 * // Shows:
 * // Similarity: 87.3%
 * //   Attack: prompt_injection
 * //     Malicious input can override system instructions
 * //   Principle: transparency
 * //     All operations must be auditable and verifiable
 */
export async function securityAttacksCommand(
  options: SecurityOptions
): Promise<void> {
  intro(chalk.bold('Security: Attacks vs Mission Principles'));

  const pgcRoot = resolvePgcRoot(options.projectRoot);

  const s = spinner();
  s.start('Finding attack vectors that conflict with mission principles');

  try {
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
    const engine = createQueryEngine(pgcRoot, workbenchUrl);

    // Execute: O2[attack_vector] ~ O4[principle]
    const query = 'O2[attack_vector] ~ O4[principle]';
    const result = await engine.execute(query);

    s.stop('Analysis complete');

    displayMeetResults(result, options);
    outro(chalk.green('✓ Security analysis complete'));
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
 * Display code symbols without security coverage
 *
 * Performs set difference between structural symbols (O₁) and security
 * guidelines (O₂) to identify functions/classes lacking security documentation.
 *
 * LATTICE TRANSLATION: `O1 - O2`
 *
 * The - (difference) operator returns items in O₁ that have no corresponding
 * entries in O₂, revealing coverage gaps in security documentation.
 *
 * @param options - Command options
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json' | 'summary'
 * @param options.limit - Maximum items to display
 * @param options.verbose - Enable verbose error output
 * @returns Promise that resolves when display is complete
 *
 * @example
 * await securityCoverageGapsCommand({
 *   projectRoot: '.',
 *   format: 'summary'
 * });
 * // Shows:
 * // DIFFERENCE: 47 item(s)
 * //   Source overlays: O1, O2
 * //
 * // Results: 47 item(s)
 * //   handleUserInput
 * //     Function that processes user-provided data
 * //   executeCommand
 * //     Runs system commands based on user input
 */
export async function securityCoverageGapsCommand(
  options: SecurityOptions
): Promise<void> {
  intro(chalk.bold('Security: Coverage Gaps'));

  const pgcRoot = resolvePgcRoot(options.projectRoot);

  const s = spinner();
  s.start('Finding code symbols without security coverage');

  try {
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
    const engine = createQueryEngine(pgcRoot, workbenchUrl);

    // Execute: O1 - O2 (symbols not covered by security)
    const query = 'O1 - O2';
    const result = await engine.execute(query);

    s.stop('Analysis complete');

    displayItemList(result, options);
    outro(chalk.green('✓ Coverage gap analysis complete'));
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
 * Display security boundaries and constraints
 *
 * Retrieves and combines boundary and constraint items from O₂ overlay
 * to provide a complete view of security perimeter and requirements.
 *
 * LATTICE TRANSLATION: `O2[boundary] | O2[constraint]`
 *
 * The | (union) operator combines both item types into a single result set,
 * showing all security perimeter definitions and mandatory constraints.
 *
 * @param options - Command options
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json' | 'summary'
 * @param options.limit - Maximum items to display
 * @param options.verbose - Enable verbose error output
 * @returns Promise that resolves when display is complete
 *
 * @example
 * await securityBoundariesCommand({
 *   projectRoot: '.',
 *   format: 'table'
 * });
 * // Shows:
 * // trust_boundary_api
 * //   Type: boundary
 * //   External API requests must be validated
 * // input_sanitization
 * //   Type: constraint
 * //   All user input must be sanitized before processing
 */
export async function securityBoundariesCommand(
  options: SecurityOptions
): Promise<void> {
  intro(chalk.bold('Security: Boundaries & Constraints'));

  const pgcRoot = resolvePgcRoot(options.projectRoot);

  const s = spinner();
  s.start('Loading security boundaries and constraints');

  try {
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
    const engine = createQueryEngine(pgcRoot, workbenchUrl);

    // Execute: O2[boundary] | O2[constraint]
    const query = 'O2[boundary] | O2[constraint]';
    const result = await engine.execute(query);

    s.stop('Analysis complete');

    displayItemList(result, options);
    outro(chalk.green('✓ Boundary analysis complete'));
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
function displayItemList(result: unknown, options: SecurityOptions): void {
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
    log.info(chalk.dim(`  Text: ${item.metadata.text}`));

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
function displayMeetResults(result: unknown, options: SecurityOptions): void {
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
    log.info(chalk.cyan(`  Attack: ${itemA.metadata.text}`));
    log.info(chalk.magenta(`  Principle: ${itemB.metadata.text}`));
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

// ========================================
// DIRECT O₂ OVERLAY QUERIES
// ========================================

import { SecurityGuidelinesManager } from '../../core/overlays/security-guidelines/manager.js';

/**
 * List all security knowledge from O₂ overlay
 *
 * Direct query to O₂ overlay manager (bypasses lattice algebra) to retrieve
 * all security items with optional filtering by type or severity. Provides
 * detailed metadata including severity, CVE IDs, and mitigation strategies.
 *
 * @param options - Command options with filtering
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json'
 * @param options.limit - Maximum items to display
 * @param options.verbose - Enable verbose error output
 * @param options.type - Filter by security type (attack_vector, boundary, etc.)
 * @param options.severity - Filter by severity level
 * @returns Promise that resolves when display is complete
 *
 * @example
 * // List all critical security items
 * await securityListCommand({
 *   projectRoot: '.',
 *   severity: 'critical',
 *   format: 'table'
 * });
 *
 * @example
 * // Export all attack vectors as JSON
 * await securityListCommand({
 *   projectRoot: '.',
 *   type: 'attack_vector',
 *   format: 'json'
 * });
 */
export async function securityListCommand(
  options: SecurityOptions & {
    type?: string;
    severity?: 'critical' | 'high' | 'medium' | 'low';
  }
): Promise<void> {
  intro(chalk.bold('Security: O₂ Overlay Contents'));

  const pgcRoot = path.join(options.projectRoot, '.open_cognition');
  const manager = new SecurityGuidelinesManager(pgcRoot);

  const s = spinner();
  s.start('Loading security knowledge from O₂ overlay');

  try {
    let items = await manager.getAllItems();
    s.stop('Analysis complete');

    if (items.length === 0) {
      log.warn(
        chalk.yellow(
          '\n⚠️  No security knowledge found in O₂ overlay.\n\n' +
            'To populate security overlay:\n' +
            '  1. Add security documentation (SECURITY.md, THREAT_MODEL.md)\n' +
            '  2. Run: cognition-cli genesis:docs docs/security/\n' +
            '  3. Or scan code: cognition-cli overlay generate security-guidelines\n'
        )
      );
      outro(chalk.dim('Security list complete (empty overlay)'));
      return;
    }

    // Filter by type if specified
    if (options.type) {
      items = items.filter(
        (item) => item.metadata.securityType === options.type
      );
    }

    // Filter by severity if specified
    if (options.severity) {
      items = items.filter(
        (item) => item.metadata.severity === options.severity
      );
    }

    const limited = items.slice(0, options.limit || 50);

    if (options.format === 'json') {
      console.log(
        JSON.stringify(
          limited.map((i) => i.metadata),
          null,
          2
        )
      );
    } else {
      log.info(chalk.bold(`\n📋 Security Knowledge (${items.length} items)`));
      if (options.type) {
        log.info(chalk.dim(`   Filtered to type: ${options.type}`));
      }
      if (options.severity) {
        log.info(chalk.dim(`   Filtered to severity: ${options.severity}`));
      }
      log.info(chalk.dim(`   Showing ${limited.length} of ${items.length}\n`));

      limited.forEach((item, i) => {
        const severityColor =
          item.metadata.severity === 'critical'
            ? chalk.red
            : item.metadata.severity === 'high'
              ? chalk.yellow
              : chalk.dim;

        log.info(
          `${i + 1}. ${severityColor(`[${item.metadata.severity.toUpperCase()}]`)} ${item.metadata.securityType}`
        );
        log.info(chalk.dim(`   ${item.metadata.text}`));
        if (item.metadata.cveId) {
          log.info(chalk.cyan(`   CVE: ${item.metadata.cveId}`));
        }
        log.info('');
      });
    }

    outro(chalk.green('✓ Security list complete'));
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
 * List all CVEs tracked in O₂ overlay
 *
 * Retrieves vulnerability information including CVE IDs, affected versions,
 * and mitigation strategies. Enables tracking of known vulnerabilities
 * relevant to the project.
 *
 * @param options - Command options
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json'
 * @param options.limit - Maximum CVEs to display
 * @param options.verbose - Enable verbose error output
 * @returns Promise that resolves when display is complete
 *
 * @example
 * await securityCVEsCommand({
 *   projectRoot: '.',
 *   format: 'table'
 * });
 * // Shows:
 * // CVEs Tracked: 3
 * //
 * // 1. CVE-2024-1234
 * //    SQL injection in user authentication
 * //    Affected: versions 1.0-1.5
 * //    Mitigation: Upgrade to 1.6+ with parameterized queries
 */
export async function securityCVEsCommand(
  options: SecurityOptions
): Promise<void> {
  intro(chalk.bold.red('Security: CVE Tracking'));

  const pgcRoot = path.join(options.projectRoot, '.open_cognition');
  const manager = new SecurityGuidelinesManager(pgcRoot);

  const s = spinner();
  s.start('Loading CVEs from O₂ overlay');

  try {
    const cves = await manager.getCVEs();
    s.stop('Analysis complete');

    if (cves.length === 0) {
      log.warn(
        chalk.yellow(
          '⚠️  No CVEs tracked in O₂ overlay. Add vulnerability documentation to populate.'
        )
      );
      outro(chalk.dim('CVE tracking complete (no CVEs found)'));
      return;
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(cves, null, 2));
    } else {
      log.info(chalk.bold.red(`\n🚨 CVEs Tracked: ${cves.length}\n`));

      cves.slice(0, options.limit || 50).forEach((cve, i) => {
        log.info(
          `${i + 1}. ${chalk.cyan(cve.metadata?.cveId || 'Unknown CVE')}`
        );
        log.info(chalk.dim(`   ${cve.text}`));
        if (cve.metadata?.affectedVersions) {
          log.info(
            chalk.yellow(`   Affected: ${cve.metadata.affectedVersions}`)
          );
        }
        if (cve.metadata?.mitigation) {
          log.info(chalk.green(`   Mitigation: ${cve.metadata.mitigation}`));
        }
        log.info('');
      });
    }

    outro(chalk.green('✓ CVE tracking complete'));
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
 * Query security knowledge with semantic search
 *
 * Performs vector-based semantic search within O₂ overlay to find security
 * items matching the search term. Uses embedding similarity for intelligent
 * matching beyond simple keyword search.
 *
 * @param searchTerm - Natural language query
 * @param options - Command options
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json'
 * @param options.limit - Maximum items to display (default: 10)
 * @param options.verbose - Enable verbose error output
 * @returns Promise that resolves when display is complete
 *
 * @example
 * await securityQueryCommand('authentication bypass', {
 *   projectRoot: '.',
 *   limit: 5
 * });
 * // Shows security items semantically related to authentication bypass,
 * // including attack vectors, mitigations, and constraints
 *
 * @example
 * await securityQueryCommand('data exfiltration', {
 *   projectRoot: '.',
 *   format: 'json'
 * });
 * // Returns JSON array of security items related to data exfiltration
 */
export async function securityQueryCommand(
  searchTerm: string,
  options: SecurityOptions
): Promise<void> {
  intro(chalk.bold(`Security: Query "${searchTerm}"`));

  const pgcRoot = path.join(options.projectRoot, '.open_cognition');
  const manager = new SecurityGuidelinesManager(pgcRoot);

  const s = spinner();
  s.start('Searching security knowledge');

  try {
    const results = await manager.queryKnowledge(searchTerm);
    s.stop('Analysis complete');

    if (results.length === 0) {
      log.warn(
        chalk.yellow(`⚠️  No security knowledge matching "${searchTerm}"`)
      );
      outro(chalk.dim('Query complete (no matches)'));
      return;
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(results, null, 2));
    } else {
      log.info(
        chalk.bold(
          `\n🔍 Security Knowledge Matching "${searchTerm}": ${results.length} items\n`
        )
      );

      results.slice(0, options.limit || 10).forEach((item, i) => {
        const severityColor =
          item.severity === 'critical'
            ? chalk.red
            : item.severity === 'high'
              ? chalk.yellow
              : chalk.dim;

        log.info(
          `${i + 1}. ${severityColor(`[${item.severity?.toUpperCase() || 'UNKNOWN'}]`)} ${item.securityType}`
        );
        log.info(chalk.dim(`   ${item.text}`));
        log.info('');
      });
    }

    outro(chalk.green('✓ Query complete'));
  } catch (error) {
    s.stop('Query failed');
    log.error(chalk.red((error as Error).message));
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}
