import { Index } from '../../pgc/index.js';
import { TransformLog } from '../../pgc/transform-log.js';
import { WorkbenchClient } from '../../executors/workbench-client.js';

export interface IntentEmbedding {
  symbol: string;
  filePath: string;
  embedding: number[];
  intent_count: number;
  /** Human-readable synthesized narrative from transform lineage */
  narrative: string;
  /** Weighted average confidence (0.0–1.0) */
  confidence: number;
}

interface IntentEntry {
  intent: string;
  confidence: number;
  method: string;
}

export class IntentEmbeddingGenerator {
  constructor(
    private index: Index,
    private transformLog: TransformLog,
    private workbench: WorkbenchClient
  ) {}

  /**
   * Generate an intent embedding for a symbol by synthesizing its transform lineage.
   * Returns null if no lineage exists (graceful fallback to shadow-only coherence).
   */
  async generateForSymbol(
    symbolName: string,
    filePath: string
  ): Promise<IntentEmbedding | null> {
    const intents = await this.loadIntents(filePath);
    if (intents.length === 0) {
      return null;
    }

    const narrative = this.synthesizeNarrative(intents);
    const confidence = this.computeConfidence(intents);

    try {
      const response = await this.workbench.embed({
        signature: narrative,
        dimensions: 768,
        prompt_name: 'query',
      });

      const embedding = response.embedding as number[];
      if (!embedding || !Array.isArray(embedding)) {
        return null;
      }

      return {
        symbol: symbolName,
        filePath,
        embedding,
        intent_count: intents.length,
        narrative,
        confidence,
      };
    } catch {
      return null;
    }
  }

  /** Extract intents from file history loaded via Index + TransformLog */
  private async loadIntents(filePath: string): Promise<IntentEntry[]> {
    const indexData = await this.index.get(filePath);
    if (!indexData || !indexData.history || indexData.history.length === 0) {
      return [];
    }

    const intents: IntentEntry[] = [];

    for (const transformId of indexData.history) {
      const transform = await this.transformLog.getTransformation(transformId);
      if (transform?.reasoning?.intent) {
        intents.push({
          intent: transform.reasoning.intent,
          confidence: transform.reasoning.confidence ?? 0.5,
          method: transform.method ?? 'unknown',
        });
      }
    }

    return intents;
  }

  /** Synthesize a single readable narrative from multiple intent strings */
  private synthesizeNarrative(intents: Array<{ intent: string }>): string {
    return intents.map((i) => i.intent).join('. ') + '.';
  }

  /** Compute weighted confidence across multiple intents */
  private computeConfidence(
    intents: Array<{ confidence: number; method: string }>
  ): number {
    if (intents.length === 0) return 0;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const entry of intents) {
      let weight: number;
      if (entry.method === 'git_rehydration') {
        weight = 0.3;
      } else if (entry.method.includes('ast')) {
        weight = 0.5;
      } else {
        weight = 1.0;
      }
      weightedSum += entry.confidence * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
}
