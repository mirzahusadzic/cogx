/**
 * Security Sugar Commands
 *
 * Convenience wrappers around lattice algebra for common security queries.
 * These commands translate to lattice expressions for better UX.
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
 * Helper to resolve PGC root with walk-up
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
 * Show security threats aligned with mission principles
 * Translates to: lattice "O2[attack_vector] ~ O4[principle]"
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
 * Show code symbols without security coverage
 * Translates to: lattice "O1 - O2"
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
 * Show security boundaries and constraints
 * Translates to: lattice "O2[boundary] | O2[constraint]"
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
    log.info(chalk.cyan(`  Attack: ${itemA.id}`));
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

// ========================================
// DIRECT O₂ OVERLAY QUERIES
// ========================================

import { SecurityGuidelinesManager } from '../../core/overlays/security-guidelines/manager.js';

/**
 * List all security knowledge in O₂ overlay
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
        log.info(chalk.dim(`   ${truncate(item.metadata.text, 80)}`));
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
        log.info(chalk.dim(`   ${truncate(cve.text, 80)}`));
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
 * Query security knowledge by text search
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
