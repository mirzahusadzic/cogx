/**
 * Dependency Health Orchestrator
 *
 * SUPERB WORKFLOW: Dependency Health Analysis across O3+O5
 *
 * Analyzes the dependency graph health by:
 * 1. Identifying circular dependencies (graph cycles)
 * 2. Computing centrality metrics (single points of failure)
 * 3. Finding stale dependencies (unused imports)
 * 4. Generating health score and recommendations
 *
 * ALGORITHMS:
 * - Circular Dependencies: Tarjan's strongly connected components
 * - Centrality: In-degree + transitive consumer count
 * - Stale Detection: Import declared but no references found
 *
 * HEALTH SCORING:
 * Score = 100 - (circular_penalty + risk_penalty + stale_penalty)
 * - Circular: -10 per cycle
 * - High-risk: -5 per high-centrality module
 * - Stale: -1 per stale import
 */

import { PGCManager } from '../pgc/manager.js';
import { GraphTraversal } from '../graph/traversal.js';
import { StructuralPatternsManager } from '../overlays/structural-patterns/manager.js';
import { LineagePatternsManager } from '../overlays/lineage/manager.js';

/**
 * High-risk dependency
 */
export interface HighRiskDependency {
  symbol: string;
  filePath: string;
  centrality: number;
  percentile: number;
  consumers: number;
  impact: string;
  recommendation: string;
}

/**
 * Circular dependency cycle
 */
export interface CircularDependency {
  path: string[];
  impact: string;
  recommendation: string;
}

/**
 * Stale dependency
 */
export interface StaleDependency {
  symbol: string;
  filePath: string;
  reason: string;
}

/**
 * Recommendation
 */
export interface Recommendation {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  action: string;
  category: 'circular' | 'risk' | 'stale' | 'general';
}

/**
 * Dependency health analysis result
 */
export interface DependencyHealthAnalysis {
  healthScore: number;
  healthLevel: string;
  highRiskDeps: HighRiskDependency[];
  circularDeps: CircularDependency[];
  staleDeps: StaleDependency[];
  staleSavings: string;
  recommendations: Recommendation[];
}

/**
 * Dependency Health Orchestrator
 */
export class DependencyHealthOrchestrator {
  private structuralManager: StructuralPatternsManager;
  private lineageManager: LineagePatternsManager;
  private traversal: GraphTraversal;

  constructor(private pgcManager: PGCManager) {
    const pgcRoot = pgcManager.pgcRoot;
    this.structuralManager = new StructuralPatternsManager(pgcRoot);
    this.lineageManager = new LineagePatternsManager(pgcRoot);
    this.traversal = new GraphTraversal(pgcManager);
  }

  /**
   * Analyze dependency health
   */
  async analyze(): Promise<DependencyHealthAnalysis> {
    // Step 1: Build dependency graph from O3
    const graph = await this.buildDependencyGraph();

    // Step 2: Identify high-risk dependencies (high centrality)
    const highRiskDeps = await this.identifyHighRiskDependencies(graph);

    // Step 3: Find circular dependencies
    const circularDeps = this.findCircularDependencies(graph);

    // Step 4: Identify stale dependencies
    const staleDeps = await this.identifyStaleDependencies();

    // Step 5: Generate recommendations
    const recommendations = this.generateRecommendations(
      highRiskDeps,
      circularDeps,
      staleDeps
    );

    // Step 6: Compute health score
    const healthScore = this.computeHealthScore(
      highRiskDeps,
      circularDeps,
      staleDeps
    );

    const healthLevel =
      healthScore >= 90
        ? 'Excellent'
        : healthScore >= 70
          ? 'Good'
          : healthScore >= 50
            ? 'Fair'
            : 'Poor';

    const staleSavings = `${staleDeps.length} unused imports`;

    return {
      healthScore,
      healthLevel,
      highRiskDeps: highRiskDeps.slice(0, 10), // Top 10
      circularDeps,
      staleDeps,
      staleSavings,
      recommendations,
    };
  }

  /**
   * Build dependency graph from lineage patterns
   */
  private async buildDependencyGraph(): Promise<Map<string, Set<string>>> {
    const graph = new Map<string, Set<string>>();
    const allLineageItems = await this.lineageManager.getAllItems();

    for (const item of allLineageItems) {
      const symbol = item.metadata.symbol;
      const deps = new Set<string>();

      // Add import dependencies
      if (item.metadata.imports) {
        for (const imp of item.metadata.imports) {
          deps.add(imp.symbol);
        }
      }

      // Add type dependencies
      if (item.metadata.types) {
        for (const type of item.metadata.types) {
          deps.add(type);
        }
      }

      // Add inheritance dependencies
      if (item.metadata.base_classes) {
        for (const base of item.metadata.base_classes) {
          deps.add(base);
        }
      }

      graph.set(symbol, deps);
    }

    return graph;
  }

