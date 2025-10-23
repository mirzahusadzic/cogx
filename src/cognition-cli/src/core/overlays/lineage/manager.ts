import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { z } from 'zod';
import * as workerpool from 'workerpool';

import { PGCManager } from '../../pgc/manager.js';
import { LanceVectorStore, VectorRecord } from '../vector-db/lance-store.js';
import { WorkbenchClient } from '../../executors/workbench-client.js';
import { PatternManager } from '../../pgc/patterns.js';
import { StructuralData } from '../../types/structural.js';
import { EmbeddingService } from '../../services/embedding-service.js';
import { EmbedResponse } from '../../types/workbench.js';
import {
  PatternGenerationOptions,
  StructuralSymbolType,
  PatternJobPacket,
} from './types.js';

// These interfaces remain, as they are part of the manager's public API for single-threaded lineage queries.
export interface Dependency {
  path: string;
  depth: number;
  structuralData: StructuralData;
}

export interface LineageQueryResult {
  dependencies: Dependency[];
  initialContext: StructuralData[];
}

export class LineagePatternsManager implements PatternManager {
  private workerPool: workerpool.Pool;
  private embeddingService: EmbeddingService;

  constructor(
    private pgc: PGCManager,
    private vectorDB: LanceVectorStore,
    private workbench: WorkbenchClient
  ) {
    // 1. INITIALIZATION: The Conductor creates its pool of autonomous agents.
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    this.workerPool = workerpool.pool(
      path.resolve(__dirname, '../../../../dist/worker.cjs'),
      { workerType: 'process' }
    );

    // 2. Initialize the centralized embedding service
    this.embeddingService = new EmbeddingService(
      process.env.WORKBENCH_URL || 'http://localhost:8000'
    );

    // 3. Configure the PGCManager to use our embedding service
    this.pgc.setEmbeddingRequestHandler(this.requestEmbedding.bind(this));
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
   * The primary, multi-worker aware, granular entry point for generating lineage patterns.
   */
  public async generate(options: PatternGenerationOptions = {}): Promise<void> {
    const { symbolTypes = [], files = [], force = false } = options;

    console.log(
      chalk.blue('[LineagePatterns] Starting generation with options:', options)
    );

    const structuralManifest = await this.pgc.overlays.get(
      'structural_patterns',
      'manifest',
      z.record(z.string())
    );

    if (!structuralManifest) {
      console.warn(
        chalk.yellow(
          '[LineagePatterns] Structural patterns manifest not found. Skipping.'
        )
      );
      return;
    }

    const targetEntries = Object.entries(structuralManifest).filter(
      ([, filePath]) => files.length === 0 || files.includes(filePath as string)
    );

    const jobs: PatternJobPacket[] = targetEntries
      .map(([symbolName, filePath]) => ({
        pgcRoot: this.pgc.pgcRoot,
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

    console.log(`[LineagePatterns] Dispatching ${jobs.length} jobs...`);

    try {
      // Use string name instead of importing the function
      const promises = jobs.map((job) =>
        this.workerPool.exec('processJob', [job])
      );

      await Promise.all(promises);
      console.log('[LineagePatterns] All jobs completed');
    } catch (error) {
      console.error('[LineagePatterns] Worker error:', error);
      throw error;
    }
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
    console.log(
      chalk.blue(
        '[LineagePatterns] Shutting down worker pool and embedding service...'
      )
    );
    await this.workerPool.terminate();
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

  // "Read" methods like findSimilarPatterns remain on the Conductor.
  public async findSimilarPatterns() // symbol: string,
  // topK: number = 10
  : Promise<
    Array<{
      symbol: string;
      similarity: number;
      architecturalRole: string;
      explanation: string;
    }>
  > {
    // ... (Your existing implementation of findSimilarPatterns)
    return [];
  }

  public async getVectorForSymbol() // symbol: string
  : Promise<VectorRecord | undefined> {
    // ... (Your existing implementation of getVectorForSymbol)
    return undefined;
  }

  private generateSimilarityExplanation() // targetSignature: string,
  // resultSignature: string
  : string {
    // ... (Your existing implementation)
    return '';
  }
}
