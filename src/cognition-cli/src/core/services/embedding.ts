import { WorkbenchClient } from '../executors/workbench-client.js';
import { EmbedResponse } from '../types/workbench.js';
import { EventEmitter } from 'events';

/**
 * Represents a queued embedding job awaiting processing.
 *
 * @private
 */
interface EmbeddingJob {
  /** Text signature to embed (structural/semantic pattern) */
  signature: string;
  /** Embedding dimensions (768 for eGemma) */
  dimensions: number;
  /** Promise resolver for successful embedding */
  resolve: (value: EmbedResponse) => void;
  /** Promise rejector for failed embedding */
  reject: (error: Error) => void;
}

/**
 * Centralized Embedding Service
 *
 * Provides rate-limited, queued access to eGemma embeddings via Workbench.
 * This service coordinates all embedding requests across the system to prevent
 * rate limit violations and ensure fair resource allocation.
 *
 * ARCHITECTURE:
 * - Single instance per pattern manager (LineagePatterns, StrategicCoherence, etc.)
 * - Queue-based processing ensures embeddings are generated sequentially
 * - Integrates with WorkbenchClient's rate limiting for coordinated throttling
 * - Event emitter for monitoring and debugging
 * - LRU cache for embeddings (10K capacity) to reduce API calls
 * - Queue size limit (1K capacity) to prevent OOM
 *
 * ALGORITHM:
 * 1. Accept embedding request via getEmbedding()
 * 2. Check LRU cache (30-40% hit rate expected)
 * 3. On cache miss: Check queue size limit
 * 4. Add to internal queue
 * 5. Process queue sequentially:
 *    a. Wait for rate limit clearance (via WorkbenchClient)
 *    b. Generate embedding
 *    c. Cache result with LRU eviction
 *    d. Resolve/reject promise
 * 6. Continue until queue empty
 *
 * RATE LIMITING:
 * - Delegates to WorkbenchClient.waitForEmbedRateLimit()
 * - All callers share the same rate limit state
 * - No local throttling - pure coordination layer
 *
 * BACKPRESSURE:
 * - Queue size limited to MAX_QUEUE_SIZE (1,000 items)
 * - Rejects new requests when queue is full
 * - Prevents OOM from unbounded queue growth
 *
 * @example
 * // Initialize service
 * const service = new EmbeddingService('http://localhost:8000');
 *
 * // Generate embeddings (automatically queued and rate-limited)
 * const embedding1 = await service.getEmbedding('pattern1', 768);
 * const embedding2 = await service.getEmbedding('pattern2', 768);
 *
 * // Shutdown when done
 * await service.shutdown();
 *
 * @example
 * // Monitor queue status
 * console.log(`Queue size: ${service.getQueueSize()}`);
 * console.log(`Processing: ${service.isProcessing()}`);
 */
export class EmbeddingService extends EventEmitter {
  private workbench: WorkbenchClient;
  private queue: EmbeddingJob[] = [];
  private processing = false;
  private isShutdown = false;

  // LRU cache for embeddings: Map maintains insertion order
  private embeddingCache = new Map<string, EmbedResponse>();
  private readonly MAX_CACHE_SIZE = 10000;

  // Queue size limit to prevent OOM with unbounded growth
  private readonly MAX_QUEUE_SIZE = 1000;

  /**
   * Initialize embedding service with Workbench endpoint.
   *
   * @param workbenchEndpoint - Workbench API URL (e.g., 'http://localhost:8000')
   */
  constructor(workbenchEndpoint: string) {
    super();
    this.workbench = new WorkbenchClient(workbenchEndpoint);
  }

  /**
   * Request an embedding for a text signature.
   *
   * This method is queue-based and rate-limited with LRU caching.
   * Embeddings are generated sequentially to respect Workbench rate limits.
   * Cached embeddings are returned immediately without API calls.
   *
   * ALGORITHM:
   * 1. Check service is not shutdown
   * 2. Check cache for existing embedding (cache hit = instant return)
   * 3. On cache miss: Check queue size limit (prevents OOM)
   * 4. Create promise and add to queue
   * 5. Trigger queue processing
   * 6. Return promise (resolves when embedding ready)
   *
   * CACHE STRATEGY:
   * - LRU eviction when cache exceeds MAX_CACHE_SIZE (10,000 items)
   * - Cache key: `${signature}:${dimensions}`
   * - Map maintains insertion order (oldest entries evicted first)
   *
   * QUEUE LIMITS:
   * - Maximum queue size: MAX_QUEUE_SIZE (1,000 items)
   * - Rejects with error when queue is full (backpressure)
   * - Prevents OOM from unbounded queue growth
   *
   * @param signature - Text to embed (structural/semantic pattern)
   * @param dimensions - Embedding dimensions (768 for eGemma)
   * @returns Promise resolving to embedding response from eGemma
   * @throws {Error} If service has been shutdown
   * @throws {Error} If queue is full (MAX_QUEUE_SIZE exceeded)
   *
   * @example
   * // Embed a structural pattern signature
   * const response = await service.getEmbedding(
   *   JSON.stringify({ class: 'Foo', methods: ['bar'] }),
   *   768
   * );
   * const embedding = response.embedding_768d;
   */
  async getEmbedding(
    signature: string,
    dimensions: number
  ): Promise<EmbedResponse> {
    if (this.isShutdown) {
      throw new Error('EmbeddingService has been shutdown');
    }

    // Check cache first (LRU cache for performance)
    const cacheKey = `${signature}:${dimensions}`;
    const cached = this.embeddingCache.get(cacheKey);

    if (cached) {
      // Cache hit - return immediately without API call
      // Move to end of Map (LRU update)
      this.embeddingCache.delete(cacheKey);
      this.embeddingCache.set(cacheKey, cached);
      return Promise.resolve(cached);
    }

    // Check queue size to prevent OOM
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      throw new Error(
        `EmbeddingService queue is full (${this.MAX_QUEUE_SIZE} items). ` +
          `Please wait for pending embeddings to complete or increase cache hit rate.`
      );
    }

