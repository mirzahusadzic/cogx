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
 *
 * ALGORITHM:
 * 1. Accept embedding request via getEmbedding()
 * 2. Add to internal queue
 * 3. Process queue sequentially:
 *    a. Wait for rate limit clearance (via WorkbenchClient)
 *    b. Generate embedding
 *    c. Resolve/reject promise
 * 4. Continue until queue empty
 *
 * RATE LIMITING:
 * - Delegates to WorkbenchClient.waitForEmbedRateLimit()
 * - All callers share the same rate limit state
 * - No local throttling - pure coordination layer
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
   * This method is queue-based and rate-limited. Embeddings are generated
   * sequentially to respect Workbench rate limits. The promise resolves
   * when the embedding is ready.
   *
   * ALGORITHM:
   * 1. Check service is not shutdown
   * 2. Create promise and add to queue
   * 3. Trigger queue processing
   * 4. Return promise (resolves when embedding ready)
   *
   * @param signature - Text to embed (structural/semantic pattern)
   * @param dimensions - Embedding dimensions (768 for eGemma)
   * @returns Promise resolving to embedding response from eGemma
   * @throws {Error} If service has been shutdown
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

    return new Promise((resolve, reject) => {
      this.queue.push({ signature, dimensions, resolve, reject });
      this.processQueue().catch(reject);
    });
  }

  /**
   * Process the embedding queue sequentially.
   *
   * This method runs continuously while there are jobs in the queue,
   * processing them one by one with rate limiting.
   *
   * ALGORITHM:
   * 1. Check if already processing or queue empty (guard)
   * 2. Set processing flag
   * 3. While queue not empty:
   *    a. Dequeue next job
   *    b. Wait for rate limit clearance
   *    c. Generate embedding via Workbench
   *    d. Resolve/reject job promise
   * 4. Clear processing flag
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
          // CRITICAL: Use the workbench's public rate limiting method
          // This ensures all embedding calls respect the same rate limits
          await this.workbench.waitForEmbedRateLimit();

          // Now make the actual embedding call
          const response = await this.workbench.embed({
            signature: job.signature,
            dimensions: job.dimensions,
          });

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
   * Rejects all pending jobs and prevents new jobs from being accepted.
   * This is a critical cleanup step to prevent resource leaks.
   *
   * ALGORITHM:
   * 1. Set shutdown flag (prevents new jobs)
   * 2. Reject all queued jobs with shutdown error
   * 3. Clear queue
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
}
