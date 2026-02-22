/**
 * Context Injector Tests
 *
 * Tests for the real-time lattice context injection functionality.
 * Covers cosine similarity, relevance calculation, and context injection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { injectRelevantContext } from '../context-injector.js';
import type { TurnAnalysis } from '../types.js';
import type { EmbeddingService } from '../../core/services/embedding.js';

// Helper to create mock TurnAnalysis
function createMockTurn(overrides: Partial<TurnAnalysis> = {}): TurnAnalysis {
  return {
    turn_id: 'test-turn-' + Math.random().toString(36).substring(7),
    role: 'assistant',
    content: 'Test content for this turn',
    timestamp: Date.now(),
    embedding: [0.5, 0.5, 0.5], // Simple 3D embedding for testing
    novelty: 0.5,
    importance_score: 5,
    is_paradigm_shift: false,
    is_routine: false,
    overlay_scores: {
      O1_structural: 5,
      O2_security: 5,
      O3_lineage: 5,
      O4_mission: 5,
      O5_operational: 5,
      O6_mathematical: 5,
      O7_strategic: 5,
    },
    references: [],
    semantic_tags: [],
    ...overrides,
  };
}

// Helper to create mock embedding service
function createMockEmbedder(): EmbeddingService {
  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    getEmbedding: vi.fn().mockResolvedValue({
      embedding_768d: [0.5, 0.5, 0.5],
    }),
    getEmbeddingBatch: vi.fn(),
    getModelInfo: vi.fn(),
  } as unknown as EmbeddingService;
}

describe('Context Injector', () => {
  let mockEmbedder: EmbeddingService;

  beforeEach(() => {
    mockEmbedder = createMockEmbedder();
  });

  describe('injectRelevantContext()', () => {
    describe('Basic Behavior', () => {
      it('should return original message when no turn history exists', async () => {
        const result = await injectRelevantContext(
          'Hello world',
          [],
          mockEmbedder
        );

        expect(result.message).toBe('Hello world');
        expect(result.embedding).toBeNull();
      });

      it('should embed the user message', async () => {
        const turns = [createMockTurn()];

        await injectRelevantContext('Test query', turns, mockEmbedder);

        expect(mockEmbedder.getEmbedding).toHaveBeenCalledWith(
          'Test query',
          768
        );
      });

      it('should return embedding when available', async () => {
        const turns = [createMockTurn()];

        const result = await injectRelevantContext(
          'Test query',
          turns,
          mockEmbedder
        );

        expect(result.embedding).toEqual([0.5, 0.5, 0.5]);
      });

      it('should handle embedding service errors gracefully', async () => {
        const turns = [createMockTurn()];
        (
          mockEmbedder.getEmbedding as ReturnType<typeof vi.fn>
        ).mockRejectedValue(new Error('Embedding service unavailable'));

        const result = await injectRelevantContext(
          'Test query',
          turns,
          mockEmbedder
        );

        // Should return original message on error
        expect(result.message).toBe('Test query');
        expect(result.embedding).toBeNull();
      });
    });

    describe('Embedding Format Handling', () => {
      it('should handle embedding_768d format', async () => {
        const turns = [createMockTurn()];
        (
          mockEmbedder.getEmbedding as ReturnType<typeof vi.fn>
        ).mockResolvedValue({
          embedding_768d: [0.1, 0.2, 0.3],
        });

        const result = await injectRelevantContext('Test', turns, mockEmbedder);

        expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
      });

      it('should handle vector format', async () => {
        const turns = [createMockTurn()];
        (
          mockEmbedder.getEmbedding as ReturnType<typeof vi.fn>
        ).mockResolvedValue({
          vector: [0.4, 0.5, 0.6],
        });

        const result = await injectRelevantContext('Test', turns, mockEmbedder);

        expect(result.embedding).toEqual([0.4, 0.5, 0.6]);
      });

      it('should handle embedding format', async () => {
        const turns = [createMockTurn()];
        (
          mockEmbedder.getEmbedding as ReturnType<typeof vi.fn>
        ).mockResolvedValue({
          embedding: [0.7, 0.8, 0.9],
        });

        const result = await injectRelevantContext('Test', turns, mockEmbedder);

        expect(result.embedding).toEqual([0.7, 0.8, 0.9]);
      });

      it('should handle invalid embedding format gracefully', async () => {
        const turns = [createMockTurn()];
        (
          mockEmbedder.getEmbedding as ReturnType<typeof vi.fn>
        ).mockResolvedValue({
          unexpected_format: 'not an array',
        });

        const result = await injectRelevantContext('Test', turns, mockEmbedder);

        expect(result.message).toBe('Test');
        expect(result.embedding).toBeNull();
      });
    });

    describe('Context Injection', () => {
      it('should inject relevant context when found', async () => {
        // Create turns with high similarity to query
        const turns = [
          createMockTurn({
            content: 'Important implementation details about the feature',
            embedding: [0.5, 0.5, 0.5], // Same as query embedding
            importance_score: 8,
            overlay_scores: {
              O1_structural: 8,
              O2_security: 5,
              O3_lineage: 5,
              O4_mission: 8,
              O5_operational: 8,
              O6_mathematical: 5,
              O7_strategic: 5,
            },
          }),
        ];

        const result = await injectRelevantContext(
          'continue with the feature',
          turns,
          mockEmbedder
        );

        // Should inject context
        expect(result.message).toContain('continue with the feature');
        expect(result.message).toContain('Recent context for reference');
        expect(result.message).toContain('Important implementation details');
      });

      it('should not inject context below relevance threshold', async () => {
        // Create turn with very low similarity (orthogonal vector)
        const turns = [
          createMockTurn({
            embedding: [1, 0, 0], // Orthogonal to query [0.5, 0.5, 0.5]
            importance_score: 1,
            overlay_scores: {
              O1_structural: 0,
              O2_security: 0,
              O3_lineage: 0,
              O4_mission: 0,
              O5_operational: 0,
              O6_mathematical: 0,
              O7_strategic: 0,
            },
          }),
        ];

        const result = await injectRelevantContext(
          'completely unrelated query',
          turns,
          mockEmbedder,
          { minRelevance: 0.9 } // Very high threshold
        );

        // Should not inject context
        expect(result.message).toBe('completely unrelated query');
      });

      it('should label user and assistant turns correctly', async () => {
        const turns = [
          createMockTurn({
            role: 'user',
            content: 'User question here',
            embedding: [0.5, 0.5, 0.5],
            importance_score: 9,
          }),
          createMockTurn({
            role: 'assistant',
            content: 'Assistant response here',
            embedding: [0.5, 0.5, 0.5],
            importance_score: 9,
          }),
        ];

        const result = await injectRelevantContext(
          'follow up',
          turns,
          mockEmbedder,
          { minRelevance: 0.1 }
        );

        // Check for correct labels
        if (result.message.includes('User question here')) {
          expect(result.message).toContain('You asked');
        }
        if (result.message.includes('Assistant response here')) {
          expect(result.message).toContain('I explained');
        }
      });

      it('should truncate long content snippets', async () => {
        const longContent = 'A'.repeat(1000);
        const turns = [
          createMockTurn({
            content: longContent,
            embedding: [0.5, 0.5, 0.5],
            importance_score: 9,
          }),
        ];

        const result = await injectRelevantContext(
          'test',
          turns,
          mockEmbedder,
          { maxSnippetLength: 100, minRelevance: 0.1 }
        );

        // Should truncate with ellipsis
        expect(result.message).toContain('...');
        expect(result.message.length).toBeLessThan(longContent.length + 200);
      });
    });

    describe('Paradigm Shifts', () => {
      it('should always consider paradigm shifts', async () => {
        // Create a paradigm shift turn outside the window
        const oldParadigmShift = createMockTurn({
          content: 'Critical paradigm shift information',
          embedding: [0.5, 0.5, 0.5],
          importance_score: 10,
          is_paradigm_shift: true,
        });

        // Create many recent turns to push paradigm shift out of window
        const recentTurns = Array.from({ length: 60 }, (_, i) =>
          createMockTurn({
            content: `Recent turn ${i}`,
            embedding: [0.1, 0.1, 0.1], // Low similarity
            importance_score: 3,
          })
        );

        const allTurns = [oldParadigmShift, ...recentTurns];

        const result = await injectRelevantContext(
          'What was the critical decision?',
          allTurns,
          mockEmbedder,
          { windowSize: 10, minRelevance: 0.1 }
        );

        // Paradigm shift should be included even outside window
        expect(result.message).toContain('paradigm shift');
      });
    });

    describe('Options', () => {
      it('should respect maxContextTurns option', async () => {
        const turns = Array.from({ length: 10 }, (_, i) =>
          createMockTurn({
            content: `Important turn ${i + 1}`,
            embedding: [0.5, 0.5, 0.5],
            importance_score: 9,
          })
        );

        const result = await injectRelevantContext(
          'test',
          turns,
          mockEmbedder,
          { maxContextTurns: 2, minRelevance: 0.1 }
        );

        // Should only include 2 context snippets
        const contextMatches = result.message.match(/\[Recent context \d+\]/g);
        expect(contextMatches?.length).toBe(2);
      });

      it('should enable debug logging when debug option is true', async () => {
        const consoleSpy = vi
          .spyOn(console, 'log')
          .mockImplementation(() => {});

        const turns = [createMockTurn({ embedding: [0.5, 0.5, 0.5] })];

        await injectRelevantContext('test', turns, mockEmbedder, {
          debug: true,
          minRelevance: 0.1,
        });

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Querying lattice for relevant context')
        );

        consoleSpy.mockRestore();
      });
    });

    describe('Relevance Calculation', () => {
      it('should rank higher importance turns higher', async () => {
        const lowImportance = createMockTurn({
          content: 'Low importance content',
          embedding: [0.5, 0.5, 0.5],
          importance_score: 2,
        });

        const highImportance = createMockTurn({
          content: 'High importance content',
          embedding: [0.5, 0.5, 0.5],
          importance_score: 9,
        });

        const turns = [lowImportance, highImportance];

        const result = await injectRelevantContext(
          'test',
          turns,
          mockEmbedder,
          { maxContextTurns: 1, minRelevance: 0.1 }
        );

        // High importance should be selected
        expect(result.message).toContain('High importance content');
        expect(result.message).not.toContain('Low importance content');
      });

      it('should boost turns with high overlay scores', async () => {
        const lowOverlay = createMockTurn({
          content: 'Low overlay content',
          embedding: [0.5, 0.5, 0.5],
          importance_score: 5,
          overlay_scores: {
            O1_structural: 1,
            O2_security: 1,
            O3_lineage: 1,
            O4_mission: 1,
            O5_operational: 1,
            O6_mathematical: 1,
            O7_strategic: 1,
          },
        });

        const highOverlay = createMockTurn({
          content: 'High overlay content',
          embedding: [0.5, 0.5, 0.5],
          importance_score: 5,
          overlay_scores: {
            O1_structural: 10,
            O2_security: 5,
            O3_lineage: 5,
            O4_mission: 10,
            O5_operational: 10,
            O6_mathematical: 5,
            O7_strategic: 5,
          },
        });

        const turns = [lowOverlay, highOverlay];

        const result = await injectRelevantContext(
          'test',
          turns,
          mockEmbedder,
          { maxContextTurns: 1, minRelevance: 0.1 }
        );

        // High overlay should be selected
        expect(result.message).toContain('High overlay content');
      });
    });
  });

  describe('Cosine Similarity (via relevance)', () => {
    it('should score identical vectors as maximum relevance', async () => {
      const turn = createMockTurn({
        embedding: [0.5, 0.5, 0.5],
        importance_score: 10,
        overlay_scores: {
          O1_structural: 10,
          O2_security: 10,
          O3_lineage: 10,
          O4_mission: 10,
          O5_operational: 10,
          O6_mathematical: 10,
          O7_strategic: 10,
        },
      });

      const result = await injectRelevantContext('test', [turn], mockEmbedder, {
        minRelevance: 0.1,
      });

      // With identical embeddings and max scores, should inject
      expect(result.message).toContain('Recent context');
    });

    it('should handle zero vectors gracefully', async () => {
      const turn = createMockTurn({
        embedding: [0, 0, 0], // Zero vector
        importance_score: 5,
      });

      // Should not crash with zero vector
      const result = await injectRelevantContext('test', [turn], mockEmbedder);

      expect(result.message).toBeDefined();
    });
  });
});
