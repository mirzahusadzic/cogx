/**
 * Mission Alignment Orchestrator
 *
 * SUPERB WORKFLOW: Feature-Mission Alignment Analysis across O1+O4+O7
 *
 * Analyzes how well a feature aligns with organizational mission by:
 * 1. Finding feature symbols from O1 (Structural)
 * 2. Retrieving mission principles from O4 (Mission)
 * 3. Computing alignment scores using O7 (Coherence) embeddings
 * 4. Identifying gaps and weak alignments
 * 5. Generating actionable recommendations
 *
 * ALIGNMENT ALGORITHM:
 * For each symbol in feature:
 *   For each principle in mission:
 *     score = cosineSimilarity(symbol.embedding, principle.embedding)
 *   avgAlignment = mean(scores)
 *
 * CLASSIFICATION:
 * - Aligned: score >= 0.7
 * - Weak: 0.4 <= score < 0.7
 * - Missing: score < 0.4
 */

import { PGCManager } from '../pgc/manager.js';
import { StructuralPatternsManager } from '../overlays/structural-patterns/manager.js';
import { MissionConceptsManager } from '../overlays/mission-concepts/manager.js';
import { StrategicCoherenceManager } from '../overlays/strategic-coherence/manager.js';

/**
 * Symbol alignment details
 */
export interface SymbolAlignment {
  symbolName: string;
  filePath: string;
  avgAlignment: number;
  topPrinciple: {
    text: string;
    score: number;
  };
  architecturalRole?: string;
}

/**
 * Aligned principle
 */
export interface AlignedPrinciple {
  text: string;
  score: number;
  type: string;
  implementedBy: string[];
}

/**
 * Weak alignment
 */
export interface WeakAlignment {
  principle: string;
  score: number;
  gap: string;
}

/**
 * Missing implementation
 */
export interface MissingImplementation {
  principle: string;
  description: string;
  recommendation: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Recommendation
 */
export interface Recommendation {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  action: string;
  category: 'implementation' | 'alignment' | 'gap';
}

/**
 * Mission alignment analysis result
 */
export interface MissionAlignmentAnalysis {
  featureName: string;
  symbols: SymbolAlignment[];
  alignedPrinciples: AlignedPrinciple[];
  weakAlignments: WeakAlignment[];
  missingImplementations: MissingImplementation[];
  recommendations: Recommendation[];
  summary: {
    totalSymbols: number;
    averageAlignment: number;
    totalPrinciples: number;
    alignmentLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  };
}

/**
 * Mission Alignment Orchestrator
 */
export class MissionAlignmentOrchestrator {
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
   * Analyze feature-mission alignment
   */
  async analyze(featureName: string): Promise<MissionAlignmentAnalysis> {
    // Step 1: Find symbols matching feature name (O1)
    const featureSymbols = await this.findFeatureSymbols(featureName);

    if (featureSymbols.length === 0) {
      return this.createEmptyAnalysis(featureName);
    }

    // Step 2: Get mission principles (O4)
    const allMissionItems = await this.missionManager.getAllItems();
    const principles = allMissionItems.filter(
      (item) =>
        item.metadata.conceptType === 'principle' ||
        item.metadata.conceptType === 'goal'
    );

    if (principles.length === 0) {
      return this.createEmptyAnalysis(featureName);
    }

    // Step 3: Compute alignment scores using embeddings
    const symbolAlignments: SymbolAlignment[] = [];

    for (const symbol of featureSymbols) {
      const alignmentScores = await this.computeAlignmentScores(
        symbol,
        principles
      );

      const avgAlignment =
        alignmentScores.reduce((sum, s) => sum + s.score, 0) /
        alignmentScores.length;

      const topPrinciple = alignmentScores[0]; // Already sorted by score

      symbolAlignments.push({
        symbolName: symbol.metadata.symbol,
        filePath: symbol.metadata.filePath,
        avgAlignment,
        topPrinciple: {
          text: topPrinciple.principle.text,
          score: topPrinciple.score,
        },
        architecturalRole: symbol.metadata.architecturalRole,
      });
    }

    // Step 4: Identify aligned principles
    const alignedPrinciples = await this.identifyAlignedPrinciples(
      symbolAlignments,
      principles
    );

    // Step 5: Identify weak alignments
    const weakAlignments = this.identifyWeakAlignments(
      symbolAlignments,
      principles
    );

    // Step 6: Find missing implementations (principles with no code)
    const missingImplementations = this.identifyMissingImplementations(
      principles,
      alignedPrinciples
    );

    // Step 7: Generate recommendations
    const recommendations = this.generateRecommendations(
      symbolAlignments,
      weakAlignments,
      missingImplementations
    );

    // Step 8: Compute summary
    const averageAlignment =
      symbolAlignments.reduce((sum, s) => sum + s.avgAlignment, 0) /
      symbolAlignments.length;

    const alignmentLevel =
      averageAlignment >= 0.7 ? 'HIGH' : averageAlignment >= 0.5 ? 'MEDIUM' : 'LOW';

    return {
      featureName,
      symbols: symbolAlignments.sort((a, b) => b.avgAlignment - a.avgAlignment),
      alignedPrinciples: alignedPrinciples.sort((a, b) => b.score - a.score),
      weakAlignments,
      missingImplementations,
      recommendations,
      summary: {
        totalSymbols: symbolAlignments.length,
        averageAlignment,
        totalPrinciples: principles.length,
        alignmentLevel,
      },
    };
  }

