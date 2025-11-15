/**
 * Analysis Queue
 *
 * Background processing queue for turn analysis.
 * Ensures analysis never blocks the UI by processing asynchronously.
 *
 * KEY FEATURE: This fixes the re-embedding UI blocking issue!
 *
 * Created as part of Week 3 Day 11-13 refactor.
 */

import { analyzeTurn } from '../../../sigma/analyzer-with-embeddings.js';
import type {
  TurnAnalysis,
  ConversationContext,
  ConversationTurn,
} from '../../../sigma/types.js';
import type {
  AnalysisTask,
  AnalysisOptions,
  AnalysisQueueHandlers,
  AnalysisQueueStatus,
} from './types.js';

/**
 * Background queue for processing turn analyses
 */
export class AnalysisQueue {
  private queue: AnalysisTask[] = [];
  private processing = false;
  private totalProcessed = 0;
  private currentTask: AnalysisTask | null = null;
  private analyzedTimestamps = new Set<number>();
  private analyzedMessageIds = new Set<string>(); // ✅ NEW: Track by message ID not just timestamp
  private pendingPersistence = 0; // ✅ NEW: Track async LanceDB writes
  private turnAnalyses: TurnAnalysis[] = [];

  constructor(
    private options: AnalysisOptions,
    private handlers: AnalysisQueueHandlers = {}
  ) {}

  /**
   * Get current queue status
   */
  getStatus(): AnalysisQueueStatus {
    return {
      isProcessing: this.processing,
      queueLength: this.queue.length,
      totalProcessed: this.totalProcessed,
      currentTask: this.currentTask
        ? {
            timestamp: this.currentTask.timestamp,
            messageIndex: this.currentTask.messageIndex,
          }
        : undefined,
    };
  }

  /**
   * Get all analyses
   */
  getAnalyses(): TurnAnalysis[] {
    return [...this.turnAnalyses];
  }

  /**
   * Set existing analyses (e.g., when loading from disk)
   */
  setAnalyses(analyses: TurnAnalysis[]): void {
    this.turnAnalyses = [...analyses];
    this.analyzedTimestamps.clear();
    this.analyzedMessageIds.clear(); // ✅ NEW: Clear message IDs too
    analyses.forEach((a) => {
      this.analyzedTimestamps.add(a.timestamp);
      // ✅ NEW: Track message ID (use turn_id as fallback)
      this.analyzedMessageIds.add(a.turn_id);
    });
  }

  /**
   * Check if a turn has already been analyzed
   */
  hasAnalyzed(timestamp: number): boolean {
    return this.analyzedTimestamps.has(timestamp);
  }

  /**
   * Add a task to the queue (non-blocking)
   */
  async enqueue(task: AnalysisTask): Promise<void> {
    // Skip if already analyzed
    if (this.hasAnalyzed(task.timestamp)) {
      return;
    }

    // Skip if already in queue
    const alreadyQueued = this.queue.some(
      (t) => t.timestamp === task.timestamp
    );
    if (alreadyQueued) {
      return;
    }

    this.queue.push(task);

    // Notify progress
    this.handlers.onProgress?.(this.getStatus());

    // Start processing (non-blocking)
    this.processQueue();
  }

  /**
   * Process queue in background (non-blocking)
   */
  private async processQueue(): Promise<void> {
    // Don't start multiple processors
    if (this.processing) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.currentTask = task;

      // Notify progress
      this.handlers.onProgress?.(this.getStatus());

      try {
        // Skip if already analyzed (may have been analyzed while queued)
        if (this.hasAnalyzed(task.timestamp)) {
          continue;
        }

        // Analyze the turn
        const analysis = await this.analyzeTurn(task);

        // Store analysis
        this.turnAnalyses.push(analysis);
        this.analyzedTimestamps.add(task.timestamp);

        // ✅ NEW: Track message ID (use messageIndex as unique identifier)
        const messageId = `msg-${task.messageIndex}`;
        this.analyzedMessageIds.add(messageId);

        this.totalProcessed++;

        // ✅ NEW: Track persistence (increment before async operation)
        this.pendingPersistence++;

        try {
          // Notify completion (this may trigger async LanceDB writes)
          await this.handlers.onAnalysisComplete?.({
            analysis,
            messageIndex: task.messageIndex,
          });
        } finally {
          // ✅ NEW: Decrement after persistence completes
          this.pendingPersistence--;
        }

        // Notify progress
        this.handlers.onProgress?.(this.getStatus());
      } catch (error) {
        // Notify error but continue processing
        this.handlers.onError?.(error as Error, task);
      }
    }

