/**
 * Security Blast Radius Command: Cross-Overlay Security Impact Analysis
 *
 * Combines O2 (Security Guidelines) + O3 (Lineage Patterns) to show the cascading
 * security impact when a file or symbol is compromised. This workflow answers:
 * "If this code has a security vulnerability, what's the blast radius?"
 *
 * SUPERB WORKFLOW RATIONALE:
 * Individual overlays tell us:
 * - O2: What security threats exist in this file
 * - O3: What depends on this file (blast radius)
 *
 * But the HIGH-VALUE insight comes from combining them:
 * - Which threats exist AND how far they propagate
 * - Critical security paths through the architecture
 * - Data exposure risk assessment
 *
 * USE CASES:
 * 1. Security Audit: "If auth.ts is compromised, what's the impact?"
 * 2. Vulnerability Triage: Prioritize fixes by blast radius
 * 3. Architecture Review: Identify security bottlenecks
 * 4. Incident Response: Understand attack surface during security events
 *
 * ALGORITHM:
 * 1. Query O2 for security threats in target file/symbol
 * 2. Run O3 blast-radius to find all consumers (transitive impact)
 * 3. Identify critical security paths (e.g., auth → database → API)
 * 4. Assess data exposure risk based on dependency chains
 * 5. Generate actionable security recommendations
 *
 * OUTPUT EXAMPLE:
 * ```
 * 🔒 Security Blast Radius: src/auth.ts
 *
 * Threats in this file (O2):
 *   ├─ SQL injection risk (line 47)
 *   ├─ Weak hash algorithm (line 89)
 *   └─ Session token in localStorage (line 134)
 *
 * Blast Radius (O3):
 *   ├─ Direct consumers: 5 files
 *   ├─ Transitive impact: 23 files total
 *   └─ Critical security paths:
 *       1. auth.ts → user.service.ts → database.ts (credential theft → DB access)
 *       2. auth.ts → session.ts → api.gateway.ts (session hijack → API access)
 *
 * Data Exposure Risk: HIGH
 *   - User credentials (passwords, emails)
 *   - Session tokens
 *   - API keys
 *
 * Recommendations:
 *   1. Fix SQL injection immediately (CRITICAL)
 *   2. Audit 23 dependent modules for security assumptions
 * ```
 *
 * @example
 * // Analyze security impact of a file
 * cognition-cli security-blast-radius src/auth.ts
 *
 * @example
 * // Export security analysis as JSON for CI/CD integration
 * cognition-cli security-blast-radius validateToken --json
 */

import chalk from 'chalk';
import type { OverlayItem } from '../core/algebra/overlay-algebra.js';
import type { StructuralMetadata } from '../core/overlays/structural-patterns/manager.js';
import type { SecurityMetadata } from '../core/overlays/security-guidelines/manager.js';
import type { GraphNode } from '../core/graph/types.js';

/**
 * Execute security blast radius analysis
 *
 * This function is called from cli.ts and performs the cross-overlay analysis
 */
