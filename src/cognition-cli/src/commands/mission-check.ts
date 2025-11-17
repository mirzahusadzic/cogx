/**
 * Mission Alignment Check Command
 *
 * SUPERB WORKFLOW: Feature-Mission Alignment Analysis across O1+O4+O7
 *
 * This command verifies whether a feature aligns with organizational mission,
 * principles, and goals. It answers:
 * - Does this feature serve our mission?
 * - Which principles does it implement?
 * - Are there alignment gaps?
 *
 * CROSS-OVERLAY SYNTHESIS:
 * - O1 (Structural): Feature symbols and implementations
 * - O4 (Mission): Organizational principles, goals, concepts
 * - O7 (Coherence): Strategic alignment scores
 *
 * USE CASES:
 * 1. Product Planning: "Should we build this feature?"
 * 2. Architecture Review: "Does this align with our vision?"
 * 3. Refactoring Decisions: "Which features to sunset?"
 * 4. Team Alignment: "Are we building what matters?"
 *
 * ALIGNMENT SCORING:
 * - High Alignment: >= 70% (well-aligned with principles)
 * - Medium Alignment: 50-70% (partially aligned)
 * - Low Alignment: < 50% (weak or no alignment)
 *
 * @example
 * // Check authentication feature alignment
 * cognition-cli mission check authentication
 *
 * @example
 * // Check specific module
 * cognition-cli mission check SnowflakeClient
 *
 * @example
 * // Export as JSON for reporting
 * cognition-cli mission check data-pipeline --json
 */

import chalk from 'chalk';

/**
 * Execute mission alignment check for a feature
 */
