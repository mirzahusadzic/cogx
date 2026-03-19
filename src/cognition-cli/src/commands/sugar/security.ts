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

import { intro, outro, spinner as clackSpinner, log } from '@clack/prompts';
import chalk from 'chalk';
import path from 'path';
import { createSugarCommand } from './factory.js';
import { SugarCommandOptions } from './types.js';
import { SecurityGuidelinesManager } from '../../core/overlays/security-guidelines/manager.js';

type SecurityOptions = SugarCommandOptions;

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
export const securityAttacksCommand = createSugarCommand({
  name: 'Security: Attacks vs Mission Principles',
  description: 'Finding attack vectors that conflict with mission principles',
  overlayType: 'O2',
  itemLabel: 'alignment',
  pluralItemLabel: 'attack alignments',
  customQuery: 'O2[attack_vector] ~ O4[principle]',
});

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
export const securityCoverageGapsCommand = createSugarCommand({
  name: 'Security: Coverage Gaps',
  description: 'Finding code symbols without security coverage',
  overlayType: 'O1',
  itemLabel: 'gap',
  pluralItemLabel: 'coverage gaps',
  customQuery: 'O1 - O2',
});

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
export const securityBoundariesCommand = createSugarCommand({
  name: 'Security: Boundaries & Constraints',
  description: 'Loading security boundaries and constraints',
  overlayType: 'O2',
  itemLabel: 'boundary',
  pluralItemLabel: 'boundaries and constraints',
  customQuery: 'O2[boundary] | O2[constraint]',
});

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
  const useJson =
    options.format === 'json' || process.env.COGNITION_FORMAT === 'json';

  if (!useJson) {
    intro(chalk.bold('Security: O₂ Overlay Contents'));
  }

  const pgcRoot = path.join(options.projectRoot || '.', '.open_cognition');
  const manager = new SecurityGuidelinesManager(pgcRoot);

  const s = clackSpinner();
  if (!useJson) {
    s.start('Loading security knowledge from O₂ overlay');
  }

  try {
    let items = await manager.getAllItems();
    if (!useJson) {
      s.stop('Analysis complete');
    }

    if (items.length === 0) {
      if (!useJson) {
        log.warn(
          chalk.yellow('\n⚠️  No security knowledge found in O₂ overlay.')
        );
        outro(chalk.dim('Security list complete (empty overlay)'));
      } else {
        console.log(JSON.stringify([], null, 2));
      }
      return;
    }

    if (options.type) {
      items = items.filter(
        (item) => item.metadata.securityType === options.type
      );
    }

    if (options.severity) {
      items = items.filter(
        (item) => item.metadata.severity === options.severity
      );
    }

    const limited = items.slice(0, options.limit || 50);

    if (useJson) {
      console.log(
        JSON.stringify(
          limited.map((i) => i.metadata),
          null,
          2
        )
      );
    } else {
      log.info(chalk.bold(`\n📋 Security Knowledge (${items.length} items)`));
      if (options.type)
        log.info(chalk.dim(`   Filtered to type: ${options.type}`));
      if (options.severity)
        log.info(chalk.dim(`   Filtered to severity: ${options.severity}`));
      log.info(chalk.dim(`   Showing ${limited.length} of ${items.length}\n`));

      limited.forEach((item, i) => {
        const severityColor =
          item.metadata.severity === 'critical'
            ? chalk.red
            : item.metadata.severity === 'high'
              ? chalk.yellow
              : chalk.dim;

        log.info(
          `${i + 1}. ${severityColor(`[${item.metadata.severity?.toUpperCase() || 'UNKNOWN'}]`)} ${item.metadata.securityType}`
        );
        log.info(chalk.dim(`   ${item.metadata.text}`));
        if (item.metadata.cveId)
          log.info(chalk.cyan(`   CVE: ${item.metadata.cveId}`));
        log.info('');
      });
    }

    if (!useJson) {
      outro(chalk.green('✓ Security list complete'));
    }
  } catch (error) {
    if (!useJson) {
      s.stop(`Analysis failed: ${(error as Error).message}`);
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
  const useJson =
    options.format === 'json' || process.env.COGNITION_FORMAT === 'json';

  if (!useJson) {
    intro(chalk.bold.red('Security: CVE Tracking'));
  }

  const pgcRoot = path.join(options.projectRoot || '.', '.open_cognition');
  const manager = new SecurityGuidelinesManager(pgcRoot);

  const s = clackSpinner();
  if (!useJson) {
    s.start('Loading CVEs from O₂ overlay');
  }

  try {
    const cves = await manager.getCVEs();
    if (!useJson) {
      s.stop('Analysis complete');
    }

    if (cves.length === 0) {
      if (!useJson) {
        log.warn(chalk.yellow('⚠️  No CVEs tracked in O₂ overlay.'));
        outro(chalk.dim('CVE tracking complete (no CVEs found)'));
      } else {
        console.log(JSON.stringify([], null, 2));
      }
      return;
    }

    if (useJson) {
      console.log(JSON.stringify(cves, null, 2));
    } else {
      log.info(chalk.bold.red(`\n🚨 CVEs Tracked: ${cves.length}\n`));
      cves.slice(0, options.limit || 50).forEach((cve, i) => {
        log.info(
          `${i + 1}. ${chalk.cyan(cve.metadata?.cveId || 'Unknown CVE')}`
        );
        log.info(chalk.dim(`   ${cve.text}`));
        if (cve.metadata?.affectedVersions)
          log.info(
            chalk.yellow(`   Affected: ${cve.metadata.affectedVersions}`)
          );
        if (cve.metadata?.mitigation)
          log.info(chalk.green(`   Mitigation: ${cve.metadata.mitigation}`));
        log.info('');
      });
    }

    if (!useJson) {
      outro(chalk.green('✓ CVE tracking complete'));
    }
  } catch (error) {
    if (!useJson) {
      s.stop(`Analysis failed: ${(error as Error).message}`);
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
  const useJson =
    options.format === 'json' || process.env.COGNITION_FORMAT === 'json';

  if (!useJson) {
    intro(chalk.bold(`Security: Query "${searchTerm}"`));
  }

  const pgcRoot = path.join(options.projectRoot || '.', '.open_cognition');
  const manager = new SecurityGuidelinesManager(pgcRoot);

  const s = clackSpinner();
  if (!useJson) {
    s.start('Searching security knowledge');
  }

  try {
    const results = await manager.queryKnowledge(searchTerm);
    if (!useJson) {
      s.stop('Analysis complete');
    }

    if (results.length === 0) {
      if (!useJson) {
        log.warn(
          chalk.yellow(`⚠️  No security knowledge matching "${searchTerm}"`)
        );
        outro(chalk.dim('Query complete (no matches)'));
      } else {
        console.log(JSON.stringify([], null, 2));
      }
      return;
    }

    if (useJson) {
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
          `${i + 1}. ${severityColor(`[${item.severity?.toUpperCase() || 'UNKNOWN'}]`)} ${item.type}`
        );
        log.info(chalk.dim(`   ${item.text}`));
        log.info('');
      });
    }

    if (!useJson) {
      outro(chalk.green('✓ Query complete'));
    }
  } catch (error) {
    if (!useJson) {
      s.stop(`Query failed: ${(error as Error).message}`);
    }
    process.exit(1);
  }
}
