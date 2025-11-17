/**
 * Dependency Health Analysis Command
 *
 * SUPERB WORKFLOW: Dependency Health Analysis across O3+O5+O7
 *
 * This command analyzes the health of the dependency graph to identify:
 * - Circular dependencies (code smell, tight coupling)
 * - High-risk dependencies (single points of failure)
 * - Stale dependencies (imported but never used)
 * - Architectural violations
 *
 * CROSS-OVERLAY SYNTHESIS:
 * - O3 (Lineage): Complete dependency graph
 * - O5 (Operational): Dependency management patterns
 * - O1 (Structural): Architectural roles
 *
 * USE CASES:
 * 1. Architecture Review: "Is our dependency structure healthy?"
 * 2. Refactoring Planning: "What circular deps to break?"
 * 3. Risk Assessment: "Which modules are single points of failure?"
 * 4. Code Quality: "What unused imports can we remove?"
 *
 * HEALTH SCORING:
 * - Excellent (90-100): Minimal issues, healthy architecture
 * - Good (70-89): Some issues, manageable
 * - Fair (50-69): Multiple issues, needs attention
 * - Poor (<50): Critical issues, refactoring required
 *
 * @example
 * // Analyze dependency health
 * cognition-cli deps health
 *
 * @example
 * // Show circular dependencies only
 * cognition-cli deps health --show-circular
 *
 * @example
 * // Export as JSON for reporting
 * cognition-cli deps health --json
 */

import chalk from 'chalk';

/**
 * Execute dependency health analysis
 */
export async function depsHealth(
  options: {
    showCircular?: boolean;
    json?: boolean;
    projectRoot?: string;
    verbose?: boolean;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PGCManager: any
): Promise<void> {
  const { DependencyHealthOrchestrator } = await import(
    '../core/orchestrators/dependency-health.js'
  );

  const pgc = new PGCManager(options.projectRoot || process.cwd());
  const orchestrator = new DependencyHealthOrchestrator(pgc);

  if (!options.json) {
    console.log(chalk.bold('\n🏥 Dependency Health Analysis\n'));
  }

  try {
    const analysis = await orchestrator.analyze();

    if (options.json) {
      console.log(JSON.stringify(analysis, null, 2));
      return;
    }

    // ASCII output
    displayAnalysis(analysis, options.showCircular);
  } catch (error) {
    console.error(chalk.red('\n❌ Error analyzing dependency health:'));
    console.error((error as Error).message);
    if (options.verbose || process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Display dependency health analysis in human-readable format
 */
function displayAnalysis(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analysis: any,
  showCircular = false
): void {
  // Health Score
  const scoreColor =
    analysis.healthScore >= 90
      ? chalk.green
      : analysis.healthScore >= 70
        ? chalk.yellow
        : analysis.healthScore >= 50
          ? chalk.red
          : chalk.red.bold;

  console.log(chalk.bold.cyan('📊 Health Score:'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log();
  console.log(`  ${scoreColor(analysis.healthScore + '/100')}`);
  console.log(`  ${analysis.healthLevel}`);
  console.log();

  // High-Risk Dependencies
  if (analysis.highRiskDeps.length > 0) {
    console.log(chalk.bold.red('⚠️  High-Risk Dependencies:'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log(
      chalk.dim('  Modules with high centrality - single points of failure\n')
    );

    for (let i = 0; i < Math.min(5, analysis.highRiskDeps.length); i++) {
      const dep = analysis.highRiskDeps[i];
      console.log(`  ${i + 1}. ${chalk.red(dep.symbol)} ${chalk.dim(`(${dep.filePath})`)}`);
      console.log(`     Centrality: ${chalk.yellow(dep.centrality + '%')} (top ${dep.percentile}%)`);
      console.log(`     Consumers: ${chalk.yellow(dep.consumers)}`);
      console.log(
        chalk.dim(`     Impact: ${dep.impact} - ${dep.recommendation}`)
      );
      console.log();
    }

    if (analysis.highRiskDeps.length > 5) {
      console.log(
        chalk.dim(
          `  ... and ${analysis.highRiskDeps.length - 5} more (use --json for full list)`
        )
      );
      console.log();
    }
  }

  // Circular Dependencies
  if (analysis.circularDeps.length > 0) {
    console.log(chalk.bold.yellow('♻️  Circular Dependencies:'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log(
      chalk.dim('  Modules that depend on each other - tight coupling\n')
    );

    for (let i = 0; i < Math.min(3, analysis.circularDeps.length); i++) {
      const cycle = analysis.circularDeps[i];
      console.log(`  Cycle ${i + 1}: ${chalk.yellow(cycle.path.join(' → '))}`);
      console.log(`  Impact: ${chalk.dim(cycle.impact)}`);
      console.log(`  Recommendation: ${chalk.green(cycle.recommendation)}`);
      console.log();
    }

    if (analysis.circularDeps.length > 3 && showCircular) {
      for (
        let i = 3;
        i < Math.min(10, analysis.circularDeps.length);
        i++
      ) {
        const cycle = analysis.circularDeps[i];
        console.log(`  Cycle ${i + 1}: ${chalk.dim(cycle.path.join(' → '))}`);
      }
      console.log();
    } else if (analysis.circularDeps.length > 3) {
      console.log(
        chalk.dim(
          `  ... and ${analysis.circularDeps.length - 3} more (use --show-circular for full list)`
        )
      );
      console.log();
    }
  } else {
    console.log(chalk.bold.green('✅ No Circular Dependencies'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log();
  }

  // Stale Dependencies
  if (analysis.staleDeps.length > 0) {
    console.log(chalk.bold.gray('🗑️  Stale Dependencies:'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log(chalk.dim('  Imported but never used - can be removed\n'));

    for (let i = 0; i < Math.min(5, analysis.staleDeps.length); i++) {
      const stale = analysis.staleDeps[i];
      console.log(`  • ${chalk.dim(stale.symbol)} in ${chalk.cyan(stale.filePath)}`);
    }

    if (analysis.staleDeps.length > 5) {
      console.log(
        chalk.dim(
          `  ... and ${analysis.staleDeps.length - 5} more`
        )
      );
    }

    console.log();
    console.log(
      chalk.green(`  Potential savings: ${analysis.staleSavings}`)
    );
    console.log();
  }

  // Recommendations
  console.log(chalk.bold('🎯 Recommendations:'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log();

  for (let i = 0; i < Math.min(10, analysis.recommendations.length); i++) {
    const rec = analysis.recommendations[i];
    const priorityColor =
      rec.priority === 'HIGH'
        ? chalk.red
        : rec.priority === 'MEDIUM'
          ? chalk.yellow
          : chalk.dim;

    console.log(
      `  ${i + 1}. ${priorityColor(`[${rec.priority}]`)} ${rec.action}`
    );
  }

  console.log();

  // Overall Assessment
  if (analysis.healthScore >= 90) {
    console.log(
      chalk.green.bold(
        '✅ Excellent dependency health - architecture is well-structured'
      )
    );
  } else if (analysis.healthScore >= 70) {
    console.log(
      chalk.yellow.bold(
        '⚠️  Good dependency health - address high-priority items'
      )
    );
  } else if (analysis.healthScore >= 50) {
    console.log(
      chalk.red.bold(
        '⚠️  Fair dependency health - refactoring recommended'
      )
    );
  } else {
    console.log(
      chalk.red.bold(
        '❌ Poor dependency health - critical refactoring required'
      )
    );
  }

  console.log();
}
