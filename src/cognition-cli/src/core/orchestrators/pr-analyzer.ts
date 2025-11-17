/**
 * PR Impact Analyzer Orchestrator
 *
 * KILLER WORKFLOW: Combines O1+O2+O3+O4+O7 for comprehensive PR analysis
 *
 * This orchestrator answers the question:
 * "What is the full impact of this PR before merging?"
 *
 * CROSS-OVERLAY SYNTHESIS:
 * - O1 (Structural): What code changed? (files, functions, modules)
 * - O2 (Security): Any security implications?
 * - O3 (Lineage): What's the blast radius? (dependent modules)
 * - O4 (Mission): Does it align with project goals?
 * - O7 (Coherence): Does it improve or hurt alignment?
 *
 * WHY THIS IS A KILLER WORKFLOW:
 * Individual overlays answer narrow questions:
 * - "What changed?" (O1)
 * - "Is it secure?" (O2)
 * - "What breaks?" (O3)
 *
 * But developers need the BIG PICTURE:
 * - "Should I merge this PR?"
 * - "What are the risks?"
 * - "What are the trade-offs?"
 *
 * This orchestrator provides that synthesis.
 *
 * USE CASES:
 * 1. PR Review: Comprehensive impact before merge
 * 2. CI/CD Integration: Automated quality gates
 * 3. Architecture Review: Understand system-wide changes
 * 4. Security Audit: Identify security-critical changes
 *
 * @example
 * // Analyze current branch changes
 * const analyzer = new PRAnalyzer(pgcManager);
 * const analysis = await analyzer.analyze();
 * console.log(`Security issues: ${analysis.security.threats.length}`);
 * console.log(`Blast radius: ${analysis.blastRadius.totalImpacted} symbols`);
 *
 * @example
 * // Analyze specific branch
 * const analysis = await analyzer.analyze({ branch: 'feature/auth-refactor' });
 * console.log(`Mission alignment: ${analysis.missionAlignment.confidence}%`);
 */

import path from 'path';
import { PGCManager } from '../pgc/manager.js';
import { GraphTraversal } from '../graph/traversal.js';
import { StructuralPatternsManager } from '../overlays/structural-patterns/manager.js';
import { SecurityGuidelinesManager } from '../overlays/security-guidelines/manager.js';
import { MissionConceptsManager } from '../overlays/mission-concepts/manager.js';
import { StrategicCoherenceManager } from '../overlays/strategic-coherence/manager.js';
import { DirtyStateManager } from '../watcher/dirty-state.js';
import type {
  DirtyFile,
  UntrackedFile,
} from '../watcher/dirty-state-tracker.js';
import { execa } from 'execa';

/**
 * Structural changes in the PR
 */
export interface StructuralChanges {
  filesChanged: number;
  modulesAdded: string[];
  functionsModified: string[];
  classesUpdated: string[];
  totalSymbols: number;
}

/**
 * Security review results
 */
export interface SecurityReview {
  threats: Array<{
    type: string;
    severity: string;
    description: string;
    file: string;
    recommendation: string;
  }>;
  riskLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Blast radius analysis
 */
export interface BlastRadiusAnalysis {
  directConsumers: number;
  transitiveImpact: number;
  criticalPaths: Array<{
    path: string[];
    reason: string;
    depth: number;
  }>;
}

/**
 * Mission alignment analysis
 */
export interface MissionAlignment {
  aligned: boolean;
  confidence: number; // 0-100
  matchingConcepts: string[];
  recommendations: string[];
}

/**
 * Coherence impact analysis
 */
export interface CoherenceImpact {
  before: {
    alignedCount: number;
    driftedCount: number;
    averageCoherence: number;
  };
  after: {
    alignedCount: number;
    driftedCount: number;
    averageCoherence: number;
  };
  delta: {
    alignedDelta: number;
    coherenceDelta: number;
  };
  trend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
}

/**
 * Complete PR analysis result
 */
export interface PRAnalysis {
  structural: StructuralChanges;
  security: SecurityReview;
  blastRadius: BlastRadiusAnalysis;
  missionAlignment: MissionAlignment;
  coherenceImpact: CoherenceImpact;
  recommendations: string[];
  mergeable: boolean;
  riskScore: number; // 0-100 (higher = riskier)
}

/**
 * PR Analyzer Options
 */
export interface PRAnalyzerOptions {
  branch?: string; // Branch to analyze (default: current)
  maxDepth?: number; // Max depth for blast radius (default: 3)
}

/**
 * PR Impact Analyzer
 *
 * Orchestrates cross-overlay analysis for pull request impact assessment
 */
export class PRAnalyzer {
  private structuralManager: StructuralPatternsManager;
  private securityManager: SecurityGuidelinesManager;
  private missionManager: MissionConceptsManager;
  private coherenceManager: StrategicCoherenceManager;
  private traversal: GraphTraversal;
  private dirtyState: DirtyStateManager;

