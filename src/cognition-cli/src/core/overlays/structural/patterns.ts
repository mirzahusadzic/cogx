import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import * as workerpool from 'workerpool';
import chalk from 'chalk';
import { z } from 'zod';
import os from 'os';

import { PatternManager } from '../../pgc/patterns.js';
import { PGCManager } from '../../pgc/manager.js';
import { LanceVectorStore, VectorRecord } from '../vector-db/lance-store.js';
import { WorkbenchClient } from '../../executors/workbench-client.js';
import { StructuralData } from '../../types/structural.js';
import { EmbeddingService } from '../../services/embedding.js';
import { EmbedResponse } from '../../types/workbench.js';
import {
  DEFAULT_EMBEDDING_DIMENSIONS,
  DEFAULT_EMBEDDING_MODEL_NAME,
} from '../../../config.js';

/**
 * Calculate optimal worker count based on system resources and workload
 *
 * NOTE: Workers now only perform mining (AST parsing, signature generation).
 * Embedding is done sequentially in the main process to respect rate limits.
 * We can safely use multiple workers for the CPU-intensive mining phase.
 */
function calculateOptimalWorkers(jobCount: number): number {
  const cpuCount = os.cpus().length;

  if (jobCount <= 10) {
    return Math.min(2, cpuCount); // Small jobs: 2 workers max
  }

  if (jobCount <= 50) {
    return Math.min(4, cpuCount); // Medium jobs: 4 workers max
  }

  // Large jobs: use up to 8 workers (leave some CPUs for main process)
  return Math.min(8, Math.floor(cpuCount * 0.75));
}

export interface PatternMetadata {
  symbol: string;
  anchor: string;
  symbolStructuralDataHash: string;
  embeddingHash: string;
  structuralSignature: string;
  architecturalRole: string;
  computedAt: string;
  vectorId: string;
  validation: {
    sourceHash: string;
    embeddingModelVersion: typeof DEFAULT_EMBEDDING_MODEL_NAME;
    extractionMethod: string;
    fidelity: number;
  };
}

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

interface StructuralJobPacket {
  projectRoot: string;
  symbolName: string;
  filePath: string;
  contentHash: string;
  structuralHash: string;
  structuralData: StructuralData;
  force: boolean;
}

interface StructuralMiningResult {
  status: 'success' | 'skipped' | 'error';
  symbolName: string;
  filePath: string;
  signature?: string;
  architecturalRole?: string;
  structuralData?: StructuralData;
  contentHash?: string;
  structuralHash?: string;
  message?: string;
}

export class StructuralPatternsManager implements PatternManager {
  private workerPool?: workerpool.Pool;
  private embeddingService?: EmbeddingService;
  private useWorkers: boolean = false;

  constructor(
    private pgc: PGCManager,
    private vectorDB: LanceVectorStore,
    private workbench: WorkbenchClient
  ) {}

  /**
   * Initialize worker pool for parallel processing with optimal size
   * @param jobCount - Number of jobs to process (used to calculate optimal worker count)
   */
  public initializeWorkers(jobCount?: number): void {
    if (this.workerPool) return;

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const workerCount = jobCount
      ? calculateOptimalWorkers(jobCount)
      : os.cpus().length;

    if (jobCount) {
      console.log(
        chalk.blue(
          `[StructuralPatterns] Initializing worker pool with ${workerCount} workers for ${jobCount} jobs (${os.cpus().length} CPUs available)`
        )
      );
    }

    this.workerPool = workerpool.pool(
      path.resolve(__dirname, '../../../../dist/structural-worker.cjs'),
      {
        workerType: 'thread', // Use worker_threads instead of child processes for better cleanup
        maxWorkers: workerCount,
      }
    );

    // Initialize centralized embedding service
    this.embeddingService = new EmbeddingService(
      process.env.WORKBENCH_URL || 'http://localhost:8000'
    );

    // Configure PGC to use our embedding service
    this.pgc.setEmbeddingRequestHandler(this.requestEmbedding.bind(this));

    this.useWorkers = true;

    if (!jobCount) {
      console.log(
        chalk.blue(
          '[StructuralPatterns] Worker pool and embedding service initialized'
        )
      );
    }
  }

  /**
   * Centralized embedding request handler for workers
   */
  private async requestEmbedding(params: {
    signature: string;
    dimensions: number;
  }): Promise<EmbedResponse> {
    if (!this.embeddingService) {
      throw new Error('Embedding service not initialized');
    }
    return this.embeddingService.getEmbedding(
      params.signature,
      params.dimensions
    );
  }