export async function analyzeSecurityBlastRadius(
  target: string,
  options: { maxDepth?: string; json?: boolean },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PGCManager: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  GraphTraversal: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SecurityGuidelinesManager: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  StructuralPatternsManager: any
): Promise<void> {
  const pgc = new PGCManager(process.cwd());
  const traversal = new GraphTraversal(pgc);
  const securityManager = new SecurityGuidelinesManager(pgc.pgcRoot);
  const structuralManager = new StructuralPatternsManager(pgc.pgcRoot);

  console.log(
    chalk.bold(`\n🔒 Security Blast Radius: ${chalk.cyan(target)}\n`)
  );

  try {
    // Step 1: Determine if target is a file path or symbol name
    const isFilePath = target.includes('/') || target.includes('.');
    let targetSymbol: string;
    let targetFile: string;

    if (isFilePath) {
      // Target is a file path - need to find symbols in that file
      targetFile = target;
      const symbolsInFile = await structuralManager.getItemsByFile(targetFile);

      if (symbolsInFile.length === 0) {
        console.error(
          chalk.red(
            `\n❌ No symbols found in file '${targetFile}'. File may not be indexed.`
          )
        );
        console.log(
          chalk.dim(
            '\n💡 Make sure to run: cognition-cli overlay generate structural_patterns'
          )
        );
        process.exit(1);
      }

      // Use the first major symbol (class/function) or fallback to any symbol
      const primarySymbol = symbolsInFile.find(
        (s: OverlayItem<StructuralMetadata>) =>
          s.metadata.architecturalRole &&
          !['utility', 'type'].includes(s.metadata.architecturalRole)
      );
      targetSymbol = primarySymbol
        ? primarySymbol.metadata.symbol
        : symbolsInFile[0].metadata.symbol;

      console.log(
        chalk.dim(
          `Analyzing primary symbol: ${chalk.cyan(targetSymbol)} (and ${symbolsInFile.length - 1} other symbols in file)\n`
        )
      );
    } else {
      // Target is a symbol name
      targetSymbol = target;
      const structuralItems = await structuralManager.getAllItems();
      const symbolItem = structuralItems.find(
        (item: OverlayItem<StructuralMetadata>) =>
          item.metadata.symbol === targetSymbol
      );

      if (!symbolItem) {
        console.error(
          chalk.red(
            `\n❌ Symbol '${targetSymbol}' not found in structural patterns.`
          )
        );
        console.log(
          chalk.dim(
            '\n💡 Make sure to run: cognition-cli overlay generate structural_patterns'
          )
        );
        process.exit(1);
      }

      targetFile = symbolItem.metadata.filePath;
    }

    // Step 2: Query O2 for security threats in this file
    console.log(chalk.bold('🔍 Querying O2 (Security Guidelines)...'));

    // Query for threats related to this file/symbol
    const securityQuery = `${targetFile} ${targetSymbol} authentication authorization security vulnerability`;
    const securityResults = await securityManager.query(securityQuery, 10);

    const relevantThreats = securityResults.filter(
      (result: { item: OverlayItem<SecurityMetadata>; similarity: number }) =>
        result.similarity > 0.3 // Threshold for relevance
    );

    // Step 3: Query O3 for blast radius
    console.log(chalk.bold('🎯 Querying O3 (Lineage Patterns)...\n'));
    const blastResult = await traversal.getBlastRadius(targetSymbol, {
      maxDepth: parseInt(options.maxDepth || '3'),
      direction: 'both',
      includeTransitive: true,
    });

    // Step 4: Generate combined security analysis
    if (options.json) {
      const jsonOutput = {
        target: {
          symbol: targetSymbol,
          filePath: targetFile,
        },
        security_threats: {
          count: relevantThreats.length,
          threats: relevantThreats.map(
            (t: {
              item: OverlayItem<SecurityMetadata>;
              similarity: number;
            }) => ({
              type: t.item.metadata.securityType,
              severity: t.item.metadata.severity,
              description: t.item.metadata.text,
              similarity: t.similarity,
              cveId: t.item.metadata.cveId,
              mitigation: t.item.metadata.mitigation,
            })
          ),
        },
        blast_radius: {
          direct_consumers: blastResult.consumers.length,
          transitive_impact: blastResult.metrics.totalImpacted,
          max_depth: Math.max(
            blastResult.metrics.maxConsumerDepth,
            blastResult.metrics.maxDependencyDepth
          ),
          consumers: blastResult.consumers.map((n: GraphNode) => ({
            symbol: n.symbol,
            filePath: n.filePath,
            role: n.architecturalRole,
          })),
          dependencies: blastResult.dependencies.map((n: GraphNode) => ({
            symbol: n.symbol,
            filePath: n.filePath,
            role: n.architecturalRole,
          })),
          critical_paths: blastResult.metrics.criticalPaths.map(
            (p: { path: string[]; depth: number; reason: string }) => ({
              path: p.path,
              depth: p.depth,
              reason: p.reason,
            })
          ),
        },
        risk_assessment: {
          severity:
            relevantThreats.length > 0 && blastResult.metrics.totalImpacted > 10
              ? 'HIGH'
              : relevantThreats.length > 0 &&
                  blastResult.metrics.totalImpacted > 5
                ? 'MEDIUM'
                : 'LOW',
          data_exposure: identifyDataExposure(
            blastResult.consumers,
            blastResult.dependencies
          ),
        },
        recommendations: generateRecommendations(relevantThreats, blastResult),
      };

      console.log(JSON.stringify(jsonOutput, null, 2));
      return;
    }

    // ASCII output
    console.log(
      chalk.green(
        `✓ Target found: ${chalk.cyan(targetFile)} (symbol: ${targetSymbol})`
      )
    );
    console.log();

    // Display security threats from O2
    console.log(chalk.bold.red('⚠️  Threats in this file (O2):'));
    if (relevantThreats.length === 0) {
      console.log(
        chalk.dim('   No specific threats identified in security guidelines.')
      );
      console.log(
        chalk.dim(
          '   This does NOT mean the file is secure - only that no documented threats match.'
        )
      );
    } else {
      for (const threat of relevantThreats) {
        const severityColor =
          threat.item.metadata.severity === 'critical'
            ? chalk.red
            : threat.item.metadata.severity === 'high'
              ? chalk.yellow
              : chalk.dim;

        console.log(
          severityColor(
            `   ├─ ${threat.item.metadata.securityType.toUpperCase()}: ${threat.item.metadata.text.substring(0, 80)}`
          )
        );
        console.log(
          chalk.dim(
            `   │    Severity: ${threat.item.metadata.severity.toUpperCase()} | Relevance: ${(threat.similarity * 100).toFixed(1)}%`
          )
        );
        if (threat.item.metadata.mitigation) {
          console.log(
            chalk.green(
              `   │    Mitigation: ${threat.item.metadata.mitigation}`
            )
          );
        }
        if (threat.item.metadata.cveId) {
          console.log(chalk.cyan(`   │    CVE: ${threat.item.metadata.cveId}`));
        }
      }
    }
    console.log();

    // Display blast radius from O3
    console.log(chalk.bold('📊 Blast Radius (O3):'));
    console.log(
      `   ├─ Direct consumers: ${chalk.yellow(blastResult.consumers.length)}`
    );
    console.log(
      `   ├─ Transitive impact: ${chalk.yellow(blastResult.metrics.totalImpacted)} symbols`
    );
    console.log(
      `   └─ Max traversal depth: ${chalk.yellow(Math.max(blastResult.metrics.maxConsumerDepth, blastResult.metrics.maxDependencyDepth))}`
    );
    console.log();

    // Show critical security paths
    if (blastResult.metrics.criticalPaths.length > 0) {
      console.log(chalk.bold('🔥 Critical Security Paths:'));
      console.log(chalk.dim('   High-impact chains through the codebase:\n'));

      for (const path of blastResult.metrics.criticalPaths.slice(0, 5)) {
        console.log(`   ${chalk.yellow(path.reason)} (depth ${path.depth})`);
        const pathStr = path.path.map((s: string) => chalk.cyan(s)).join(' → ');
        console.log(`      ${pathStr}`);
        console.log();
      }
    }

    // Data exposure assessment
    const dataExposure = identifyDataExposure(
      blastResult.consumers,
      blastResult.dependencies
    );
    if (dataExposure.length > 0) {
      console.log(chalk.bold.red('💀 Data Exposure Risk:'));
      console.log(
        chalk.dim('   If this symbol is compromised, attackers may access:\n')
      );
      for (const exposure of dataExposure) {
        console.log(`   • ${chalk.red(exposure)}`);
      }
      console.log();
    }

    // Generate recommendations
    const recommendations = generateRecommendations(
      relevantThreats,
      blastResult
    );
    console.log(chalk.bold('🎯 Recommendations:'));
    for (let i = 0; i < recommendations.length; i++) {
      console.log(`   ${i + 1}. ${recommendations[i]}`);
    }
    console.log();

    // Risk summary
    const riskLevel =
      relevantThreats.length > 0 && blastResult.metrics.totalImpacted > 10
        ? 'HIGH'
        : relevantThreats.length > 0 && blastResult.metrics.totalImpacted > 5
          ? 'MEDIUM'
          : 'LOW';

    const riskColor =
      riskLevel === 'HIGH'
        ? chalk.red
        : riskLevel === 'MEDIUM'
          ? chalk.yellow
          : chalk.green;

    console.log(
      riskColor(
        `\n📈 Overall Risk Level: ${riskLevel} (${relevantThreats.length} threats × ${blastResult.metrics.totalImpacted} impacted symbols)`
      )
    );
  } catch (error) {
    if ((error as Error).message.includes('not found in graph')) {
      console.error(
        chalk.red(`\n❌ Symbol '${target}' not found in structural patterns.`)
      );
      console.log(
        chalk.dim(
          '\n💡 Make sure to run: cognition-cli overlay generate structural_patterns'
        )
      );
    } else {
      console.error(chalk.red('\n❌ Error analyzing security blast radius:'));
      console.error((error as Error).message);
      if (process.env.DEBUG) {
        console.error(error);
      }
    }
    process.exit(1);
  }
}

