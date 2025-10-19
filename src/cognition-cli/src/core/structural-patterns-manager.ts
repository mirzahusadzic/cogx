import { PGCManager } from './pgc-manager.js';
import { LanceVectorStore } from '../lib/patterns/vector-db/lance-vector-store.js';
import { WorkbenchClient } from '../executors/workbench-client.js';
import { StructuralData } from '../types/structural.js';
import { DEFAULT_EMBEDDING_DIMENSIONS } from '../config.js';
import { EmbedResponse } from '../types/workbench.js';
import chalk from 'chalk';

export interface PatternMetadata {
  symbol: string;
  anchor: string;
  lineageHash: string;
  embeddingHash: string;
  structuralSignature: string;
  computedAt: string;
  vectorId: string;
  validation: {
    sourceHash: string;
    embeddingModelVersion: string;
  };
}

import { z } from 'zod';

const PatternMetadataSchema = z.object({
  symbol: z.string(),
  anchor: z.string(),
  lineageHash: z.string(),
  embeddingHash: z.string(),
  structuralSignature: z.string(),
  computedAt: z.string(),
  vectorId: z.string(),
  validation: z.object({
    sourceHash: z.string(),
    embeddingModelVersion: z.string(),
  }),
});

export class StructuralPatternsManager {
  constructor(
    private pgc: PGCManager,
    private vectorDB: LanceVectorStore,
    private workbench: WorkbenchClient
  ) {}

  public async generateAndStorePattern(
    symbol: string,
    filePath: string,
    sourceHash: string
  ) {
    const { dependencies, initialContext } = await this.pgc.getLineageForSymbol(
      symbol,
      { maxDepth: 5 }
    );

    if (initialContext.length === 0) {
      console.warn(
        `[Pattern] No initial context found for ${symbol}, skipping.`
      );
      return;
    }

    const lineage = [
      ...initialContext,
      ...dependencies.map((d) => d.structuralData),
    ];

    const signature = this.generateStructuralSignature(lineage);
    const architecturalRole = this.inferArchitecturalRole(lineage); // ✅ ADD THIS

    const embedResponse: EmbedResponse = await this.workbench.embed({
      signature,
      dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
    });

    const embedding =
      embedResponse[`embedding_${DEFAULT_EMBEDDING_DIMENSIONS}d`];

    if (!embedding) {
      console.error(
        `Could not find embedding for dimension ${DEFAULT_EMBEDDING_DIMENSIONS} in response for ${symbol}`
      );
      return;
    }

    const lineageHash = this.pgc.objectStore.computeHash(
      JSON.stringify(lineage)
    );
    const embeddingHash = this.pgc.objectStore.computeHash(
      JSON.stringify(embedding)
    );

    // Use symbol-based ID to avoid collisions
    const vectorId = `pattern_${symbol.replace(/[^a-zA-Z0-9]/g, '_')}`;

    await this.vectorDB.storeVector(vectorId, embedding, {
      symbol: symbol,
      structural_signature: signature,
      architectural_role: architecturalRole,
      computed_at: new Date().toISOString(),
      lineage_hash: lineageHash,
    });

    const metadata: PatternMetadata = {
      symbol: symbol,
      anchor: filePath,
      lineageHash,
      embeddingHash,
      structuralSignature: signature,
      computedAt: new Date().toISOString(),
      validation: {
        sourceHash: sourceHash,
        embeddingModelVersion: 'eGemma-v2-alpha',
      },
      vectorId: vectorId, // ✅ Store reference to vector DB entry
    };

    await this.pgc.overlays.update('structural_patterns', symbol, metadata); // ✅ Use symbol as overlay key
  }

  private inferArchitecturalRole(lineage: StructuralData[]): string {
    // Simple role inference based on lineage characteristics
    const dependencyCount = lineage.length;
    const depth = Math.max(...lineage.map((item) => item.depth || 0));
    const hasManyDependencies = dependencyCount > 10;
    const hasDeepHierarchy = depth > 3;

    if (hasManyDependencies && hasDeepHierarchy) {
      return 'orchestrator';
    } else if (lineage.some((item) => item.type?.includes('Repository'))) {
      return 'data_access';
    } else if (lineage.some((item) => item.type?.includes('Service'))) {
      return 'service';
    } else if (
      lineage.some(
        (item) =>
          item.type?.includes('Controller') || item.type?.includes('Handler')
      )
    ) {
      return 'controller';
    } else if (dependencyCount === 0) {
      return 'utility';
    }

    return 'component';
  }

  private generateStructuralSignature(lineage: StructuralData[]): string {
    // Group by relationship type and depth for better pattern recognition
    const relationships = new Map<string, number>();

    for (const item of lineage) {
      const relationship = item.relationship || 'uses';
      const depth = item.depth || 1;
      const type = item.type || this.extractPrimaryType(item);

      if (type) {
        const key = `${relationship}:${type}`;
        const weight = 1 / Math.sqrt(depth); // Weight by depth
        relationships.set(key, (relationships.get(key) || 0) + weight);
      }
    }

    // Convert to sorted signature
    return Array.from(relationships.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by weight descending
      .slice(0, 15) // Top 15 most significant relationships
      .map(([key, weight]) => `${key}:${weight.toFixed(2)}`)
      .join(' | ');
  }

  private extractPrimaryType(structuralData: StructuralData): string {
    if (structuralData.classes?.length > 0)
      return structuralData.classes[0].name;
    if (structuralData.functions?.length > 0)
      return structuralData.functions[0].name;
    if (structuralData.interfaces && structuralData.interfaces.length > 0)
      return structuralData.interfaces[0].name;
    if (structuralData.type) return structuralData.type;
    return 'unknown';
  }

  public async findSimilarPatterns(
    symbol: string,
    topK: number = 10
  ): Promise<
    Array<{
      symbol: string;
      similarity: number;
      architecturalRole: string;
      explanation: string;
    }>
  > {
    // Get target pattern metadata
    const targetMetadata = await this.pgc.overlays.get(
      'structural_patterns',
      symbol,
      PatternMetadataSchema
    );
    if (!targetMetadata) {
      console.log(chalk.yellow(`No pattern found for symbol: ${symbol}`));
      return [];
    }

    // Get target vector
    const targetVector = await this.vectorDB.getVector(targetMetadata.vectorId);
    if (!targetVector) {
      throw new Error(`Vector not found for symbol: ${symbol}`);
    }

    // Find similar patterns
    const similar = await this.vectorDB.similaritySearch(
      targetVector.embedding,
      topK + 1 // +1 to exclude self
    );

    // Filter out self and format results
    return similar
      .filter((result) => result.id !== targetMetadata.vectorId)
      .map((result) => ({
        symbol: result.metadata.symbol as string,
        similarity: result.similarity,
        architecturalRole: result.metadata.architectural_role as string,
        explanation: this.generateSimilarityExplanation(
          targetMetadata.structuralSignature,
          result.metadata.structural_signature as string
        ),
      }));
  }

  private generateSimilarityExplanation(
    targetSignature: string,
    resultSignature: string
  ): string {
    const targetParts = new Set(targetSignature.split(' | '));
    const resultParts = new Set(resultSignature.split(' | '));
    const common = [...targetParts].filter((part) => resultParts.has(part));

    return `Shared patterns: ${common.slice(0, 3).join(', ')}`;
  }
}
