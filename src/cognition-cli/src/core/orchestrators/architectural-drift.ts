/**
 * Architectural Drift Orchestrator
 *
 * SUPERB WORKFLOW: Architectural Drift Analysis across O1+O4+O7
 *
 * Analyzes architectural health by detecting:
 * 1. Coherence decay (symbols drifting from mission)
 * 2. Pattern violations (naming, structure)
 * 3. Boundary violations (layering rules)
 * 4. Consistency issues (documentation, types)
 *
 * DRIFT DETECTION ALGORITHM:
 * 1. Get coherence scores from O7 (strategic alignment)
 * 2. Identify symbols below bottom quartile (severe drift)
 * 3. Analyze patterns from O1 for consistency
 * 4. Check architectural role boundaries
 * 5. Generate prioritized recommendations
 *
 * DRIFT LEVELS:
 * - CRITICAL: avg_coherence < 0.4 OR >20% severe drift
 * - HIGH: avg_coherence 0.4-0.6 OR 10-20% severe drift
 * - MEDIUM: avg_coherence 0.6-0.75 OR 5-10% drift
 * - LOW: avg_coherence > 0.75
 */

import { PGCManager } from '../pgc/manager.js';
import { StructuralPatternsManager } from '../overlays/structural-patterns/manager.js';
import { MissionConceptsManager } from '../overlays/mission-concepts/manager.js';
import { StrategicCoherenceManager } from '../overlays/strategic-coherence/manager.js';

/**
 * Symbol with severe drift
 */
export interface SevereDrift {
  symbol: string;
  filePath: string;
  coherence: number;
  issue: string;
  recommendation: string;
}

/**
 * Pattern violation
 */
export interface PatternViolation {
  type: string;
  symbol: string;
  description: string;
  fix: string;
}

/**
 * Boundary violation
 */
export interface BoundaryViolation {
  source: string;
  target: string;
  rule: string;
  recommendation: string;
}

/**
 * Consistency issue
 */
export interface ConsistencyIssue {
  category: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

/**
 * Recommendation
 */
export interface Recommendation {
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  action: string;
  category: 'drift' | 'pattern' | 'boundary' | 'consistency';
}

/**
 * Architectural drift analysis result
 */
export interface ArchitecturalDriftAnalysis {
  driftLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  summary: {
    totalSymbols: number;
    averageCoherence: number;
    driftedCount: number;
    violationCount: number;
  };
  severeDrift: SevereDrift[];
  patternViolations: PatternViolation[];
  boundaryViolations: BoundaryViolation[];
  consistencyIssues: ConsistencyIssue[];
  recommendations: Recommendation[];
}

/**
 * Architectural Drift Orchestrator
 */
export class ArchitecturalDriftOrchestrator {
  private structuralManager: StructuralPatternsManager;
  private missionManager: MissionConceptsManager;
  private coherenceManager: StrategicCoherenceManager;

  constructor(private pgcManager: PGCManager) {
    const pgcRoot = pgcManager.pgcRoot;
    this.structuralManager = new StructuralPatternsManager(pgcRoot);
    this.missionManager = new MissionConceptsManager(pgcRoot);
    this.coherenceManager = new StrategicCoherenceManager(pgcRoot);
  }

  /**
   * Analyze architectural drift
   */
  async analyze(): Promise<ArchitecturalDriftAnalysis> {
    // Step 1: Get coherence data from O7
    const coherenceOverlay = await this.coherenceManager.retrieve();

    if (!coherenceOverlay) {
      throw new Error(
        'Strategic coherence overlay not found. Run: cognition-cli overlay generate strategic_coherence'
      );
    }

    // Step 2: Identify severe drift (bottom quartile)
    const severeDrift = await this.identifySevereDrift(coherenceOverlay);

    // Step 3: Analyze pattern violations
    const patternViolations = await this.analyzePatternViolations();

    // Step 4: Check boundary violations
    const boundaryViolations = await this.checkBoundaryViolations();

    // Step 5: Find consistency issues
    const consistencyIssues = await this.findConsistencyIssues();

    // Step 6: Generate recommendations
    const recommendations = this.generateRecommendations(
      severeDrift,
      patternViolations,
      boundaryViolations,
      consistencyIssues
    );

    // Step 7: Determine drift level
    const averageCoherence = coherenceOverlay.overall_metrics.average_coherence;
    const driftedCount = severeDrift.length;
    const totalSymbols = coherenceOverlay.symbol_coherence.length;
    const driftPercent = (driftedCount / totalSymbols) * 100;

    let driftLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    if (averageCoherence < 0.4 || driftPercent > 20) {
      driftLevel = 'CRITICAL';
    } else if (averageCoherence < 0.6 || driftPercent > 10) {
      driftLevel = 'HIGH';
    } else if (averageCoherence < 0.75 || driftPercent > 5) {
      driftLevel = 'MEDIUM';
    } else {
      driftLevel = 'LOW';
    }

    return {
      driftLevel,
      summary: {
        totalSymbols,
        averageCoherence,
        driftedCount,
        violationCount:
          patternViolations.length +
          boundaryViolations.length +
          consistencyIssues.length,
      },
      severeDrift,
      patternViolations,
      boundaryViolations,
      consistencyIssues,
      recommendations,
    };
  }

