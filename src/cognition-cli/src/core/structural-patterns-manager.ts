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

export interface PatternMetadata {
  symbol: string;
  anchor: string;
  symbolStructuralDataHash: string;
  embeddingHash: string;
  structuralSignature: string;
  computedAt: string;
  vectorId: string;
  validation: {
    sourceHash: string;
    embeddingModelVersion: typeof DEFAULT_EMBEDDING_MODEL_NAME;
  };
}

import { z } from 'zod';

const PatternMetadataSchema = z.object({
  symbol: z.string(),
  anchor: z.string(),
  symbolStructuralDataHash: z.string(),
  embeddingHash: z.string(),
  structuralSignature: z.string(),
  computedAt: z.string(),
  vectorId: z.string(),
  validation: z.object({
    sourceHash: z.string(),
    embeddingModelVersion: z.literal(DEFAULT_EMBEDDING_MODEL_NAME),
  }),
});

export class StructuralPatternsManager implements PatternManager {
  constructor(
    private pgc: PGCManager,
    private vectorDB: LanceVectorStore,
    private workbench: WorkbenchClient
  ) {}

  public async generateAndStorePattern(
    symbolName: string, // The name of the symbol (e.g., class name, function name)
    symbolStructuralData: StructuralData, // StructuralData for the individual symbol
    filePath: string,
    sourceHash: string
  ) {
    await this.vectorDB.initialize('structural_patterns');
    const signature = this.generateStructuralSignature(symbolStructuralData);
    const architecturalRole = this.inferArchitecturalRole(symbolStructuralData);

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

    const lineageHash = this.pgc.objectStore.computeHash(
      JSON.stringify(symbolStructuralData)
    );
    const embeddingHash = this.pgc.objectStore.computeHash(
      JSON.stringify(embedding)
    );

    // Use a combination of filePath and symbolName for vectorId to ensure uniqueness
    const vectorId = `pattern_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${symbolName.replace(/[^a-zA-Z0-9]/g, '_')}`;

    await this.vectorDB.storeVector(vectorId, embedding, {
      symbol: symbolName,
      structural_signature: signature,
      architectural_role: architecturalRole,
      computed_at: new Date().toISOString(),
      lineage_hash: lineageHash,
    });

    const metadata: PatternMetadata = {
      symbol: symbolName,
      anchor: filePath,
      symbolStructuralDataHash: lineageHash,
      embeddingHash,
      structuralSignature: signature,
      computedAt: new Date().toISOString(),
      validation: {
        sourceHash: sourceHash,
        embeddingModelVersion: DEFAULT_EMBEDDING_MODEL_NAME,
      },
      vectorId: vectorId, // Store reference to vector DB entry
    };

    // Use a combination of filePath and symbolName for the overlay key
    const overlayKey = `${filePath}#${symbolName}`;
    await this.pgc.overlays.update('structural_patterns', overlayKey, metadata);
  }

  private inferArchitecturalRole(structuralData: StructuralData): string {
    // Role inference based on the characteristics of a single symbol's structural data
    if (structuralData.classes && structuralData.classes.length > 0) {
      const className = structuralData.classes[0].name;
      if (className.includes('Repository')) return 'data_access';
      if (className.includes('Service')) return 'service';
      if (className.includes('Controller') || className.includes('Handler'))
        return 'controller';
      if (className.includes('Orchestrator')) return 'orchestrator';
    }
    if (structuralData.functions && structuralData.functions.length > 0) {
      const functionName = structuralData.functions[0].name;
      if (functionName.includes('Handler')) return 'controller';
      if (functionName.includes('Util') || functionName.includes('Helper'))
        return 'utility';
    }
    if (structuralData.type) {
      if (structuralData.type.includes('Repository')) return 'data_access';
      if (structuralData.type.includes('Service')) return 'service';
      if (
        structuralData.type.includes('Controller') ||
        structuralData.type.includes('Handler')
      )
        return 'controller';
      if (structuralData.type.includes('Orchestrator')) return 'orchestrator';
    }

    // Fallback for general components or if no specific role is inferred
    return 'component';
  }

  private generateStructuralSignature(structuralData: StructuralData): string {
    // Generate a signature based on the characteristics of a single symbol's structural data
    const parts: string[] = [];

    if (structuralData.classes && structuralData.classes.length > 0) {
      const cls = structuralData.classes[0];
      parts.push(`class:${cls.name}`);
      if (cls.base_classes && cls.base_classes.length > 0) {
        parts.push(`extends:${cls.base_classes.join(',')}`);
      }
      if (cls.implements_interfaces && cls.implements_interfaces.length > 0) {
        parts.push(`implements:${cls.implements_interfaces.join(',')}`);
      }
      parts.push(`methods:${cls.methods.length}`);
      parts.push(`decorators:${cls.decorators.length}`);
    }

    if (structuralData.functions && structuralData.functions.length > 0) {
      const func = structuralData.functions[0];
      parts.push(`function:${func.name}`);
      parts.push(`params:${func.params.length}`);
      parts.push(`returns:${func.returns}`);
      parts.push(`async:${func.is_async}`);
      parts.push(`decorators:${func.decorators.length}`);
    }

    if (structuralData.interfaces && structuralData.interfaces.length > 0) {
      const iface = structuralData.interfaces[0];
      parts.push(`interface:${iface.name}`);
      parts.push(`properties:${iface.properties.length}`);
    }

    if (structuralData.imports && structuralData.imports.length > 0) {
      parts.push(`imports:${structuralData.imports.length}`);
    }

    if (structuralData.exports && structuralData.exports.length > 0) {
      parts.push(`exports:${structuralData.exports.length}`);
    }

    if (structuralData.type) {
      parts.push(`type:${structuralData.type}`);
    }

    // Sort parts for consistent signature generation
    return parts.sort().join(' | ');
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
    const manifest = await this.pgc.overlays.get(
      'structural_patterns',
      'manifest',
      z.record(z.string())
    );

    if (!manifest) {
      console.log(chalk.yellow(`No structural patterns manifest found.`));
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
      'structural_patterns',
      overlayKey,
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

  public async getVectorForSymbol(
    symbol: string
  ): Promise<VectorRecord | undefined> {
    const manifest = await this.pgc.overlays.get(
      'structural_patterns',
      'manifest',
      z.record(z.string())
    );

    if (!manifest) {
      console.log(chalk.yellow(`No structural patterns manifest found.`));
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
      'structural_patterns',
      overlayKey,
      PatternMetadataSchema
    );
    if (!targetMetadata) {
      console.log(chalk.yellow(`No pattern found for symbol: ${symbol}`));
      return undefined;
    }

    return this.vectorDB.getVector(targetMetadata.vectorId);
  }
}
