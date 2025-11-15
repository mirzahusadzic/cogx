/**
 * Turn Analysis Hook - Non-Blocking Background Analysis Orchestration
 *
 * React hook that manages conversation turn analysis using a background processing
 * queue. Ensures the TUI remains responsive by analyzing user/assistant messages
 * asynchronously without blocking the UI thread.
 *
 * DESIGN RATIONALE:
 * The previous implementation blocked the UI during re-embedding operations, creating
 * noticeable lag. This hook solves that by:
 * 1. Queueing analysis tasks in a background AnalysisQueue
 * 2. Processing tasks asynchronously one at a time
 * 3. Updating React state only when analyses complete
 * 4. Coordinating with compression to ensure all analyses finish before archival
 *
 * INTEGRATION WITH GROUNDED CONTEXT POOL (PGC):
 * As analyses complete, they're automatically persisted to conversation overlays
 * in the Grounded Context Pool (PGC) via the ConversationOverlayRegistry. This enables:
 * - Semantic search across conversation history
 * - Paradigm shift detection
 * - Novelty tracking
 * - Importance scoring
 *
 * COMPRESSION COORDINATION:
 * The hook provides compression coordination methods to ensure all pending analyses
 * and LanceDB writes complete before compression starts:
 * - waitForCompressionReady(): Blocks until queue is idle and persistence complete
 * - isReadyForCompression(): Checks if safe to compress
 * - getUnanalyzedMessages(): Identifies messages that need analysis before compression
 *
 * @example
 * // Basic usage in a TUI component
 * const {
 *   analyses,
 *   queueStatus,
 *   enqueueAnalysis,
 *   stats
 * } = useTurnAnalysis({
 *   embedder,
 *   projectRegistry,
 *   conversationRegistry,
 *   cwd: process.cwd(),
 *   sessionId: 'session-123',
 *   debug: true
 * });
 *
 * // Enqueue analysis for new message (non-blocking)
 * await enqueueAnalysis({
 *   message: userMessage,
 *   messageIndex: 5,
 *   timestamp: Date.now(),
 *   cachedEmbedding: undefined
 * });
 *
 * @example
 * // Compression coordination
 * const { waitForCompressionReady, getUnanalyzedMessages } = useTurnAnalysis({...});
 *
 * // Before compressing, ensure all analyses complete
 * await waitForCompressionReady(60000, (elapsed, status) => {
 *   console.log(`Waiting for analysis: ${status.queueLength} pending`);
 * });
 *
 * // Check for missed messages
 * const unanalyzed = getUnanalyzedMessages(allMessages);
 * if (unanalyzed.length > 0) {
 *   console.warn(`${unanalyzed.length} messages not analyzed`);
 * }
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { AnalysisQueue } from './AnalysisQueue.js';
import type { EmbeddingService } from '../../../core/services/embedding.js';
import type { OverlayRegistry } from '../../../core/algebra/overlay-registry.js';
import type { ConversationOverlayRegistry } from '../../../sigma/conversation-registry.js';
import type { TurnAnalysis } from '../../../sigma/types.js';
import type { AnalysisQueueStatus, AnalysisTask } from './types.js';

/**
 * Configuration options for the turn analysis hook
 */
export interface UseTurnAnalysisOptions {
  /** Embedding service for vectorizing conversation turns */
  embedder: EmbeddingService | null;
  /** Project-level overlay registry for semantic alignment */
  projectRegistry: OverlayRegistry | null;
  /** Conversation-level overlay registry for storing analyses in Grounded Context Pool (PGC) */
  conversationRegistry: ConversationOverlayRegistry | null;
  /** Current working directory (project root) */
  cwd: string;
  /** Unique session identifier for this conversation */
  sessionId: string;
  /** Enable debug logging for queue operations */
  debug?: boolean;
}

/**
 * Return value from useTurnAnalysis hook
 */
export interface UseTurnAnalysisReturn {
  // Analysis data
  /** All completed turn analyses, sorted chronologically */
  analyses: TurnAnalysis[];
  /** Current status of the background processing queue */
  queueStatus: AnalysisQueueStatus;

  // Queue operations
  /** Enqueue a new analysis task (non-blocking) */
  enqueueAnalysis: (task: AnalysisTask) => Promise<void>;
  /** Set analyses from external source (e.g., loaded from disk) */
  setAnalyses: (analyses: TurnAnalysis[]) => void;
  /** Check if a turn at given timestamp has been analyzed */
  hasAnalyzed: (timestamp: number) => boolean;
  /** Clear all analyses and reset queue */
  clear: () => void;

