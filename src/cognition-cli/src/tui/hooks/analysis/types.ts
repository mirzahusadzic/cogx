/**
 * Analysis Layer Types
 *
 * Type definitions for turn analysis and background processing queue.
 *
 * Created as part of Week 3 Day 11-13 refactor.
 */

import type { TurnAnalysis, ConversationContext } from '../../../sigma/types.js';
import type { EmbeddingService } from '../../../core/services/embedding.js';
import type { OverlayRegistry } from '../../../core/algebra/overlay-registry.js';
import type { ClaudeMessage } from '../useClaudeAgent.js';

/**
 * Message with index for analysis tracking
 */
export interface MessageWithIndex {
  message: ClaudeMessage;
  index: number;
}

/**
 * Analysis task for queue
 */
export interface AnalysisTask {
  message: ClaudeMessage;
  messageIndex: number;
  timestamp: number;
  cachedEmbedding?: number[];
}

/**
 * Analysis queue status
 */
export interface AnalysisQueueStatus {
  isProcessing: boolean;
  queueLength: number;
  totalProcessed: number;
  currentTask?: {
    timestamp: number;
    messageIndex: number;
  };
}

/**
 * Analysis result
 */
export interface AnalysisResult {
  analysis: TurnAnalysis;
  messageIndex: number;
}

/**
 * Analysis options
 */
export interface AnalysisOptions {
  embedder: EmbeddingService;
  projectRegistry: OverlayRegistry | null;
  cwd: string;
  sessionId: string;
  debug?: boolean;
}

/**
 * Queue event handlers
 */
export interface AnalysisQueueHandlers {
  onAnalysisComplete?: (result: AnalysisResult) => void;
  onQueueEmpty?: () => void;
  onError?: (error: Error, task: AnalysisTask) => void;
  onProgress?: (status: AnalysisQueueStatus) => void;
}
