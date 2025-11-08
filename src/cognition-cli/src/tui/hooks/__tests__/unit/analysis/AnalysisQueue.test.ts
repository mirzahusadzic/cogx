/**
 * Tests for AnalysisQueue
 *
 * Week 3 Day 11-13: Extract Analysis Layer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalysisQueue } from '../../../analysis/AnalysisQueue.js';
import type { AnalysisTask, AnalysisOptions } from '../../../analysis/types.js';
import type { TurnAnalysis } from '../../../../../sigma/types.js';

// Mock analyzeTurn
vi.mock('../../../../../sigma/analyzer-with-embeddings.js', () => ({
  analyzeTurn: vi.fn(async (turn) => {
    // Return a mock analysis
    return {
      turn_id: turn.id,
      role: turn.role,
      content: turn.content,
      timestamp: turn.timestamp,
      novelty: 0.5,
      importance_score: 5,
      is_paradigm_shift: false,
      is_routine: false,
      embedding: [0.1, 0.2, 0.3],
      overlay_scores: {},
    } as TurnAnalysis;
  }),
}));

describe('AnalysisQueue', () => {
  let mockOptions: AnalysisOptions;

  beforeEach(() => {
    mockOptions = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      embedder: {} as any,
      projectRegistry: null,
      cwd: '/test',
      sessionId: 'test-session',
      debug: false,
    };
  });

  describe('initialization', () => {
    it('starts with empty queue', () => {
      const queue = new AnalysisQueue(mockOptions);
      const status = queue.getStatus();

      expect(status.isProcessing).toBe(false);
      expect(status.queueLength).toBe(0);
      expect(status.totalProcessed).toBe(0);
    });

    it('starts with empty analyses', () => {
      const queue = new AnalysisQueue(mockOptions);
      expect(queue.getAnalyses()).toEqual([]);
    });
  });

  describe('enqueue()', () => {
    it('adds task to queue', async () => {
      const queue = new AnalysisQueue(mockOptions);
      const task: AnalysisTask = {
        message: {
          type: 'user',
          content: 'Hello',
          timestamp: new Date(1000),
        },
        messageIndex: 0,
        timestamp: 1000,
      };

      await queue.enqueue(task);
      await queue.waitForCompletion();

      expect(queue.getAnalyses()).toHaveLength(1);
    });

    it('does not add duplicate tasks', async () => {
      const queue = new AnalysisQueue(mockOptions);
      const task: AnalysisTask = {
        message: {
          type: 'user',
          content: 'Hello',
          timestamp: new Date(1000),
        },
        messageIndex: 0,
        timestamp: 1000,
      };

      await queue.enqueue(task);
      await queue.enqueue(task); // Duplicate
      await queue.waitForCompletion();

      expect(queue.getAnalyses()).toHaveLength(1);
    });

    it('does not re-analyze already analyzed turns', async () => {
      const queue = new AnalysisQueue(mockOptions);
      const task: AnalysisTask = {
        message: {
          type: 'user',
          content: 'Hello',
          timestamp: new Date(1000),
        },
        messageIndex: 0,
        timestamp: 1000,
      };

      // First analysis
      await queue.enqueue(task);
      await queue.waitForCompletion();

      const firstCount = queue.getAnalyses().length;

      // Try to analyze again
      await queue.enqueue(task);
      await queue.waitForCompletion();

      expect(queue.getAnalyses()).toHaveLength(firstCount);
    });

    it('processes multiple tasks in order', async () => {
      const queue = new AnalysisQueue(mockOptions);
      const tasks: AnalysisTask[] = [
        {
          message: {
            type: 'user',
            content: 'First',
            timestamp: new Date(1000),
          },
          messageIndex: 0,
          timestamp: 1000,
        },
        {
          message: {
            type: 'assistant',
            content: 'Second',
            timestamp: new Date(2000),
          },
          messageIndex: 1,
          timestamp: 2000,
        },
        {
          message: {
            type: 'user',
            content: 'Third',
            timestamp: new Date(3000),
          },
          messageIndex: 2,
          timestamp: 3000,
        },
      ];

      for (const task of tasks) {
        await queue.enqueue(task);
      }
      await queue.waitForCompletion();

      const analyses = queue.getAnalyses();
      expect(analyses).toHaveLength(3);
      expect(analyses[0].timestamp).toBe(1000);
      expect(analyses[1].timestamp).toBe(2000);
      expect(analyses[2].timestamp).toBe(3000);
    });
  });

  describe('hasAnalyzed()', () => {
    it('returns false for unanalyzed timestamps', () => {
      const queue = new AnalysisQueue(mockOptions);
      expect(queue.hasAnalyzed(1000)).toBe(false);
    });

    it('returns true after analyzing', async () => {
      const queue = new AnalysisQueue(mockOptions);
      const task: AnalysisTask = {
        message: { type: 'user', content: 'Hello', timestamp: new Date(1000) },
        messageIndex: 0,
        timestamp: 1000,
      };

      await queue.enqueue(task);
      await queue.waitForCompletion();

      expect(queue.hasAnalyzed(1000)).toBe(true);
    });
  });

  describe('setAnalyses()', () => {
    it('sets existing analyses', () => {
      const queue = new AnalysisQueue(mockOptions);
      const analyses: TurnAnalysis[] = [
        {
          turn_id: 'turn-1',
          role: 'user',
          content: 'Hello',
          timestamp: 1000,
          novelty: 0.5,
          importance_score: 5,
          is_paradigm_shift: false,
          is_routine: false,
          embedding: [0.1, 0.2],
          overlay_scores: {},
        },
      ];

      queue.setAnalyses(analyses);

      expect(queue.getAnalyses()).toHaveLength(1);
      expect(queue.hasAnalyzed(1000)).toBe(true);
    });

    it('prevents re-analysis of loaded turns', async () => {
      const queue = new AnalysisQueue(mockOptions);

      // Load existing analysis
      const existingAnalyses: TurnAnalysis[] = [
        {
          turn_id: 'turn-1',
          role: 'user',
          content: 'Hello',
          timestamp: 1000,
          novelty: 0.5,
          importance_score: 5,
          is_paradigm_shift: false,
          is_routine: false,
          embedding: [0.1, 0.2],
          overlay_scores: {},
        },
      ];
      queue.setAnalyses(existingAnalyses);

      // Try to enqueue same turn
      const task: AnalysisTask = {
        message: { type: 'user', content: 'Hello', timestamp: new Date(1000) },
        messageIndex: 0,
        timestamp: 1000,
      };
      await queue.enqueue(task);
      await queue.waitForCompletion();

      // Should still only have 1 analysis
      expect(queue.getAnalyses()).toHaveLength(1);
    });
  });

  describe('clear()', () => {
    it('clears all analyses and queue', async () => {
      const queue = new AnalysisQueue(mockOptions);
      const task: AnalysisTask = {
        message: { type: 'user', content: 'Hello', timestamp: new Date(1000) },
        messageIndex: 0,
        timestamp: 1000,
      };

      await queue.enqueue(task);
      await queue.waitForCompletion();

      queue.clear();

      expect(queue.getAnalyses()).toHaveLength(0);
      expect(queue.hasAnalyzed(1000)).toBe(false);
      expect(queue.getStatus().totalProcessed).toBe(0);
    });
  });

  describe('event handlers', () => {
    it('calls onAnalysisComplete when analysis finishes', async () => {
      const onAnalysisComplete = vi.fn();
      const queue = new AnalysisQueue(mockOptions, { onAnalysisComplete });

      const task: AnalysisTask = {
        message: { type: 'user', content: 'Hello', timestamp: new Date(1000) },
        messageIndex: 0,
        timestamp: 1000,
      };

      await queue.enqueue(task);
      await queue.waitForCompletion();

      expect(onAnalysisComplete).toHaveBeenCalledWith({
        analysis: expect.objectContaining({
          timestamp: 1000,
        }),
        messageIndex: 0,
      });
    });

    it('calls onProgress during processing', async () => {
      const onProgress = vi.fn();
      const queue = new AnalysisQueue(mockOptions, { onProgress });

      const task: AnalysisTask = {
        message: { type: 'user', content: 'Hello', timestamp: new Date(1000) },
        messageIndex: 0,
        timestamp: 1000,
      };

      await queue.enqueue(task);
      await queue.waitForCompletion();

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          isProcessing: expect.any(Boolean),
          queueLength: expect.any(Number),
          totalProcessed: expect.any(Number),
        })
      );
    });

    it('calls onQueueEmpty when queue finishes', async () => {
      const onQueueEmpty = vi.fn();
      const queue = new AnalysisQueue(mockOptions, { onQueueEmpty });

      const task: AnalysisTask = {
        message: { type: 'user', content: 'Hello', timestamp: new Date(1000) },
        messageIndex: 0,
        timestamp: 1000,
      };

      await queue.enqueue(task);
      await queue.waitForCompletion();

      expect(onQueueEmpty).toHaveBeenCalled();
    });

    it('calls onError when analysis fails', async () => {
      // Mock analyzeTurn to throw error for this test
      const { analyzeTurn } = await import(
        '../../../../../sigma/analyzer-with-embeddings.js'
      );
      vi.mocked(analyzeTurn).mockRejectedValueOnce(new Error('Test error'));

      const onError = vi.fn();
      const queue = new AnalysisQueue(mockOptions, { onError });

      const task: AnalysisTask = {
        message: { type: 'user', content: 'Hello', timestamp: new Date(1000) },
        messageIndex: 0,
        timestamp: 1000,
      };

      await queue.enqueue(task);
      await queue.waitForCompletion();

      expect(onError).toHaveBeenCalledWith(expect.any(Error), task);
    });
  });

  describe('background processing', () => {
    it('does not block on enqueue', async () => {
      const queue = new AnalysisQueue(mockOptions);
      const task: AnalysisTask = {
        message: { type: 'user', content: 'Hello', timestamp: new Date(1000) },
        messageIndex: 0,
        timestamp: 1000,
      };

      // enqueue should return immediately
      const startTime = Date.now();
      await queue.enqueue(task);
      const enqueueTime = Date.now() - startTime;

      // Should be very fast (< 10ms)
      expect(enqueueTime).toBeLessThan(10);

      // Wait for actual processing
      await queue.waitForCompletion();
    });

    it('processes queue in background', async () => {
      let processingStarted = false;
      const onProgress = vi.fn((status) => {
        if (status.isProcessing) {
          processingStarted = true;
        }
      });

      const queue = new AnalysisQueue(mockOptions, { onProgress });
      const task: AnalysisTask = {
        message: { type: 'user', content: 'Hello', timestamp: new Date(1000) },
        messageIndex: 0,
        timestamp: 1000,
      };

      await queue.enqueue(task);

      // Should eventually start processing
      await queue.waitForCompletion();
      expect(processingStarted).toBe(true);
    });
  });
});