  // Compression coordination methods
  /**
   * Wait for queue to become ready for compression
   * Ensures all pending analyses and LanceDB writes complete
   */
  waitForCompressionReady: (
    timeout?: number,
    onProgress?: (elapsed: number, status: AnalysisQueueStatus) => void
  ) => Promise<void>;
  /**
   * Get all messages that haven't been analyzed yet
   * Uses message index, not timestamp (handles duplicates correctly)
   */
  getUnanalyzedMessages: (
    messages: Array<{ timestamp: Date; type: string; id?: string }>
  ) => Array<{ timestamp: number; messageId: string; index: number }>;
  /** Check if queue is ready for compression (no pending work) */
  isReadyForCompression: () => boolean;

  // Stats
  /** Aggregate statistics across all analyses */
  stats: {
    /** Total number of turns analyzed */
    totalAnalyzed: number;
    /** Number of paradigm shifts detected */
    paradigmShifts: number;
    /** Number of routine turns (low novelty/importance) */
    routineTurns: number;
    /** Average novelty score (0-1) */
    avgNovelty: number;
    /** Average importance score (0-1) */
    avgImportance: number;
  };
}

/**
 * Hook for managing turn analysis with background processing
 *
 * Creates and manages an AnalysisQueue that processes conversation turns
 * asynchronously. Automatically populates conversation overlays in the
 * Grounded Context Pool (PGC) as analyses complete.
 *
 * LIFECYCLE:
 * 1. Hook mounts, waits for embedder to be ready
 * 2. Creates AnalysisQueue with event handlers
 * 3. As messages arrive, caller enqueues analysis tasks
 * 4. Queue processes tasks in background, updating React state on completion
 * 5. Completed analyses are persisted to PGC overlays
 * 6. Hook provides stats and coordination methods for compression
 *
 * @param options - Configuration including embedder, registries, session info
 * @returns Hook interface with analyses, queue status, and control methods
 *
 * @example
 * // In a TUI component
 * const turnAnalysis = useTurnAnalysis({
 *   embedder,
 *   projectRegistry,
 *   conversationRegistry,
 *   cwd: process.cwd(),
 *   sessionId,
 *   debug: true
 * });
 *
 * // When new message arrives
 * if (message.type === 'user' || message.type === 'assistant') {
 *   await turnAnalysis.enqueueAnalysis({
 *     message,
 *     messageIndex: messages.length - 1,
 *     timestamp: message.timestamp.getTime()
 *   });
 * }
 *
 * // Display queue status in UI
 * <Text>{turnAnalysis.queueStatus.isProcessing ? 'Analyzing...' : 'Idle'}</Text>
 * <Text>Queue: {turnAnalysis.queueStatus.queueLength} pending</Text>
 */
