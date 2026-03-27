/**
 * PR Impact Analysis Command
 *
 * SUPERB WORKFLOW: Full PR impact across O1+O2+O3+O4+O7
 *
 * This command is the culmination of the cross-overlay architecture.
 * It answers the question every developer asks before merging:
 * "What is the FULL impact of this PR?"
 *
 * DESIGNED FOR:
 * - PR reviews before merge
 * - CI/CD quality gates
 * - Architecture impact assessment
 * - Security audits
 *
 * @example
 * // Analyze current changes
 * cognition-cli pr-analyze
 *
 * @example
 * // Analyze specific branch
 * cognition-cli pr-analyze --branch feature/auth-refactor
 *
 * @example
 * // Export for CI/CD
 * cognition-cli pr-analyze --json > pr-analysis.json
 */

import chalk from 'chalk';

/**
 * Execute PR impact analysis
 */
export async function analyzePRImpact(
  options: { branch?: string; maxDepth?: string; json?: boolean },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PGCManager: any
): Promise<void> {
  const { PRAnalysisService } =
    await import('../core/services/vcs/pr-analyzer.js');

  const pgc = new PGCManager(process.cwd());
  const analyzer = new PRAnalysisService(pgc);

  if (!options.json) {
    console.log(chalk.bold('\n📊 PR Impact Analysis\n'));
    if (options.branch) {
      console.log(chalk.dim(`Branch: ${options.branch}\n`));
    }
  }

  try {
    const analysis = await analyzer.analyze({
      branch: options.branch,
      maxDepth: options.maxDepth ? parseInt(options.maxDepth) : 3,
    });

    if (options.json) {
      console.log(JSON.stringify(analysis, null, 2));
      return;
    }

    // ASCII output
    displayAnalysis(analysis);
  } catch (error) {
    if (!options.json) {
      console.error(chalk.red('\n❌ Error analyzing PR:'));
      console.error((error as Error).message);
      if (process.env.DEBUG) {
        console.error(error);
      }
    }
    process.exit(1);
  }
}