  /**
   * Identify symbols with severe drift (bottom quartile)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async identifySevereDrift(coherenceOverlay: any): Promise<SevereDrift[]> {
    const threshold = coherenceOverlay.overall_metrics.bottom_quartile_coherence;
    const driftedSymbols = coherenceOverlay.symbol_coherence.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s.overallCoherence <= threshold
    );

    const severe: SevereDrift[] = [];

    for (const symbol of driftedSymbols.slice(0, 20)) {
      // Top 20 worst
      severe.push({
        symbol: symbol.symbolName,
        filePath: symbol.filePath,
        coherence: symbol.overallCoherence,
        issue: `Low mission alignment (${(symbol.overallCoherence * 100).toFixed(1)}%)`,
        recommendation: `Review purpose and align with mission, or refactor/remove if not needed`,
      });
    }

    return severe.sort((a, b) => a.coherence - b.coherence);
  }

  /**
   * Analyze pattern violations
   */
  private async analyzePatternViolations(): Promise<PatternViolation[]> {
    const violations: PatternViolation[] = [];
    const allSymbols = await this.structuralManager.getAllItems();

    for (const item of allSymbols) {
      const symbol = item.metadata.symbol;
      const type = item.metadata.type;
      const role = item.metadata.architecturalRole;

      // Naming convention violations
      if (type === 'class') {
        // Classes should be PascalCase
        if (symbol[0] !== symbol[0].toUpperCase()) {
          violations.push({
            type: 'Naming Convention',
            symbol,
            description: 'Class should use PascalCase',
            fix: `Rename to ${symbol[0].toUpperCase() + symbol.slice(1)}`,
          });
        }
      } else if (type === 'function') {
        // Functions should be camelCase
        if (symbol.includes('_') && !symbol.startsWith('_')) {
          violations.push({
            type: 'Naming Convention',
            symbol,
            description: 'Function should use camelCase, not snake_case',
            fix: `Rename to ${toCamelCase(symbol)}`,
          });
        }
      }

      // Missing docstrings for public APIs
      if (
        (role === 'service' || role === 'controller') &&
        !item.metadata.docstring
      ) {
        violations.push({
          type: 'Missing Documentation',
          symbol,
          description: 'Public API should have docstring',
          fix: 'Add docstring explaining purpose and usage',
        });
      }

      // Overly long names (>50 chars)
      if (symbol.length > 50) {
        violations.push({
          type: 'Naming Length',
          symbol,
          description: 'Symbol name too long (>50 chars)',
          fix: 'Use more concise name',
        });
      }
    }

    return violations;
  }

  /**
   * Check for architectural boundary violations
   */
  private async checkBoundaryViolations(): Promise<BoundaryViolation[]> {
    const violations: BoundaryViolation[] = [];

    // This would ideally check:
    // - Data layer NOT calling service layer
    // - UI layer NOT directly accessing data layer
    // - Utilities NOT depending on business logic
    //
    // For now, we'll do simplified heuristic checks

    // Placeholder: would need full dependency graph analysis
    // to detect layering violations

    return violations;
  }

  /**
   * Find consistency issues
   */
  private async findConsistencyIssues(): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];
    const allSymbols = await this.structuralManager.getAllItems();

    // Check for missing type hints (TypeScript/Python)
    const missingTypes = allSymbols.filter(
      (item) =>
        item.metadata.type === 'function' &&
        (!item.metadata.params ||
          item.metadata.params.some(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (p: any) => !p.type || p.type === 'any'
          ))
    );

    if (missingTypes.length > 0) {
      issues.push({
        category: 'Type Safety',
        description: `${missingTypes.length} functions missing complete type annotations`,
        severity: 'medium',
      });
    }

    // Check for test coverage gaps (files without tests)
    const testFiles = allSymbols.filter((item) =>
      item.metadata.filePath.includes('test')
    );
    const sourceFiles = allSymbols.filter(
      (item) => !item.metadata.filePath.includes('test')
    );
    const testCoveragePercent = (testFiles.length / sourceFiles.length) * 100;

    if (testCoveragePercent < 70) {
      issues.push({
        category: 'Test Coverage',
        description: `Test coverage at ${testCoveragePercent.toFixed(0)}% (target: 70%+)`,
        severity: 'high',
      });
    }

    return issues;
  }

  /**
   * Generate prioritized recommendations
   */
  private generateRecommendations(
    severeDrift: SevereDrift[],
    patternViolations: PatternViolation[],
    boundaryViolations: BoundaryViolation[],
    consistencyIssues: ConsistencyIssue[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Critical: Severe drift
    if (severeDrift.length > 0) {
      const top5 = severeDrift.slice(0, 5);
      recommendations.push({
        priority: 'CRITICAL',
        action: `Review and refactor ${top5.length} severely drifted symbols: ${top5.map((d) => d.symbol).join(', ')}`,
        category: 'drift',
      });
    }

    // High: Boundary violations
    if (boundaryViolations.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        action: `Fix ${boundaryViolations.length} architectural boundary violation(s)`,
        category: 'boundary',
      });
    }

    // Medium: Pattern violations
    const namingViolations = patternViolations.filter(
      (v) => v.type === 'Naming Convention'
    );
    if (namingViolations.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        action: `Fix ${namingViolations.length} naming convention violation(s)`,
        category: 'pattern',
      });
    }

    const docViolations = patternViolations.filter(
      (v) => v.type === 'Missing Documentation'
    );
    if (docViolations.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        action: `Add documentation to ${docViolations.length} public API(s)`,
        category: 'pattern',
      });
    }

    // Medium: High-severity consistency issues
    const highSeverityIssues = consistencyIssues.filter(
      (i) => i.severity === 'high'
    );
    if (highSeverityIssues.length > 0) {
      for (const issue of highSeverityIssues) {
        recommendations.push({
          priority: 'MEDIUM',
          action: `${issue.category}: ${issue.description}`,
          category: 'consistency',
        });
      }
    }

    // General recommendations
    if (severeDrift.length === 0 && patternViolations.length === 0) {
      recommendations.push({
        priority: 'LOW',
        action: 'Architecture is healthy - continue monitoring for drift',
        category: 'drift',
      });
    }

    return recommendations;
  }
}

/**
 * Convert snake_case to camelCase
 */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}