export async function missionCheck(
  featureName: string,
  options: { json?: boolean; projectRoot?: string; verbose?: boolean },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PGCManager: any
): Promise<void> {
  const { MissionAlignmentOrchestrator } = await import(
    '../core/orchestrators/mission-alignment.js'
  );

  const pgc = new PGCManager(options.projectRoot || process.cwd());
  const orchestrator = new MissionAlignmentOrchestrator(pgc);

  if (!options.json) {
    console.log(chalk.bold(`\n🎯 Feature-Mission Alignment: ${chalk.cyan(featureName)}\n`));
  }

  try {
    const analysis = await orchestrator.analyze(featureName);

    if (options.json) {
      console.log(JSON.stringify(analysis, null, 2));
      return;
    }

    // ASCII output
    displayAnalysis(analysis);
  } catch (error) {
    console.error(chalk.red('\n❌ Error analyzing mission alignment:'));
    console.error((error as Error).message);
    if (options.verbose || process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Display mission alignment analysis in human-readable format
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function displayAnalysis(analysis: any): void {
  // Feature Symbols
  console.log(chalk.bold.cyan('📦 Feature Symbols:'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log();

  if (analysis.symbols.length === 0) {
    console.log(chalk.yellow('  No symbols found matching feature name'));
    console.log(chalk.dim('  Try a different search term or check if structural overlay exists'));
    console.log();
    return;
  }

  console.log(`  Found ${chalk.yellow(analysis.symbols.length)} symbols:`);
  console.log();

  for (let i = 0; i < Math.min(5, analysis.symbols.length); i++) {
    const symbol = analysis.symbols[i];
    const scoreBar = '█'.repeat(Math.round(symbol.avgAlignment * 20));
    const scorePct = (symbol.avgAlignment * 100).toFixed(1);
    const scoreColor =
      symbol.avgAlignment >= 0.7
        ? chalk.green
        : symbol.avgAlignment >= 0.5
          ? chalk.yellow
          : chalk.red;

    console.log(
      `  • ${chalk.cyan(symbol.symbolName)} ${chalk.dim(`(${symbol.filePath})`)}`
    );
    console.log(`    ${scoreColor(scoreBar)} ${scorePct}% alignment`);
  }

  if (analysis.symbols.length > 5) {
    console.log(chalk.dim(`  ... and ${analysis.symbols.length - 5} more`));
  }

  console.log();
  console.log(
    `  Average alignment: ${chalk.yellow((analysis.summary.averageAlignment * 100).toFixed(1) + '%')}`
  );
  console.log();

  // Aligned Principles
  if (analysis.alignedPrinciples.length > 0) {
    console.log(chalk.bold.green('✅ Aligned Principles:'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log();

    for (let i = 0; i < Math.min(5, analysis.alignedPrinciples.length); i++) {
      const principle = analysis.alignedPrinciples[i];
      const scorePct = (principle.score * 100).toFixed(1);

      console.log(
        `  ${i + 1}. ${chalk.green(scorePct + '%')} - ${chalk.white(principle.text)}`
      );

      if (principle.implementedBy.length > 0) {
        console.log(
          chalk.dim(
            `     Implemented by: ${principle.implementedBy.slice(0, 3).join(', ')}`
          )
        );
      }
    }

    console.log();
  }

  // Weak Alignments
  if (analysis.weakAlignments.length > 0) {
    console.log(chalk.bold.yellow('⚠️  Weak Alignment:'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log();

    for (let i = 0; i < Math.min(3, analysis.weakAlignments.length); i++) {
      const weak = analysis.weakAlignments[i];
      const scorePct = (weak.score * 100).toFixed(1);

      console.log(
        `  ${chalk.yellow(scorePct + '%')} - ${chalk.white(weak.principle)}`
      );
      console.log(chalk.dim(`     Gap: ${weak.gap}`));
    }

    console.log();
  }

  // Missing Implementations
  if (analysis.missingImplementations.length > 0) {
    console.log(chalk.bold.red('❌ Missing Implementations:'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log();

    for (let i = 0; i < Math.min(3, analysis.missingImplementations.length); i++) {
      const missing = analysis.missingImplementations[i];
      console.log(`  ${i + 1}. ${chalk.red(missing.principle)}`);
      console.log(chalk.dim(`     ${missing.description}`));
      console.log(chalk.green(`     → Recommendation: ${missing.recommendation}`));
      console.log();
    }

    if (analysis.missingImplementations.length > 3) {
      console.log(
        chalk.dim(
          `  ... and ${analysis.missingImplementations.length - 3} more (use --json for full list)`
        )
      );
    }
    console.log();
  }

  // Recommendations
  console.log(chalk.bold('🎯 Recommendations:'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log();

  for (let i = 0; i < Math.min(5, analysis.recommendations.length); i++) {
    const rec = analysis.recommendations[i];
    const priorityColor =
      rec.priority === 'HIGH' ? chalk.red : rec.priority === 'MEDIUM' ? chalk.yellow : chalk.dim;

    console.log(`  ${i + 1}. ${priorityColor(`[${rec.priority}]`)} ${rec.action}`);
  }

  console.log();

  // Overall Assessment
  const alignmentLevel = analysis.summary.alignmentLevel;
  const alignmentColor =
    alignmentLevel === 'HIGH'
      ? chalk.green
      : alignmentLevel === 'MEDIUM'
        ? chalk.yellow
        : chalk.red;

  console.log(chalk.bold('📊 Overall Assessment:'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log();
  console.log(
    `  Alignment Level: ${alignmentColor(alignmentLevel)} (${(analysis.summary.averageAlignment * 100).toFixed(1)}%)`
  );
  console.log(
    `  Principles Satisfied: ${chalk.yellow(analysis.alignedPrinciples.length)}/${analysis.summary.totalPrinciples}`
  );
  console.log();

  if (alignmentLevel === 'HIGH') {
    console.log(
      chalk.green.bold(
        '✅ Strong mission alignment - feature serves organizational goals'
      )
    );
  } else if (alignmentLevel === 'MEDIUM') {
    console.log(
      chalk.yellow.bold(
        '⚠️  Partial alignment - review gaps and consider improvements'
      )
    );
  } else {
    console.log(
      chalk.red.bold(
        '❌ Weak alignment - feature may not serve mission effectively'
      )
    );
  }

  console.log();
}
