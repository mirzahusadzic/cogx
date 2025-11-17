/**
 * Analysis Queue - Non-Blocking Background Turn Analysis
 *
 * Asynchronous FIFO queue for processing conversation turn analysis. Prevents
 * UI blocking during expensive embedding operations by processing tasks in the
 * background with event-driven updates.
 *
 * PROBLEM SOLVED:
 * The previous implementation re-embedded messages synchronously during render,
 * causing noticeable UI lag (100-300ms per message). This queue decouples
 * analysis from the UI thread, making the TUI responsive.
 *
 * ALGORITHM:
 * The queue implements a single-consumer producer pattern:
 * 1. Producer: enqueue() adds tasks to queue array (O(1))
 * 2. Consumer: processQueue() processes tasks sequentially in background
 * 3. Deduplication: Tracks analyzed timestamps and message IDs
 * 4. Persistence: Counts pending LanceDB writes for compression coordination
 *
 * DEDUPLICATION STRATEGY:
 * Uses dual tracking to handle edge cases:
 * - analyzedTimestamps: Fast lookup for timestamp-based deduplication
 * - analyzedMessageIds: Handles duplicate timestamps (e.g., rapid messages)
 *
 * COMPRESSION COORDINATION:
 * Before compressing conversations, we must ensure:
 * 1. Queue is empty (queue.length === 0)
 * 2. No task is processing (processing === false)
 * 3. All LanceDB writes complete (pendingPersistence === 0)
 *
 * This prevents race conditions where compression runs while embeddings are
 * still being written to disk.
 *
 * @example
 * // Create queue with event handlers
 * const queue = new AnalysisQueue(
 *   {
 *     embedder,
 *     projectRegistry,
 *     cwd: '/home/user/project',
 *     sessionId: 'session-123',
 *     debug: true
 *   },
 *   {
 *     onAnalysisComplete: (result) => {
 *       console.log(`Analyzed turn ${result.messageIndex}`);
 *       updateUI(result.analysis);
 *     },
 *     onProgress: (status) => {
 *       console.log(`Queue: ${status.queueLength} pending`);
 *     }
 *   }
 * );
 *
 * // Enqueue tasks (non-blocking)
 * await queue.enqueue({
 *   message: claudeMessage,
 *   messageIndex: 0,
 *   timestamp: Date.now()
 * });
 *
 * @example
 * // Compression coordination
 * // Wait for queue to finish before compressing
 * await queue.waitForCompressionReady(60000, (elapsed, status) => {
 *   console.log(`Waiting ${elapsed}ms, ${status.queueLength} pending`);
 * });
 *
 * // Now safe to compress
 * await compressConversation();
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
 * Background FIFO queue for processing turn analyses
 *
 * Implements producer-consumer pattern with single consumer thread.
 * Processes tasks sequentially to maintain conversation context order.
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

  /**
   * Create a new analysis queue
   *
   * @param options - Configuration for the analyzer (embedder, registries, etc.)
   * @param handlers - Event callbacks for queue lifecycle events
   */
  constructor(
    private options: AnalysisOptions,
    private handlers: AnalysisQueueHandlers = {}
  ) {}

  /**
   * Get current queue status
   *
   * Returns a snapshot of queue state for UI updates. Called frequently
   * by React components to display progress.
   *
   * @returns Current queue status including processing state and task counts
   *
   * @example
   * const status = queue.getStatus();
   * console.log(`Queue: ${status.queueLength} pending, processing: ${status.isProcessing}`);
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
   * Get all completed analyses
   *
   * Returns a copy of the analyses array to prevent external mutation.
   * Analyses are in chronological order (oldest first).
   *
   * @returns Array of all turn analyses completed so far
   *
   * @example
   * const analyses = queue.getAnalyses();
   * const paradigmShifts = analyses.filter(a => a.is_paradigm_shift);
   * console.log(`Found ${paradigmShifts.length} paradigm shifts`);
   */
  getAnalyses(): TurnAnalysis[] {
    return [...this.turnAnalyses];
  }

  /**
   * Set existing analyses from external source
   *
   * Used when loading persisted analyses from disk. Rebuilds the
   * deduplication sets to prevent re-analyzing loaded turns.
   *
   * @param analyses - Array of turn analyses to load (e.g., from session file)
   *
   * @example
   * // Load analyses from disk
   * const savedAnalyses = JSON.parse(fs.readFileSync('session.json', 'utf-8'));
   * queue.setAnalyses(savedAnalyses);
   * // Queue now knows these turns are already analyzed
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
   *
   * Uses timestamp-based lookup for O(1) performance. Note that this doesn't
   * handle duplicate timestamps; use message ID tracking for that.
   *
   * @param timestamp - Unix timestamp (ms) of the turn to check
   * @returns true if this timestamp has been analyzed
   *
   * @example
   * if (!queue.hasAnalyzed(message.timestamp.getTime())) {
   *   await queue.enqueue({ message, messageIndex, timestamp });
   * }
   */
  hasAnalyzed(timestamp: number): boolean {
    return this.analyzedTimestamps.has(timestamp);
  }

  /**
   * Add a task to the queue (non-blocking)
   *
   * ALGORITHM:
   * 1. Check if already analyzed (timestamp deduplication) → skip if yes
   * 2. Check if already in queue (prevent duplicates) → skip if yes
   * 3. Add to queue array
   * 4. Notify progress handlers
   * 5. Trigger processQueue() (starts consumer if not already running)
   *
   * This method returns immediately (non-blocking). Processing happens
   * asynchronously in the background.
   *
   * @param task - Analysis task to enqueue
   *
   * @example
   * // Enqueue analysis for new user message
   * await queue.enqueue({
   *   message: userMessage,
   *   messageIndex: messages.length - 1,
   *   timestamp: Date.now(),
   *   cachedEmbedding: undefined
   * });
   * // Returns immediately, analysis happens in background
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
   * Process queue in background (non-blocking, single consumer)
   *
   * ALGORITHM:
   * 1. Check if already processing → return if yes (single consumer)
   * 2. Set processing = true
   * 3. While queue has tasks:
   *    a. Dequeue task (FIFO: shift from front)
   *    b. Check if already analyzed (may have been analyzed while queued)
   *    c. Analyze turn (async, may take 100-300ms)
   *    d. Store result in turnAnalyses array
   *    e. Update deduplication sets (timestamps + message IDs)
   *    f. Increment pendingPersistence counter
   *    g. Call onAnalysisComplete handler (triggers PGC writes)
   *    h. Decrement pendingPersistence counter
   *    i. Call onProgress handler (UI updates)
   * 4. Set processing = false
   * 5. Call onQueueEmpty handler
   *
   * ERROR HANDLING:
   * If analysis fails, error is logged via onError handler but processing
   * continues. This prevents one bad message from blocking the entire queue.
   *
   * CONCURRENCY:
   * Only one task is processed at a time (sequential processing) to maintain
   * conversation context order. Multiple processQueue() calls are safe due to
   * the `processing` flag guard.
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
        // ✅ FIX: Mark as analyzed even on failure to prevent infinite retries
        // When embeddings fail (e.g., WORKBENCH_API_KEY not set), we must still
        // mark the message as processed to avoid infinite loops
        this.analyzedTimestamps.add(task.timestamp);
        const messageId = `msg-${task.messageIndex}`;
        this.analyzedMessageIds.add(messageId);

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
   * Analyze a single conversation turn
   *
   * Builds conversation context from previous analyses, then calls the core
   * analyzeTurn() function to compute novelty, importance, and other metrics.
   *
   * CONTEXT BUILDING:
   * Previous analyses are included in the context so the analyzer can:
   * - Detect semantic drift (novelty calculation)
   * - Identify paradigm shifts (topic changes)
   * - Calculate importance relative to conversation history
   *
   * EMBEDDING REUSE:
   * If task.cachedEmbedding is provided, it's reused instead of re-computing.
   * This optimization saves ~100-200ms per turn when loading from disk.
   *
   * @param task - Analysis task with message and metadata
   * @returns Completed turn analysis with all metrics
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
   * Clear all analyses and reset queue
   *
   * Resets queue to initial state. Clears:
   * - Pending tasks in queue
   * - Completed analyses
   * - Deduplication sets (timestamps + message IDs)
   * - Processing counters
   *
   * Does NOT interrupt currently processing task (if any).
   *
   * @example
   * // Start fresh session
   * queue.clear();
   * console.log('Queue reset, ready for new conversation');
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
   * Wait for queue to finish processing all pending tasks
   *
   * Polls queue state every 100ms until both queue is empty and no task
   * is being processed. Does NOT wait for LanceDB writes (see
   * waitForCompressionReady for that).
   *
   * @returns Promise that resolves when queue becomes idle
   *
   * @example
   * // Wait for all analyses to complete
   * await queue.waitForCompletion();
   * console.log('All tasks processed');
   */
  async waitForCompletion(): Promise<void> {
    while (this.processing || this.queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Check if queue is ready for compression
   *
   * Compression requires that ALL analysis work is complete, including:
   * 1. No queued tasks (queue.length === 0)
   * 2. No task currently processing (processing === false)
   * 3. No current task (currentTask === null)
   * 4. All LanceDB writes complete (pendingPersistence === 0)
   *
   * Condition #4 is critical: even if the queue is empty, there may be
   * pending async writes to LanceDB. Compressing before these complete
   * would cause data loss.
   *
   * @returns true if safe to compress, false if work remains
   *
   * @example
   * if (queue.isReadyForCompression()) {
   *   await compressConversation();
   * } else {
   *   console.log('Waiting for analysis to complete...');
   * }
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
   * Wait for queue to become ready for compression
   *
   * Polls isReadyForCompression() every 100ms until all analysis work completes
   * (including LanceDB writes), or until timeout is reached.
   *
   * ALGORITHM:
   * 1. Start timer
   * 2. While not ready for compression:
   *    a. Check elapsed time → throw if timeout exceeded
   *    b. Call onProgress callback (if provided)
   *    c. Wait 100ms
   * 3. Return when ready
   *
   * TIMEOUT:
   * Default timeout is 60000ms (60 seconds), configurable via
   * SIGMA_COMPRESSION_TIMEOUT_MS environment variable.
   *
   * @param timeout - Maximum time to wait (ms), defaults to 60000 or env var
   * @param onProgress - Optional progress callback (elapsed ms, current status)
   * @returns Promise that resolves when ready
   * @throws Error if timeout is exceeded
   *
   * @example
   * // Wait with progress reporting
   * await queue.waitForCompressionReady(60000, (elapsed, status) => {
   *   console.log(`${elapsed}ms: ${status.queueLength} pending, ${status.totalProcessed} done`);
   * });
   * console.log('Ready to compress!');
   *
   * @example
   * // With timeout handling
   * try {
   *   await queue.waitForCompressionReady(30000);
   *   await compressConversation();
   * } catch (error) {
   *   console.error('Timeout waiting for analysis:', error);
   * }
   */
  async waitForCompressionReady(
    timeout: number = parseInt(
      process.env.SIGMA_COMPRESSION_TIMEOUT_MS || '60000', // 60s for network workbench
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
   * Get all unanalyzed messages (by message ID, not timestamp)
   *
   * Identifies messages that haven't been analyzed yet, using message index
   * as the unique identifier. This handles duplicate timestamps correctly
   * (e.g., rapid-fire messages within same millisecond).
   *
   * ALGORITHM:
   * 1. Filter to user/assistant messages only
   * 2. For each message, compute messageId = `msg-${index}`
   * 3. Check if messageId is in analyzedMessageIds set
   * 4. If not found, add to unanalyzed array
   *
   * This is used before compression to ensure no messages are missed.
   *
   * @param allMessages - All messages in the conversation
   * @returns Array of unanalyzed messages with metadata
   *
   * @example
   * const unanalyzed = queue.getUnanalyzedMessages(messages);
   * if (unanalyzed.length > 0) {
   *   console.warn(`${unanalyzed.length} messages not analyzed:`);
   *   for (const msg of unanalyzed) {
   *     console.warn(`  - Message ${msg.index} at ${msg.timestamp}`);
   *   }
   * }
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
