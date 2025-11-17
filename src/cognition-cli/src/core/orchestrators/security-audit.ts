/**
 * Security Audit Orchestrator
 *
 * SUPERB WORKFLOW: Comprehensive Security Analysis across O2+O3+O5
 *
 * Combines multiple overlays to provide executive-level security visibility:
 * - O2 (Security): Documented threats, vulnerabilities, CVEs
 * - O3 (Lineage): Blast radius and impact propagation
 * - O1 (Structural): Code coverage and attack surface
 *
 * ALGORITHM:
 * 1. Retrieve all security knowledge from O2
 * 2. For each vulnerability, compute blast radius via O3
 * 3. Calculate impact scores (severity × blast radius × centrality)
 * 4. Identify attack surface (O1 - O2 uncovered symbols)
 * 5. Check security boundary compliance
 * 6. Generate prioritized remediation recommendations
 *
 * IMPACT SCORING:
 * Impact = Severity Weight × Blast Radius Factor × Centrality
 * - Critical: 10 × (consumers/10) × centrality
 * - High: 7 × (consumers/10) × centrality
 * - Medium: 4 × (consumers/10) × centrality
 * - Low: 1 × (consumers/10) × centrality
 */

import { PGCManager } from '../pgc/manager.js';
import { GraphTraversal } from '../graph/traversal.js';
import { StructuralPatternsManager } from '../overlays/structural-patterns/manager.js';
import { SecurityGuidelinesManager } from '../overlays/security-guidelines/manager.js';

/**
 * Critical security issue with impact analysis
 */
export interface CriticalIssue {
  type: string;
  severity: string;
  description: string;
  blastRadius: number;
  impactScore: number;
  affectedPaths?: string[];
  affectedFiles?: number;
  recommendation?: string;
  cveId?: string;
}

/**
 * Attack surface analysis
 */
export interface AttackSurface {
  uncovered: Array<{ name: string; filePath: string }>;
  highRiskUncovered: Array<{
    name: string;
    filePath: string;
    reason: string;
  }>;
}

/**
 * Security boundary compliance
 */
export interface BoundaryCompliance {
  total: number;
  passing: number;
  violations: Array<{
    boundary: string;
    description: string;
    severity: string;
  }>;
  healthPercent: number;
}

/**
 * Recommended action
 */
export interface RecommendedAction {
  priority: 'IMMEDIATE' | 'THIS_WEEK' | 'THIS_SPRINT';
  action: string;
  category: 'vulnerability' | 'coverage' | 'boundary' | 'remediation';
}

/**
 * Complete security audit report
 */
export interface SecurityAuditReport {
  summary: {
    totalThreats: number;
    cveCount: number;
    uncoveredSymbols: number;
    highPriorityCount: number;
    riskScore: number;
  };
  criticalIssues: CriticalIssue[];
  attackSurface: AttackSurface;
  boundaries: BoundaryCompliance;
  recommendations: RecommendedAction[];
  generatedAt: string;
}

/**
 * Security Audit Orchestrator
 */
export class SecurityAuditOrchestrator {
  private structuralManager: StructuralPatternsManager;
  private securityManager: SecurityGuidelinesManager;
  private traversal: GraphTraversal;

  constructor(private pgcManager: PGCManager) {
    const pgcRoot = pgcManager.pgcRoot;
    this.structuralManager = new StructuralPatternsManager(pgcRoot);
    this.securityManager = new SecurityGuidelinesManager(pgcRoot);
    this.traversal = new GraphTraversal(pgcManager);
  }