  /**
   * Identify high-risk dependencies using centrality metrics
   */
  private async identifyHighRiskDependencies(
    graph: Map<string, Set<string>>
  ): Promise<HighRiskDependency[]> {
    const allSymbols = await this.structuralManager.getAllItems();
    const highRisk: HighRiskDependency[] = [];

    // Compute centrality for each symbol (number of consumers)
    const centralityScores = new Map<string, number>();

    for (const [symbol] of graph) {
      let consumerCount = 0;

      // Count how many other symbols depend on this one
      for (const [, deps] of graph) {
        if (deps.has(symbol)) {
          consumerCount++;
        }
      }

      centralityScores.set(symbol, consumerCount);
    }

    // Sort by centrality
    const sorted = Array.from(centralityScores.entries()).sort(
      (a, b) => b[1] - a[1]
    );

    // Top 10% are high-risk
    const threshold = Math.max(5, Math.ceil(sorted.length * 0.1));
    const highCentralitySymbols = sorted.slice(0, threshold);

    for (const [symbol, consumers] of highCentralitySymbols) {
      const symbolItem = allSymbols.find(
        (item) => item.metadata.symbol === symbol
      );

      if (!symbolItem) continue;

      const percentile = Math.round((consumers / sorted.length) * 100);

      highRisk.push({
        symbol,
        filePath: symbolItem.metadata.filePath,
        centrality: percentile,
        percentile,
        consumers,
        impact: `${consumers} modules depend on this`,
        recommendation: 'Add redundancy or extract interface',
      });
    }

    return highRisk;
  }

  /**
   * Find circular dependencies using DFS cycle detection
   */
  private findCircularDependencies(
    graph: Map<string, Set<string>>
  ): CircularDependency[] {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycles: CircularDependency[] = [];

    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || new Set();

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        } else if (recStack.has(neighbor)) {
          // Cycle detected
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart !== -1) {
            const cyclePath = path.slice(cycleStart);
            cyclePath.push(neighbor); // Complete the cycle

            // Only add if not already recorded (different representation of same cycle)
            const cycleKey = cyclePath.sort().join('→');
            const isDuplicate = cycles.some(
              (c) => c.path.sort().join('→') === cycleKey
            );

            if (!isDuplicate && cyclePath.length > 1) {
              cycles.push({
                path: cyclePath,
                impact: 'Tight coupling, difficult to test and maintain',
                recommendation: 'Extract shared interface or invert dependency',
              });
            }
          }
        }
      }

      recStack.delete(node);
    };

    for (const [node] of graph) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  /**
   * Identify stale dependencies (imported but unused)
   */
  private async identifyStaleDependencies(): Promise<StaleDependency[]> {
    const stale: StaleDependency[] = [];
    const allLineageItems = await this.lineageManager.getAllItems();

    for (const item of allLineageItems) {
      const imports = item.metadata.imports || [];
      const bodyDeps = item.metadata.body_dependencies || [];
      const types = item.metadata.types || [];

      // Find imports not used in body or types
      for (const imp of imports) {
        const isUsedInBody = bodyDeps.some(
          (dep: { symbol: string }) => dep.symbol === imp.symbol
        );
        const isUsedInTypes = types.includes(imp.symbol);

        if (!isUsedInBody && !isUsedInTypes) {
          stale.push({
            symbol: imp.symbol,
            filePath: item.metadata.filePath,
            reason: 'Imported but never referenced',
          });
        }
      }
    }

    return stale;
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    highRiskDeps: HighRiskDependency[],
    circularDeps: CircularDependency[],
    staleDeps: StaleDependency[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Circular dependencies (highest priority)
    if (circularDeps.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        action: `Break ${circularDeps.length} circular dependenc${circularDeps.length > 1 ? 'ies' : 'y'}`,
        category: 'circular',
      });

      if (circularDeps.length > 3) {
        recommendations.push({
          priority: 'HIGH',
          action: `Focus on top ${Math.min(3, circularDeps.length)} cycles first`,
          category: 'circular',
        });
      }
    }

    // High-risk dependencies
    if (highRiskDeps.length > 0) {
      const top3 = highRiskDeps.slice(0, 3);
      recommendations.push({
        priority: 'MEDIUM',
        action: `Add redundancy for ${top3.length} high-centrality module${top3.length > 1 ? 's' : ''}: ${top3.map((d) => d.symbol).join(', ')}`,
        category: 'risk',
      });
    }

    // Stale dependencies
    if (staleDeps.length > 0) {
      recommendations.push({
        priority: 'LOW',
        action: `Remove ${staleDeps.length} unused import${staleDeps.length > 1 ? 's' : ''}`,
        category: 'stale',
      });
    }

    // General recommendations
    if (circularDeps.length === 0 && highRiskDeps.length === 0) {
      recommendations.push({
        priority: 'LOW',
        action: 'Dependency structure is healthy - continue monitoring',
        category: 'general',
      });
    }

    return recommendations;
  }

  /**
   * Compute overall health score (0-100)
   */
  private computeHealthScore(
    highRiskDeps: HighRiskDependency[],
    circularDeps: CircularDependency[],
    staleDeps: StaleDependency[]
  ): number {
    let score = 100;

    // Circular dependencies penalty (-10 each, max -40)
    score -= Math.min(40, circularDeps.length * 10);

    // High-risk dependencies penalty (-5 each, max -30)
    score -= Math.min(30, highRiskDeps.length * 5);

    // Stale dependencies penalty (-1 each, max -15)
    score -= Math.min(15, staleDeps.length);

    return Math.max(0, score);
  }
}
