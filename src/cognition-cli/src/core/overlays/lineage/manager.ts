import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import * as workerpool from 'workerpool';
import os from 'os';

import { PGCManager } from '../../pgc/manager.js';
import { LanceVectorStore, VectorRecord } from '../vector-db/lance-store.js';
import { WorkbenchClient } from '../../executors/workbench-client.js';
import { PatternManager } from '../../pgc/patterns.js';
import { StructuralData } from '../../types/structural.js';
import { EmbeddingService } from '../../services/embedding.js';
import { EmbedResponse } from '../../types/workbench.js';
import { EmbedLogger } from '../shared/embed-logger.js';
import {
  PatternGenerationOptions,
  StructuralSymbolType,
  PatternJobPacket,
  PatternResultPacket,
  LineagePatternMetadata,
  LineagePatternMetadataSchema,
} from './types.js';

/**
 * Calculates optimal worker count based on system resources and workload.
 * Workers perform lineage mining while embedding is done sequentially.
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

/**
 * Represents a dependency discovered during lineage traversal.
 */
export interface Dependency {
  path: string;
  depth: number;
  structuralData: StructuralData;
}

/**
 * Represents the result of a lineage query including dependencies and initial context.
 */
export interface LineageQueryResult {
  dependencies: Dependency[];
  initialContext: StructuralData[];
}

/**
 * Lineage Patterns Manager (O₃) - DEPENDENCY PROVENANCE
 *
 * Manages lineage pattern generation and similarity search using worker-based
 * mining and sequential embedding. Lineage patterns capture the COMPLETE
 * dependency tree of a symbol via provenance-grounded traversal.
 *
 * LATTICE POSITION: O₃ (Structural/Derived)
 * - Derives from: O₁ (structural patterns) via transform log traversal
 * - Uses: PGC reverse_deps for time-traveling dependency discovery
 * - Informs: O₇ (coherence) via dependency-aware weighting
 *
 * ARCHITECTURE:
 * - Two-phase generation:
 *   Phase 1: Mine lineage in parallel (workers traverse transform log)
 *   Phase 2: Generate embeddings sequentially (rate-limited via EmbeddingService)
 * - Worker pool: Optimal sizing based on CPU count and job size
 * - Centralized embedding: Single service coordinates all embedding requests
 *
 * LINEAGE ALGORITHM ("Time-Traveling Archaeologist"):
 * 1. Find symbol in index → get structural_hash
 * 2. Find transform that CREATED this hash (reverse_deps)
 * 3. Get transform manifest → extract INPUT hashes
 * 4. Load input structures → find all dependencies
 * 5. Repeat for each dependency (recursive traversal)
 * 6. Build complete dependency tree with provenance
 *
 * DESIGN RATIONALE:
 * - Provenance-grounded: Uses actual transform log (not just imports)
 * - Parallel mining: Workers handle expensive traversal
 * - Sequential embedding: Centralized service prevents rate limit violations
 * - Complete lineage: Captures full dependency context, not just direct imports
 *
 * EMBEDDINGS:
 * - Each lineage pattern has a 768D vector from eGemma
 * - Embeds the ENTIRE dependency tree structure
 * - Enables queries: "Find symbols with similar dependencies"
 *
 * STORAGE:
 * - Metadata: .open_cognition/overlays/lineage_patterns/<file>#<symbol>.json
 * - Vectors: .open_cognition/lance/lineage_patterns/ (LanceDB)
 * - Manifest: .open_cognition/overlays/lineage_patterns/manifest.json
 *
 * @example
 * // Generate lineage patterns for entire codebase
 * const manager = new LineagePatternsManager(pgc, vectorDB, workbench);
 * await manager.generate({ force: false });
 * await manager.shutdown(); // Critical cleanup
 *
 * @example
 * // Find symbols with similar dependencies
 * const similar = await manager.findSimilarPatterns('MyClass', 10);
 * console.log(`Found ${similar.length} symbols with similar lineage`);
 *
 * @example
 * // Monitor embedding queue
 * const stats = manager.getEmbeddingStats();
 * console.log(`Queue: ${stats.queueSize}, Processing: ${stats.isProcessing}`);
 */
export class LineagePatternsManager implements PatternManager {
  private workerPool: workerpool.Pool | null = null;
  private embeddingService: EmbeddingService;
  private workerScriptPath: string;

