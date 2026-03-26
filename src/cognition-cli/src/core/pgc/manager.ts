import { Index } from './index.js';
import { ObjectStore } from './object-store.js';
import { TransformLog } from './transform-log.js';
import { ReverseDeps } from './reverse-deps.js';
import { Overlays } from './overlays.js';
import { LineageQueryResult } from '../overlays/lineage/manager.js';
import { EmbedResponse } from '../types/workbench.js';
import { PGCStoreContext } from './store-context.js';
import { PGCQueryService } from './query-service.js';
import { PGCIndexerService } from './indexer-service.js';
import { IndexData } from '../types/index.js';
import { Transformation } from '../types/transform.js';
import { IntentAdapter } from '../lineage/intent-adapter.js';
import { TransformDAG } from './transform-dag.js';

/**
 * PGCManager (Grounded Context Pool Manager)
 *
 * THE FACADE: This class maintains the existing API for components using
 * the PGC while delegating logic to specialized services.
 *
 * Central coordinator for the PGC system - a content-addressable, provenance-tracked
 * computation framework that ensures all derived data is traceable to its source.
 *
 * ARCHITECTURE:
 * The PGC maintains a complete DAG (Directed Acyclic Graph) of transformations:
 * - Source files → Structural extraction → Code patterns (O₁)
 * - Documents → Concept extraction → Overlays (O₂, O₄, O₅, O₆)
 * - Patterns + Concepts → Strategic coherence (O₇)
 *
 * COMPONENTS:
 * - Index: Fast symbol lookup (name → structural_hash)
 * - ObjectStore: Content-addressable storage (hash → content)
 * - TransformLog: Transformation provenance (transform_id → inputs/outputs)
 * - ReverseDeps: Dependency graph (output_hash → transform_ids that used it)
 * - Overlays: Pattern metadata and embeddings storage
 * - IntentAdapter: Declared agent intent capture for transforms
 *
 * PROVENANCE:
 * Every piece of derived data has a complete provenance chain:
 * 1. Source file (hash, path, timestamp)
 * 2. Transform that processed it (id, method, timestamp)
 * 3. Output artifacts (hashes, types)
 * 4. Dependencies (what used this output)
 *
 * DESIGN RATIONALE:
 * - Content-addressable: Automatic deduplication, cache invalidation
 * - Provenance tracking: Reproducibility, debugging, incremental updates
 * - Overlay architecture: Separation of concerns (structure vs semantics)
 * - Embedding-first: Enables semantic search across all overlays
 *
 * @example
 * // Initialize PGC for a project
 * const pgc = new PGCManager('/path/to/project');
 *
 * // Search for a symbol
 * const results = await pgc.search('StrategicCoherenceManager');
 *
 * // Capture agent intent
 * await pgc.intentAdapter.recordIntent({ ... });
 */
export class PGCManager {
  private context: PGCStoreContext;
  private queryService: PGCQueryService;
  private indexerService: PGCIndexerService;

  public readonly pgcRoot: string;
  public readonly projectRoot: string;
  public readonly index: Index;
  public readonly objectStore: ObjectStore;
  public readonly transformLog: TransformLog;
  public readonly reverseDeps: ReverseDeps;
  public readonly overlays: Overlays;
  public readonly intentAdapter: IntentAdapter;
  public readonly transformDAG: TransformDAG;

  constructor(projectRoot: string) {
    this.context = new PGCStoreContext(projectRoot);
    this.queryService = new PGCQueryService(this.context);
    this.indexerService = new PGCIndexerService(this.context);

    // Maintain existing API properties for 33+ components
    this.pgcRoot = this.context.pgcRoot;
    this.projectRoot = this.context.projectRoot;
    this.index = this.context.index;
    this.objectStore = this.context.objectStore;
    this.transformLog = this.context.transformLog;
    this.reverseDeps = this.context.reverseDeps;
    this.overlays = this.context.overlays;
    this.intentAdapter = this.context.intentAdapter;
    this.transformDAG = this.context.transformDAG;
  }

  // --- QUERY DELEGATION ---

  /**
   * Search for a symbol in the index.
   *
   * @param symbolName - Name of the symbol to search for
   * @param context - Optional context to narrow the search
   * @returns Array of matching index entries
   */
  public async search(
    symbolName: string,
    context?: string
  ): Promise<IndexData[]> {
    return this.queryService.search(symbolName, context);
  }

  /**
   * Perform provenance-grounded lineage traversal.
   *
   * Delegates to PGCQueryService to reconstruct the symbol's dependency tree
   * by traveling backwards through time via the transform log.
   */
  public async getLineageForSymbol(
    symbolName: string,
    options: { maxDepth: number }
  ): Promise<LineageQueryResult> {
    return this.queryService.getLineageForSymbol(symbolName, options);
  }

  // --- INDEXER DELEGATION ---

  /**
   * Record a transformation in the log.
   *
   * @param transformData - Data for the transformation to record
   * @returns The generated transform ID
   */
  public async recordTransform(
    transformData: Omit<Transformation, 'phi' | 'verification_result'>
  ): Promise<string> {
    const transformId =
      await this.indexerService.recordTransform(transformData);
    // Link in DAG synchronously to maintain consistency
    await this.transformDAG.link(transformId, {
      ...transformData,
      phi: 1.0,
      verification_result: { success: true, messages: [] },
    });
    return transformId;
  }

  /**
   * Set embedding request handler for centralized embedding coordination.
   */
  public setEmbeddingRequestHandler(
    handler: (params: {
      signature: string;
      dimensions: number;
    }) => Promise<EmbedResponse>
  ): void {
    this.indexerService.setEmbeddingRequestHandler(handler);
  }

  /**
   * Request an embedding via centralized service.
   */
  public async requestEmbedding(params: {
    signature: string;
    dimensions: number;
  }): Promise<EmbedResponse> {
    return this.indexerService.requestEmbedding(params);
  }

  /**
   * Check if embedding requests are available.
   */
  public canRequestEmbeddings(): boolean {
    return this.indexerService.canRequestEmbeddings();
  }
}
