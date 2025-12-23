import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  findSimilarConversations,
  findAllParadigmShifts,
  findByOverlayAlignment,
} from '../cross-session-query.js';

const { mockLanceStore } = vi.hoisted(() => ({
  mockLanceStore: {
    initialize: vi.fn(),
    getSessionTurns: vi.fn(),
    getTurn: vi.fn(),
    storeTurn: vi.fn(),
    similaritySearch: vi.fn(),
    getParadigmShifts: vi.fn(),
    getStats: vi.fn(),
    close: vi.fn(),
  },
}));

vi.mock('../conversation-lance-store.js', () => ({
  ConversationLanceStore: vi.fn().mockImplementation(() => mockLanceStore),
}));

const { mockWorkbench } = vi.hoisted(() => ({
  mockWorkbench: {
    embed: vi
      .fn()
      .mockResolvedValue({ embedding_768d: new Array(768).fill(0.1) }),
  },
}));

vi.mock('../../core/executors/workbench-client.js', () => ({
  WorkbenchClient: vi.fn().mockImplementation(() => mockWorkbench),
}));

describe('CrossSessionQuery', () => {
  const sigmaRoot = '/tmp/sigma';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findSimilarConversations', () => {
    it('should search and return results', async () => {
      mockLanceStore.similaritySearch.mockResolvedValue([
        {
          id: 't1',
          session_id: 's1',
          role: 'user',
          content: 'test',
          timestamp: 100,
          similarity: 0.9,
          metadata: {
            novelty: 0.1,
            importance: 5,
            is_paradigm_shift: false,
            alignment_O1: 1,
            alignment_O2: 1,
            alignment_O3: 1,
            alignment_O4: 1,
            alignment_O5: 1,
            alignment_O6: 1,
            alignment_O7: 1,
            semantic_tags: [],
            references: [],
          },
        },
      ]);

      const results = await findSimilarConversations('query', sigmaRoot);

      expect(results).toHaveLength(1);
      expect(results[0].session_id).toBe('s1');
      expect(mockLanceStore.initialize).toHaveBeenCalled();
      expect(mockLanceStore.close).toHaveBeenCalled();
    });

    it('should filter by includeSessions', async () => {
      mockLanceStore.similaritySearch.mockResolvedValue([
        { session_id: 's1', metadata: { alignment_O1: 0 } },
        { session_id: 's2', metadata: { alignment_O1: 0 } },
      ]);

      const results = await findSimilarConversations('query', sigmaRoot, {
        includeSessions: ['s1'],
      });

      expect(results).toHaveLength(1);
      expect(results[0].session_id).toBe('s1');
    });
  });

  describe('findAllParadigmShifts', () => {
    it('should return paradigm shifts', async () => {
      mockLanceStore.getParadigmShifts.mockResolvedValue([
        {
          id: 't1',
          session_id: 's1',
          role: 'assistant',
          content: 'AHA!',
          timestamp: 200,
          is_paradigm_shift: true,
          novelty: 0.9,
          importance: 9,
          alignment_O1: 5,
          alignment_O2: 5,
          alignment_O3: 5,
          alignment_O4: 5,
          alignment_O5: 5,
          alignment_O6: 5,
          alignment_O7: 5,
          semantic_tags: '[]',
          references: '[]',
        },
      ]);

      const results = await findAllParadigmShifts(sigmaRoot);

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('AHA!');
      expect(results[0].metadata.is_paradigm_shift).toBe(true);
    });
  });

  describe('findByOverlayAlignment', () => {
    it('should filter by overlay alignment', async () => {
      mockLanceStore.similaritySearch.mockResolvedValue([
        {
          id: 't1',
          session_id: 's1',
          metadata: {
            alignment_O2: 9,
            novelty: 0.1,
            importance: 8,
            is_paradigm_shift: false,
          },
        },
      ]);

      const results = await findByOverlayAlignment(sigmaRoot, 'O2', 8.0);

      expect(results).toHaveLength(1);
      expect(mockLanceStore.similaritySearch).toHaveBeenCalledWith(
        expect.any(Array),
        20,
        { overlay: 'O2', min_overlay_alignment: 8.0 },
        'cosine'
      );
    });
  });
});