  constructor(
    private pgc: PGCManager,
    private vectorDB: LanceVectorStore,
    private workbench: WorkbenchClient
  ) {
    // 1. Store worker script path for lazy initialization
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    this.workerScriptPath = path.resolve(
      __dirname,
      '../../../../dist/lineage-worker.cjs'
    );

    // 2. Initialize the centralized embedding service
    this.embeddingService = new EmbeddingService(this.workbench.getBaseUrl());

    // 3. Configure the PGCManager to use our embedding service
    this.pgc.setEmbeddingRequestHandler(this.requestEmbedding.bind(this));
  }

  /**
   * Initialize worker pool with optimal size based on job count
   */
  private initializeWorkerPool(jobCount: number): void {
    if (this.workerPool) {
      return; // Already initialized
    }

    const workerCount = calculateOptimalWorkers(jobCount);
    console.log(
      chalk.blue(
        `[LineagePatterns] Initializing worker pool with ${workerCount} workers for ${jobCount} jobs (${os.cpus().length} CPUs available)`
      )
    );

    this.workerPool = workerpool.pool(
      this.workerScriptPath,
      /* @vite-ignore */ {
        workerType: 'thread', // Use worker_threads instead of child processes for better cleanup
        maxWorkers: workerCount,
      }
    );
  }

  /**
   * Centralized embedding request handler for workers
   */
  public async requestEmbedding(params: {
    signature: string;
    dimensions: number;
  }): Promise<EmbedResponse> {
    return this.embeddingService.getEmbedding(
      params.signature,
      params.dimensions
    );
  }

  /**
   * Generate lineage patterns in two phases:
   * Phase 1: Mine lineage in parallel (expensive dependency traversal)
   * Phase 2: Generate embeddings sequentially (rate-limited)
   */
  public async generate(options: PatternGenerationOptions = {}): Promise<void> {
    const { symbolTypes = [], files = [], force = false } = options;

    console.log(
      chalk.blue('[LineagePatterns] Starting generation with options:', options)
    );

    const structuralManifest = await this.pgc.overlays.getManifest(
      'structural_patterns'
    );

    if (!structuralManifest || Object.keys(structuralManifest).length === 0) {
      console.warn(
        chalk.yellow(
          '[LineagePatterns] Structural patterns manifest not found. Skipping.'
        )
      );
      return;
    }

    const targetEntries = Object.entries(structuralManifest)
      .map(([symbol, entry]) => {
        const filePath = typeof entry === 'string' ? entry : entry.filePath;
        return [symbol, filePath] as [string, string];
      })
      .filter(([, filePath]) => files.length === 0 || files.includes(filePath));

    const jobs: PatternJobPacket[] = targetEntries
      .map(([symbolName, filePath]) => ({
        projectRoot: this.pgc.projectRoot,
        symbolName,
        filePath: filePath as string,
        symbolType: this._getSymbolType(symbolName),
        force,
      }))
      .filter(
        (job) =>
          symbolTypes.length === 0 || symbolTypes.includes(job.symbolType)
      );

    if (jobs.length === 0) {
      console.log(
        chalk.blue(
          '[LineagePatterns] No new patterns to generate based on current options.'
        )
      );
      return;
    }

    // Phase 1: Mine lineage in parallel
    this.initializeWorkerPool(jobs.length);

    console.log(
      chalk.blue(
        `[LineagePatterns] Phase 1: Mining lineage for ${jobs.length} patterns with workers...`
      )
    );

    let miningResults: PatternResultPacket[];
    try {
      const promises = jobs.map((job) =>
        this.workerPool!.exec('processJob', [job]).catch((error) => ({
          status: 'error' as const,
          symbolName: job.symbolName,
          filePath: job.filePath,
          message: error.message || String(error),
        }))
      );

      // Use Promise.allSettled to continue even if some workers crash
      // This prevents one failing job from stopping all lineage generation
      const settledResults = await Promise.allSettled(promises);

      miningResults = settledResults.map((result) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          // Worker crashed completely - return error result
          return {
            status: 'error' as const,
            symbolName: 'unknown',
            filePath: 'unknown',
            message: result.reason?.message || String(result.reason),
          };
        }
      }) as PatternResultPacket[];

      const mined = miningResults.filter((r) => r.status === 'success').length;
      const skipped = miningResults.filter(
        (r) => r.status === 'skipped'
      ).length;
      const failed = miningResults.filter((r) => r.status === 'error').length;

      console.log(
        chalk.green(
          `[LineagePatterns] Mining complete: ${mined} mined, ${skipped} skipped, ${failed} failed`
        )
      );

