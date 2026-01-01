/**
 * Turn Analysis Layer - Type Definitions
 *
 * Type definitions for the background turn analysis system. Provides interfaces
 * for queueing, processing, and tracking conversation turn analysis.
 *
 * ARCHITECTURE:
 * The analysis layer uses a producer-consumer pattern:
 * - Producer: TUI components enqueue AnalysisTasks as messages arrive
 * - Queue: AnalysisQueue manages background processing
 * - Consumer: analyzeTurn() processes tasks asynchronously
 * - Observers: React components subscribe to AnalysisQueueStatus updates
 *
 * This decouples analysis from the UI thread, preventing blocking during
 * expensive embedding operations.
 *
 * TYPE HIERARCHY:
 * - AnalysisTask: Input to the queue (message + metadata)
 * - AnalysisResult: Output from the queue (analysis + index)
 * - AnalysisOptions: Configuration for the analyzer
 * - AnalysisQueueStatus: Observable queue state
 * - AnalysisQueueHandlers: Event callbacks for queue lifecycle
 *
 * @example
 * // Creating an analysis task
 * const task: AnalysisTask = {
 *   message: claudeMessage,
 *   messageIndex: 5,
 *   timestamp: Date.now(),
 *   cachedEmbedding: undefined // Will compute fresh
 * };
 *
 * @example
 * // Subscribing to queue status
 * const handlers: AnalysisQueueHandlers = {
 *   onProgress: (status) => {
 *     systemLog('tui', `Queue: ${status.queueLength} pending, ${status.totalProcessed} done`);
 *   },
 *   onAnalysisComplete: (result) => {
 *     systemLog('tui', `Analyzed turn ${result.messageIndex}`, { novelty: result.analysis.novelty });
 *   }
 * };
 */

import type { TurnAnalysis } from '../../../sigma/types.js';
import type { EmbeddingService } from '../../../core/services/embedding.js';
import type { OverlayRegistry } from '../../../core/algebra/overlay-registry.js';
import type { TUIMessage } from '../useAgent.js';

/**
 * Message with index for analysis tracking
 *
 * Pairs a Claude message with its position in the conversation history.
 * Used internally for maintaining chronological order during analysis.
 */
export interface MessageWithIndex {
  /** The TUI message (user or assistant) */
  message: TUIMessage;
  /** Zero-based index in the conversation history */
  index: number;
}

/**
 * Analysis task for background queue
 *
 * Represents a single turn analysis job. Tasks are processed asynchronously
 * in the order they're enqueued (FIFO).
 *
 * DESIGN NOTE:
 * We track both timestamp and messageIndex because:
 * - timestamp: Used for deduplication (prevent re-analyzing same turn)
 * - messageIndex: Used for ordering and context building
 *
 * @example
 * const task: AnalysisTask = {
 *   message: { type: 'user', content: 'Hello', timestamp: new Date() },
 *   messageIndex: 0,
 *   timestamp: Date.now(),
 *   cachedEmbedding: [0.1, 0.2, ...] // Optional: reuse existing embedding
 * };
 */
export interface AnalysisTask {
  /** The message to analyze */
  message: TUIMessage;
  /** Position in conversation history (0-based) */
  messageIndex: number;
  /** Unix timestamp (ms) for deduplication */
  timestamp: number;
  /** Optional pre-computed embedding (avoids re-embedding) */
  cachedEmbedding?: number[];
}

/**
 * Analysis queue status for UI updates
 *
 * Observable state that React components can use to display queue progress.
 * Updated after each task completes or when queue state changes.
 *
 * @example
 * // Display in TUI
 * const { queueStatus } = useTurnAnalysis({...});
 * <Text>
 *   {queueStatus.isProcessing
 *     ? `Analyzing turn ${queueStatus.currentTask?.messageIndex}...`
 *     : 'Idle'}
 * </Text>
 * <Text>Queue: {queueStatus.queueLength} pending</Text>
 * <Text>Completed: {queueStatus.totalProcessed}</Text>
 */
export interface AnalysisQueueStatus {
  /** True if queue is currently processing a task */
  isProcessing: boolean;
  /** Number of tasks waiting in queue */
  queueLength: number;
  /** Total tasks processed since queue creation */
  totalProcessed: number;
  /** Details about the task currently being processed */
  currentTask?: {
    /** Timestamp of the task being processed */
    timestamp: number;
    /** Message index being analyzed */
    messageIndex: number;
  };
}

/**
 * Analysis result returned from queue
 *
 * Contains the completed turn analysis plus metadata for tracking.
 * Emitted via onAnalysisComplete callback.
 *
 * @example
 * const result: AnalysisResult = {
 *   analysis: {
 *     turn_id: 'turn-123',
 *     novelty: 0.8,
 *     importance_score: 0.9,
 *     is_paradigm_shift: true,
 *     // ... other TurnAnalysis fields
 *   },
 *   messageIndex: 5
 * };
 */
export interface AnalysisResult {
  /** Completed turn analysis with all computed metrics */
  analysis: TurnAnalysis;
  /** Position in conversation history (for ordering) */
  messageIndex: number;
}

/**
 * Configuration options for the analysis system
 *
 * Provides dependencies needed for turn analysis, including the embedding
 * service and overlay registries for semantic alignment.
 *
 * @example
 * const options: AnalysisOptions = {
 *   embedder: new OpenAIEmbedder({ model: 'text-embedding-3-small' }),
 *   projectRegistry: new OverlayRegistry(pgcPath),
 *   cwd: '/home/user/project',
 *   sessionId: 'session-abc123',
 *   debug: true // Enable verbose logging
 * };
 */
export interface AnalysisOptions {
  /** Embedding service for vectorizing conversation content */
  embedder: EmbeddingService;
  /** Project overlay registry for semantic alignment (null if not available) */
  projectRegistry: OverlayRegistry | null;
  /** Current working directory (project root) */
  cwd: string;
  /** Unique session identifier */
  sessionId: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Event handlers for queue lifecycle
 *
 * Callbacks invoked during queue processing. Used by useTurnAnalysis to
 * update React state and persist analyses to Grounded Context Pool (PGC).
 *
 * @example
 * const handlers: AnalysisQueueHandlers = {
 *   onAnalysisComplete: async (result) => {
 *     // Update React state
 *     setAnalyses(prev => [...prev, result.analysis]);
 *
 *     // Persist to PGC overlays
 *     await conversationRegistry.storeAnalysis(result.analysis);
 *   },
 *   onProgress: (status) => {
 *     setQueueStatus(status);
 *   },
 *   onError: (error, task) => {
 *     systemLog('tui', `Failed to analyze turn ${task.messageIndex}`, { error }, 'error');
 *   },
 *   onQueueEmpty: () => {
 *     systemLog('tui', 'All analyses complete');
 *   }
 * };
 */
export interface AnalysisQueueHandlers {
  /** Called when a task completes successfully */
  onAnalysisComplete?: (result: AnalysisResult) => void;
  /** Called when queue becomes empty (all tasks processed) */
  onQueueEmpty?: () => void;
  /** Called when a task fails (queue continues processing) */
  onError?: (error: Error, task: AnalysisTask) => void;
  /** Called after each state change (for UI updates) */
  onProgress?: (status: AnalysisQueueStatus) => void;
}
