/**
 * Architectural Drift Report Command
 *
 * SUPERB WORKFLOW: Architectural Drift Analysis across O1+O4+O7
 *
 * This command analyzes architectural drift and pattern violations:
 * - Coherence decay (symbols drifting from mission)
 * - Pattern violations (naming, structure, conventions)
 * - Boundary violations (layering, separation of concerns)
 * - Consistency issues
 *
 * CROSS-OVERLAY SYNTHESIS:
 * - O1 (Structural): Pattern consistency, architectural roles
 * - O4 (Mission): Mission alignment
 * - O7 (Coherence): Alignment scores and drift detection
 *
 * USE CASES:
 * 1. Architecture Review: "Is our architecture eroding?"
 * 2. Tech Debt Assessment: "Where is drift happening?"
 * 3. Refactoring Planning: "What needs fixing?"
 * 4. Code Quality: "Are patterns being followed?"
 *
 * DRIFT CLASSIFICATION:
 * - Critical: Coherence < 40%, multiple violations
 * - High: Coherence 40-60%, pattern violations
 * - Medium: Coherence 60-75%, minor issues
 * - Low: Coherence > 75%, minimal drift
 *
 * @example
 * // Analyze architectural drift
 * cognition-cli arch drift
 *
 * @example
 * // Export as JSON for reporting
 * cognition-cli arch drift --json
 */

import chalk from 'chalk';

/**
 * Execute architectural drift analysis
 */
export async function archDrift(
  options: {
    json?: boolean;
    projectRoot?: string;
    verbose?: boolean;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PGCManager: any
): Promise<void> {
  const { ArchitecturalDriftOrchestrator } = await import(
    '../core/orchestrators/architectural-drift.js'
  );

  const pgc = new PGCManager(options.projectRoot || process.cwd());
  const orchestrator = new ArchitecturalDriftOrchestrator(pgc);

  if (!options.json) {
    console.log(chalk.bold('\n🏗️  Architectural Drift Report\n'));
  }

  try {
    const analysis = await orchestrator.analyze();

    if (options.json) {
      console.log(JSON.stringify(analysis, null, 2));
      return;
    }

    // ASCII output
    displayAnalysis(analysis);
  } catch (error) {
    console.error(chalk.red('\n❌ Error analyzing architectural drift:'));
    console.error((error as Error).message);
    if (options.verbose || process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Display architectural drift analysis in human-readable format
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function displayAnalysis(analysis: any): void {
  // Overall Drift Level
  const driftColor =
    analysis.driftLevel === 'CRITICAL'
      ? chalk.red.bold
      : analysis.driftLevel === 'HIGH'
        ? chalk.red
        : analysis.driftLevel === 'MEDIUM'
          ? chalk.yellow
          : chalk.green;

  console.log(chalk.bold.cyan('📊 Drift Assessment:'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log();
  console.log(`  ${driftColor(analysis.driftLevel)} drift detected`);
  console.log(
    `  Overall coherence: ${chalk.yellow((analysis.summary.averageCoherence * 100).toFixed(1) + '%')}`
  );
  console.log(
    `  Drifted symbols: ${chalk.red(analysis.summary.driftedCount)}/${analysis.summary.totalSymbols}`
  );
  console.log();

  // Severe Drift (Worst Offenders)
  if (analysis.severeDrift.length > 0) {
    console.log(chalk.bold.red('🚨 Severe Drift (Worst Offenders):'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log();

    for (let i = 0; i < Math.min(5, analysis.severeDrift.length); i++) {
      const item = analysis.severeDrift[i];
      const scorePct = (item.coherence * 100).toFixed(1);

      console.log(
        `  ${i + 1}. ${chalk.red(item.symbol)} ${chalk.dim(`(${item.filePath})`)}`
      );
      console.log(`     Coherence: ${chalk.red(scorePct + '%')}`);
      console.log(chalk.dim(`     Issue: ${item.issue}`));
      console.log(chalk.green(`     → ${item.recommendation}`));
      console.log();
    }

    if (analysis.severeDrift.length > 5) {
      console.log(
        chalk.dim(
          `  ... and ${analysis.severeDrift.length - 5} more (use --json for full list)`
        )
      );
    }
    console.log();
  }

  // Pattern Violations
  if (analysis.patternViolations.length > 0) {
    console.log(chalk.bold.yellow('⚠️  Pattern Violations:'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log();

    for (let i = 0; i < Math.min(5, analysis.patternViolations.length); i++) {
      const violation = analysis.patternViolations[i];
      console.log(
        `  ${i + 1}. ${chalk.yellow(violation.type)}: ${violation.symbol}`
      );
      console.log(chalk.dim(`     ${violation.description}`));
      console.log(chalk.green(`     Fix: ${violation.fix}`));
      console.log();
    }

    if (analysis.patternViolations.length > 5) {
      console.log(
        chalk.dim(`  ... and ${analysis.patternViolations.length - 5} more`)
      );
    }
    console.log();
  }

  // Boundary Violations
  if (analysis.boundaryViolations.length > 0) {
    console.log(chalk.bold.red('🛡️  Boundary Violations:'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log();

    for (let i = 0; i < Math.min(3, analysis.boundaryViolations.length); i++) {
      const violation = analysis.boundaryViolations[i];
      console.log(
        `  ${i + 1}. ${chalk.red(violation.source)} → ${violation.target}`
      );
      console.log(chalk.dim(`     Rule: ${violation.rule}`));
      console.log(chalk.green(`     Fix: ${violation.recommendation}`));
      console.log();
    }

    console.log();
  }

  // Consistency Issues
  if (analysis.consistencyIssues.length > 0) {
    console.log(chalk.bold.gray('📝 Consistency Issues:'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log();

    const issueGroups = groupBy(analysis.consistencyIssues, (i) => i.category);

    for (const [category, issues] of Object.entries(issueGroups)) {
      console.log(`  ${chalk.cyan(category)}: ${issues.length} issue(s)`);
      for (let i = 0; i < Math.min(2, issues.length); i++) {
        console.log(chalk.dim(`    • ${issues[i].description}`));
      }
    }

    console.log();
  }

  // Recommendations
  console.log(chalk.bold('🎯 Recommendations:'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log();

  for (let i = 0; i < Math.min(10, analysis.recommendations.length); i++) {
    const rec = analysis.recommendations[i];
    const priorityColor =
      rec.priority === 'CRITICAL'
        ? chalk.red
        : rec.priority === 'HIGH'
          ? chalk.yellow
          : chalk.dim;

    console.log(
      `  ${i + 1}. ${priorityColor(`[${rec.priority}]`)} ${rec.action}`
    );
  }

  console.log();

  // Overall Assessment
  if (analysis.driftLevel === 'CRITICAL') {
    console.log(
      chalk.red.bold(
        '❌ CRITICAL drift detected - immediate refactoring required'
      )
    );
  } else if (analysis.driftLevel === 'HIGH') {
    console.log(
      chalk.red.bold(
        '⚠️  HIGH drift detected - schedule refactoring sprint'
      )
    );
  } else if (analysis.driftLevel === 'MEDIUM') {
    console.log(
      chalk.yellow.bold(
        '⚠️  MEDIUM drift detected - address high-priority items'
      )
    );
  } else {
    console.log(
      chalk.green.bold(
        '✅ LOW drift detected - architecture is well-maintained'
      )
    );
  }

  console.log();
}

/**
 * Group array by key function
 */
function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const key = keyFn(item);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {} as Record<string, T[]>
  );
}