      // Log individual worker errors for debugging
      if (failed > 0) {
        const errors = miningResults.filter((r) => r.status === 'error');
        console.warn(
          chalk.yellow(
            `[LineagePatterns] ${failed} worker(s) failed - check logs for details`
          )
        );
        errors.slice(0, 5).forEach((r) => {
          console.warn(
            chalk.dim(`  - ${r.symbolName} (${r.filePath}): ${r.message}`)
          );
        });
        if (errors.length > 5) {
          console.warn(chalk.dim(`  ... and ${errors.length - 5} more`));
        }
      }
    } catch (error) {
      console.error(chalk.red('[LineagePatterns] Mining error:'), error);
      throw error;
    }

    // Phase 2: Generate embeddings sequentially
    const successfulMines = miningResults.filter((r) => r.status === 'success');

    if (successfulMines.length === 0) {
      console.log(chalk.yellow('[LineagePatterns] No patterns to embed.'));
      return;
    }

    console.log(
      chalk.blue(
        `[LineagePatterns] Phase 2: Generating embeddings for ${successfulMines.length} patterns...`
      )
    );

    await this.vectorDB.initialize('lineage_patterns');

    let embeddedCount = 0;
    let embedFailedCount = 0;

    for (const result of successfulMines) {
      try {
        await this.generateAndStoreEmbedding(result);
        embeddedCount++;

        // Show progress every 10 patterns
        if (embeddedCount % 10 === 0) {
          EmbedLogger.progress(
            embeddedCount,
            successfulMines.length,
            'LineagePatterns'
          );
        }
      } catch (error) {
        EmbedLogger.error(result.symbolName, error as Error, 'LineagePatterns');
        embedFailedCount++;
      }
    }

    console.log(
      chalk.green(
        `[LineagePatterns] Embedding complete: ${embeddedCount} succeeded, ${embedFailedCount} failed`
      )
    );
  }

  /**
   * Generate embedding and store lineage pattern for a single mined result
   */
  private async generateAndStoreEmbedding(
    result: PatternResultPacket
  ): Promise<void> {
    const { symbolName, filePath, miningResult } = result;

    if (!miningResult) {
      throw new Error(`Missing mining result for ${symbolName}`);
    }

    const { signature, lineageDataHash, symbolType, validationSourceHash } =
      miningResult;

    EmbedLogger.start(symbolName, 'LineagePatterns');

    // Request embedding through centralized service
    const embedResponse = await this.embeddingService.getEmbedding(
      signature,
      768 // DEFAULT_EMBEDDING_DIMENSIONS
    );

    const embedding = embedResponse[`embedding_768d`];
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error(`Invalid embedding format for ${symbolName}`);
    }

    const embeddingHash = this.pgc.objectStore.computeHash(
      JSON.stringify(embedding)
    );

    const vectorId = `pattern_${filePath.replace(/[^a-zA-Z0-9_]/g, '_')}_${symbolName.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Store vector
    await this.vectorDB.storeVector(vectorId, embedding, {
      symbol: symbolName,
      symbolType: symbolType,
      structural_signature: signature,
      architectural_role: 'lineage_pattern',
      computed_at: new Date().toISOString(),
      lineage_hash: lineageDataHash,
    });

    // Update PGC overlays
    const metadata = {
      symbol: symbolName,
      symbolType: symbolType,
      anchor: filePath,
      lineageHash: lineageDataHash,
      embeddingHash,
      lineageSignature: signature,
      computed_at: new Date().toISOString(),
      validation: {
        sourceHash: validationSourceHash,
        embeddingModelVersion: 'eGemma-2B',
      },
      vectorId: vectorId,
    };

    const overlayKey = `${filePath}#${symbolName}`;
    // CRITICAL: Update overlay metadata FIRST, then manifest
    // If overlay update fails, manifest won't have a stale entry
    await this.pgc.overlays.update('lineage_patterns', overlayKey, metadata);
    await this.pgc.overlays.updateManifest('lineage_patterns', symbolName, {
      filePath,
      sourceHash: validationSourceHash,
      lastUpdated: new Date().toISOString(),
    });

    EmbedLogger.complete(symbolName, 'LineagePatterns');
  }

  /**
   * Helper to determine symbol type. This is a heuristic and can be improved.
   */
  private _getSymbolType(symbol: string): StructuralSymbolType {
    if (
      symbol.charAt(0) === 'I' &&
      symbol.length > 1 &&
      symbol.charAt(1) === symbol.charAt(1).toUpperCase()
    )
      return 'interface';
    if (symbol.charAt(0) === symbol.charAt(0).toUpperCase()) return 'class';
    if (
      symbol.startsWith('T') &&
      symbol.length > 1 &&
      symbol.charAt(1) === symbol.charAt(1).toUpperCase()
    )
      return 'type';
    return 'function';
  }

  /**
   * Convenience method to run a full genesis.
   */
  public async generateLineageForAllPatterns(): Promise<void> {
    await this.generate({ force: false });
  }

  /**
   * Shuts down the worker pool and embedding service. A crucial cleanup step.
   */
  public async shutdown(): Promise<void> {
    // Only print if we actually initialized workers
    if (this.workerPool) {
      console.log(
        chalk.blue(
          '[LineagePatterns] Shutting down worker pool and embedding service...'
        )
      );
      await this.workerPool.terminate();
    }
    await this.embeddingService.shutdown();
  }

  /**
   * Get embedding service statistics for monitoring
   */
  public getEmbeddingStats(): { queueSize: number; isProcessing: boolean } {
    return {
      queueSize: this.embeddingService.getQueueSize(),
      isProcessing: this.embeddingService.isProcessing(),
    };
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
    const manifest = await this.pgc.overlays.getManifest('lineage_patterns');

    if (!manifest || Object.keys(manifest).length === 0) {
      console.log(chalk.yellow(`No lineage patterns manifest found.`));
      return [];
    }

    const filePath = manifest[symbol];

    if (!filePath) {
      console.log(
        chalk.yellow(`No lineage pattern found for symbol: ${symbol}`)
      );
      return [];
    }

    const overlayKey = `${filePath}#${symbol}`;

    const targetMetadata = await this.pgc.overlays.get<LineagePatternMetadata>(
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
      throw new Error(`Vector not found for symbol: ${symbol}`);
    }

    const similar = await this.vectorDB.similaritySearch(
      targetVector.embedding,
      topK + 1
    );

    // Get structural patterns to fetch architectural roles
    const structuralManifest = await this.pgc.overlays.getManifest(
      'structural_patterns'
    );

    return similar
      .filter((result) => result.id !== targetMetadata.vectorId)
      .map((result) => {
        const resultSymbol = result.metadata.symbol as string;
        const resultFilePath = result.metadata.anchor as string;

        // Try to get architectural role from structural patterns
        let architecturalRole = 'component'; // default
        if (structuralManifest && structuralManifest[resultSymbol]) {
          // We have structural data for this symbol, but we'll just use default for now
          // Could enhance this by loading the structural metadata
          architecturalRole = 'component';
        }

        return {
          symbol: resultSymbol,
          filePath: resultFilePath,
          similarity: result.similarity,
          architecturalRole,
          explanation: this.generateSimilarityExplanation(
            targetMetadata.lineageSignature,
            result.metadata.lineage_signature as string
          ),
        };
      });
  }

  public async getVectorForSymbol(
    symbol: string
  ): Promise<VectorRecord | undefined> {
    const manifest = await this.pgc.overlays.getManifest('lineage_patterns');

    if (!manifest) {
      return undefined;
    }

    const filePath = manifest[symbol];
    if (!filePath) {
      return undefined;
    }

    const overlayKey = `${filePath}#${symbol}`;
    const metadata = await this.pgc.overlays.get<LineagePatternMetadata>(
      'lineage_patterns',
      overlayKey,
      LineagePatternMetadataSchema
    );

    if (!metadata) {
      return undefined;
    }

    return this.vectorDB.getVector(metadata.vectorId);
  }

  private generateSimilarityExplanation(
    targetSignature: string,
    resultSignature: string
  ): string {
    try {
      const targetLineage = JSON.parse(targetSignature);
      const resultLineage = JSON.parse(resultSignature);

      const targetDeps = new Set(
        targetLineage.lineage?.map((d: { type: string }) => d.type) || []
      );
      const resultDeps = new Set(
        resultLineage.lineage?.map((d: { type: string }) => d.type) || []
      );

      const common = [...targetDeps].filter((dep) => resultDeps.has(dep));

      if (common.length === 0) {
        return 'Similar dependency depth structure';
      }

      return `Shared dependencies: ${common.slice(0, 3).join(', ')}`;
    } catch {
      return 'Similar dependency structure';
    }
  }
}
