import { PGCManager } from './pgc-manager.js';
import { PatternManager } from './pattern-manager.js';
import {
  LanceVectorStore,
  VectorRecord,
} from '../lib/patterns/vector-db/lance-vector-store.js';
import { WorkbenchClient } from '../executors/workbench-client.js';
import { StructuralData } from '../types/structural.js';
import {
  DEFAULT_EMBEDDING_DIMENSIONS,
  DEFAULT_EMBEDDING_MODEL_NAME,
} from '../config.js';
import { EmbedResponse } from '../types/workbench.js';
import chalk from 'chalk';

export interface LineagePatternMetadata {
  symbol: string;
  anchor: string;
  lineageHash: string;
  embeddingHash: string;
  lineageSignature: string;
  computed_at: string;
  vectorId: string;
  validation: {
    sourceHash: string;
    embeddingModelVersion: typeof DEFAULT_EMBEDDING_MODEL_NAME;
  };
}

import { z } from 'zod';

const LineagePatternMetadataSchema = z.object({
  symbol: z.string(),
  anchor: z.string(),
  lineageHash: z.string(),
  embeddingHash: z.string(),
  lineageSignature: z.string(),
  computedAt: z.string(),
  vectorId: z.string(),
  validation: z.object({
    sourceHash: z.string(),
    embeddingModelVersion: z.literal(DEFAULT_EMBEDDING_MODEL_NAME),
  }),
});

export class LineagePatternsManager implements PatternManager {
  constructor(
    private pgc: PGCManager,
    private vectorDB: LanceVectorStore,
    private workbench: WorkbenchClient
  ) {}

  public async generateAndStoreLineagePattern(
    symbolName: string, // The name of the symbol (e.g., class name, function name)
    lineageData: StructuralData, // LineageData for the individual symbol
    filePath: string,
    sourceHash: string
  ) {
    await this.vectorDB.initialize('lineage_patterns');
    const lineageDataHash = this.pgc.objectStore.computeHash(
      JSON.stringify(lineageData)
    );
    const signature = this.generateLineageSignature(
      lineageData,
      lineageDataHash
    );

    const embedResponse: EmbedResponse = await this.workbench.embed({
      signature,
      dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
    });

    const embedding =
      embedResponse[`embedding_${DEFAULT_EMBEDDING_DIMENSIONS}d`];

    if (!embedding) {
      console.error(
        `Could not find embedding for dimension ${DEFAULT_EMBEDDING_DIMENSIONS} in response for ${symbolName}`
      );
      return;
    }
    const embeddingHash = this.pgc.objectStore.computeHash(
      JSON.stringify(embedding)
    );

    // Use a combination of filePath and symbolName for vectorId to ensure uniqueness
    const vectorId = `pattern_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${symbolName.replace(/[^a-zA-Z0-9]/g, '_')}`;

    await this.vectorDB.storeVector(vectorId, embedding, {
      symbol: symbolName,
      structural_signature: signature,
      architectural_role: 'lineage_pattern', // Add a default role
      computed_at: new Date().toISOString(),
      lineage_hash: lineageDataHash, // Add this missing field
    });

    const metadata: LineagePatternMetadata = {
      symbol: symbolName,
      anchor: filePath,
      lineageHash: lineageDataHash,
      embeddingHash,
      lineageSignature: signature,
      computed_at: new Date().toISOString(),
      validation: {
        sourceHash: sourceHash,
        embeddingModelVersion: DEFAULT_EMBEDDING_MODEL_NAME,
      },
      vectorId: vectorId, // Store reference to vector DB entry
    };

    // Use a combination of filePath and symbolName for the overlay key
    const overlayKey = `${filePath}#${symbolName}`;
    await this.pgc.overlays.update('lineage_patterns', overlayKey, metadata);
  }

  private generateLineageSignature(
    lineageData: StructuralData,
    lineageDataHash: string
  ): string {
    // For now, a simple signature based on the lineage hash
    // In the future, this could be more sophisticated, incorporating call graph details etc.
    return `lineage_hash:${lineageDataHash}`;
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
    const manifest = await this.pgc.overlays.get(
      'lineage_patterns',
      'manifest',
      z.record(z.string())
    );

    if (!manifest) {
      console.log(chalk.yellow(`No lineage patterns manifest found.`));
      return [];
    }

    const matchingKeys = Object.keys(manifest).filter((key) =>
      key.endsWith(`#${symbol}`)
    );

    if (matchingKeys.length === 0) {
      console.log(chalk.yellow(`No pattern found for symbol: ${symbol}`));
      return [];
    }

    if (matchingKeys.length > 1) {
      console.warn(
        chalk.yellow(
          `Multiple patterns found for symbol: ${symbol}. Using the first match: ${matchingKeys[0]}`
        )
      );
    }

    const overlayKey = matchingKeys[0];

    const targetMetadata = await this.pgc.overlays.get(
      'lineage_patterns',
      overlayKey,
      LineagePatternMetadataSchema
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
          targetMetadata.lineageSignature,
          result.metadata.structural_signature as string // Compare against structural_signature in DB
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

  public async getVectorForSymbol(
    symbol: string
  ): Promise<VectorRecord | undefined> {
    const manifest = await this.pgc.overlays.get(
      'lineage_patterns',
      'manifest',
      z.record(z.string())
    );

    if (!manifest) {
      console.log(chalk.yellow(`No lineage patterns manifest found.`));
      return undefined;
    }

    const matchingKeys = Object.keys(manifest).filter((key) =>
      key.endsWith(`#${symbol}`)
    );

    if (matchingKeys.length === 0) {
      console.log(chalk.yellow(`No pattern found for symbol: ${symbol}`));
      return undefined;
    }

    if (matchingKeys.length > 1) {
      console.warn(
        chalk.yellow(
          `Multiple patterns found for symbol: ${symbol}. Using the first match: ${matchingKeys[0]}`
        )
      );
    }

    const overlayKey = matchingKeys[0];

    const targetMetadata = await this.pgc.overlays.get(
      'lineage_patterns',
      overlayKey,
      LineagePatternMetadataSchema
    );
    if (!targetMetadata) {
      console.log(chalk.yellow(`No pattern found for symbol: ${symbol}`));
      return undefined;
    }

    return this.vectorDB.getVector(targetMetadata.vectorId);
  }
}
