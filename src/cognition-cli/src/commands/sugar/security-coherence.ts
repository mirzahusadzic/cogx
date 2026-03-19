/**
 * Security Coherence Metrics (O₇ Specialized Analysis)
 *
 * Provides focused analysis of security implementation alignment with mission
 * principles by filtering O₇ (Strategic Coherence) data to security-related
 * symbols. This enables tracking mission-security integration health.
 *
 * DESIGN RATIONALE:
 * While O₇ provides general code-to-mission coherence, security requires
 * special attention due to:
 * 1. Critical Impact: Security misalignment can violate core mission principles
 * 2. Component Tracking: Specific validators, drift detectors require monitoring
 * 3. Coverage Analysis: Must verify all security mechanisms align with mission
 * 4. Compliance: Security coherence often has threshold requirements
 *
 * MEASURED ASPECTS:
 * - Security class coherence scores (overall alignment with mission)
 * - Top mission concept alignments (which principles guide security?)
 * - Implementation coverage (are key security components present?)
 * - Median vs average scores (detect outliers vs systematic drift)
 *
 * DATA SOURCE:
 * Reads from O₇ (strategic_coherence overlay) and filters to security symbols
 * based on file path patterns and symbol naming conventions.
 *
 * INTEGRATION WITH O₇:
 * This is a specialized view of O₇ data. For general coherence:
 * - Use: `cognition-cli coherence report`
 * For security-specific coherence:
 * - Use: `cognition-cli security-coherence`
 *
 * @example
 * // Analyze security coherence
 * await securityCoherenceCommand({
 *   projectRoot: '.',
 *   format: 'table',
 *   verbose: true
 * });
 * // Shows:
 * // - Overall security coherence score
 * // - Top mission concepts security aligns with
 * // - Security component coverage (validator, drift detector, etc.)
 * // - Detailed per-class breakdown (with --verbose)
 *
 * @example
 * // Export security coherence as JSON for CI/CD
 * await securityCoherenceCommand({
 *   projectRoot: '.',
 *   format: 'json'
 * });
 * // Can be piped to jq for threshold checks:
 * // jq '.overallSecurityCoherence >= 0.7'
 */

/**
 * Security Coherence Metrics (O₇ Specialized Analysis)
 *
 * Provides focused analysis of security implementation alignment with mission
 * principles by filtering O₇ (Strategic Coherence) data to security-related
 * symbols. This enables tracking mission-security integration health.
 *
 * DESIGN RATIONALE:
 * While O₇ provides general code-to-mission coherence, security requires
 * special attention due to:
 * 1. Critical Impact: Security misalignment can violate core mission principles
 * 2. Component Tracking: Specific validators, drift detectors require monitoring
 * 3. Coverage Analysis: Must verify all security mechanisms align with mission
 * 4. Compliance: Security coherence often has threshold requirements
 *
 * MEASURED ASPECTS:
 * - Security class coherence scores (overall alignment with mission)
 * - Top mission concept alignments (which principles guide security?)
 * - Implementation coverage (are key security components present?)
 * - Median vs average scores (detect outliers vs systematic drift)
 *
 * DATA SOURCE:
 * Reads from O₇ (strategic_coherence overlay) and filters to security symbols
 * based on file path patterns and symbol naming conventions.
 *
 * INTEGRATION WITH O₇:
 * This is a specialized view of O₇ data. For general coherence:
 * - Use: `cognition-cli coherence report`
 * For security-specific coherence:
 * - Use: `cognition-cli security-coherence`
 *
 * @example
 * // Analyze security coherence
 * await securityCoherenceCommand({
 *   projectRoot: '.',
 *   format: 'table',
 *   verbose: true
 * });
 * // Shows:
 * // - Overall security coherence score
 * // - Top mission concepts security aligns with
 * // - Security component coverage (validator, drift detector, etc.)
 * // - Detailed per-class breakdown (with --verbose)
 *
 * @example
 * // Export security coherence as JSON for CI/CD
 * await securityCoherenceCommand({
 *   projectRoot: '.',
 *   format: 'json'
 * });
 * // Can be piped to jq for threshold checks:
 * // jq '.overallSecurityCoherence >= 0.7'
 */