    // Cache miss - queue for processing
    return new Promise((resolve, reject) => {
      this.queue.push({ signature, dimensions, resolve, reject });
      this.processQueue().catch(reject);
    });
  }

  /**
   * Process the embedding queue sequentially with caching.
   *
   * This method runs continuously while there are jobs in the queue,
   * processing them one by one with rate limiting and caching results.
   *
   * ALGORITHM:
   * 1. Check if already processing or queue empty (guard)
   * 2. Set processing flag
   * 3. While queue not empty:
   *    a. Dequeue next job
   *    b. Wait for rate limit clearance
   *    c. Generate embedding via Workbench
   *    d. Cache the result (with LRU eviction if needed)
   *    e. Resolve/reject job promise
   * 4. Clear processing flag
   *
   * CACHE MANAGEMENT:
   * - After each successful embedding, add to cache
   * - If cache exceeds MAX_CACHE_SIZE, evict oldest entry (LRU)
   * - Map maintains insertion order for efficient LRU
   *
   * CRITICAL: Uses WorkbenchClient.waitForEmbedRateLimit() to coordinate
   * rate limiting across all embedding requests system-wide.
   *
   * @private
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    try {
      while (this.queue.length > 0 && !this.isShutdown) {
        const job = this.queue.shift()!;

        try {
          // Make the embedding call - WorkbenchClient handles rate limiting internally
          const response = await this.workbench.embed({
            signature: job.signature,
            dimensions: job.dimensions,
          });

          // Cache the result (LRU eviction if needed)
          const cacheKey = `${job.signature}:${job.dimensions}`;

          // Evict oldest entry if cache is full (LRU policy)
          if (this.embeddingCache.size >= this.MAX_CACHE_SIZE) {
            const firstKey = this.embeddingCache.keys().next().value;
            if (firstKey) {
              this.embeddingCache.delete(firstKey);
            }
          }

          this.embeddingCache.set(cacheKey, response);

          job.resolve(response);
        } catch (error) {
          job.reject(error as Error);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Shutdown the embedding service gracefully.
   *
   * Rejects all pending jobs, clears cache, and prevents new jobs from being accepted.
   * This is a critical cleanup step to prevent resource leaks.
   *
   * ALGORITHM:
   * 1. Set shutdown flag (prevents new jobs)
   * 2. Reject all queued jobs with shutdown error
   * 3. Clear queue
   * 4. Clear embedding cache
   *
   * @example
   * // Always shutdown when done
   * try {
   *   await generateEmbeddings();
   * } finally {
   *   await embeddingService.shutdown();
   * }
   */
  async shutdown(): Promise<void> {
    this.isShutdown = true;
    // Reject all pending jobs
    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      job.reject(new Error('EmbeddingService shutdown'));
    }
    // Clear cache to free memory
    this.embeddingCache.clear();
    // Remove all event listeners to prevent memory leaks
    this.removeAllListeners();
  }

  /**
   * Get current queue size for monitoring.
   *
   * @returns Number of pending embedding jobs
   *
   * @example
   * if (service.getQueueSize() > 100) {
   *   console.warn('Large embedding queue detected');
   * }
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Check if service is currently processing jobs.
   *
   * @returns True if actively generating embeddings
   */
  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Get workbench client for direct access if needed.
   *
   * Allows advanced use cases that need direct Workbench access
   * (e.g., custom embedding dimensions, model selection).
   *
   * @returns WorkbenchClient instance
   */
  getWorkbenchClient(): WorkbenchClient {
    return this.workbench;
  }

  /**
   * Get cache statistics for monitoring and performance analysis.
   *
   * @returns Object containing cache size and maximum capacity
   *
   * @example
   * const stats = service.getCacheStats();
   * console.log(`Cache: ${stats.size}/${stats.maxSize} (${stats.hitRate}%)`);
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    utilizationPercent: number;
  } {
    return {
      size: this.embeddingCache.size,
      maxSize: this.MAX_CACHE_SIZE,
      utilizationPercent: Math.round(
        (this.embeddingCache.size / this.MAX_CACHE_SIZE) * 100
      ),
    };
  }
}