/**
 * Display analysis in human-readable format
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function displayAnalysis(analysis: any): void {
  // Structural Changes (O1)
  console.log(chalk.bold.cyan('📦 Structural Changes (O1):'));
  console.log(
    `   ├─ Files changed: ${chalk.yellow(analysis.structural.filesChanged)}`
  );
  console.log(
    `   ├─ Modules added: ${chalk.yellow(analysis.structural.modulesAdded.length)}`
  );
  console.log(
    `   ├─ Functions modified: ${chalk.yellow(analysis.structural.functionsModified.length)}`
  );
  console.log(
    `   └─ Classes updated: ${chalk.yellow(analysis.structural.classesUpdated.length)}`
  );
  console.log();

  // Security Review (O2)
  const riskColor =
    analysis.security.riskLevel === 'CRITICAL'
      ? chalk.red
      : analysis.security.riskLevel === 'HIGH'
        ? chalk.yellow
        : analysis.security.riskLevel === 'MEDIUM'
          ? chalk.yellow
          : chalk.green;

  console.log(chalk.bold.red('🔒 Security Review (O2):'));
  console.log(`   ├─ Risk level: ${riskColor(analysis.security.riskLevel)}`);
  console.log(
    `   └─ Threats detected: ${chalk.yellow(analysis.security.threats.length)}`
  );

  if (analysis.security.threats.length > 0) {
    console.log();
    for (let i = 0; i < Math.min(3, analysis.security.threats.length); i++) {
      const threat = analysis.security.threats[i];
      const severityColor =
        threat.severity === 'critical'
          ? chalk.red
          : threat.severity === 'high'
            ? chalk.yellow
            : chalk.dim;

      console.log(
        `   ${severityColor(`⚠️  [${threat.severity.toUpperCase()}]`)} ${threat.type}`
      );
      console.log(chalk.dim(`      ${threat.description.substring(0, 60)}...`));
      console.log(chalk.green(`      → ${threat.recommendation}`));
    }

    if (analysis.security.threats.length > 3) {
      console.log(
        chalk.dim(
          `   ... and ${analysis.security.threats.length - 3} more (use --json for full list)`
        )
      );
    }
  }
  console.log();

  // Blast Radius (O3)
  console.log(chalk.bold.magenta('💥 Blast Radius (O3):'));
  console.log(
    `   ├─ Direct consumers: ${chalk.yellow(analysis.blastRadius.directConsumers)}`
  );
  console.log(
    `   ├─ Transitive impact: ${chalk.yellow(analysis.blastRadius.transitiveImpact)} symbols`
  );
  console.log(
    `   └─ Critical paths: ${chalk.yellow(analysis.blastRadius.criticalPaths.length)}`
  );

  if (analysis.blastRadius.criticalPaths.length > 0) {
    console.log();
    for (
      let i = 0;
      i < Math.min(2, analysis.blastRadius.criticalPaths.length);
      i++
    ) {
      const path = analysis.blastRadius.criticalPaths[i];
      console.log(`   ${chalk.yellow(path.reason)} (depth ${path.depth})`);
      const pathStr = path.path.map((s: string) => chalk.cyan(s)).join(' → ');
      console.log(`      ${pathStr}`);
    }
  }
  console.log();

  // Mission Alignment (O4)
  console.log(chalk.bold.blue('🎯 Mission Alignment (O4):'));
  const alignmentColor = analysis.missionAlignment.aligned
    ? chalk.green
    : chalk.yellow;
  console.log(
    `   ├─ Aligned: ${alignmentColor(analysis.missionAlignment.aligned ? 'Yes' : 'No')}`
  );
  console.log(
    `   ├─ Confidence: ${chalk.yellow(analysis.missionAlignment.confidence + '%')}`
  );
  console.log(
    `   └─ Matching concepts: ${chalk.yellow(analysis.missionAlignment.matchingConcepts.length)}`
  );

  if (analysis.missionAlignment.matchingConcepts.length > 0) {
    console.log();
    for (
      let i = 0;
      i < Math.min(3, analysis.missionAlignment.matchingConcepts.length);
      i++
    ) {
      console.log(
        `   • ${chalk.cyan(analysis.missionAlignment.matchingConcepts[i])}`
      );
    }
  }
  console.log();

  // Coherence Impact (O7)
  console.log(chalk.bold.green('📈 Coherence Impact (O7):'));
  const trendColor =
    analysis.coherenceImpact.trend === 'IMPROVING'
      ? chalk.green
      : analysis.coherenceImpact.trend === 'DEGRADING'
        ? chalk.red
        : chalk.yellow;

  console.log(
    `   ├─ Before: ${chalk.yellow(analysis.coherenceImpact.before.alignedCount)} aligned, ` +
      `${chalk.yellow(analysis.coherenceImpact.before.driftedCount)} drifted`
  );
  console.log(
    `   ├─ After:  ${chalk.yellow(analysis.coherenceImpact.after.alignedCount)} aligned, ` +
      `${chalk.yellow(analysis.coherenceImpact.after.driftedCount)} drifted`
  );
  console.log(
    `   ├─ Delta:  ${analysis.coherenceImpact.delta.alignedDelta > 0 ? chalk.green('+' + analysis.coherenceImpact.delta.alignedDelta) : chalk.red(analysis.coherenceImpact.delta.alignedDelta)} symbols`
  );
  console.log(`   └─ Trend:  ${trendColor(analysis.coherenceImpact.trend)}`);
  console.log();

  // Recommendations
  console.log(chalk.bold('🎯 Recommendations:'));
  for (let i = 0; i < analysis.recommendations.length; i++) {
    const rec = analysis.recommendations[i];
    const icon = rec.includes('CRITICAL')
      ? '🚨'
      : rec.includes('good')
        ? '✅'
        : '💡';
    console.log(`   ${i + 1}. ${icon} ${rec}`);
  }
  console.log();

  // Overall Assessment
  const mergeableColor = analysis.mergeable ? chalk.green : chalk.red;
  const riskScoreColor =
    analysis.riskScore > 80
      ? chalk.red
      : analysis.riskScore > 50
        ? chalk.yellow
        : chalk.green;

  console.log(chalk.bold('📋 Overall Assessment:'));
  console.log(
    `   ├─ Mergeable: ${mergeableColor(analysis.mergeable ? 'Yes ✓' : 'No ✗')}`
  );
  console.log(
    `   └─ Risk score: ${riskScoreColor(analysis.riskScore + '/100')}`
  );
  console.log();

  // Final verdict
  if (analysis.mergeable) {
    if (analysis.riskScore < 30) {
      console.log(chalk.green.bold('✅ Low risk - PR looks good to merge!'));
    } else if (analysis.riskScore < 60) {
      console.log(
        chalk.yellow.bold(
          '⚠️  Medium risk - review recommendations before merging'
        )
      );
    } else {
      console.log(
        chalk.yellow.bold('⚠️  Higher risk - thorough review recommended')
      );
    }
  } else {
    console.log(
      chalk.red.bold('🚫 Not mergeable - address critical issues first')
    );
  }
}
