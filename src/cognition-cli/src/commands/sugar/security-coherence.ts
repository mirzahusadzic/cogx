/**
 * Security Coherence Metrics
 *
 * Measures how well security implementation aligns with security principles.
 * Provides dedicated security-focused coherence tracking.
 */

import { intro, outro, spinner, log } from '@clack/prompts';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { CoherenceAlgebraAdapter } from '../../core/overlays/strategic-coherence/algebra-adapter.js';

interface SecurityCoherenceOptions {
  projectRoot: string;
  format?: 'table' | 'json';
  verbose?: boolean;
}

/**
 * Security coherence metrics interface
 */
interface SecurityCoherenceMetrics {
  // Security class scores
  securityClassScores: Array<{
    className: string;
    filePath: string;
    coherenceScore: number;
    topConcept: string;
    conceptScore: number;
  }>;

  // Mission concept alignments (dynamically extracted from top concepts)
  topMissionConcepts: Array<{
    concept: string;
    alignedClasses: number;
    averageScore: number;
  }>;

  // Implementation coverage
  implementationCoverage: {
    hasTransparencyLog: boolean;
    hasDriftDetector: boolean;
    hasValidator: boolean;
    hasMissionIntegrity: boolean;
    implementedComponents: string[];
  };

  // Overall
  overallSecurityCoherence: number; // Average of all security class scores
  securityClassCount: number;
  medianSecurityScore: number;
}

/**
 * Calculate security coherence metrics
 */
