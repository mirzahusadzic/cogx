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
    analyses.forEach((a) => this.analyzedTimestamps.add(a.timestamp));
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
        this.totalProcessed++;

        // Notify completion
        this.handlers.onAnalysisComplete?.({
          analysis,
          messageIndex: task.messageIndex,
        });

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
    this.totalProcessed = 0;
    this.currentTask = null;
  }

  /**
   * Wait for queue to finish processing
   */
  async waitForCompletion(): Promise<void> {
    while (this.processing || this.queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
