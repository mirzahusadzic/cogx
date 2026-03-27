import { PGCStoreContext } from '../../pgc/store-context.js';
import { EmbedResponse } from '../../types/workbench.js';
import { IndexData } from '../../types/index.js';
import { Transformation } from '../../types/transform.js';

/**
 * PGCIndexerService handles write-heavy updates to the PGC data.
 * It is responsible for indexing, recording transformations, and
 * coordinating embedding generation.
 *
 * PROVENANCE RECORDING:
 * Every transformation recorded via this service generates a unique audit record:
 * 1. Inputs (hashes of source files)
 * 2. Outputs (hashes of generated artifacts)
 * 3. Metadata (timestamp, method, tool version)
 */
export class PGCIndexerService {
  private embeddingRequestHandler?: (params: {
    signature: string;
    dimensions: number;
  }) => Promise<EmbedResponse>;

  constructor(private context: PGCStoreContext) {}

  /**
   * Index a symbol.
   *
   * @param key - File path or symbol key to index
   * @param data - Index data including hashes and metadata
   */
  public async index(key: string, data: IndexData): Promise<void> {
    await this.context.index.set(key, data);
  }

  /**
   * Record a transformation in the log.
   *
   * @param transformData - Data for the transformation to record
   * @returns The generated transform ID
   */
  public async recordTransform(
    transformData: Omit<Transformation, 'phi' | 'verification_result'>
  ): Promise<string> {
    return this.context.transformLog.record(transformData);
  }

  /**
   * Set embedding request handler for centralized embedding coordination.
   *
   * Pattern managers use this to delegate embedding generation to a
   * centralized service, ensuring rate limiting and fair resource allocation.
   *
   * DESIGN:
   * - Workers call pgc.requestEmbedding()
   * - This handler routes to EmbeddingService
   * - Service queues and rate-limits all requests
   * - No worker directly calls Workbench (prevents rate limit violations)
   *
   * @param handler - Function that generates embeddings via centralized service
   *
   * @example
   * const embeddingService = new EmbeddingService('http://localhost:8000');
   * pgc.setEmbeddingRequestHandler(async (params) => {
   *   return embeddingService.getEmbedding(params.signature, params.dimensions);
   * });
   */
  public setEmbeddingRequestHandler(
    handler: (params: {
      signature: string;
      dimensions: number;
    }) => Promise<EmbedResponse>
  ): void {
    this.embeddingRequestHandler = handler;
  }

  /**
   * Request an embedding via centralized service.
   *
   * Workers use this method to generate embeddings without directly accessing
   * Workbench. The request is routed through the embedding handler which
   * queues and rate-limits all requests.
   *
   * @param params - Embedding request parameters
   * @param params.signature - Text to embed (structural/semantic pattern)
   * @param params.dimensions - Embedding dimensions (768 for eGemma)
   * @returns Promise resolving to embedding response
   * @throws {Error} If embedding handler not configured
   *
   * @example
   * // Worker requesting embedding
   * const response = await pgc.requestEmbedding({
   *   signature: JSON.stringify(structuralPattern),
   *   dimensions: 768
   * });
   * const embedding = response.embedding_768d;
   */
  public async requestEmbedding(params: {
    signature: string;
    dimensions: number;
  }): Promise<EmbedResponse> {
    if (!this.embeddingRequestHandler) {
      throw new Error(
        'Embedding request handler not set. This PGCIndexerService instance cannot service embedding requests. ' +
          'Make sure you are using this indexer service through a PatternManager that sets up the embedding service.'
      );
    }
    return this.embeddingRequestHandler(params);
  }

  /**
   * Check if embedding requests are available.
   *
   * @returns True if embedding handler is configured
   */
  public canRequestEmbeddings(): boolean {
    return this.embeddingRequestHandler !== undefined;
  }
}