/**
 * Identify potential data exposure based on dependency chains
 *
 * Analyzes architectural roles of consumers and dependencies to infer
 * what data might be exposed if this symbol is compromised.
 */
function identifyDataExposure(
  consumers: Array<{ symbol: string; architecturalRole?: string }>,
  dependencies: Array<{ symbol: string; architecturalRole?: string }>
): string[] {
  const exposures = new Set<string>();

  // Check for database access
  if (
    dependencies.some(
      (d) =>
        d.symbol.toLowerCase().includes('database') ||
        d.symbol.toLowerCase().includes('db') ||
        d.symbol.toLowerCase().includes('repository')
    )
  ) {
    exposures.add('Database records (full read/write access)');
  }

  // Check for authentication/session handling
  if (
    dependencies.some(
      (d) =>
        d.symbol.toLowerCase().includes('auth') ||
        d.symbol.toLowerCase().includes('session') ||
        d.symbol.toLowerCase().includes('token')
    )
  ) {
    exposures.add('User credentials and session tokens');
  }

  // Check for API access
  if (
    consumers.some(
      (c) =>
        c.symbol.toLowerCase().includes('api') ||
        c.symbol.toLowerCase().includes('endpoint') ||
        c.symbol.toLowerCase().includes('controller')
    )
  ) {
    exposures.add('API endpoints and external interfaces');
  }

  // Check for admin/privileged operations
  if (
    consumers.some(
      (c) =>
        c.symbol.toLowerCase().includes('admin') ||
        c.symbol.toLowerCase().includes('privilege')
    )
  ) {
    exposures.add('Administrative functions and elevated privileges');
  }

  // Check for user data
  if (
    dependencies.some(
      (d) =>
        d.symbol.toLowerCase().includes('user') ||
        d.symbol.toLowerCase().includes('profile')
    )
  ) {
    exposures.add('User personal information (PII)');
  }

  return Array.from(exposures);
}

