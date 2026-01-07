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

import { intro, outro, spinner, log } from '@clack/prompts';
import chalk from 'chalk';
import path from 'path';
import { CoherenceAlgebraAdapter } from '../../core/overlays/strategic-coherence/algebra-adapter.js';
import { WorkspaceManager } from '../../core/workspace-manager.js';

interface SecurityCoherenceOptions {
  projectRoot: string;
  format?: 'table' | 'json';
  verbose?: boolean;
}

/**
 * Resolve Grounded Context Pool (PGC) root directory
 *
 * Walks up the directory tree from startPath to find the nearest
 * .open_cognition workspace.
 *
 * @param startPath - Starting directory for the walk-up search
 * @returns Absolute path to .open_cognition directory
 * @throws {Error} Exits process if no workspace found
 */
function resolvePgcRoot(
  startPath: string,
  options?: SecurityCoherenceOptions
): string {
  const workspaceManager = new WorkspaceManager();
  const projectRoot = workspaceManager.resolvePgcRoot(startPath);

  if (!projectRoot) {
    if (options?.format !== 'json' && process.env.COGNITION_FORMAT !== 'json') {
      log.error(
        chalk.red(
          'No .open_cognition workspace found. Run "cognition-cli init" to create one.'
        )
      );
    }
    process.exit(1);
  }

  return path.join(projectRoot, '.open_cognition');
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
 * Calculate and display security coherence metrics
 *
 * Analyzes how well security implementation aligns with mission principles
 * by filtering O₇ coherence data to security-related symbols. Provides
 * overall scores, component coverage, and alignment insights.
 *
 * ANALYSIS PROCESS:
 * 1. Load all coherence data from O₇
 * 2. Filter to security symbols (file path or name contains security keywords)
 * 3. Calculate aggregate metrics (average, median, component presence)
 * 4. Group by top mission concepts to identify alignment patterns
 * 5. Display formatted report with recommendations
 *
 * @param options - Command options
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json'
 * @param options.verbose - Show detailed per-class breakdown
 * @returns Promise that resolves when analysis is complete
 *
 * @example
 * // Show security coherence report
 * await securityCoherenceCommand({
 *   projectRoot: '.',
 *   format: 'table',
 *   verbose: false
 * });
 *
 * @example
 * // Detailed analysis with all security classes
 * await securityCoherenceCommand({
 *   projectRoot: '.',
 *   verbose: true
 * });
 */
export async function securityCoherenceCommand(
  options: SecurityCoherenceOptions
): Promise<void> {
  const useJson =
    options.format === 'json' || process.env.COGNITION_FORMAT === 'json';

  if (!useJson) {
    intro(chalk.bold.cyan('🔒 Security Coherence Metrics'));
  }

  const pgcRoot = resolvePgcRoot(options.projectRoot, options);

  const s = spinner();
  if (!useJson) {
    s.start('Analyzing security implementation alignment');
  }

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

    if (!useJson) {
      s.stop('Analysis complete');
    }

    if (securitySymbols.length === 0) {
      if (!useJson) {
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
      } else {
        console.log(JSON.stringify([], null, 2));
      }
      return;
    }

    // Calculate metrics
    const metrics = await calculateSecurityMetrics(securitySymbols);

    // Display results
    if (useJson) {
      console.log(JSON.stringify(metrics, null, 2));
    } else {
      displaySecurityCoherenceReport(metrics, options.verbose || false);
    }

    if (!useJson) {
      outro(chalk.green('✓ Security coherence analysis complete'));
    }
  } catch (error) {
    if (!useJson) {
      s.stop('Analysis failed');
      log.error(chalk.red((error as Error).message));
    }
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
 * const metrics = await calculateSecurityMetrics(symbols);
 * // Returns: { overallSecurityCoherence, topMissionConcepts, ... }
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
 * @param verbose - Include detailed per-class scores
 *
 * @example
 * displaySecurityCoherenceReport(metrics, true);
 * // Shows:
 * // Overall: 78.5% (green)
 * // Top Concepts: ["transparency", "verifiability", ...]
 * // Coverage: ✓ Validator, ✓ Drift Detector, ✗ Transparency Log
 * // Classes: MissionValidator (85%), SemanticDriftDetector (72%), ...
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
 * Get color function for coherence score
 *
 * Returns chalk color function based on score thresholds:
 * - Green: ≥70% (well-aligned)
 * - Yellow: ≥50% (needs attention)
 * - Red: <50% (drifted)
 *
 * @param score - Coherence score (0.0 to 1.0)
 * @returns Chalk color function for formatting
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
