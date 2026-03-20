import { describe, it, expect } from 'vitest';
import { cosineSimilarity, normalizedCosineSimilarity } from '../math.js';

describe('math utilities', () => {
  describe('cosineSimilarity', () => {
    it('should compute correct cosine similarity for identical vectors', () => {
      const vec = [1, 0, 1, 0];
      expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0, 5);
    });

    it('should compute correct cosine similarity for orthogonal vectors', () => {
      const vecA = [1, 0];
      const vecB = [0, 1];
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(0.0, 5);
    });

    it('should compute correct cosine similarity for opposite vectors', () => {
      const vecA = [1, 1];
      const vecB = [-1, -1];
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(-1.0, 5);
    });

    it('should handle zero vectors gracefully', () => {
      const vecA = [0, 0];
      const vecB = [1, 1];
      expect(cosineSimilarity(vecA, vecB)).toBe(0);
    });

    it('should throw error for mismatched dimensions', () => {
      const vecA = [1, 2];
      const vecB = [1, 2, 3];
      expect(() => cosineSimilarity(vecA, vecB)).toThrow(
        'Vector dimension mismatch'
      );
    });
  });

  describe('normalizedCosineSimilarity', () => {
    it('should map -1 to 0', () => {
      const vecA = [1, 1];
      const vecB = [-1, -1];
      expect(normalizedCosineSimilarity(vecA, vecB)).toBeCloseTo(0.0, 5);
    });

    it('should map 0 to 0.5', () => {
      const vecA = [1, 0];
      const vecB = [0, 1];
      expect(normalizedCosineSimilarity(vecA, vecB)).toBeCloseTo(0.5, 5);
    });

    it('should map 1 to 1', () => {
      const vecA = [1, 1];
      const vecB = [1, 1];
      expect(normalizedCosineSimilarity(vecA, vecB)).toBeCloseTo(1.0, 5);
    });
  });
});
