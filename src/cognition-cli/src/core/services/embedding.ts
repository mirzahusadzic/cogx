import { WorkbenchClient } from '../executors/workbench-client.js';
import { EmbedResponse } from '../types/workbench.js';
import { EventEmitter } from 'events';

interface EmbeddingJob {
  signature: string;
  dimensions: number;
  resolve: (value: EmbedResponse) => void;
  reject: (error: Error) => void;
}

export class EmbeddingService extends EventEmitter {
  private workbench: WorkbenchClient;
  private queue: EmbeddingJob[] = [];
  private processing = false;
  private isShutdown = false;

  constructor(workbenchEndpoint: string) {
    super();
    this.workbench = new WorkbenchClient(workbenchEndpoint);
  }

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

  async shutdown(): Promise<void> {
    this.isShutdown = true;
    // Reject all pending jobs
    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      job.reject(new Error('EmbeddingService shutdown'));
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Get workbench client for direct access if needed
   */
  getWorkbenchClient(): WorkbenchClient {
    return this.workbench;
  }
}