  constructor(private pgcManager: PGCManager) {
    const pgcRoot = pgcManager.pgcRoot;
    this.structuralManager = new StructuralPatternsManager(pgcRoot);
    this.securityManager = new SecurityGuidelinesManager(pgcRoot);
    this.missionManager = new MissionConceptsManager(pgcRoot);
    this.coherenceManager = new StrategicCoherenceManager(pgcRoot);
    this.traversal = new GraphTraversal(pgcManager);
    this.dirtyState = new DirtyStateManager(pgcRoot);
  }

  /**
   * Analyze PR impact across all overlays
   */
  async analyze(options: PRAnalyzerOptions = {}): Promise<PRAnalysis> {
    const maxDepth = options.maxDepth ?? 3;

    // Step 1: Get changed files
    const changedFiles = await this.getChangedFiles(options.branch);

    if (changedFiles.length === 0) {
      // No changes - return empty analysis
      return this.createEmptyAnalysis();
    }

    // Step 2: Query O1 (Structural) for changed symbols
    const structural = await this.analyzeStructuralChanges(changedFiles);

    // Step 3: Query O2 (Security) for threats
    const security = await this.analyzeSecurityThreats(changedFiles);

    // Step 4: Query O3 (Lineage) for blast radius
    const blastRadius = await this.analyzeBlastRadius(
      structural.functionsModified,
      maxDepth
    );

    // Step 5: Query O4 (Mission) for alignment
    const missionAlignment = await this.analyzeMissionAlignment(changedFiles);

    // Step 6: Query O7 (Coherence) - simulate before/after
    // Note: This is a simplified version - full implementation would require
    // re-computing coherence with changed symbols
    const coherenceImpact = await this.analyzeCoherenceImpact(
      structural.functionsModified
    );

    // Step 7: Generate recommendations
    const recommendations = this.generateRecommendations(
      structural,
      security,
      blastRadius,
      missionAlignment,
      coherenceImpact
    );

    // Step 8: Compute risk score and mergeability
    const riskScore = this.computeRiskScore(
      security,
      blastRadius,
      missionAlignment
    );
    const mergeable = this.isMergeable(security, riskScore);

    return {
      structural,
      security,
      blastRadius,
      missionAlignment,
      coherenceImpact,
      recommendations,
      mergeable,
      riskScore,
    };
  }

  /**
   * Get list of changed files
   */
  private async getChangedFiles(
    branch?: string
  ): Promise<Array<{ path: string; status: string }>> {
    try {
      // If branch specified, use git diff
      if (branch) {
        const { stdout } = await execa('git', [
          'diff',
          '--name-status',
          `origin/main...${branch}`,
        ]);

        return stdout.split('\n').map((line) => {
          const [status, filePath] = line.split('\t');
          return { path: filePath, status };
        });
      }

      // Otherwise use dirty state
      const dirtyState = await this.dirtyState.read();
      const changed: Array<{ path: string; status: string }> = [];

      for (const file of dirtyState.modified) {
        changed.push({ path: file.path, status: 'M' });
      }

      for (const file of dirtyState.untracked) {
        changed.push({ path: file.path, status: 'A' });
      }

      return changed;
    } catch (error) {
      console.warn('Error getting changed files:', (error as Error).message);
      return [];
    }
  }

  /**
   * Analyze structural changes from O1
   */
  private async analyzeStructuralChanges(
    changedFiles: Array<{ path: string; status: string }>
  ): Promise<StructuralChanges> {
    const allItems = await this.structuralManager.getAllItems();
    const changedPaths = new Set(changedFiles.map((f) => f.path));

    const functionsModified: string[] = [];
    const classesUpdated: string[] = [];
    const modulesAdded = new Set<string>();

    for (const item of allItems) {
      if (changedPaths.has(item.metadata.filePath)) {
        const symbol = item.metadata.symbol;

        // Check if it's a new file (module added)
        const fileChange = changedFiles.find(
          (f) => f.path === item.metadata.filePath
        );
        if (fileChange?.status === 'A') {
          modulesAdded.add(item.metadata.filePath);
        }

        // Categorize by architectural role
        const role = item.metadata.architecturalRole;
        if (role === 'service' || role === 'utility' || role === 'component') {
          functionsModified.push(symbol);
        } else if (role === 'model' || role === 'controller') {
          classesUpdated.push(symbol);
        }
      }
    }

    return {
      filesChanged: changedFiles.length,
      modulesAdded: Array.from(modulesAdded),
      functionsModified,
      classesUpdated,
      totalSymbols: functionsModified.length + classesUpdated.length,
    };
  }

