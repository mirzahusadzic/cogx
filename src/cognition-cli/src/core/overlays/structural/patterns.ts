import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import * as workerpool from 'workerpool';
import chalk from 'chalk';
import { z } from 'zod';
import os from 'os';

import { PatternManager } from '../../pgc/patterns.js';
import { PGCManager } from '../../pgc/manager.js';
import { OverlayManifestEntry } from '../../pgc/overlays.js';
import { LanceVectorStore, VectorRecord } from '../vector-db/lance-store.js';
import { WorkbenchClient } from '../../executors/workbench-client.js';
import { StructuralData } from '../../types/structural.js';
import { EmbeddingService } from '../../services/embedding.js';
import { RoleClassifier } from '../../services/role-classifier.js';
import { EmbedResponse } from '../../types/workbench.js';
import { EmbedLogger } from '../shared/embed-logger.js';
import {
  DEFAULT_EMBEDDING_DIMENSIONS,
  DEFAULT_EMBEDDING_MODEL_NAME,
} from '../../../config.js';

/**
 * Calculates optimal worker count based on system resources and workload.
 * Workers perform mining while embedding is done sequentially.
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
 * Calculates cPOW magnitude representing computational cost of overlay generation.
 */
function calculateCPOWMagnitude(
  extractionMethod: string,
  fidelity: number
): number {
  // Base layer costs (Genesis extraction)
  const GENESIS_COSTS: Record<string, number> = {
    ast_remote: 0.15, // Remote API call to eGemma
    ast_local: 0.05, // Local AST parsing
    llm_supervised: 0.3, // LLM-assisted extraction
  };

  // Overlay layer cost (embedding generation - always expensive)
  const OVERLAY_EMBEDDING_COST = 0.75;

  let magnitude = 0.0;

  // Genesis layer contribution
  magnitude += GENESIS_COSTS[extractionMethod] || 0.1;

  // Overlay layer contribution (embedding)
  magnitude += OVERLAY_EMBEDDING_COST;

  // Adjust by fidelity (higher fidelity = more work/refinement)
  magnitude *= fidelity;

  return Math.min(magnitude, 1.0);
}

/**
 * Represents metadata for a structural pattern including validation and cPOW tracking.
 * Supports dual embeddings: structural (the body) and semantic (the shadow).
 */
export interface PatternMetadata {
  symbol: string;
  anchor: string;
  symbolStructuralDataHash: string;
  embeddingHash: string;
  structuralSignature: string;
  semanticSignature?: string; // The shadow signature (docstring + type)
  semanticEmbeddingHash?: string; // Hash of semantic embedding
  semanticVectorId?: string; // Vector ID for semantic embedding
  architecturalRole: string;
  computedAt: string;
  vectorId: string;
  validation: {
    sourceHash: string;
    embeddingModelVersion: typeof DEFAULT_EMBEDDING_MODEL_NAME;
    extractionMethod?: string;
    fidelity?: number;
  };
  cpow?: {
    magnitude: number; // 0.0 - 1.0 scale of computational work
    computation: {
      extraction_method: string;
      embedding_model: string;
      api_calls: number;
    };
    timestamp: string;
  };
}

/**
 * Zod schema for validating pattern metadata.
 */
const PatternMetadataSchema = z.object({
  symbol: z.string(),
  anchor: z.string(),
  symbolStructuralDataHash: z.string(),
  embeddingHash: z.string(),
  structuralSignature: z.string(),
  semanticSignature: z.string().optional(),
  semanticEmbeddingHash: z.string().optional(),
  semanticVectorId: z.string().optional(),
  architecturalRole: z.string(),
  computedAt: z.string(),
  vectorId: z.string(),
  validation: z.object({
    sourceHash: z.string(),
    embeddingModelVersion: z.literal(DEFAULT_EMBEDDING_MODEL_NAME),
    extractionMethod: z.string().optional(),
    fidelity: z.number().optional(),
  }),
  cpow: z
    .object({
      magnitude: z.number(),
      computation: z.object({
        extraction_method: z.string(),
        embedding_model: z.string(),
        api_calls: z.number(),
      }),
      timestamp: z.string(),
    })
    .optional(),
});

/**
 * Represents a job packet for parallel structural pattern mining.
 */
interface StructuralJobPacket {
  projectRoot: string;
  symbolName: string;
  filePath: string;
  contentHash: string;
  structuralHash: string;
  structuralData: StructuralData;
  force: boolean;
}

