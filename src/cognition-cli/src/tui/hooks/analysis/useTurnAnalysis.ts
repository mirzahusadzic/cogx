/**
 * useTurnAnalysis Hook
 *
 * React hook for managing turn analysis with background queue.
 * Orchestrates the AnalysisQueue and integrates with React state.
 *
 * Created as part of Week 3 Day 11-13 refactor.
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { AnalysisQueue } from './AnalysisQueue.js';
import type { EmbeddingService } from '../../../core/services/embedding.js';
import type { OverlayRegistry } from '../../../core/algebra/overlay-registry.js';
import type { ConversationOverlayRegistry } from '../../../sigma/conversation-registry.js';
import type { TurnAnalysis } from '../../../sigma/types.js';
import type { AnalysisQueueStatus, AnalysisTask } from './types.js';

export interface UseTurnAnalysisOptions {
  embedder: EmbeddingService | null;
  projectRegistry: OverlayRegistry | null;
  conversationRegistry: ConversationOverlayRegistry | null;
  cwd: string;
  sessionId: string;
  debug?: boolean;
}

export interface UseTurnAnalysisReturn {
  // Analysis data
  analyses: TurnAnalysis[];
  queueStatus: AnalysisQueueStatus;

  // Queue operations
  enqueueAnalysis: (task: AnalysisTask) => Promise<void>;
  setAnalyses: (analyses: TurnAnalysis[]) => void;
  hasAnalyzed: (timestamp: number) => boolean;
  clear: () => void;

  // ✅ NEW: Compression coordination methods
  waitForCompressionReady: (timeout?: number) => Promise<void>;
  getUnanalyzedMessages: (
    messages: Array<{ timestamp: Date; type: string; id?: string }>
  ) => Array<{ timestamp: number; messageId: string; index: number }>;
  isReadyForCompression: () => boolean;

  // Stats
  stats: {
    totalAnalyzed: number;
    paradigmShifts: number;
    routineTurns: number;
    avgNovelty: number;
    avgImportance: number;
  };
}

/**
 * Hook for managing turn analysis with background processing
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
  const waitForCompressionReady = useCallback(async (timeout?: number) => {
    if (!queueRef.current) {
      throw new Error('Analysis queue not initialized');
    }
    await queueRef.current.waitForCompressionReady(timeout);
  }, []);

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
 * Populate conversation overlays (helper function)
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