  /**
   * Analyze security threats from O2
   */
  private async analyzeSecurityThreats(
    changedFiles: Array<{ path: string; status: string }>
  ): Promise<SecurityReview> {
    const threats: SecurityReview['threats'] = [];
    const allSecurityItems = await this.securityManager.getAllItems();

    // For each changed file, query O2 for relevant threats
    for (const file of changedFiles) {
      const query = `${file.path} security vulnerability threat`;
      const results = await this.securityManager.query(query, 5);

      for (const result of results) {
        if (result.similarity > 0.3) {
          threats.push({
            type: result.item.metadata.securityType,
            severity: result.item.metadata.severity,
            description: result.item.metadata.text,
            file: file.path,
            recommendation:
              result.item.metadata.mitigation || 'Review for security issues',
          });
        }
      }
    }

    // Determine overall risk level
    const riskLevel = this.determineRiskLevel(threats);

    return { threats, riskLevel };
  }

  /**
   * Analyze blast radius from O3
   */
  private async analyzeBlastRadius(
    changedSymbols: string[],
    maxDepth: number
  ): Promise<BlastRadiusAnalysis> {
    if (changedSymbols.length === 0) {
      return {
        directConsumers: 0,
        transitiveImpact: 0,
        criticalPaths: [],
      };
    }

    // Analyze first changed symbol (as representative)
    // In a full implementation, we'd aggregate across all changed symbols
    const primarySymbol = changedSymbols[0];

    try {
      const result = await this.traversal.getBlastRadius(primarySymbol, {
        maxDepth,
        direction: 'up', // Only consumers (what breaks)
        includeTransitive: true,
      });

      return {
        directConsumers: result.consumers.length,
        transitiveImpact: result.metrics.totalImpacted,
        criticalPaths: result.metrics.criticalPaths.map((p) => ({
          path: p.path,
          reason: p.reason,
          depth: p.depth,
        })),
      };
    } catch (error) {
      console.warn(
        'Error computing blast radius:',
        (error as Error).message
      );
      return {
        directConsumers: 0,
        transitiveImpact: 0,
        criticalPaths: [],
      };
    }
  }

  /**
   * Analyze mission alignment from O4
   */
  private async analyzeMissionAlignment(
    changedFiles: Array<{ path: string; status: string }>
  ): Promise<MissionAlignment> {
    const allMissionItems = await this.missionManager.getAllItems();

    if (allMissionItems.length === 0) {
      return {
        aligned: true,
        confidence: 50,
        matchingConcepts: [],
        recommendations: ['Add mission documentation to enable alignment check'],
      };
    }

    // Query O4 with changed file paths
    const query = changedFiles.map((f) => f.path).join(' ');
    const results = await this.missionManager.query(query, 5);

    const matchingConcepts = results
      .filter((r) => r.similarity > 0.4)
      .map((r) => r.item.metadata.text);

    const averageSimilarity =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.similarity, 0) / results.length
        : 0;

    const confidence = Math.round(averageSimilarity * 100);
    const aligned = confidence > 50;

    return {
      aligned,
      confidence,
      matchingConcepts,
      recommendations: aligned
        ? ['Changes align with mission goals']
        : ['Review changes for mission alignment'],
    };
  }

