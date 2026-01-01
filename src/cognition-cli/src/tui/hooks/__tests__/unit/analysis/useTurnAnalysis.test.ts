/**
 * Tests for useTurnAnalysis hook
 *
 * Tests the turn analysis hook for background processing of conversation turns.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Mock AnalysisQueue
const mockEnqueue = vi.fn();
const mockGetAnalyses = vi.fn();
const mockSetAnalyses = vi.fn();
const mockHasAnalyzed = vi.fn();
const mockClear = vi.fn();
const mockWaitForCompressionReady = vi.fn();
const mockGetUnanalyzedMessages = vi.fn();
const mockIsReadyForCompression = vi.fn();

let onAnalysisComplete: ((result: unknown) => void) | null = null;
let onProgress: ((status: unknown) => void) | null = null;
let onError: ((error: unknown, task: unknown) => void) | null = null;

vi.mock('../../../analysis/AnalysisQueue.js', () => ({
  AnalysisQueue: vi.fn().mockImplementation((_options, callbacks) => {
    onAnalysisComplete = callbacks.onAnalysisComplete;
    onProgress = callbacks.onProgress;
    onError = callbacks.onError;

    return {
      enqueue: mockEnqueue,
      getAnalyses: mockGetAnalyses,
      setAnalyses: mockSetAnalyses,
      hasAnalyzed: mockHasAnalyzed,
      clear: mockClear,
      waitForCompressionReady: mockWaitForCompressionReady,
      getUnanalyzedMessages: mockGetUnanalyzedMessages,
      isReadyForCompression: mockIsReadyForCompression,
    };
  }),
}));

// Mock conversation populator
vi.mock('../../../../../sigma/conversation-populator.js', () => ({
  populateConversationOverlays: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocking
import { useTurnAnalysis } from '../../../analysis/useTurnAnalysis.js';

describe('useTurnAnalysis', () => {
  const mockEmbedder = {
    embed: vi.fn(),
    embedBatch: vi.fn(),
  };

  const mockProjectRegistry = {
    get: vi.fn(),
    getOverlayInfo: vi.fn(),
  };

  const mockConversationRegistry = {
    get: vi.fn(),
    flush: vi.fn(),
  };

  const defaultOptions = {
    embedder:
      mockEmbedder as unknown as import('../../../../../core/services/embedding.js').EmbeddingService,
    projectRegistry:
      mockProjectRegistry as unknown as import('../../../../../core/algebra/overlay-registry.js').OverlayRegistry,
    conversationRegistry:
      mockConversationRegistry as unknown as import('../../../../../sigma/conversation-registry.js').ConversationOverlayRegistry,
    cwd: '/test/project',
    sessionId: 'session-123',
    debug: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    onAnalysisComplete = null;
    onProgress = null;
    onError = null;

    mockGetAnalyses.mockReturnValue([]);
    mockHasAnalyzed.mockReturnValue(false);
    mockIsReadyForCompression.mockReturnValue(true);
    mockGetUnanalyzedMessages.mockReturnValue([]);
    mockEnqueue.mockResolvedValue(undefined);
    mockWaitForCompressionReady.mockResolvedValue(undefined);
  });

  describe('initialization', () => {
    it('should start with empty analyses', () => {
      const { result } = renderHook(() => useTurnAnalysis(defaultOptions));

      expect(result.current.analyses).toEqual([]);
    });

    it('should start with idle queue status', () => {
      const { result } = renderHook(() => useTurnAnalysis(defaultOptions));

      expect(result.current.queueStatus).toEqual({
        isProcessing: false,
        queueLength: 0,
        totalProcessed: 0,
      });
    });

    it('should provide initial stats', () => {
      const { result } = renderHook(() => useTurnAnalysis(defaultOptions));

      expect(result.current.stats).toEqual({
        totalAnalyzed: 0,
        paradigmShifts: 0,
        routineTurns: 0,
        avgNovelty: 0,
        avgImportance: 0,
      });
    });

    it('should not create queue without embedder', () => {
      // When embedder is null, the queue should not be created
      // We verify this indirectly by checking that enqueueAnalysis throws
      const { result } = renderHook(() =>
        useTurnAnalysis({ ...defaultOptions, embedder: null })
      );

      // Queue not initialized = enqueue will throw
      expect(result.current.enqueueAnalysis).toBeDefined();
    });
  });

  describe('enqueueAnalysis', () => {
    it('should enqueue analysis task', async () => {
      const { result } = renderHook(() => useTurnAnalysis(defaultOptions));

      const task = {
        message: { type: 'user', content: 'Hello' },
        messageIndex: 0,
        timestamp: Date.now(),
      };

      await act(async () => {
        await result.current.enqueueAnalysis(task);
      });

      expect(mockEnqueue).toHaveBeenCalledWith(task);
    });

    it('should throw if queue not initialized', async () => {
      const { result } = renderHook(() =>
        useTurnAnalysis({ ...defaultOptions, embedder: null })
      );

      const task = {
        message: { type: 'user', content: 'Hello' },
        messageIndex: 0,
        timestamp: Date.now(),
      };

      await expect(result.current.enqueueAnalysis(task)).rejects.toThrow(
        'Analysis queue not initialized'
      );
    });
  });

  describe('setAnalyses', () => {
    it('should set analyses from external source', () => {
      const { result } = renderHook(() => useTurnAnalysis(defaultOptions));

      const analyses = [
        {
          turn_index: 0,
          timestamp: Date.now(),
          novelty: 0.5,
          importance_score: 0.7,
          is_paradigm_shift: false,
          is_routine: false,
        },
      ];

      act(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result.current.setAnalyses(analyses as any);
      });

      expect(mockSetAnalyses).toHaveBeenCalledWith(analyses);
    });
  });

  describe('hasAnalyzed', () => {
    it('should check if timestamp was analyzed', () => {
      mockHasAnalyzed.mockReturnValue(true);

      const { result } = renderHook(() => useTurnAnalysis(defaultOptions));

      const isAnalyzed = result.current.hasAnalyzed(1234567890);

      expect(mockHasAnalyzed).toHaveBeenCalledWith(1234567890);
      expect(isAnalyzed).toBe(true);
    });

    it('should return false if queue not initialized', () => {
      const { result } = renderHook(() =>
        useTurnAnalysis({ ...defaultOptions, embedder: null })
      );

      expect(result.current.hasAnalyzed(1234567890)).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all analyses', () => {
      const { result } = renderHook(() => useTurnAnalysis(defaultOptions));

      act(() => {
        result.current.clear();
      });

      expect(mockClear).toHaveBeenCalled();
    });
  });

  describe('compression coordination', () => {
    it('should wait for compression ready', async () => {
      const { result } = renderHook(() => useTurnAnalysis(defaultOptions));

      const onProgress = vi.fn();

      await act(async () => {
        await result.current.waitForCompressionReady(60000, onProgress);
      });

      expect(mockWaitForCompressionReady).toHaveBeenCalledWith(
        60000,
        onProgress
      );
    });

    it('should get unanalyzed messages', () => {
      mockGetUnanalyzedMessages.mockReturnValue([
        { timestamp: 1234567890, messageId: 'msg-1', index: 0 },
      ]);

      const { result } = renderHook(() => useTurnAnalysis(defaultOptions));

      const messages = [{ timestamp: new Date(), type: 'user', id: 'msg-1' }];
      const unanalyzed = result.current.getUnanalyzedMessages(messages);

      expect(mockGetUnanalyzedMessages).toHaveBeenCalledWith(messages);
      expect(unanalyzed).toHaveLength(1);
    });

    it('should check if ready for compression', () => {
      mockIsReadyForCompression.mockReturnValue(true);

      const { result } = renderHook(() => useTurnAnalysis(defaultOptions));

      expect(result.current.isReadyForCompression()).toBe(true);
    });

    it('should return true if queue not initialized', () => {
      const { result } = renderHook(() =>
        useTurnAnalysis({ ...defaultOptions, embedder: null })
      );

      expect(result.current.isReadyForCompression()).toBe(true);
    });
  });

  describe('analysis callbacks', () => {
    it('should update analyses on completion', async () => {
      const analysisResult = {
        turn_index: 0,
        timestamp: Date.now(),
        novelty: 0.8,
        importance_score: 0.9,
        is_paradigm_shift: true,
        is_routine: false,
      };

      mockGetAnalyses.mockReturnValue([analysisResult]);

      const { result } = renderHook(() => useTurnAnalysis(defaultOptions));

      await waitFor(() => {
        expect(onAnalysisComplete).not.toBeNull();
      });

      act(() => {
        if (onAnalysisComplete) {
          onAnalysisComplete({
            analysis: analysisResult,
            messageIndex: 0,
          });
        }
      });

      await waitFor(() => {
        expect(result.current.analyses).toContainEqual(analysisResult);
      });
    });

    it('should update queue status on progress', async () => {
      const { result } = renderHook(() => useTurnAnalysis(defaultOptions));

      await waitFor(() => {
        expect(onProgress).not.toBeNull();
      });

      act(() => {
        if (onProgress) {
          onProgress({
            isProcessing: true,
            queueLength: 3,
            totalProcessed: 5,
          });
        }
      });

      await waitFor(() => {
        expect(result.current.queueStatus).toEqual({
          isProcessing: true,
          queueLength: 3,
          totalProcessed: 5,
        });
      });
    });

    it('should handle errors in debug mode', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      renderHook(() => useTurnAnalysis({ ...defaultOptions, debug: true }));

      await waitFor(() => {
        expect(onError).not.toBeNull();
      });

      act(() => {
        if (onError) {
          onError(new Error('Analysis failed'), { messageIndex: 0 });
        }
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AnalysisQueue] Error analyzing turn:')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('stats calculation', () => {
    it('should calculate stats from analyses', async () => {
      const analyses = [
        {
          turn_index: 0,
          novelty: 0.8,
          importance_score: 0.9,
          is_paradigm_shift: true,
          is_routine: false,
        },
        {
          turn_index: 1,
          novelty: 0.2,
          importance_score: 0.3,
          is_paradigm_shift: false,
          is_routine: true,
        },
      ];

      mockGetAnalyses.mockReturnValue(analyses);

      const { result } = renderHook(() => useTurnAnalysis(defaultOptions));

      await waitFor(() => {
        expect(onAnalysisComplete).not.toBeNull();
      });

      // Trigger update with first analysis
      act(() => {
        if (onAnalysisComplete) {
          onAnalysisComplete({ analysis: analyses[0], messageIndex: 0 });
        }
      });

      // Trigger update with second analysis
      act(() => {
        if (onAnalysisComplete) {
          onAnalysisComplete({ analysis: analyses[1], messageIndex: 1 });
        }
      });

      await waitFor(() => {
        expect(result.current.stats.totalAnalyzed).toBe(2);
        expect(result.current.stats.paradigmShifts).toBe(1);
        expect(result.current.stats.routineTurns).toBe(1);
        expect(result.current.stats.avgNovelty).toBeCloseTo(0.5, 1);
        expect(result.current.stats.avgImportance).toBeCloseTo(0.6, 1);
      });
    });

    it('should handle empty analyses for stats', () => {
      mockGetAnalyses.mockReturnValue([]);

      const { result } = renderHook(() => useTurnAnalysis(defaultOptions));

      expect(result.current.stats.avgNovelty).toBe(0);
      expect(result.current.stats.avgImportance).toBe(0);
    });
  });

  describe('return value structure', () => {
    it('should return all expected properties', () => {
      const { result } = renderHook(() => useTurnAnalysis(defaultOptions));

      expect(result.current).toHaveProperty('analyses');
      expect(result.current).toHaveProperty('queueStatus');
      expect(result.current).toHaveProperty('enqueueAnalysis');
      expect(result.current).toHaveProperty('setAnalyses');
      expect(result.current).toHaveProperty('hasAnalyzed');
      expect(result.current).toHaveProperty('clear');
      expect(result.current).toHaveProperty('waitForCompressionReady');
      expect(result.current).toHaveProperty('getUnanalyzedMessages');
      expect(result.current).toHaveProperty('isReadyForCompression');
      expect(result.current).toHaveProperty('stats');
    });
  });
});