export function useTurnAnalysis(
  options: UseTurnAnalysisOptions
): UseTurnAnalysisReturn {
  const {
    embedder,
    projectRegistry,
    conversationRegistry,
    cwd,
    sessionId,
    debug,
  } = options;

  // Analysis queue (stable reference)
  const queueRef = useRef<AnalysisQueue | null>(null);

  // Queue status (for UI updates)
  const [queueStatus, setQueueStatus] = useState<AnalysisQueueStatus>({
    isProcessing: false,
    queueLength: 0,
    totalProcessed: 0,
  });

  // Analyses (for UI updates)
  const [analyses, setAnalysesState] = useState<TurnAnalysis[]>([]);

  // Last analyzed message index
  const lastAnalyzedIndexRef = useRef(-1);

  // Initialize queue when embedder is ready
  useEffect(() => {
    if (!embedder) {
      return;
    }

    // Create queue if not exists
    if (!queueRef.current) {
      queueRef.current = new AnalysisQueue(
        {
          embedder,
          projectRegistry,
          cwd,
          sessionId,
          debug,
        },
        {
          onAnalysisComplete: (result) => {
            // Update analyses state
            setAnalysesState(queueRef.current!.getAnalyses());

            // Update last analyzed index
            lastAnalyzedIndexRef.current = result.messageIndex;

            // Populate conversation overlays
            if (conversationRegistry) {
              populateOverlays(result.analysis, conversationRegistry);
            }
          },
          onProgress: (status) => {
            setQueueStatus(status);
          },
          onError: (error, task) => {
            if (debug) {
              console.error('[AnalysisQueue] Error analyzing turn:', error);
              console.error('[AnalysisQueue] Task:', task);
            }
          },
        }
      );
    }
  }, [embedder, projectRegistry, conversationRegistry, cwd, sessionId, debug]);

  // Enqueue analysis
  const enqueueAnalysis = useCallback(async (task: AnalysisTask) => {
    if (!queueRef.current) {
      throw new Error('Analysis queue not initialized');
    }
    await queueRef.current.enqueue(task);
  }, []);

  // Set analyses (e.g., when loading from disk)
  const setAnalyses = useCallback((newAnalyses: TurnAnalysis[]) => {
    if (queueRef.current) {
      queueRef.current.setAnalyses(newAnalyses);
      setAnalysesState(newAnalyses);
    }
  }, []);

  // Check if analyzed
  const hasAnalyzed = useCallback((timestamp: number): boolean => {
    return queueRef.current?.hasAnalyzed(timestamp) ?? false;
  }, []);

  // Clear analyses
  const clear = useCallback(() => {
    if (queueRef.current) {
      queueRef.current.clear();
      setAnalysesState([]);
      lastAnalyzedIndexRef.current = -1;
    }
  }, []);

  // ✅ NEW: Expose queue methods for compression coordination
  const waitForCompressionReady = useCallback(
    async (
      timeout?: number,
      onProgress?: (elapsed: number, status: AnalysisQueueStatus) => void
    ) => {
      if (!queueRef.current) {
        throw new Error('Analysis queue not initialized');
      }
      await queueRef.current.waitForCompressionReady(timeout, onProgress);
    },
    []
  );

  const getUnanalyzedMessages = useCallback(
    (messages: Array<{ timestamp: Date; type: string; id?: string }>) => {
      if (!queueRef.current) return [];
      return queueRef.current.getUnanalyzedMessages(messages);
    },
    []
  );

  const isReadyForCompression = useCallback(() => {
    if (!queueRef.current) return true; // No queue = ready
    return queueRef.current.isReadyForCompression();
  }, []);

  // Calculate stats
  const stats = {
    totalAnalyzed: analyses.length,
    paradigmShifts: analyses.filter((a) => a.is_paradigm_shift).length,
    routineTurns: analyses.filter((a) => a.is_routine).length,
    avgNovelty:
      analyses.length > 0
        ? analyses.reduce((sum, a) => sum + a.novelty, 0) / analyses.length
        : 0,
    avgImportance:
      analyses.length > 0
        ? analyses.reduce((sum, a) => sum + a.importance_score, 0) /
          analyses.length
        : 0,
  };

  return {
    analyses,
    queueStatus,
    enqueueAnalysis,
    setAnalyses,
    hasAnalyzed,
    clear,
    // ✅ NEW: Compression coordination methods
    waitForCompressionReady,
    getUnanalyzedMessages,
    isReadyForCompression,
    stats,
  };
}

/**
 * Populate conversation overlays in Grounded Context Pool (PGC)
 *
 * Takes a completed turn analysis and stores it in the appropriate conversation
 * overlays (topics, entities, actions, patterns). This enables semantic search
 * and cross-conversation coherence analysis.
 *
 * NOTE: Periodic flushing to LanceDB is handled by the caller (useClaudeAgent),
 * not by this function. This ensures batch writes for performance.
 *
 * @param analysis - Completed turn analysis with embeddings
 * @param registry - Conversation overlay registry for this session
 *
 * @example
 * // Called automatically when analysis completes
 * await populateOverlays(analysis, conversationRegistry);
 * // Later, caller flushes to disk
 * await conversationRegistry.flush();
 */
async function populateOverlays(
  analysis: TurnAnalysis,
  registry: ConversationOverlayRegistry
): Promise<void> {
  try {
    const { populateConversationOverlays } = await import(
      '../../../sigma/conversation-populator.js'
    );
    await populateConversationOverlays(analysis, registry);

    // Note: Periodic flushing is handled by the caller (useClaudeAgent)
    // We just populate overlays here
  } catch (error) {
    console.error('[useTurnAnalysis] Failed to populate overlays:', error);
  }
}