  /**
   * Shutdown worker pool and embedding service
   */
  public async shutdown(): Promise<void> {
    if (this.workerPool) {
      console.log(
        chalk.blue(
          '[StructuralPatterns] Shutting down worker pool and embedding service...'
        )
      );
      await this.workerPool.terminate(true);
      this.workerPool = undefined;
    }
    if (this.embeddingService) {
      await this.embeddingService.shutdown();
      this.embeddingService = undefined;
    }
    this.useWorkers = false;
  }

  /**
   * Generate patterns in two phases:
   * Phase 1: Mine patterns in parallel (fast, CPU-intensive)
   * Phase 2: Generate embeddings sequentially (slow, rate-limited)
   */
  public async generatePatternsParallel(
    jobs: StructuralJobPacket[]
  ): Promise<void> {
    if (!this.workerPool) {
      throw new Error(
        'Worker pool not initialized. Call initializeWorkers() first.'
      );
    }
    if (!this.embeddingService) {
      throw new Error('Embedding service not initialized.');
    }

    // Phase 1: Mine patterns in parallel
    console.log(
      chalk.blue(
        `[StructuralPatterns] Phase 1: Mining ${jobs.length} patterns with workers...`
      )
    );

    let miningResults: StructuralMiningResult[];
    try {
      const promises = jobs.map((job) =>
        this.workerPool!.exec('processStructuralPattern', [job])
      );

      miningResults = (await Promise.all(promises)) as StructuralMiningResult[];

      const mined = miningResults.filter((r) => r.status === 'success').length;
      const skipped = miningResults.filter(
        (r) => r.status === 'skipped'
      ).length;
      const failed = miningResults.filter((r) => r.status === 'error').length;

      console.log(
        chalk.green(
          `[StructuralPatterns] Mining complete: ${mined} mined, ${skipped} skipped, ${failed} failed`
        )
      );
    } catch (error) {
      console.error(chalk.red('[StructuralPatterns] Mining error:'), error);
      throw error;
    }

    // Phase 2: Generate embeddings sequentially (respecting rate limits)
    const successfulMines = miningResults.filter((r) => r.status === 'success');

    if (successfulMines.length === 0) {
      console.log(chalk.yellow('[StructuralPatterns] No patterns to embed.'));
      return;
    }

    console.log(
      chalk.blue(
        `[StructuralPatterns] Phase 2: Generating embeddings for ${successfulMines.length} patterns...`
      )
    );

    await this.vectorDB.initialize('structural_patterns');

    let embeddedCount = 0;
    let embedFailedCount = 0;

    for (const result of successfulMines) {
      try {
        await this.generateAndStoreEmbedding(result);
        embeddedCount++;

        // Show progress every 10 patterns
        if (embeddedCount % 10 === 0) {
          console.log(
            chalk.dim(
              `[StructuralPatterns] Progress: ${embeddedCount}/${successfulMines.length} embedded`
            )
          );
        }
      } catch (error) {
        console.error(
          chalk.red(
            `[StructuralPatterns] Failed to embed ${result.symbolName}: ${(error as Error).message}`
          )
        );
        embedFailedCount++;
      }
    }

    console.log(
      chalk.green(
        `[StructuralPatterns] Embedding complete: ${embeddedCount} succeeded, ${embedFailedCount} failed`
      )
    );
  }

  /**
   * Generate embedding and store pattern for a single mined result
   */
  private async generateAndStoreEmbedding(
    result: StructuralMiningResult
  ): Promise<void> {
    const {
      symbolName,
      filePath,
      signature,
      architecturalRole,
      structuralData,
      contentHash,
      structuralHash,
    } = result;

    if (
      !signature ||
      !architecturalRole ||
      !structuralData ||
      !contentHash ||
      !structuralHash
    ) {
      throw new Error(`Missing required data for ${symbolName}`);
    }

    console.log(chalk.dim(`  [Embed] ${symbolName} - requesting embedding...`));

    // Request embedding through centralized service
    const embedResponse = await this.workbench.embed({
      signature,
      dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
    });

    const embedding =
      embedResponse[`embedding_${DEFAULT_EMBEDDING_DIMENSIONS}d`];

    if (!embedding) {
      throw new Error(
        `Could not find embedding for dimension ${DEFAULT_EMBEDDING_DIMENSIONS}`
      );
    }

    console.log(chalk.dim(`  [Embed] ${symbolName} - computing hashes...`));

    const lineageHash = this.pgc.objectStore.computeHash(
      JSON.stringify(structuralData)
    );
    const embeddingHash = this.pgc.objectStore.computeHash(
      JSON.stringify(embedding)
    );
    const vectorId = `pattern_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${symbolName.replace(/[^a-zA-Z0-9]/g, '_')}`;

    console.log(chalk.dim(`  [Embed] ${symbolName} - storing vector...`));

    // Store vector
    await this.vectorDB.storeVector(vectorId, embedding as number[], {
      symbol: symbolName,
      structural_signature: signature,
      architectural_role: architecturalRole,
      computed_at: new Date().toISOString(),
      lineage_hash: lineageHash,
    });

    // Update PGC overlays
    const metadata: PatternMetadata = {
      symbol: symbolName,
      anchor: filePath,
      symbolStructuralDataHash: structuralHash,
      embeddingHash,
      structuralSignature: signature,
      architecturalRole: architecturalRole,
      computedAt: new Date().toISOString(),
      validation: {
        sourceHash: contentHash,
        embeddingModelVersion: DEFAULT_EMBEDDING_MODEL_NAME,
        extractionMethod: structuralData.extraction_method,
        fidelity: structuralData.fidelity,
      },
      vectorId: vectorId,
    };

    const overlayKey = `${filePath}#${symbolName}`;
    console.log(
      chalk.dim(`  [Embed] ${symbolName} - updating overlay "${overlayKey}"...`)
    );

    // CRITICAL: Update overlay metadata FIRST, then manifest
    // If overlay update fails, manifest won't have a stale entry
    await this.pgc.overlays.update('structural_patterns', overlayKey, metadata);

    console.log(chalk.dim(`  [Embed] ${symbolName} - updating manifest...`));
    await this.pgc.overlays.updateManifest(
      'structural_patterns',
      symbolName,
      filePath
    );

    console.log(chalk.dim(`  [Embed] ${symbolName} - ✓ complete`));
  }