import chalk from 'chalk';
import {
  CoherenceAlgebraAdapter,
  CoherenceMetadata,
} from '../../core/overlays/strategic-coherence/algebra-adapter.js';
import { resolvePgcRoot, displayItemList } from './utils.js';
import { createSugarCommand } from './factory.js';
import { OverlayItem } from '../../core/algebra/overlay-algebra.js';
import { SugarCommandOptions } from './types.js';

/**
 * Security coherence metrics command handler
 */
export const securityCoherenceCommand = createSugarCommand({
  name: '🔒 Security Coherence Metrics',
  description:
    'Analyzing security implementation alignment with mission principles',
  overlayType: 'O7',
  itemLabel: 'security symbol',
  pluralItemLabel: 'security symbols',
  customHandler: async (options: SugarCommandOptions) => {
    const pgcRoot = resolvePgcRoot(options.projectRoot || '.');
    const useJson =
      options.format === 'json' || process.env.COGNITION_FORMAT === 'json';

    // Load coherence data
    const coherenceAdapter = new CoherenceAlgebraAdapter(pgcRoot);
    let allItems: OverlayItem<CoherenceMetadata>[] = [];

    try {
      allItems = await coherenceAdapter.getAllItems();
    } finally {
      await coherenceAdapter.close();
    }

    // Filter to security-related symbols
    const securitySymbols = allItems.filter((item) => {
      const metadata = item.metadata as Record<string, unknown>;
      const filePath = (metadata.filePath as string) || '';
      const symbolName = (metadata.symbolName as string) || '';
      return (
        filePath.includes('security') ||
        symbolName.toLowerCase().includes('security') ||
        symbolName.toLowerCase().includes('validator') ||
        symbolName.toLowerCase().includes('drift') ||
        symbolName.toLowerCase().includes('transparency')
      );
    });

    if (securitySymbols.length === 0) {
      if (!useJson) {
        console.log(
          chalk.yellow(
            '\n⚠️  No security symbols found in coherence overlay.\n\n' +
              'Try: cognition-cli overlay generate strategic-coherence --force\n'
          )
        );
      } else {
        console.log(JSON.stringify([], null, 2));
      }
      return;
    }

    // Calculate metrics
    const metrics = calculateSecurityMetrics(securitySymbols);

    // Display results
    if (useJson) {
      console.log(JSON.stringify(metrics, null, 2));
    } else {
      displaySecurityCoherenceReport(metrics);

      // Also show the item list if verbose
      if (options.verbose) {
        console.log(chalk.bold('\n🔐 Security Classes (sorted by coherence):'));
        displayItemList(securitySymbols, 'security symbols', options);
      } else {
        console.log(
          chalk.dim(
            `\n  Use --verbose to see detailed security class breakdown (${securitySymbols.length} symbols)`
          )
        );
      }
    }
  },
});

interface SecurityCoherenceMetrics {
  securityClassScores: Array<{
    className: string;
    filePath: string;
    coherenceScore: number;
    topConcept: string;
    conceptScore: number;
  }>;
  topMissionConcepts: Array<{
    concept: string;
    alignedClasses: number;
    averageScore: number;
  }>;
  implementationCoverage: {
    hasTransparencyLog: boolean;
    hasDriftDetector: boolean;
    hasValidator: boolean;
    hasMissionIntegrity: boolean;
    implementedComponents: string[];
  };
  overallSecurityCoherence: number;
  securityClassCount: number;
  medianSecurityScore: number;
}

/**
 * Calculate security-specific coherence metrics
 *
 * Processes security symbols from O₇ to extract:
 * - Per-class coherence scores
 * - Top mission concept alignments
 * - Security component coverage
 * - Statistical aggregates (mean, median)
 *
 * @param securitySymbols - Filtered security symbols from O₇ coherence data
 * @returns Structured security coherence metrics
 *
 * @example
 * const symbols = allItems.filter(item =>
 *   item.metadata.filePath.includes('security')
 * );
 * const metrics = calculateSecurityMetrics(symbols);
 * // Returns: { overallSecurityCoherence, topMissionConcepts, ... }
 */