/**
 * Generate actionable security recommendations
 *
 * Combines threat severity and blast radius to prioritize remediation.
 */
function generateRecommendations(
  threats: Array<{
    item: {
      metadata: {
        severity: string;
        securityType: string;
        text: string;
        mitigation?: string;
      };
    };
  }>,
  blastResult: {
    metrics: { totalImpacted: number };
    consumers: Array<{ symbol: string }>;
  }
): string[] {
  const recommendations: string[] = [];

  // Critical threats first
  const criticalThreats = threats.filter(
    (t) => t.item.metadata.severity === 'critical'
  );
  if (criticalThreats.length > 0) {
    for (const threat of criticalThreats) {
      if (threat.item.metadata.mitigation) {
        recommendations.push(
          `${chalk.red('CRITICAL')}: ${threat.item.metadata.mitigation}`
        );
      } else {
        recommendations.push(
          `${chalk.red('CRITICAL')}: Address ${threat.item.metadata.securityType} immediately`
        );
      }
    }
  }

  // High threats
  const highThreats = threats.filter(
    (t) => t.item.metadata.severity === 'high'
  );
  if (highThreats.length > 0) {
    recommendations.push(
      `Fix ${highThreats.length} high-severity security issue(s)`
    );
  }

  // Blast radius audit
  if (blastResult.metrics.totalImpacted > 10) {
    recommendations.push(
      `Audit ${blastResult.metrics.totalImpacted} impacted modules for security assumptions`
    );
  }

  // Input validation
  if (
    threats.some((t) =>
      t.item.metadata.text.toLowerCase().includes('injection')
    )
  ) {
    recommendations.push(
      'Implement comprehensive input validation and sanitization'
    );
  }

  // Least privilege
  if (blastResult.consumers.length > 5) {
    recommendations.push(
      'Consider applying principle of least privilege - wide blast radius detected'
    );
  }

  // Default recommendation
  if (recommendations.length === 0) {
    recommendations.push(
      'Perform security code review focusing on input validation and authentication'
    );
    recommendations.push('Document security assumptions for dependent modules');
  }

  return recommendations;
}
