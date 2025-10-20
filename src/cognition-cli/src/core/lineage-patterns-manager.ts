import { PGCManager } from './pgc-manager.js';
import { LanceVectorStore } from '../lib/patterns/vector-db/lance-vector-store.js';
import { WorkbenchClient } from '../executors/workbench-client.js';
import {
  LineagePatternMetadata,
  LineagePatternMetadataSchema,
} from '../types/lineage.js';
import { DEFAULT_EMBEDDING_DIMENSIONS } from '../config.js';
import { EmbedResponse } from '../types/workbench.js';
import { formatAsLineageJSON, QueryResult } from '../commands/query.js';
import chalk from 'chalk';
import { z } from 'zod';
import {
  Field,
  Schema,
  Utf8,
  FixedSizeList,
  Float,
  Precision,
} from 'apache-arrow';

export const LINEAGE_VECTOR_RECORD_SCHEMA = new Schema([
  new Field('id', new Utf8()),
  new Field('symbol', new Utf8()),
  new Field(
    'embedding',
    new FixedSizeList(
      DEFAULT_EMBEDDING_DIMENSIONS,
      new Field('item', new Float(Precision.DOUBLE))
    )
  ),
  new Field('structural_signature', new Utf8()),
  new Field('architectural_role', new Utf8()),
  new Field('computed_at', new Utf8()),
  new Field('lineage_hash', new Utf8()),
]);

export class LineagePatternsManager {
  constructor(
    private pgc: PGCManager,
    private vectorDB: LanceVectorStore,
    private workbench: WorkbenchClient
  ) {}

  public async generateAndStoreLineagePattern(
    symbolName: string,
    filePath: string,
    queryResult: QueryResult,
    sourceHash: string
  ) {
    await this.vectorDB.initialize(
      'lineage_patterns',
      LINEAGE_VECTOR_RECORD_SCHEMA
    );
    const lineageSignature = formatAsLineageJSON(queryResult);

    const embedResponse: EmbedResponse = await this.workbench.embed({
      signature: lineageSignature,
      dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
    });

    const embedding =
      embedResponse[`embedding_${DEFAULT_EMBEDDING_DIMENSIONS}d`];

    if (!embedding) {
      console.error(
        `Could not find embedding for dimension ${DEFAULT_EMBEDDING_DIMENSIONS} in response for lineage of ${symbolName}`
      );
      return;
    }

    const lineageEmbeddingHash = this.pgc.objectStore.computeHash(
      JSON.stringify(embedding)
    );

    const vectorId = `lineage_pattern_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${symbolName.replace(/[^a-zA-Z0-9]/g, '_')}`;

    await this.vectorDB.storeVector(vectorId, embedding, {
      symbol: symbolName,
      structural_signature: lineageSignature, // Storing lineageSignature here
      architectural_role: 'lineage', // A generic role for lineage patterns
      computed_at: new Date().toISOString(),
      lineage_hash: lineageEmbeddingHash, // Hash of the embedding itself
    });

    const metadata: LineagePatternMetadata = {
      symbol: symbolName,
      anchor: filePath,
      lineageSignature,
      lineageEmbeddingHash,
      computedAt: new Date().toISOString(),
      validation: {
        sourceHash: sourceHash,
        embeddingModelVersion: 'eGemma-v2-alpha',
      },
      vectorId: vectorId,
    };

    const overlayKey = `${filePath}#${symbolName}`;
    await this.pgc.overlays.update('lineage_patterns', overlayKey, metadata);
  }

  public async findSimilarLineagePatterns(
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
      console.log(
        chalk.yellow(`No lineage pattern found for symbol: ${symbol}`)
      );
      return [];
    }

    if (matchingKeys.length > 1) {
      console.warn(
        chalk.yellow(
          `Multiple lineage patterns found for symbol: ${symbol}. Using the first match: ${matchingKeys[0]}`
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
      console.log(
        chalk.yellow(`No lineage pattern found for symbol: ${symbol}`)
      );
      return [];
    }

    const targetVector = await this.vectorDB.getVector(targetMetadata.vectorId);
    if (!targetVector) {
      throw new Error(`Vector not found for lineage of symbol: ${symbol}`);
    }

    const similar = await this.vectorDB.similaritySearch(
      targetVector.embedding,
      topK + 1 // +1 to exclude self
    );

    return similar
      .filter((result) => result.id !== targetMetadata.vectorId)
      .map((result) => ({
        symbol: result.metadata.symbol as string,
        similarity: result.similarity,
        architecturalRole: result.metadata.architectural_role as string,
        explanation: this.generateSimilarityExplanation(
          targetMetadata.lineageSignature,
          result.metadata.structural_signature as string
        ),
      }));
  }

  private generateSimilarityExplanation(
    targetSignature: string,
    resultSignature: string
  ): string {
    // For lineage, a simple comparison of the JSON strings might be too strict.
    // A more sophisticated comparison would involve parsing the JSON and comparing the lineage items.
    // For now, we can just indicate if they are identical or not.
    if (targetSignature === resultSignature) {
      return 'Identical lineage signature.';
    } else {
      return 'Different lineage signature.';
    }
  }
}