export async function securityCoherenceCommand(
  options: SecurityCoherenceOptions
): Promise<void> {
  intro(chalk.bold.cyan('🔒 Security Coherence Metrics'));

  const pgcRoot = path.join(options.projectRoot, '.open_cognition');
  if (!(await fs.pathExists(pgcRoot))) {
    log.error(
      chalk.red(`PGC not initialized. Run 'cognition-cli init' first.`)
    );
    process.exit(1);
  }

  const s = spinner();
  s.start('Analyzing security implementation alignment');

  try {
    // Load coherence data
    const coherenceAdapter = new CoherenceAlgebraAdapter(pgcRoot);
    const allItems = await coherenceAdapter.getAllItems();

    // Filter to security-related symbols
    const securitySymbols = allItems.filter(
      (item) =>
        item.metadata.filePath.includes('security') ||
        item.metadata.symbolName.toLowerCase().includes('security') ||
        item.metadata.symbolName.toLowerCase().includes('validator') ||
        item.metadata.symbolName.toLowerCase().includes('drift') ||
        item.metadata.symbolName.toLowerCase().includes('transparency')
    );

    s.stop('Analysis complete');

    if (securitySymbols.length === 0) {
      log.warn(
        chalk.yellow(
          '\n⚠️  No security symbols found in coherence overlay.\n\n' +
            'This might indicate:\n' +
            '  1. Security classes not extracted into O₁ structural overlay\n' +
            '  2. O₇ coherence overlay needs regeneration\n' +
            '  3. Security symbols not matching filter criteria\n\n' +
            'Try: cognition-cli overlay generate strategic-coherence --force\n'
        )
      );
      outro(chalk.dim('Security coherence analysis complete (no data)'));
      return;
    }

    // Calculate metrics
    const metrics = await calculateSecurityMetrics(securitySymbols);

    // Display results
    if (options.format === 'json') {
      console.log(JSON.stringify(metrics, null, 2));
    } else {
      displaySecurityCoherenceReport(metrics, options.verbose || false);
    }

    outro(chalk.green('✓ Security coherence analysis complete'));
  } catch (error) {
    s.stop('Analysis failed');
    log.error(chalk.red((error as Error).message));
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

interface CoherenceSymbol {
  metadata: {
    symbolName: string;
    filePath: string;
    coherence?: number;
    topConcept?: string;
    topConceptScore?: number;
  };
}

/**
 * Calculate security coherence metrics
 */
async function calculateSecurityMetrics(
  securitySymbols: CoherenceSymbol[]
): Promise<SecurityCoherenceMetrics> {
  // Extract security class scores
  const securityClassScores = securitySymbols.map((item) => ({
    className: item.metadata.symbolName,
    filePath: item.metadata.filePath,
    coherenceScore: item.metadata.coherence || 0,
    topConcept: item.metadata.topConcept || 'Unknown',
    conceptScore: item.metadata.topConceptScore || 0,
  }));

  // Dynamically group by top concepts to find what security aligns with
  const conceptMap = new Map<string, { scores: number[]; classes: string[] }>();

  for (const cls of securityClassScores) {
    if (!cls.topConcept || cls.topConcept === 'Unknown') continue;

    if (!conceptMap.has(cls.topConcept)) {
      conceptMap.set(cls.topConcept, { scores: [], classes: [] });
    }

    const entry = conceptMap.get(cls.topConcept)!;
    entry.scores.push(cls.coherenceScore);
    entry.classes.push(cls.className);
  }

  // Convert to sorted array of top mission concepts
  const topMissionConcepts = Array.from(conceptMap.entries())
    .map(([concept, data]) => ({
      concept,
      alignedClasses: data.classes.length,
      averageScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
    }))
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 5); // Top 5 mission concepts

  // Check for specific security components
  const implementedComponents: string[] = [];
  const hasTransparencyLog = securitySymbols.some((s) => {
    if (s.metadata.symbolName === 'TransparencyLog') {
      implementedComponents.push('TransparencyLog');
      return true;
    }
    return false;
  });

  const hasDriftDetector = securitySymbols.some((s) => {
    if (s.metadata.symbolName.includes('Drift')) {
      implementedComponents.push(s.metadata.symbolName);
      return true;
    }
    return false;
  });

  const hasValidator = securitySymbols.some((s) => {
    if (s.metadata.symbolName.includes('Validator')) {
      implementedComponents.push(s.metadata.symbolName);
      return true;
    }
    return false;
  });

  const hasMissionIntegrity = securitySymbols.some((s) => {
    if (s.metadata.symbolName.includes('Integrity')) {
      implementedComponents.push(s.metadata.symbolName);
      return true;
    }
    return false;
  });

  // Calculate overall coherence (simple average)
  const overallSecurityCoherence =
    securityClassScores.reduce((sum, s) => sum + s.coherenceScore, 0) /
    securityClassScores.length;

  // Calculate median
  const sorted = [...securityClassScores].sort(
    (a, b) => a.coherenceScore - b.coherenceScore
  );
  const medianSecurityScore =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1].coherenceScore +
          sorted[sorted.length / 2].coherenceScore) /
        2
      : sorted[Math.floor(sorted.length / 2)].coherenceScore;

  return {
    securityClassScores,
    topMissionConcepts,
    implementationCoverage: {
      hasTransparencyLog,
      hasDriftDetector,
      hasValidator,
      hasMissionIntegrity,
      implementedComponents,
    },
    overallSecurityCoherence,
    securityClassCount: securitySymbols.length,
    medianSecurityScore,
  };
}

/**
 * Display security coherence report
 */