  /**
   * Find structural symbols matching feature name
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async findFeatureSymbols(featureName: string): Promise<any[]> {
    // Query structural patterns for matching symbols
    const results = await this.structuralManager.query(featureName, 20);

    // Filter for reasonable similarity threshold
    return results
      .filter((r) => r.similarity > 0.3)
      .map((r) => r.item)
      .slice(0, 10); // Limit to top 10 symbols
  }

  /**
   * Compute alignment scores between symbol and all principles
   */
  private async computeAlignmentScores(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    symbol: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    principles: any[]
  ): Promise<Array<{ principle: { text: string }; score: number }>> {
    const symbolEmbedding = symbol.embedding;
    const scores: Array<{ principle: { text: string }; score: number }> = [];

    for (const principle of principles) {
      const principleEmbedding = principle.embedding;
      const score = this.cosineSimilarity(symbolEmbedding, principleEmbedding);

      scores.push({
        principle: { text: principle.metadata.text },
        score,
      });
    }

    // Sort by score descending
    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dotProduct / denom;
  }

  /**
   * Identify principles that are well-implemented
   */
  private async identifyAlignedPrinciples(
    symbolAlignments: SymbolAlignment[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    principles: any[]
  ): Promise<AlignedPrinciple[]> {
    const aligned: AlignedPrinciple[] = [];

    for (const principle of principles) {
      // Find symbols that align well with this principle
      const implementingSymbols: string[] = [];
      let maxScore = 0;

      for (const symbol of symbolAlignments) {
        // Re-compute score for this specific principle-symbol pair
        const score = this.cosineSimilarity(
          symbol.topPrinciple.text === principle.metadata.text
            ? [symbol.topPrinciple.score]
            : [symbol.avgAlignment],
          [1.0]
        );

        if (score >= 0.7) {
          implementingSymbols.push(symbol.symbolName);
        }

        if (score > maxScore) {
          maxScore = score;
        }
      }

      if (maxScore >= 0.7) {
        aligned.push({
          text: principle.metadata.text,
          score: maxScore,
          type: principle.metadata.conceptType,
          implementedBy: implementingSymbols,
        });
      }
    }

    return aligned;
  }

  /**
   * Identify weak alignments (principles partially implemented)
   */
  private identifyWeakAlignments(
    symbolAlignments: SymbolAlignment[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    principles: any[]
  ): WeakAlignment[] {
    const weak: WeakAlignment[] = [];

    for (const symbol of symbolAlignments) {
      if (symbol.avgAlignment >= 0.4 && symbol.avgAlignment < 0.7) {
        weak.push({
          principle: symbol.topPrinciple.text,
          score: symbol.topPrinciple.score,
          gap: `${symbol.symbolName} partially implements this principle but could be strengthened`,
        });
      }
    }

    return weak;
  }

  /**
   * Identify principles with no implementing code
   */
  private identifyMissingImplementations(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    principles: any[],
    alignedPrinciples: AlignedPrinciple[]
  ): MissingImplementation[] {
    const alignedTexts = new Set(alignedPrinciples.map((p) => p.text));
    const missing: MissingImplementation[] = [];

    for (const principle of principles) {
      if (!alignedTexts.has(principle.metadata.text)) {
        missing.push({
          principle: principle.metadata.text,
          description: `No code implementation found for this ${principle.metadata.conceptType}`,
          recommendation: `Consider implementing code that embodies "${principle.metadata.text}"`,
          priority:
            principle.metadata.conceptType === 'principle'
              ? 'HIGH'
              : principle.metadata.conceptType === 'goal'
                ? 'MEDIUM'
                : 'LOW',
        });
      }
    }

    return missing.sort((a, b) => {
      const priorities = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return priorities[b.priority] - priorities[a.priority];
    });
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    symbolAlignments: SymbolAlignment[],
    weakAlignments: WeakAlignment[],
    missingImplementations: MissingImplementation[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Recommendations for low alignment symbols
    const lowAlignment = symbolAlignments.filter((s) => s.avgAlignment < 0.5);
    if (lowAlignment.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        action: `Review ${lowAlignment.length} low-alignment symbols - may not serve mission`,
        category: 'alignment',
      });
    }

    // Recommendations for weak alignments
    if (weakAlignments.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        action: `Strengthen ${weakAlignments.length} partially-aligned implementations`,
        category: 'alignment',
      });
    }

    // Recommendations for missing implementations
    const highPriorityMissing = missingImplementations.filter(
      (m) => m.priority === 'HIGH'
    );
    if (highPriorityMissing.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        action: `Implement ${highPriorityMissing.length} missing principles`,
        category: 'gap',
      });
    }

    // General recommendation
    const averageAlignment =
      symbolAlignments.reduce((sum, s) => sum + s.avgAlignment, 0) /
      symbolAlignments.length;

    if (averageAlignment >= 0.7) {
      recommendations.push({
        priority: 'LOW',
        action: 'Feature shows strong mission alignment - continue current direction',
        category: 'alignment',
      });
    } else if (averageAlignment < 0.5) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Consider whether this feature truly serves organizational mission',
        category: 'alignment',
      });
    }

    return recommendations;
  }

  /**
   * Create empty analysis when no symbols found
   */
  private createEmptyAnalysis(featureName: string): MissionAlignmentAnalysis {
    return {
      featureName,
      symbols: [],
      alignedPrinciples: [],
      weakAlignments: [],
      missingImplementations: [],
      recommendations: [
        {
          priority: 'HIGH',
          action:
            'No symbols found - check if structural overlay exists or try different feature name',
          category: 'implementation',
        },
      ],
      summary: {
        totalSymbols: 0,
        averageAlignment: 0,
        totalPrinciples: 0,
        alignmentLevel: 'LOW',
      },
    };
  }
}