  /**
   * Analyze coherence impact from O7
   */
  private async analyzeCoherenceImpact(
    changedSymbols: string[]
  ): Promise<CoherenceImpact> {
    const coherenceOverlay = await this.coherenceManager.retrieve();

    if (!coherenceOverlay) {
      return {
        before: { alignedCount: 0, driftedCount: 0, averageCoherence: 0 },
        after: { alignedCount: 0, driftedCount: 0, averageCoherence: 0 },
        delta: { alignedDelta: 0, coherenceDelta: 0 },
        trend: 'STABLE',
      };
    }

    // Use existing coherence metrics as "before"
    const before = {
      alignedCount: coherenceOverlay.overall_metrics.aligned_symbols_count,
      driftedCount: coherenceOverlay.overall_metrics.drifted_symbols_count,
      averageCoherence: coherenceOverlay.overall_metrics.average_coherence,
    };

    // For "after", we'd need to re-compute coherence with changed symbols
    // This is expensive, so for now we'll estimate based on changed symbols
    const changedSymbolCoherence = coherenceOverlay.symbol_coherence.filter(
      (s) => changedSymbols.includes(s.symbolName)
    );

    const estimatedCoherenceChange =
      changedSymbolCoherence.length > 0
        ? changedSymbolCoherence.reduce((sum, s) => sum + s.overallCoherence, 0) /
            changedSymbolCoherence.length -
          before.averageCoherence
        : 0;

    const after = {
      alignedCount:
        before.alignedCount +
        (estimatedCoherenceChange > 0 ? changedSymbols.length : 0),
      driftedCount:
        before.driftedCount +
        (estimatedCoherenceChange < 0 ? changedSymbols.length : 0),
      averageCoherence: before.averageCoherence + estimatedCoherenceChange,
    };

    const delta = {
      alignedDelta: after.alignedCount - before.alignedCount,
      coherenceDelta: after.averageCoherence - before.averageCoherence,
    };

    const trend =
      delta.coherenceDelta > 0.05
        ? 'IMPROVING'
        : delta.coherenceDelta < -0.05
          ? 'DEGRADING'
          : 'STABLE';

    return { before, after, delta, trend };
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    structural: StructuralChanges,
    security: SecurityReview,
    blastRadius: BlastRadiusAnalysis,
    missionAlignment: MissionAlignment,
    coherenceImpact: CoherenceImpact
  ): string[] {
    const recommendations: string[] = [];

    // Security recommendations
    if (security.threats.length > 0) {
      const critical = security.threats.filter(
        (t) => t.severity === 'critical'
      );
      if (critical.length > 0) {
        recommendations.push(
          `CRITICAL: Fix ${critical.length} critical security issue(s) before merging`
        );
      }
    }

    // Blast radius recommendations
    if (blastRadius.transitiveImpact > 20) {
      recommendations.push(
        `High blast radius (${blastRadius.transitiveImpact} symbols) - thorough testing required`
      );
    }

    // Mission alignment recommendations
    if (!missionAlignment.aligned) {
      recommendations.push(
        'Changes may not align with mission goals - review architectural intent'
      );
    }

    // Coherence recommendations
    if (coherenceImpact.trend === 'DEGRADING') {
      recommendations.push('Changes reduce code-mission coherence - consider refactoring');
    } else if (coherenceImpact.trend === 'IMPROVING') {
      recommendations.push('Changes improve mission alignment - good work!');
    }

    // Structural recommendations
    if (structural.filesChanged > 50) {
      recommendations.push('Large PR - consider breaking into smaller changes');
    }

    if (recommendations.length === 0) {
      recommendations.push('No major concerns - PR looks good to merge');
    }

    return recommendations;
  }

  /**
   * Compute overall risk score (0-100)
   */
  private computeRiskScore(
    security: SecurityReview,
    blastRadius: BlastRadiusAnalysis,
    missionAlignment: MissionAlignment
  ): number {
    let score = 0;

    // Security risk (0-40 points)
    const criticalThreats = security.threats.filter(
      (t) => t.severity === 'critical'
    ).length;
    const highThreats = security.threats.filter((t) => t.severity === 'high')
      .length;
    score += Math.min(40, criticalThreats * 20 + highThreats * 10);

    // Blast radius risk (0-30 points)
    score += Math.min(30, (blastRadius.transitiveImpact / 50) * 30);

    // Mission misalignment risk (0-30 points)
    if (!missionAlignment.aligned) {
      score += 30 - Math.floor((missionAlignment.confidence / 100) * 30);
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Determine if PR is mergeable
   */
  private isMergeable(security: SecurityReview, riskScore: number): boolean {
    // Block on critical security issues
    const hasCritical = security.threats.some((t) => t.severity === 'critical');
    if (hasCritical) return false;

    // Block on very high risk
    if (riskScore > 80) return false;

    return true;
  }

  /**
   * Determine overall security risk level
   */
  private determineRiskLevel(
    threats: SecurityReview['threats']
  ): SecurityReview['riskLevel'] {
    if (threats.length === 0) return 'NONE';

    const hasCritical = threats.some((t) => t.severity === 'critical');
    if (hasCritical) return 'CRITICAL';

    const hasHigh = threats.some((t) => t.severity === 'high');
    if (hasHigh) return 'HIGH';

    const hasMedium = threats.some((t) => t.severity === 'medium');
    if (hasMedium) return 'MEDIUM';

    return 'LOW';
  }

  /**
   * Create empty analysis (no changes)
   */
  private createEmptyAnalysis(): PRAnalysis {
    return {
      structural: {
        filesChanged: 0,
        modulesAdded: [],
        functionsModified: [],
        classesUpdated: [],
        totalSymbols: 0,
      },
      security: {
        threats: [],
        riskLevel: 'NONE',
      },
      blastRadius: {
        directConsumers: 0,
        transitiveImpact: 0,
        criticalPaths: [],
      },
      missionAlignment: {
        aligned: true,
        confidence: 100,
        matchingConcepts: [],
        recommendations: [],
      },
      coherenceImpact: {
        before: { alignedCount: 0, driftedCount: 0, averageCoherence: 0 },
        after: { alignedCount: 0, driftedCount: 0, averageCoherence: 0 },
        delta: { alignedDelta: 0, coherenceDelta: 0 },
        trend: 'STABLE',
      },
      recommendations: ['No changes detected'],
      mergeable: true,
      riskScore: 0,
    };
  }
}