function calculateSecurityMetrics(
  securitySymbols: OverlayItem[]
): SecurityCoherenceMetrics {
  // Extract security class scores
  const securityClassScores = securitySymbols.map((item) => {
    const metadata = item.metadata as Record<string, unknown>;
    return {
      className: (metadata.symbolName as string) || item.id,
      filePath: (metadata.filePath as string) || '',
      coherenceScore: (metadata.overallCoherence as number) || 0,
      topConcept: (metadata.topConceptText as string) || 'Unknown',
      conceptScore: (metadata.topConceptScore as number) || 0,
    };
  });

  // Dynamically group by top concepts
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

  const topMissionConcepts = Array.from(conceptMap.entries())
    .map(([concept, data]) => ({
      concept,
      alignedClasses: data.classes.length,
      averageScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
    }))
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 5);

  const implementedComponents: string[] = [];
  const hasTransparencyLog = securitySymbols.some((s) => {
    const metadata = s.metadata as Record<string, unknown>;
    const symbolName = (metadata.symbolName as string) || '';
    if (symbolName === 'TransparencyLog') {
      implementedComponents.push('TransparencyLog');
      return true;
    }
    return false;
  });

  const hasDriftDetector = securitySymbols.some((s) => {
    const metadata = s.metadata as Record<string, unknown>;
    const symbolName = (metadata.symbolName as string) || '';
    if (symbolName.includes('Drift')) {
      implementedComponents.push(symbolName);
      return true;
    }
    return false;
  });

  const hasValidator = securitySymbols.some((s) => {
    const metadata = s.metadata as Record<string, unknown>;
    const symbolName = (metadata.symbolName as string) || '';
    if (symbolName.includes('Validator')) {
      implementedComponents.push(symbolName);
      return true;
    }
    return false;
  });

  const hasMissionIntegrity = securitySymbols.some((s) => {
    const metadata = s.metadata as Record<string, unknown>;
    const symbolName = (metadata.symbolName as string) || '';
    if (symbolName.includes('Integrity')) {
      implementedComponents.push(symbolName);
      return true;
    }
    return false;
  });

  const overallSecurityCoherence =
    securityClassScores.reduce((sum, s) => sum + s.coherenceScore, 0) /
    securityClassScores.length;

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
 * Display formatted security coherence report
 *
 * Renders security coherence metrics with:
 * - Color-coded overall score (green ≥70%, yellow ≥50%, red <50%)
 * - Top mission concepts security aligns with
 * - Component coverage checklist
 * - Actionable recommendations
 * - Optional verbose per-class breakdown
 *
 * @param metrics - Calculated security coherence metrics
 *
 * @example
 * displaySecurityCoherenceReport(metrics);
 * // Shows:
 * // Overall: 78.5% (green)
 * // Top Concepts: ["transparency", "verifiability", ...]
 * // Coverage: ✓ Validator, ✓ Drift Detector, ✗ Transparency Log
 */
function displaySecurityCoherenceReport(
  metrics: SecurityCoherenceMetrics
): void {
  console.log(chalk.bold('\n📊 Security Coherence Summary'));
  console.log(chalk.dim('━'.repeat(80)));

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

  if (metrics.topMissionConcepts.length > 0) {
    console.log(chalk.bold('\n🎯 Top Mission Concept Alignments:'));
    metrics.topMissionConcepts.forEach((concept, i) => {
      const scoreColor = formatScoreColor(concept.averageScore);
      console.log(
        `  ${i + 1}. ${scoreColor(`${(concept.averageScore * 100).toFixed(1)}%`)} - ${concept.concept.slice(0, 60)}${concept.concept.length > 60 ? '...' : ''}`
      );
      console.log(chalk.dim(`     Aligned classes: ${concept.alignedClasses}`));
    });
  }

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

function formatScoreColor(score: number): (text: string) => string {
  if (score >= 0.7) return chalk.green;
  if (score >= 0.5) return chalk.yellow;
  return chalk.red;
}