function displaySecurityCoherenceReport(
  metrics: SecurityCoherenceMetrics,
  verbose: boolean
): void {
  console.log(chalk.bold('\n📊 Security Coherence Report'));
  console.log(chalk.dim('━'.repeat(80)));

  // Overall score
  const overallColor =
    metrics.overallSecurityCoherence >= 0.7
      ? chalk.green
      : metrics.overallSecurityCoherence >= 0.5
        ? chalk.yellow
        : chalk.red;

  console.log(
    chalk.bold('\nOverall Security Coherence: ') +
      overallColor(`${(metrics.overallSecurityCoherence * 100).toFixed(1)}%`)
  );
  console.log(
    chalk.dim(
      `  ${metrics.securityClassCount} security classes | Median: ${(metrics.medianSecurityScore * 100).toFixed(1)}%`
    )
  );

  // Top mission concepts (dynamically discovered)
  if (metrics.topMissionConcepts.length > 0) {
    console.log(chalk.bold('\n🎯 Top Mission Concept Alignments:'));
    metrics.topMissionConcepts.forEach((concept, i) => {
      const scoreColor = formatScoreColor(concept.averageScore);
      console.log(
        `  ${i + 1}. ${scoreColor(`${(concept.averageScore * 100).toFixed(1)}%`)} - ${concept.concept.slice(0, 60)}${concept.concept.length > 60 ? '...' : ''}`
      );
      console.log(chalk.dim(`     Aligned classes: ${concept.alignedClasses}`));
    });
  } else {
    console.log(
      chalk.yellow(
        '\n⚠️  No mission concept alignments found (classes lack topConcept data)'
      )
    );
  }

  // Implementation coverage
  console.log(chalk.bold('\n⚙️  Security Component Coverage:'));
  const coverage = metrics.implementationCoverage;
  console.log(
    `  TransparencyLog:    ${coverage.hasTransparencyLog ? chalk.green('✓ Implemented') : chalk.red('✗ Missing')}`
  );
  console.log(
    `  Drift Detector:     ${coverage.hasDriftDetector ? chalk.green('✓ Implemented') : chalk.red('✗ Missing')}`
  );
  console.log(
    `  Mission Validator:  ${coverage.hasValidator ? chalk.green('✓ Implemented') : chalk.red('✗ Missing')}`
  );
  console.log(
    `  Mission Integrity:  ${coverage.hasMissionIntegrity ? chalk.green('✓ Implemented') : chalk.red('✗ Missing')}`
  );

  if (coverage.implementedComponents.length > 0) {
    console.log(
      chalk.dim(
        `  Tracked components: ${coverage.implementedComponents.join(', ')}`
      )
    );
  }

  // Security classes
  if (verbose) {
    console.log(chalk.bold('\n🔐 Security Classes (sorted by coherence):'));
    const sorted = [...metrics.securityClassScores].sort(
      (a, b) => b.coherenceScore - a.coherenceScore
    );

    sorted.forEach((cls, i) => {
      const scoreColor = formatScoreColor(cls.coherenceScore);

      console.log(
        `\n  ${i + 1}. ${chalk.cyan(cls.className)} ${chalk.dim(`[${cls.filePath}]`)}`
      );
      console.log(
        `     Coherence: ${scoreColor(`${(cls.coherenceScore * 100).toFixed(1)}%`)}`
      );
      console.log(
        chalk.dim(
          `     Top concept: ${cls.topConcept.slice(0, 60)}${cls.topConcept.length > 60 ? '...' : ''} (${(cls.conceptScore * 100).toFixed(1)}%)`
        )
      );
    });
  } else {
    console.log(
      chalk.dim(
        `\n  Use --verbose to see detailed security class breakdown (${metrics.securityClassCount} classes)`
      )
    );
  }

  // Recommendations
  console.log(chalk.bold('\n💡 Recommendations:'));
  if (metrics.overallSecurityCoherence < 0.7) {
    console.log(
      chalk.yellow(
        '  • Security coherence is below 70% target. Consider adding mission'
      )
    );
    console.log(
      chalk.yellow(
        '    concept references to security class documentation headers.'
      )
    );
  }
  if (!coverage.hasValidator) {
    console.log(
      chalk.red(
        "  • MissionValidator not tracked. Verify it's properly extracted."
      )
    );
  }
  if (!coverage.hasDriftDetector) {
    console.log(
      chalk.red(
        '  • Drift detection not tracked. Verify SemanticDriftDetector is extracted.'
      )
    );
  }
  if (
    metrics.overallSecurityCoherence >= 0.7 &&
    coverage.hasValidator &&
    coverage.hasDriftDetector
  ) {
    console.log(
      chalk.green('  ✓ Security implementation is well-aligned with mission!')
    );
  }
}

/**
 * Get color for score
 */
function formatScoreColor(score: number): (text: string) => string {
  if (score >= 0.7) {
    return chalk.green;
  } else if (score >= 0.5) {
    return chalk.yellow;
  } else {
    return chalk.red;
  }
}