    this.currentTask = null;
    this.processing = false;

    // Notify queue empty
    this.handlers.onQueueEmpty?.();

    // Final progress update
    this.handlers.onProgress?.(this.getStatus());
  }

  /**
   * Analyze a single turn
   */
  private async analyzeTurn(task: AnalysisTask): Promise<TurnAnalysis> {
    const { message, cachedEmbedding } = task;
    const { embedder, projectRegistry, cwd, sessionId } = this.options;

    // Build context from previous analyses
    const context: ConversationContext = {
      projectRoot: cwd,
      sessionId,
      history: this.turnAnalyses.map((a) => ({
        id: a.turn_id,
        role: a.role,
        content: a.content,
        timestamp: a.timestamp,
        embedding: a.embedding,
      })) as Array<ConversationTurn & { embedding: number[] }>,
    };

    // Analyze the turn
    const analysis = await analyzeTurn(
      {
        id: `turn-${task.timestamp}`,
        role: message.type as 'user' | 'assistant',
        content: message.content,
        timestamp: task.timestamp,
      },
      context,
      embedder,
      projectRegistry,
      {},
      cachedEmbedding
    );

    return analysis;
  }

  /**
   * Clear all analyses and queue
   */
  clear(): void {
    this.queue = [];
    this.turnAnalyses = [];
    this.analyzedTimestamps.clear();
    this.analyzedMessageIds.clear(); // ✅ NEW: Clear message IDs too
    this.totalProcessed = 0;
    this.currentTask = null;
    this.pendingPersistence = 0; // ✅ NEW: Reset persistence counter
  }

  /**
   * Wait for queue to finish processing
   */
  async waitForCompletion(): Promise<void> {
    while (this.processing || this.queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * ✅ NEW: Check if queue is ready for compression
   * @returns true if no pending analysis work AND all persistence complete
   */
  isReadyForCompression(): boolean {
    return (
      this.queue.length === 0 && // No queued tasks
      !this.processing && // Not currently processing
      this.currentTask === null && // No task in progress
      this.pendingPersistence === 0 // All LanceDB writes complete
    );
  }

  /**
   * ✅ NEW: Wait for queue to become ready for compression
   * @param timeout Maximum time to wait (ms), default from env or 15000
   * @param onProgress Optional progress callback (elapsed ms, current status)
   * @returns Promise that resolves when ready or rejects on timeout
   */
  async waitForCompressionReady(
    timeout: number = parseInt(
      process.env.SIGMA_COMPRESSION_TIMEOUT_MS || '15000',
      10
    ),
    onProgress?: (elapsed: number, status: AnalysisQueueStatus) => void
  ): Promise<void> {
    const startTime = Date.now();

    while (!this.isReadyForCompression()) {
      const elapsed = Date.now() - startTime;

      // Report progress
      if (onProgress) {
        onProgress(elapsed, this.getStatus());
      }

      // Check timeout
      if (elapsed > timeout) {
        throw new Error(
          `Timeout waiting for analysis queue (${this.queue.length} pending, processing: ${this.processing}, pendingPersistence: ${this.pendingPersistence})`
        );
      }

      // Wait 100ms before checking again
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * ✅ NEW: Get all unanalyzed messages (by message ID, not timestamp)
   * Handles duplicate timestamps correctly
   */
  getUnanalyzedMessages(
    allMessages: Array<{ timestamp: Date; type: string; id?: string }>
  ): Array<{ timestamp: number; messageId: string; index: number }> {
    const unanalyzed: Array<{
      timestamp: number;
      messageId: string;
      index: number;
    }> = [];

    allMessages
      .filter((m) => m.type === 'user' || m.type === 'assistant')
      .forEach((m, index) => {
        const messageId = `msg-${index}`;

        // Check if THIS SPECIFIC MESSAGE was analyzed (not just timestamp)
        if (!this.analyzedMessageIds.has(messageId)) {
          unanalyzed.push({
            timestamp: m.timestamp.getTime(),
            messageId,
            index,
          });
        }
      });

    return unanalyzed;
  }
}
