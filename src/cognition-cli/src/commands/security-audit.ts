/**
 * Security Audit Report Command
 *
 * SUPERB WORKFLOW: Comprehensive Security Analysis across O2+O3+O5
 *
 * This command generates a complete security audit report combining:
 * - O2 (Security): All documented threats, vulnerabilities, CVEs
 * - O3 (Lineage): Blast radius for each vulnerability
 * - O5 (Operational): Security-aligned workflow patterns
 *
 * The report provides CTO-level security visibility with developer actionability.
 *
 * SECTIONS:
 * 1. Executive Summary - High-level metrics and risk overview
 * 2. Critical Issues - Vulnerabilities sorted by impact score
 * 3. Attack Surface Analysis - Uncovered symbols and high-risk areas
 * 4. Security Boundaries - Constraint compliance check
 * 5. Recommended Actions - Prioritized remediation steps
 *
 * IMPACT SCORING:
 * Impact Score = (Severity Weight × Blast Radius × Centrality)
 * - Critical: 10 points
 * - High: 7 points
 * - Medium: 4 points
 * - Low: 1 point
 *
 * @example
 * // Generate security audit report
 * cognition-cli security-audit
 *
 * @example
 * // Export as markdown
 * cognition-cli security-audit --output security-report.md
 *
 * @example
 * // JSON output for CI/CD
 * cognition-cli security-audit --json
 */

import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

/**
 * Execute comprehensive security audit
 */