/**
 * Represents the result of a structural mining operation.
 */
interface StructuralMiningResult {
  status: 'success' | 'skipped' | 'error';
  symbolName: string;
  filePath: string;
  signature?: string; // Structural signature (the body)
  semanticSignature?: string; // Semantic signature (the shadow)
  architecturalRole?: string;
  rulesHash?: string; // Hash of classification rules at time of mining
  structuralData?: StructuralData;
  contentHash?: string;
  structuralHash?: string;
  message?: string;
}

/**
 * Manages structural pattern generation and similarity search using worker-based mining and sequential embedding.
 */
export class StructuralPatternsManager implements PatternManager {
  private workerPool?: workerpool.Pool;
  private embeddingService?: EmbeddingService;
  private roleClassifier: RoleClassifier = new RoleClassifier();
  private useWorkers: boolean = false;

  constructor(
    private pgc: PGCManager,
    private vectorDB: LanceVectorStore,
    private workbench: WorkbenchClient
  ) {
    this.roleClassifier = RoleClassifier.loadFromProject(this.pgc.projectRoot);
  }

  public getClassifier(): RoleClassifier {
    return this.roleClassifier;
  }

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
      /* @vite-ignore */ {
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
    jobs: StructuralJobPacket[],
    onProgress?: (
      current: number,
      total: number,
      message: string,
      phase: string
    ) => void
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

    const manifestUpdates: Record<string, Partial<OverlayManifestEntry>> = {};
    const allVectorRecords: Array<{
      id: string;
      embedding: number[];
      metadata: Omit<VectorRecord, 'id' | 'embedding'>;
    }> = [];

    for (const result of successfulMines) {
      try {
        const { vectorRecords, manifestEntry } =
          await this.generatePatternEmbedding(result);

        allVectorRecords.push(...vectorRecords);

        // Use unique key for manifest (filePath#symbolName)
        const manifestKey = `${result.filePath}#${result.symbolName}`;
        manifestUpdates[manifestKey] = manifestEntry;

        embeddedCount++;

        // Report progress via callback
        if (onProgress) {
          const percent = Math.round(
            (embeddedCount / successfulMines.length) * 100
          );
          onProgress(
            embeddedCount,
            successfulMines.length,
            `Embedding ${embeddedCount}/${successfulMines.length} patterns (${percent}%)`,
            'embedding'
          );
        }

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

    // Phase 3: Batch store everything (Massive speedup!)
    if (allVectorRecords.length > 0) {
      console.log(
        chalk.blue(
          `\n[StructuralPatterns] Phase 3: Batch storing ${allVectorRecords.length} vectors...`
        )
      );
      await this.vectorDB.batchStoreVectors(allVectorRecords);
    }

    if (Object.keys(manifestUpdates).length > 0) {
      console.log(
        chalk.blue(
          `[StructuralPatterns] Updating manifest for ${Object.keys(manifestUpdates).length} symbols...`
        )
      );
      await this.pgc.overlays.batchUpdateManifest(
        'structural_patterns',
        manifestUpdates
      );
    }

    console.log(
      chalk.green(
        `[StructuralPatterns] Embedding complete: ${embeddedCount} succeeded, ${embedFailedCount} failed`
      )
    );
  }

  /**
   * Re-classify symbols without re-embedding.
   * This is much faster than full regeneration when only role rules changed.
   */
  public async reclassifySymbols(
    jobs: Array<{ symbolName: string; filePath: string; rulesHash: string }>,
    onProgress?: (
      current: number,
      total: number,
      message: string,
      phase: string
    ) => void
  ): Promise<void> {
    if (jobs.length === 0) return;

    console.log(
      chalk.blue(
        `[StructuralPatterns] Re-classifying ${jobs.length} symbols without re-embedding...`
      )
    );

    await this.vectorDB.initialize('structural_patterns');

    // 1. Fetch ALL vectors once to avoid thousands of individual lookups
    console.log(
      chalk.gray(`[StructuralPatterns] Pre-loading vector database...`)
    );
    const allVectors = await this.vectorDB.getAllVectors();
    const vectorMap = new Map<string, VectorRecord>();
    for (const v of allVectors) {
      vectorMap.set(v.id, v);
    }

    let processedCount = 0;
    const manifestUpdates: Record<string, Partial<OverlayManifestEntry>> = {};
    const vectorUpdates: Array<{
      id: string;
      embedding: number[];
      metadata: Omit<VectorRecord, 'id' | 'embedding'>;
    }> = [];

    // Process in chunks to manage concurrency for metadata file I/O
    const CHUNK_SIZE = 50;
    for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
      const chunk = jobs.slice(i, i + CHUNK_SIZE);

      await Promise.all(
        chunk.map(async (job) => {
          const { symbolName, filePath, rulesHash } = job;
          const overlayKey = `${filePath}#${symbolName}`;

          try {
            // 2. Get existing metadata (from JSON file)
            const metadata = await this.pgc.overlays.get(
              'structural_patterns',
              overlayKey,
              PatternMetadataSchema
            );

            if (!metadata) {
              return;
            }

            // 3. Perform new classification
            const newRole = this.roleClassifier.classify(symbolName, filePath);
            const now = new Date().toISOString();

            // 4. Update metadata object
            const updatedMetadata: PatternMetadata = {
              ...metadata,
              architecturalRole: newRole,
              computedAt: now,
            };

            // 5. Prepare vector updates (from memory map)
            const existingVector = vectorMap.get(metadata.vectorId);
            if (existingVector) {
              vectorUpdates.push({
                id: metadata.vectorId,
                embedding: existingVector.embedding,
                metadata: {
                  symbol: symbolName,
                  filePath: filePath,
                  structuralHash: metadata.symbolStructuralDataHash,
                  document_hash: metadata.symbolStructuralDataHash,
                  structural_signature: metadata.structuralSignature,
                  semantic_signature: metadata.semanticSignature || '',
                  architectural_role: newRole,
                  computed_at: now,
                  lineage_hash:
                    (existingVector.lineage_hash as string) || 'unknown',
                  type: (existingVector.type as string) || 'structural',
                },
              });
            }

            if (metadata.semanticVectorId) {
              const semanticVector = vectorMap.get(metadata.semanticVectorId);
              if (semanticVector) {
                vectorUpdates.push({
                  id: metadata.semanticVectorId,
                  embedding: semanticVector.embedding,
                  metadata: {
                    symbol: symbolName,
                    filePath: filePath,
                    structuralHash: metadata.symbolStructuralDataHash,
                    document_hash: metadata.symbolStructuralDataHash,
                    semantic_signature: metadata.semanticSignature || '',
                    architectural_role: newRole,
                    computed_at: now,
                    lineage_hash:
                      (semanticVector.lineage_hash as string) || 'unknown',
                    type: 'semantic',
                  },
                });
              }
            }

            // 6. Update overlay metadata file
            await this.pgc.overlays.update(
              'structural_patterns',
              overlayKey,
              updatedMetadata
            );

            // 7. Collect manifest update
            manifestUpdates[overlayKey] = {
              filePath,
              sourceHash: metadata.validation.sourceHash,
              rulesHash,
              lastUpdated: now,
            };

            processedCount++;
            if (
              processedCount === 1 ||
              processedCount % 50 === 0 ||
              processedCount === jobs.length
            ) {
              console.log(
                chalk.gray(
                  `[StructuralPatterns] Re-classified ${processedCount}/${jobs.length} symbols...`
                )
              );
            }
            if (onProgress) {
              onProgress(
                processedCount,
                jobs.length,
                `Re-classifying ${processedCount}/${jobs.length} symbols`,
                'reclassification'
              );
            }
          } catch (error) {
            console.error(
              chalk.red(
                `[StructuralPatterns] Failed to re-classify ${symbolName}: ${(error as Error).message}`
              )
            );
          }
        })
      );
    }

    // 8. Batch store all vector updates (Massive speedup: 1 mergeInsert instead of 1000)
    if (vectorUpdates.length > 0) {
      console.log(
        chalk.gray(
          `[StructuralPatterns] Saving ${vectorUpdates.length} vector updates to database...`
        )
      );
      await this.vectorDB.batchStoreVectors(vectorUpdates);
    }

    // 9. Perform batch manifest update
    if (Object.keys(manifestUpdates).length > 0) {
      await this.pgc.overlays.batchUpdateManifest(
        'structural_patterns',
        manifestUpdates
      );
    }

    console.log(
      chalk.green(
        `[StructuralPatterns] Re-classification complete: ${processedCount} succeeded.`
      )
    );
  }

  /**
   * Generate DUAL embeddings (structural + semantic) and store pattern for a single mined result
   * The structural embedding captures the architecture (the body)
   * The semantic embedding captures the meaning (the shadow)
   */
  private async generatePatternEmbedding(
    result: StructuralMiningResult
  ): Promise<{
    vectorRecords: Array<{
      id: string;
      embedding: number[];
      metadata: Omit<VectorRecord, 'id' | 'embedding'>;
    }>;
    manifestEntry: Partial<OverlayManifestEntry>;
  }> {
    const {
      symbolName,
      filePath,
      signature,
      semanticSignature,
      architecturalRole,
      rulesHash,
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

    EmbedLogger.start(symbolName);

    // Request STRUCTURAL embedding (the body)
    const structuralEmbedResponse = await this.workbench.embed({
      signature,
      dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
    });

    const structuralEmbedding =
      structuralEmbedResponse[`embedding_${DEFAULT_EMBEDDING_DIMENSIONS}d`];

    if (!structuralEmbedding) {
      throw new Error(
        `Could not find structural embedding for dimension ${DEFAULT_EMBEDDING_DIMENSIONS}`
      );
    }

    // Request SEMANTIC embedding (the shadow) - only if semantic signature exists
    let semanticEmbedding: number[] | undefined;
    let semanticEmbeddingHash: string | undefined;
    let semanticVectorId: string | undefined;

    if (semanticSignature && semanticSignature.trim().length > 0) {
      const semanticEmbedResponse = await this.workbench.embed({
        signature: semanticSignature,
        dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
      });

      const embeddingField =
        semanticEmbedResponse[`embedding_${DEFAULT_EMBEDDING_DIMENSIONS}d`];

      if (embeddingField && Array.isArray(embeddingField)) {
        semanticEmbedding = embeddingField as number[];
        semanticEmbeddingHash = this.pgc.objectStore.computeHash(
          JSON.stringify(semanticEmbedding)
        );
        semanticVectorId = `pattern_semantic_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${symbolName.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }
    }

    // Compute lineage hash BEFORE storing vectors (needed for both structural and semantic)
    const lineageHash = this.pgc.objectStore.computeHash(
      JSON.stringify(structuralData)
    );

    const now = new Date().toISOString();
    const vectorRecords: Array<{
      id: string;
      embedding: number[];
      metadata: Omit<VectorRecord, 'id' | 'embedding'>;
    }> = [];

    // Prepare semantic vector record if it exists
    if (semanticEmbedding && semanticVectorId) {
      vectorRecords.push({
        id: semanticVectorId,
        embedding: semanticEmbedding,
        metadata: {
          symbol: symbolName,
          filePath: filePath,
          structuralHash: structuralHash,
          document_hash: structuralHash, // Use structural hash as document identifier
          semantic_signature: semanticSignature,
          architectural_role: architecturalRole,
          computed_at: now,
          lineage_hash: lineageHash, // CRITICAL: Include lineage hash
          type: 'semantic', // Mark as semantic shadow
        },
      });
    }

    const embeddingHash = this.pgc.objectStore.computeHash(
      JSON.stringify(structuralEmbedding)
    );
    const vectorId = `pattern_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${symbolName.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Prepare structural vector record
    vectorRecords.push({
      id: vectorId,
      embedding: structuralEmbedding as number[],
      metadata: {
        symbol: symbolName,
        filePath: filePath,
        structuralHash: structuralHash,
        document_hash: structuralHash, // Use structural hash as document identifier
        structural_signature: signature,
        architectural_role: architecturalRole,
        computed_at: now,
        lineage_hash: lineageHash,
        type: 'structural', // Mark as structural body
      },
    });

    // Calculate cPOW magnitude
    const cpowMagnitude = calculateCPOWMagnitude(
      structuralData.extraction_method,
      structuralData.fidelity
    );

    // Update PGC overlays with DUAL embeddings (body + shadow)
    const metadata: PatternMetadata = {
      symbol: symbolName,
      anchor: filePath,
      symbolStructuralDataHash: structuralHash,
      embeddingHash,
      structuralSignature: signature,
      semanticSignature: semanticSignature, // The shadow
      semanticEmbeddingHash: semanticEmbeddingHash, // Shadow's hash
      semanticVectorId: semanticVectorId, // Shadow's vector ID
      architecturalRole: architecturalRole,
      computedAt: now,
      validation: {
        sourceHash: contentHash,
        embeddingModelVersion: DEFAULT_EMBEDDING_MODEL_NAME,
        extractionMethod: structuralData.extraction_method,
        fidelity: structuralData.fidelity,
      },
      cpow: {
        magnitude: cpowMagnitude,
        computation: {
          extraction_method: structuralData.extraction_method,
          embedding_model: DEFAULT_EMBEDDING_MODEL_NAME,
          api_calls: semanticEmbedding ? 2 : 1, // Count both embeddings if shadow exists
        },
        timestamp: now,
      },
      vectorId: vectorId,
    };

    const overlayKey = `${filePath}#${symbolName}`;

    // CRITICAL: Update overlay metadata FIRST (individual JSON file)
    await this.pgc.overlays.update('structural_patterns', overlayKey, metadata);

    EmbedLogger.complete(symbolName);

    return {
      vectorRecords,
      manifestEntry: {
        filePath,
        sourceHash: contentHash,
        rulesHash,
        lastUpdated: now,
      },
    };
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
    const architecturalRole = this.inferArchitecturalRole(
      symbolName,
      symbolStructuralData,
      relativePath
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

    const lineageHash = this.pgc.objectStore.computeHash(
      JSON.stringify(symbolStructuralData)
    );
    const embeddingHash = this.pgc.objectStore.computeHash(
      JSON.stringify(embedding)
    );

    const vectorId = `pattern_${relativePath.replace(/[^a-zA-Z0-9]/g, '_')}_${symbolName.replace(/[^a-zA-Z0-9]/g, '_')}`;

    await this.vectorDB.storeVector(vectorId, embedding as number[], {
      symbol: symbolName,
      filePath: relativePath,
      structuralHash: structuralDataHash,
      document_hash: structuralDataHash, // Use structural hash as document identifier
      structural_signature: signature,
      architectural_role: architecturalRole,
      computed_at: new Date().toISOString(),
      lineage_hash: lineageHash,
    });

    // Calculate cPOW magnitude
    const cpowMagnitude = calculateCPOWMagnitude(
      symbolStructuralData.extraction_method,
      symbolStructuralData.fidelity
    );

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
      cpow: {
        magnitude: cpowMagnitude,
        computation: {
          extraction_method: symbolStructuralData.extraction_method,
          embedding_model: DEFAULT_EMBEDDING_MODEL_NAME,
          api_calls: 1,
        },
        timestamp: new Date().toISOString(),
      },
      vectorId: vectorId,
    };

    const overlayKey = `${relativePath}#${symbolName}`;
    await this.pgc.overlays.update('structural_patterns', overlayKey, metadata);
  }

  private inferArchitecturalRole(
    symbolName: string,
    _structuralData: StructuralData,
    filePath: string
  ): string {
    return this.roleClassifier.classify(symbolName, filePath);
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
    const entry = await this.pgc.overlays.getManifestEntry(
      'structural_patterns',
      symbol
    );

    if (!entry || !entry.filePath) {
      console.log(chalk.yellow(`No pattern found for symbol: ${symbol}`));
      return [];
    }

    const filePath = entry.filePath;

    // Extract raw symbol name from key if it's a unique key
    const rawName = symbol.includes('#') ? symbol.split('#').pop()! : symbol;
    const overlayKey = `${filePath}#${rawName}`;

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

  /**
   * Get vector for a specific symbol
   * @param symbol - Symbol name or unique manifest key (filePath#symbolName)
   * @returns Vector record or undefined
   */
  public async getVectorForSymbol(
    symbol: string
  ): Promise<VectorRecord | undefined> {
    const manifest = await this.pgc.overlays.getManifest('structural_patterns');

    if (!manifest || Object.keys(manifest).length === 0) {
      console.log(chalk.yellow(`No structural patterns manifest found.`));
      return undefined;
    }

    // Use helper to resolve manifest entry (handles unique keys and suffix matches)
    const entry = await this.pgc.overlays.getManifestEntry(
      'structural_patterns',
      symbol
    );

    if (!entry || !entry.filePath) {
      console.log(chalk.yellow(`No pattern found for symbol: ${symbol}`));
      return undefined;
    }

    // Extract raw symbol name from key if it's a unique key
    const rawName = symbol.includes('#') ? symbol.split('#').pop()! : symbol;
    const overlayKey = `${entry.filePath}#${rawName}`;

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
