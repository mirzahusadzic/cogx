import path from 'path';
import fs from 'fs/promises';
import { PGCManager, LineageQueryResult } from './pgc-manager.js';
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

  public async generateLineageForAllPatterns(): Promise<void> {
    const overlayPath = path.join(
      this.pgc.pgcRoot,
      'overlays',
      'structural_patterns'
    );
    const manifestPath = path.join(overlayPath, 'manifest.json');

    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      for (const [symbolName, relativeFilePath] of Object.entries(manifest)) {
        const jsonFileName = `${relativeFilePath}#${symbolName}.json`;
        const structuralJsonPath = path.join(overlayPath, jsonFileName);

        try {
          const structuralContent = await fs.readFile(
            structuralJsonPath,
            'utf-8'
          );
          const structuralData = JSON.parse(
            structuralContent
          ) as StructuralData;

          const searchPath = path.dirname(path.join(overlayPath, jsonFileName));

          const sourceHash = '';

          await this.generateAndStoreLineagePattern(
            symbolName,
            structuralData,
            relativeFilePath as string,
            sourceHash,
            searchPath
          );
        } catch (error) {
          console.error(
            chalk.red(
              `Error processing symbol ${symbolName} from ${structuralJsonPath}:`
            ),
            error
          );
        }
      }
    } catch (error) {
      console.error(
        chalk.red(`Error reading or parsing manifest file at ${manifestPath}:`),
        error
      );
    }
  }

  private _determineMaxDepth(structuralData: StructuralData): number {
    if (
      structuralData.classes?.some((c) => (c.methods?.length || 0) > 0) ||
      structuralData.functions?.some((f) => (f.params?.length || 0) > 0) ||
      structuralData.interfaces?.some((i) => (i.properties?.length || 0) > 0)
    ) {
      return 2;
    }
    return 1;
  }

  public async generateAndStoreLineagePattern(
    symbolName: string,
    structuralData: StructuralData,
    filePath: string,
    sourceHash: string,
    searchPath: string
  ) {
    await this.vectorDB.initialize('lineage_patterns');

    const maxDepth = this._determineMaxDepth(structuralData);

    const lineageResult = await this.pgc.getLineageForStructuralData(
      structuralData,
      maxDepth,
      searchPath,
      filePath
    );

    const lineageJson = this._formatAsLineageJSON(lineageResult);
    const signature = JSON.stringify(lineageJson, null, 2);

    const lineageDataHash = this.pgc.objectStore.computeHash(signature);

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

    const vectorId = `pattern_${filePath.replace(
      /[^a-zA-Z0-9]/g,
      '_'
    )}_${symbolName.replace(/[^a-zA-Z0-9]/g, '_')}`;

    await this.vectorDB.storeVector(vectorId, embedding, {
      symbol: symbolName,
      structural_signature: signature,
      architectural_role: 'lineage_pattern',
      computed_at: new Date().toISOString(),
      lineage_hash: lineageDataHash,
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
      vectorId: vectorId,
    };

    const overlayKey = `${filePath}#${symbolName}`;
    await this.pgc.overlays.update('lineage_patterns', overlayKey, metadata);
  }

  private _formatAsLineageJSON(lineageResult: LineageQueryResult): object {
    const rootSymbol =
      lineageResult.initialContext[0]?.classes?.[0]?.name ||
      lineageResult.initialContext[0]?.functions?.[0]?.name ||
      lineageResult.initialContext[0]?.interfaces?.[0]?.name ||
      '';

    const lineage = lineageResult.dependencies.map((dep) => {
      const depSymbol =
        dep.structuralData.classes?.[0]?.name ||
        dep.structuralData.functions?.[0]?.name ||
        dep.structuralData.interfaces?.[0]?.name ||
        '';
      return {
        type: depSymbol,
        relationship: 'uses',
        depth: dep.depth,
      };
    });

    return {
      symbol: rootSymbol,
      lineage: lineage,
    };
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

    const targetVector = await this.vectorDB.getVector(targetMetadata.vectorId);
    if (!targetVector) {
      throw new Error(`Vector not found for symbol: ${symbol}`);
    }

    const similar = await this.vectorDB.similaritySearch(
      targetVector.embedding,
      topK + 1
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