export async function securityAudit(
  options: { output?: string; json?: boolean; projectRoot?: string },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PGCManager: any
): Promise<void> {
  const { SecurityAuditOrchestrator } = await import(
    '../core/orchestrators/security-audit.js'
  );

  const pgc = new PGCManager(options.projectRoot || process.cwd());
  const orchestrator = new SecurityAuditOrchestrator(pgc);

  if (!options.json) {
    console.log(chalk.bold('\n🔒 Security Audit Report\n'));
    console.log(chalk.dim(`Generated: ${new Date().toISOString()}\n`));
  }

  try {
    const report = await orchestrator.generateReport();

    if (options.json) {
      const jsonOutput = JSON.stringify(report, null, 2);
      if (options.output) {
        await fs.writeFile(options.output, jsonOutput, 'utf-8');
        console.log(chalk.green(`✓ Report saved to ${options.output}`));
      } else {
        console.log(jsonOutput);
      }
      return;
    }

    // Markdown output
    const markdown = formatAsMarkdown(report);

    if (options.output) {
      await fs.writeFile(options.output, markdown, 'utf-8');
      console.log(chalk.green(`✓ Report saved to ${options.output}`));
    } else {
      // ASCII output for terminal
      displayReport(report);
    }
  } catch (error) {
    console.error(chalk.red('\n❌ Error generating security audit:'));
    console.error((error as Error).message);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Display security audit report in ASCII format
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function displayReport(report: any): void {
  // Executive Summary
  console.log(chalk.bold.cyan('📊 Executive Summary'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log();
  console.log(
    `  Total threats tracked:     ${chalk.yellow(report.summary.totalThreats)}`
  );
  console.log(
    `  CVEs documented:           ${chalk.yellow(report.summary.cveCount)}`
  );
  console.log(
    `  Attack surface (uncovered): ${chalk.yellow(report.summary.uncoveredSymbols)}`
  );
  console.log(
    `  High-priority issues:      ${chalk.red(report.summary.highPriorityCount)}`
  );
  console.log();

  // Critical Issues
  if (report.criticalIssues.length > 0) {
    console.log(chalk.bold.red('🚨 Critical Issues'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log();

    for (let i = 0; i < Math.min(5, report.criticalIssues.length); i++) {
      const issue = report.criticalIssues[i];
      const severityColor =
        issue.severity === 'critical'
          ? chalk.red
          : issue.severity === 'high'
            ? chalk.yellow
            : chalk.white;

      console.log(
        severityColor(
          `  ${i + 1}. [${issue.severity.toUpperCase()}] ${issue.type}`
        )
      );
      console.log(
        chalk.dim(
          `     ${issue.description.substring(0, 70)}${issue.description.length > 70 ? '...' : ''}`
        )
      );
      console.log(`     Blast Radius: ${chalk.yellow(issue.blastRadius)} symbols`);
      console.log(`     Impact Score: ${chalk.red(issue.impactScore.toFixed(1))}/10`);

      if (issue.affectedPaths && issue.affectedPaths.length > 0) {
        console.log(
          chalk.cyan(`     Affected: ${issue.affectedPaths.slice(0, 3).join(', ')}`)
        );
      }

      if (issue.recommendation) {
        console.log(chalk.green(`     → ${issue.recommendation}`));
      }
      console.log();
    }

    if (report.criticalIssues.length > 5) {
      console.log(
        chalk.dim(
          `  ... and ${report.criticalIssues.length - 5} more (use --json for full list)`
        )
      );
      console.log();
    }
  }

  // Attack Surface Analysis
  console.log(chalk.bold.yellow('🎯 Attack Surface Analysis'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log();
  console.log(
    `  Uncovered symbols:         ${chalk.yellow(report.attackSurface.uncovered.length)}`
  );
  console.log(
    `  High-risk uncovered:       ${chalk.red(report.attackSurface.highRiskUncovered.length)}`
  );

  if (report.attackSurface.highRiskUncovered.length > 0) {
    console.log();
    console.log(chalk.dim('  High-Risk Uncovered Symbols:'));
    for (
      let i = 0;
      i < Math.min(5, report.attackSurface.highRiskUncovered.length);
      i++
    ) {
      const symbol = report.attackSurface.highRiskUncovered[i];
      console.log(`    • ${chalk.cyan(symbol.name)} ${chalk.dim(`(${symbol.filePath})`)}`);
    }
    if (report.attackSurface.highRiskUncovered.length > 5) {
      console.log(
        chalk.dim(
          `    ... and ${report.attackSurface.highRiskUncovered.length - 5} more`
        )
      );
    }
  }
  console.log();

  // Security Boundaries
  console.log(chalk.bold.blue('🛡️  Security Boundaries'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log();
  console.log(
    `  Boundary compliance:       ${chalk.yellow(report.boundaries.healthPercent + '%')}`
  );
  console.log(
    `  Constraints passing:       ${chalk.green(report.boundaries.passing)}/${report.boundaries.total}`
  );

  if (report.boundaries.violations.length > 0) {
    console.log();
    console.log(chalk.dim('  Violations:'));
    for (let i = 0; i < Math.min(3, report.boundaries.violations.length); i++) {
      const violation = report.boundaries.violations[i];
      console.log(
        chalk.red(`    ✗ ${violation.boundary} - ${violation.description}`)
      );
    }
  }
  console.log();

  // Recommended Actions
  console.log(chalk.bold.green('🎯 Recommended Actions'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log();

  for (let i = 0; i < Math.min(10, report.recommendations.length); i++) {
    const rec = report.recommendations[i];
    const priorityColor =
      rec.priority === 'IMMEDIATE'
        ? chalk.red
        : rec.priority === 'THIS_WEEK'
          ? chalk.yellow
          : chalk.dim;

    console.log(
      `  ${i + 1}. ${priorityColor(`[${rec.priority}]`)} ${rec.action}`
    );
  }
  console.log();

  // Overall Risk Score
  const riskColor =
    report.summary.riskScore > 70
      ? chalk.red
      : report.summary.riskScore > 40
        ? chalk.yellow
        : chalk.green;

  console.log(chalk.bold('📈 Overall Risk Assessment'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log();
  console.log(
    `  Risk Score: ${riskColor(report.summary.riskScore + '/100')}`
  );
  console.log();

  if (report.summary.riskScore > 70) {
    console.log(
      chalk.red.bold(
        '⚠️  HIGH RISK - Immediate action required to address critical issues'
      )
    );
  } else if (report.summary.riskScore > 40) {
    console.log(
      chalk.yellow.bold('⚠️  MEDIUM RISK - Review and address high-priority items')
    );
  } else {
    console.log(
      chalk.green.bold('✓ LOW RISK - Continue monitoring security posture')
    );
  }
  console.log();
}

/**
 * Format report as markdown
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatAsMarkdown(report: any): string {
  const lines: string[] = [];

  lines.push('# Security Audit Report');
  lines.push('');
  lines.push(`**Generated**: ${new Date().toISOString()}`);
  lines.push('');

  // Executive Summary
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(`- Total threats tracked: ${report.summary.totalThreats}`);
  lines.push(`- CVEs documented: ${report.summary.cveCount}`);
  lines.push(`- Attack surface (uncovered): ${report.summary.uncoveredSymbols}`);
  lines.push(`- High-priority issues: ${report.summary.highPriorityCount}`);
  lines.push('');

  // Critical Issues
  if (report.criticalIssues.length > 0) {
    lines.push('## Critical Issues');
    lines.push('');

    for (let i = 0; i < report.criticalIssues.length; i++) {
      const issue = report.criticalIssues[i];
      lines.push(`### ${i + 1}. ${issue.type} ⚠️ ${issue.severity.toUpperCase()}`);
      lines.push('');
      lines.push(`**Blast Radius**: ${issue.blastRadius} consumers across ${issue.affectedFiles || 0} files`);
      lines.push(`**Impact Score**: ${issue.impactScore.toFixed(1)}/10`);
      lines.push('');
      lines.push(`**Description**: ${issue.description}`);
      lines.push('');

      if (issue.affectedPaths && issue.affectedPaths.length > 0) {
        lines.push('**Affected Paths**:');
        for (const path of issue.affectedPaths.slice(0, 10)) {
          lines.push(`- ${path}`);
        }
        lines.push('');
      }

      if (issue.recommendation) {
        lines.push('**Remediation**:');
        lines.push('');
        lines.push('```');
        lines.push(issue.recommendation);
        lines.push('```');
        lines.push('');
      }
    }
  }

  // Attack Surface Analysis
  lines.push('## Attack Surface Analysis');
  lines.push('');
  lines.push(`**Uncovered Symbols**: ${report.attackSurface.uncovered.length}`);
  lines.push(
    `**High-Risk Uncovered**: ${report.attackSurface.highRiskUncovered.length}`
  );
  lines.push('');

  if (report.attackSurface.highRiskUncovered.length > 0) {
    lines.push('### High-Risk Uncovered Symbols');
    lines.push('');
    for (const symbol of report.attackSurface.highRiskUncovered) {
      lines.push(`- **${symbol.name}** (${symbol.filePath})`);
    }
    lines.push('');
  }

  lines.push('**Recommendation**: Add security documentation for high-risk symbols');
  lines.push('');

  // Security Boundaries
  lines.push('## Security Boundaries');
  lines.push('');
  lines.push(`**Boundary Health**: ${report.boundaries.healthPercent}%`);
  lines.push(`**Constraints Passing**: ${report.boundaries.passing}/${report.boundaries.total}`);
  lines.push('');

  if (report.boundaries.violations.length > 0) {
    lines.push('### Violations');
    lines.push('');
    for (const violation of report.boundaries.violations) {
      lines.push(`- ✗ **${violation.boundary}** - ${violation.description}`);
    }
    lines.push('');
  }

  // Recommended Actions
  lines.push('## Recommended Actions');
  lines.push('');

  for (let i = 0; i < report.recommendations.length; i++) {
    const rec = report.recommendations[i];
    lines.push(`${i + 1}. **[${rec.priority}]** ${rec.action}`);
  }
  lines.push('');

  // Overall Risk
  lines.push('## Overall Risk Assessment');
  lines.push('');
  lines.push(`**Risk Score**: ${report.summary.riskScore}/100`);
  lines.push('');

  return lines.join('\n');
}