  /**
   * Get embedding service statistics for monitoring
   */
  public getEmbeddingStats(): { queueSize: number; isProcessing: boolean } {
    if (!this.embeddingService) {
      return { queueSize: 0, isProcessing: false };
    }
    return {
      queueSize: this.embeddingService.getQueueSize(),
      isProcessing: this.embeddingService.isProcessing(),
    };
  }

  /**
   * Original single-threaded method (kept for backwards compatibility)
   */
  public async generateAndStorePattern(
    symbolName: string,
    symbolStructuralData: StructuralData,
    relativePath: string,
    sourceHash: string,
    structuralDataHash: string
  ): Promise<void> {
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

    const vectorId = `pattern_${relativePath.replace(/[^a-zA-Z0-9]/g, '_')}_${symbolName.replace(/[^a-zA-Z0-9]/g, '_')}`;

    await this.vectorDB.storeVector(vectorId, embedding as number[], {
      symbol: symbolName,
      structural_signature: signature,
      architectural_role: architecturalRole,
      computed_at: new Date().toISOString(),
      lineage_hash: lineageHash,
    });

    const metadata: PatternMetadata = {
      symbol: symbolName,
      anchor: relativePath,
      symbolStructuralDataHash: structuralDataHash,
      embeddingHash,
      structuralSignature: signature,
      architecturalRole: architecturalRole,
      computedAt: new Date().toISOString(),
      validation: {
        sourceHash: sourceHash,
        embeddingModelVersion: DEFAULT_EMBEDDING_MODEL_NAME,
        extractionMethod: symbolStructuralData.extraction_method,
        fidelity: symbolStructuralData.fidelity,
      },
      vectorId: vectorId,
    };

    const overlayKey = `${relativePath}#${symbolName}`;
    await this.pgc.overlays.update('structural_patterns', overlayKey, metadata);
  }

  private inferArchitecturalRole(structuralData: StructuralData): string {
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

    return 'component';
  }

  private generateStructuralSignature(structuralData: StructuralData): string {
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

    return parts.sort().join(' | ');
  }

  public async findSimilarPatterns(
    symbol: string,
    topK: number = 10
  ): Promise<
    Array<{
      symbol: string;
      filePath: string;
      similarity: number;
      architecturalRole: string;
      explanation: string;
    }>
  > {
    const manifest = await this.pgc.overlays.get(
      'structural_patterns',
      'manifest',
      z.record(z.string())
    );

    if (!manifest) {
      console.log(chalk.yellow(`No structural patterns manifest found.`));
      return [];
    }

    const filePath = manifest[symbol];

    if (!filePath) {
      console.log(chalk.yellow(`No pattern found for symbol: ${symbol}`));
      return [];
    }

    const overlayKey = `${filePath}#${symbol}`;

    const targetMetadata = await this.pgc.overlays.get(
      'structural_patterns',
      overlayKey,
      PatternMetadataSchema
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
        filePath: result.metadata.anchor as string,
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

    const filePath = manifest[symbol];

    if (!filePath) {
      console.log(chalk.yellow(`No pattern found for symbol: ${symbol}`));
      return undefined;
    }

    const overlayKey = `${filePath}#${symbol}`;

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
