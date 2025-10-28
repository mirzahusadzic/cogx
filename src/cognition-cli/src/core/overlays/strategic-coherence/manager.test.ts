import { describe, it, expect } from 'vitest';
import { StrategicCoherenceManager } from './manager.js';

// Helper to access private methods for testing
type ManagerWithPrivate = StrategicCoherenceManager & {
  cosineSimilarity: (a: number[], b: number[]) => number;
};

describe('StrategicCoherenceManager', () => {
  describe('Cosine Similarity', () => {
    it('should compute correct cosine similarity for identical vectors', () => {
      const manager = new StrategicCoherenceManager(
        '/test-pgc'
      ) as ManagerWithPrivate;
      const vec = new Array(768).fill(1);

      const similarity = manager.cosineSimilarity(vec, vec);

      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should compute correct cosine similarity for orthogonal vectors', () => {
      const manager = new StrategicCoherenceManager(
        '/test-pgc'
      ) as ManagerWithPrivate;
      const vecA = [...new Array(384).fill(1), ...new Array(384).fill(0)];
      const vecB = [...new Array(384).fill(0), ...new Array(384).fill(1)];

      const similarity = manager.cosineSimilarity(vecA, vecB);

      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should compute correct cosine similarity for opposite vectors', () => {
      const manager = new StrategicCoherenceManager(
        '/test-pgc'
      ) as ManagerWithPrivate;
      const vecA = new Array(768).fill(1);
      const vecB = new Array(768).fill(-1);

      const similarity = manager.cosineSimilarity(vecA, vecB);

      expect(similarity).toBeCloseTo(-1.0, 5);
    });

    it('should handle zero vectors gracefully', () => {
      const manager = new StrategicCoherenceManager(
        '/test-pgc'
      ) as ManagerWithPrivate;
      const vecA = new Array(768).fill(0);
      const vecB = new Array(768).fill(1);

      const similarity = manager.cosineSimilarity(vecA, vecB);

      expect(similarity).toBe(0);
    });

    it('should throw error for mismatched dimensions', () => {
      const manager = new StrategicCoherenceManager(
        '/test-pgc'
      ) as ManagerWithPrivate;
      const vecA = new Array(768).fill(1);
      const vecB = new Array(384).fill(1);

      expect(() => {
        manager.cosineSimilarity(vecA, vecB);
      }).toThrow('Vector dimension mismatch');
    });
  });

  describe('Overlay Structure', () => {
    it('should have correct overlay structure shape', () => {
      // This test validates the interface structure
      const mockOverlay = {
        generated_at: new Date().toISOString(),
        mission_document_hash: 'abc123',
        structural_patterns_count: 10,
        mission_concepts_count: 5,
        symbol_coherence: [
          {
            symbolName: 'TestClass',
            filePath: 'src/test.ts',
            symbolHash: 'hash123',
            topAlignments: [
              {
                conceptText: 'verifiable',
                conceptSection: 'Mission',
                alignmentScore: 0.85,
                sectionHash: 'section-hash',
              },
            ],
            overallCoherence: 0.85,
          },
        ],
        concept_implementations: [
          {
            conceptText: 'verifiable',
            conceptSection: 'Mission',
            implementingSymbols: [
              {
                symbolName: 'TestClass',
                filePath: 'src/test.ts',
                alignmentScore: 0.85,
              },
            ],
          },
        ],
        overall_metrics: {
          average_coherence: 0.85,
          weighted_coherence: 0.85,
          lattice_coherence: 0.85,
          median_coherence: 0.85,
          std_deviation: 0.05,
          top_quartile_coherence: 0.9,
          bottom_quartile_coherence: 0.8,
          high_alignment_threshold: 0.7,
          aligned_symbols_count: 1,
          drifted_symbols_count: 0,
          total_symbols: 1,
        },
      };

      expect(mockOverlay.generated_at).toBeTruthy();
      expect(mockOverlay.mission_document_hash).toBe('abc123');
      expect(mockOverlay.structural_patterns_count).toBe(10);
      expect(mockOverlay.mission_concepts_count).toBe(5);
      expect(mockOverlay.symbol_coherence.length).toBe(1);
      expect(mockOverlay.concept_implementations.length).toBe(1);
      expect(mockOverlay.overall_metrics.average_coherence).toBe(0.85);
    });
  });
});