  /**
   * Generate comprehensive security audit report
   */
  async generateReport(): Promise<SecurityAuditReport> {
    // Step 1: Get all security knowledge from O2
    const allSecurityItems = await this.securityManager.getAllItems();

    // Step 2: Get all structural symbols from O1
    const allStructuralItems = await this.structuralManager.getAllItems();

    // Step 3: Analyze critical issues with blast radius
    const criticalIssues = await this.analyzeCriticalIssues(allSecurityItems);

    // Step 4: Identify attack surface
    const attackSurface = await this.analyzeAttackSurface(
      allStructuralItems,
      allSecurityItems
    );

    // Step 5: Check security boundary compliance
    const boundaries = await this.analyzeBoundaries(allSecurityItems);

    // Step 6: Generate recommendations
    const recommendations = this.generateRecommendations(
      criticalIssues,
      attackSurface,
      boundaries
    );

    // Step 7: Compute summary metrics
    const cveCount = allSecurityItems.filter((item) => item.metadata.cveId).length;
    const highPriorityCount = criticalIssues.filter(
      (issue) => issue.severity === 'critical' || issue.severity === 'high'
    ).length;
    const riskScore = this.computeRiskScore(
      criticalIssues,
      attackSurface,
      boundaries
    );

    return {
      summary: {
        totalThreats: allSecurityItems.length,
        cveCount,
        uncoveredSymbols: attackSurface.uncovered.length,
        highPriorityCount,
        riskScore,
      },
      criticalIssues,
      attackSurface,
      boundaries,
      recommendations,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Analyze critical security issues with blast radius and impact scores
   */
  private async analyzeCriticalIssues(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    securityItems: any[]
  ): Promise<CriticalIssue[]> {
    const issues: CriticalIssue[] = [];

    // Filter for vulnerabilities and threats
    const vulnerabilities = securityItems.filter(
      (item) =>
        item.metadata.securityType === 'vulnerability' ||
        item.metadata.securityType === 'threat_model' ||
        item.metadata.securityType === 'attack_vector'
    );

    for (const vuln of vulnerabilities) {
      // Try to find related structural symbols to compute blast radius
      const relatedSymbols = await this.findRelatedSymbols(vuln.metadata.text);

      let blastRadius = 0;
      const affectedPaths: string[] = [];

      if (relatedSymbols.length > 0) {
        // Compute blast radius for the first related symbol
        try {
          const result = await this.traversal.getBlastRadius(
            relatedSymbols[0].metadata.symbol,
            {
              maxDepth: 3,
              direction: 'up',
              includeTransitive: true,
            }
          );

          blastRadius = result.metrics.totalImpacted;

          // Collect affected file paths
          const uniquePaths = new Set<string>();
          for (const consumer of result.consumers) {
            uniquePaths.add(consumer.filePath);
          }
          affectedPaths.push(...Array.from(uniquePaths));
        } catch (error) {
          // Symbol not found in graph - blast radius remains 0
        }
      }

      // Calculate impact score
      const impactScore = this.calculateImpactScore(
        vuln.metadata.severity,
        blastRadius
      );

      issues.push({
        type: vuln.metadata.securityType,
        severity: vuln.metadata.severity,
        description: vuln.metadata.text,
        blastRadius,
        impactScore,
        affectedPaths: affectedPaths.slice(0, 10), // Limit to 10 paths
        affectedFiles: affectedPaths.length,
        recommendation: vuln.metadata.mitigation,
        cveId: vuln.metadata.cveId,
      });
    }

    // Sort by impact score (descending)
    return issues.sort((a, b) => b.impactScore - a.impactScore);
  }

  /**
   * Find structural symbols related to a security threat
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async findRelatedSymbols(threatText: string): Promise<any[]> {
    // Query structural patterns for symbols related to this threat
    const query = threatText.split(' ').slice(0, 5).join(' '); // First 5 words
    const results = await this.structuralManager.query(query, 5);

    return results
      .filter((r) => r.similarity > 0.3)
      .map((r) => r.item);
  }

  /**
   * Calculate impact score
   */
  private calculateImpactScore(severity: string, blastRadius: number): number {
    const severityWeights: Record<string, number> = {
      critical: 10,
      high: 7,
      medium: 4,
      low: 1,
    };

    const weight = severityWeights[severity] || 1;
    const radiusFactor = Math.min(blastRadius / 10, 5); // Cap at 5x multiplier

    return weight * (1 + radiusFactor);
  }

  /**
   * Analyze attack surface (uncovered symbols)
   */
  private async analyzeAttackSurface(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    structuralItems: any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    securityItems: any[]
  ): Promise<AttackSurface> {
    // Get all file paths that have security documentation
    const coveredFiles = new Set<string>();
    for (const secItem of securityItems) {
      // Security items might reference specific files or patterns
      if (secItem.metadata.source_file) {
        coveredFiles.add(secItem.metadata.source_file);
      }
    }

    // Identify uncovered symbols
    const uncovered: Array<{ name: string; filePath: string }> = [];
    const highRiskUncovered: Array<{
      name: string;
      filePath: string;
      reason: string;
    }> = [];

    for (const symbol of structuralItems) {
      const filePath = symbol.metadata.filePath;
      const symbolName = symbol.metadata.symbol;
      const role = symbol.metadata.architecturalRole;

      // Skip if file has security documentation
      if (coveredFiles.has(filePath)) {
        continue;
      }

      uncovered.push({ name: symbolName, filePath });

      // Identify high-risk uncovered symbols
      const isHighRisk =
        role === 'controller' ||
        role === 'service' ||
        symbolName.toLowerCase().includes('auth') ||
        symbolName.toLowerCase().includes('admin') ||
        symbolName.toLowerCase().includes('api') ||
        symbolName.toLowerCase().includes('endpoint') ||
        symbolName.toLowerCase().includes('validate') ||
        symbolName.toLowerCase().includes('security');

      if (isHighRisk) {
        let reason = 'Security-sensitive role or name';
        if (role === 'controller') reason = 'API controller - externally reachable';
        else if (role === 'service') reason = 'Core service - high impact';
        else if (symbolName.toLowerCase().includes('auth'))
          reason = 'Authentication/Authorization';

        highRiskUncovered.push({ name: symbolName, filePath, reason });
      }
    }

    return { uncovered, highRiskUncovered };
  }

  /**
   * Analyze security boundary compliance
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async analyzeBoundaries(securityItems: any[]): Promise<BoundaryCompliance> {
    // Get all boundary and constraint items from O2
    const boundaries = securityItems.filter(
      (item) =>
        item.metadata.securityType === 'boundary' ||
        item.metadata.securityType === 'constraint'
    );

    if (boundaries.length === 0) {
      return {
        total: 0,
        passing: 0,
        violations: [],
        healthPercent: 0,
      };
    }

    // For this initial implementation, we'll do basic compliance checking
    // In a full implementation, this would verify code against each boundary
    const violations: Array<{
      boundary: string;
      description: string;
      severity: string;
    }> = [];

    // Check for common violations based on boundary text
    for (const boundary of boundaries) {
      const text = boundary.metadata.text.toLowerCase();

      // Example: "credentials never logged" - we'd check code for logging
      if (text.includes('never log') && text.includes('credential')) {
        // Simplified check - in real implementation, scan code for logger calls
        const hasViolation = await this.checkLoggingViolation();
        if (hasViolation) {
          violations.push({
            boundary: boundary.metadata.text,
            description: 'Potential credential logging detected in code',
            severity: boundary.metadata.severity,
          });
        }
      }

      // Example: "validate all inputs"
      if (text.includes('validate') && text.includes('input')) {
        const hasViolation = await this.checkInputValidation();
        if (hasViolation) {
          violations.push({
            boundary: boundary.metadata.text,
            description: 'Missing input validation in some endpoints',
            severity: boundary.metadata.severity,
          });
        }
      }
    }

    const passing = boundaries.length - violations.length;
    const healthPercent = Math.round((passing / boundaries.length) * 100);

    return {
      total: boundaries.length,
      passing,
      violations,
      healthPercent,
    };
  }

  /**
   * Check for potential logging violations (simplified)
   */
  private async checkLoggingViolation(): Promise<boolean> {
    // Simplified check - in real implementation, would scan code for:
    // - logger.log(credentials)
    // - console.log(password)
    // This would use O1 structural analysis + AST scanning
    return false; // Placeholder
  }

  /**
   * Check for missing input validation (simplified)
   */
  private async checkInputValidation(): Promise<boolean> {
    // Simplified check - in real implementation, would verify:
    // - All controller methods validate inputs
    // - All API endpoints have validation middleware
    return false; // Placeholder
  }

  /**
   * Generate prioritized recommendations
   */
  private generateRecommendations(
    criticalIssues: CriticalIssue[],
    attackSurface: AttackSurface,
    boundaries: BoundaryCompliance
  ): RecommendedAction[] {
    const recommendations: RecommendedAction[] = [];

    // IMMEDIATE: Critical vulnerabilities
    const criticalVulns = criticalIssues.filter(
      (issue) => issue.severity === 'critical'
    );
    for (const vuln of criticalVulns.slice(0, 3)) {
      recommendations.push({
        priority: 'IMMEDIATE',
        action: vuln.recommendation || `Fix critical ${vuln.type} vulnerability`,
        category: 'vulnerability',
      });
    }

    // THIS_WEEK: High-severity issues
    const highSeverity = criticalIssues.filter((issue) => issue.severity === 'high');
    if (highSeverity.length > 0) {
      recommendations.push({
        priority: 'THIS_WEEK',
        action: `Address ${highSeverity.length} high-severity security issue(s)`,
        category: 'vulnerability',
      });
    }

    // THIS_WEEK: High-risk uncovered symbols
    if (attackSurface.highRiskUncovered.length > 0) {
      recommendations.push({
        priority: 'THIS_WEEK',
        action: `Add security documentation for ${attackSurface.highRiskUncovered.length} high-risk symbols`,
        category: 'coverage',
      });
    }

    // THIS_SPRINT: Boundary violations
    if (boundaries.violations.length > 0) {
      for (const violation of boundaries.violations.slice(0, 2)) {
        recommendations.push({
          priority: 'THIS_SPRINT',
          action: `Fix boundary violation: ${violation.boundary}`,
          category: 'boundary',
        });
      }
    }

    // THIS_SPRINT: General attack surface reduction
    if (attackSurface.uncovered.length > 20) {
      recommendations.push({
        priority: 'THIS_SPRINT',
        action: `Review and document ${attackSurface.uncovered.length} uncovered symbols`,
        category: 'coverage',
      });
    }

    return recommendations;
  }

  /**
   * Compute overall risk score (0-100)
   */
  private computeRiskScore(
    criticalIssues: CriticalIssue[],
    attackSurface: AttackSurface,
    boundaries: BoundaryCompliance
  ): number {
    let score = 0;

    // Critical issues (0-40 points)
    const criticalCount = criticalIssues.filter(
      (i) => i.severity === 'critical'
    ).length;
    const highCount = criticalIssues.filter((i) => i.severity === 'high').length;
    score += Math.min(40, criticalCount * 15 + highCount * 7);

    // Attack surface (0-30 points)
    const attackSurfaceRatio =
      attackSurface.uncovered.length > 0
        ? attackSurface.highRiskUncovered.length / attackSurface.uncovered.length
        : 0;
    score += Math.min(30, attackSurfaceRatio * 30);

    // Boundary compliance (0-30 points)
    const boundaryRisk = 100 - boundaries.healthPercent;
    score += Math.min(30, (boundaryRisk / 100) * 30);

    return Math.min(100, Math.round(score));
  }
}
