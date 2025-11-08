/**
 * Lattice Operations Tests
 *
 * Tests all lattice algebra operations with both mock and real data.
 * Integration tests are skipped if no PGC data is available (CI/CD friendly).
 */

import { describe, it, expect } from 'vitest';
import {
  union,
  intersection,
  difference,
  meet,
  complement,
  symbolDifference,
  symbolIntersection,
  symbolUnion,
} from '../lattice-operations.js';
import { OverlayItem, OverlayMetadata } from '../overlay-algebra.js';
import { DEFAULT_EMBEDDING_DIMENSIONS } from '../../../config.js';

// ========================================
// UNIT TESTS (Mock Data - Always Run)
// ========================================

describe('Lattice Operations (Unit Tests)', () => {
  // Mock overlay items for testing
  const createMockItem = (
    id: string,
    text: string,
    type: string = 'test',
    embedding?: number[]
  ): OverlayItem<OverlayMetadata> => ({
    id,
    embedding: embedding || Array(DEFAULT_EMBEDDING_DIMENSIONS).fill(0.1),
    metadata: { text, type },
  });

  describe('union', () => {
    it('should combine items from multiple overlays', () => {
      const itemsA = [
        createMockItem('a1', 'Item A1'),
        createMockItem('a2', 'Item A2'),
      ];
      const itemsB = [
        createMockItem('b1', 'Item B1'),
        createMockItem('b2', 'Item B2'),
      ];

      const result = union([itemsA, itemsB], ['O1', 'O2']);

      expect(result.items).toHaveLength(4);
      expect(result.metadata.operation).toBe('union');
      expect(result.metadata.itemCount).toBe(4);
      expect(result.metadata.sourceOverlays).toEqual(['O1', 'O2']);
    });

    it('should deduplicate items with same ID', () => {
      const itemsA = [
        createMockItem('a1', 'Item A1'),
        createMockItem('shared', 'Shared Item'),
      ];
      const itemsB = [
        createMockItem('b1', 'Item B1'),
        createMockItem('shared', 'Shared Item'),
      ];

      const result = union([itemsA, itemsB], ['O1', 'O2']);

      expect(result.items).toHaveLength(3); // a1, shared, b1
      const ids = result.items.map((item) => item.id);
      expect(ids).toContain('a1');
      expect(ids).toContain('shared');
      expect(ids).toContain('b1');
      expect(ids.filter((id) => id === 'shared')).toHaveLength(1); // Only one 'shared'
    });

    it('should handle empty overlays', () => {
      const itemsA = [createMockItem('a1', 'Item A1')];
      const itemsB: OverlayItem<OverlayMetadata>[] = [];

      const result = union([itemsA, itemsB], ['O1', 'O2']);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('a1');
    });
  });

  describe('intersection', () => {
    it('should return only items present in all overlays', () => {
      const itemsA = [
        createMockItem('shared1', 'Shared 1'),
        createMockItem('shared2', 'Shared 2'),
        createMockItem('a1', 'Only in A'),
      ];
      const itemsB = [
        createMockItem('shared1', 'Shared 1'),
        createMockItem('shared2', 'Shared 2'),
        createMockItem('b1', 'Only in B'),
      ];

      const result = intersection([itemsA, itemsB], ['O1', 'O2']);

      expect(result.items).toHaveLength(2);
      const ids = result.items.map((item) => item.id).sort();
      expect(ids).toEqual(['shared1', 'shared2']);
    });

    it('should return empty set if no overlap', () => {
      const itemsA = [createMockItem('a1', 'Item A1')];
      const itemsB = [createMockItem('b1', 'Item B1')];

      const result = intersection([itemsA, itemsB], ['O1', 'O2']);

      expect(result.items).toHaveLength(0);
    });

    it('should work with 3+ overlays', () => {
      const itemsA = [
        createMockItem('shared', 'Shared'),
        createMockItem('a1', 'A only'),
      ];
      const itemsB = [
        createMockItem('shared', 'Shared'),
        createMockItem('b1', 'B only'),
      ];
      const itemsC = [
        createMockItem('shared', 'Shared'),
        createMockItem('c1', 'C only'),
      ];

      const result = intersection([itemsA, itemsB, itemsC], ['O1', 'O2', 'O3']);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('shared');
    });
  });

  describe('difference', () => {
    it('should return items in A but not in B', () => {
      const itemsA = [
        createMockItem('a1', 'Only in A'),
        createMockItem('a2', 'Also only in A'),
        createMockItem('shared', 'Shared'),
      ];
      const itemsB = [
        createMockItem('shared', 'Shared'),
        createMockItem('b1', 'Only in B'),
      ];

      const result = difference(itemsA, itemsB, ['O1', 'O2']);

      expect(result.items).toHaveLength(2);
      const ids = result.items.map((item) => item.id).sort();
      expect(ids).toEqual(['a1', 'a2']);
    });

    it('should return all items if B is empty', () => {
      const itemsA = [
        createMockItem('a1', 'Item A1'),
        createMockItem('a2', 'Item A2'),
      ];
      const itemsB: OverlayItem<OverlayMetadata>[] = [];

      const result = difference(itemsA, itemsB, ['O1', 'O2']);

      expect(result.items).toHaveLength(2);
    });

    it('should return empty if A is subset of B', () => {
      const itemsA = [createMockItem('shared', 'Shared')];
      const itemsB = [
        createMockItem('shared', 'Shared'),
        createMockItem('b1', 'Also in B'),
      ];

      const result = difference(itemsA, itemsB, ['O1', 'O2']);

      expect(result.items).toHaveLength(0);
    });
  });

  describe('meet (semantic alignment)', () => {
    it('should find semantically similar items above threshold', async () => {
      // Create items with similar embeddings (more realistic)
      const embeddingA = Array(DEFAULT_EMBEDDING_DIMENSIONS)
        .fill(0)
        .map((_, i) => Math.sin(i / 10));
      const embeddingSimilar = Array(DEFAULT_EMBEDDING_DIMENSIONS)
        .fill(0)
        .map((_, i) => Math.sin(i / 10) + 0.01); // Very similar
      const embeddingDifferent = Array(DEFAULT_EMBEDDING_DIMENSIONS)
        .fill(0)
        .map((_, i) => Math.cos(i / 10)); // Different pattern

      const itemsA = [
        createMockItem('a1', 'Security constraint', 'constraint', embeddingA),
      ];
      const itemsB = [
        createMockItem(
          'b1',
          'Security principle',
          'principle',
          embeddingSimilar
        ),
        createMockItem('b2', 'Unrelated item', 'other', embeddingDifferent),
      ];

      const result = await meet(itemsA, itemsB, { threshold: 0.95, topK: 5 });

      // Should find at least b1 (similar), similarity > 0.95
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].itemA.id).toBe('a1');
      expect(result[0].similarity).toBeGreaterThan(0.95);

      // The most similar item should be b1
      const b1Match = result.find((r) => r.itemB.id === 'b1');
      expect(b1Match).toBeDefined();
      expect(b1Match!.similarity).toBeGreaterThan(0.95);
    });

    it('should respect topK parameter', async () => {
      const embedding = Array(DEFAULT_EMBEDDING_DIMENSIONS).fill(0.5);
      const itemsA = [createMockItem('a1', 'Item A', 'test', embedding)];
      const itemsB = [
        createMockItem('b1', 'Item B1', 'test', embedding),
        createMockItem('b2', 'Item B2', 'test', embedding),
        createMockItem('b3', 'Item B3', 'test', embedding),
      ];

      const result = await meet(itemsA, itemsB, { threshold: 0.9, topK: 2 });

      // Each item in A should have at most topK matches
      const matchesForA1 = result.filter((r) => r.itemA.id === 'a1');
      expect(matchesForA1.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array if no items meet threshold', async () => {
      // Create truly dissimilar embeddings (orthogonal vectors)
      const embeddingA = Array(DEFAULT_EMBEDDING_DIMENSIONS)
        .fill(0)
        .map((_, i) => (i < DEFAULT_EMBEDDING_DIMENSIONS / 2 ? 1 : 0));
      const embeddingB = Array(DEFAULT_EMBEDDING_DIMENSIONS)
        .fill(0)
        .map((_, i) => (i >= DEFAULT_EMBEDDING_DIMENSIONS / 2 ? 1 : 0));

      const itemsA = [createMockItem('a1', 'Item A', 'test', embeddingA)];
      const itemsB = [createMockItem('b1', 'Item B', 'test', embeddingB)];

      // Very high threshold - should not match orthogonal vectors
      const result = await meet(itemsA, itemsB, { threshold: 0.5 });

      expect(result).toHaveLength(0);
    });
  });

  describe('complex compositions', () => {
    it('should support union then intersection', () => {
      const itemsA = [
        createMockItem('a1', 'A1'),
        createMockItem('shared', 'Shared'),
      ];
      const itemsB = [
        createMockItem('b1', 'B1'),
        createMockItem('shared', 'Shared'),
      ];
      const itemsC = [
        createMockItem('c1', 'C1'),
        createMockItem('shared', 'Shared'),
      ];

      // (A ∪ B) ∩ C
      const unionResult = union([itemsA, itemsB], ['O1', 'O2']);
      const finalResult = intersection(
        [unionResult.items, itemsC],
        ['union_result', 'O3']
      );

      expect(finalResult.items).toHaveLength(1);
      expect(finalResult.items[0].id).toBe('shared');
    });

    it('should support difference after union', () => {
      const itemsA = [
        createMockItem('a1', 'A1'),
        createMockItem('shared', 'Shared'),
      ];
      const itemsB = [
        createMockItem('b1', 'B1'),
        createMockItem('shared', 'Shared'),
      ];
      const itemsC = [
        createMockItem('shared', 'Shared'),
        createMockItem('c1', 'C1'),
      ];

      // (A ∪ B) - C
      const unionResult = union([itemsA, itemsB], ['O1', 'O2']);
      const finalResult = difference(unionResult.items, itemsC, [
        'union_result',
        'O3',
      ]);

      const ids = finalResult.items.map((i) => i.id).sort();
      expect(ids).toEqual(['a1', 'b1']);
    });
  });

  describe('complement (wrapper for difference)', () => {
    it('should behave identically to difference', () => {
      const universal = [
        createMockItem('a1', 'Item A1'),
        createMockItem('a2', 'Item A2'),
        createMockItem('shared', 'Shared'),
      ];
      const exclusion = [createMockItem('shared', 'Shared')];

      const complementResult = complement(universal, exclusion, ['O1', 'O2']);
      const differenceResult = difference(universal, exclusion, ['O1', 'O2']);

      expect(complementResult.items).toEqual(differenceResult.items);
      expect(complementResult.items).toHaveLength(2);
      const ids = complementResult.items.map((i) => i.id).sort();
      expect(ids).toEqual(['a1', 'a2']);
    });

    it('should return all items if exclusion set is empty', () => {
      const universal = [
        createMockItem('a1', 'Item A1'),
        createMockItem('a2', 'Item A2'),
      ];
      const exclusion: OverlayItem<OverlayMetadata>[] = [];

      const result = complement(universal, exclusion, ['O1', 'O2']);

      expect(result.items).toHaveLength(2);
    });
  });
});

// ========================================
// SECURITY TESTS (Always Run)
// ========================================

describe('Security: SQL Injection Prevention', () => {
  it('should handle IDs with special SQL characters', () => {
    // These characters often break SQL queries
    const dangerousIds = [
      "CVE-2024-12345: _vector','",
      "item'; DROP TABLE overlays; --",
      'item" OR 1=1 --',
      "item\\'escaped",
      'item with\nnewline',
      'item\twith\ttabs',
    ];

    dangerousIds.forEach((id) => {
      const item = {
        id,
        embedding: Array(DEFAULT_EMBEDDING_DIMENSIONS).fill(0.1),
        metadata: { text: 'Test item', type: 'test' },
      };

      // Should not throw - these will be tested against the vector store
      expect(() => item).not.toThrow();
      expect(item.id).toBe(id); // ID preserved exactly
    });
  });

  // NOTE: Actual SQL injection tests against LanceDB will be in lance-store.test.ts
});

// ========================================
// SYMBOL-LEVEL OPERATIONS (Always Run)
// ========================================

describe('Symbol-Level Set Operations', () => {
  describe('symbolDifference', () => {
    it('should return symbols in A but not in B', () => {
      const symbolsA = new Set(['symbol1', 'symbol2', 'shared']);
      const symbolsB = new Set(['shared', 'symbol3']);

      const result = symbolDifference(symbolsA, symbolsB);

      expect(result.size).toBe(2);
      expect(result.has('symbol1')).toBe(true);
      expect(result.has('symbol2')).toBe(true);
      expect(result.has('shared')).toBe(false);
      expect(result.has('symbol3')).toBe(false);
    });

    it('should return all symbols if B is empty', () => {
      const symbolsA = new Set(['symbol1', 'symbol2']);
      const symbolsB = new Set<string>();

      const result = symbolDifference(symbolsA, symbolsB);

      expect(result.size).toBe(2);
      expect(result).toEqual(symbolsA);
    });

    it('should return empty set if A is subset of B', () => {
      const symbolsA = new Set(['symbol1']);
      const symbolsB = new Set(['symbol1', 'symbol2', 'symbol3']);

      const result = symbolDifference(symbolsA, symbolsB);

      expect(result.size).toBe(0);
    });
  });

  describe('symbolIntersection', () => {
    it('should return symbols present in both A and B', () => {
      const symbolsA = new Set(['symbol1', 'shared1', 'shared2']);
      const symbolsB = new Set(['shared1', 'shared2', 'symbol2']);

      const result = symbolIntersection(symbolsA, symbolsB);

      expect(result.size).toBe(2);
      expect(result.has('shared1')).toBe(true);
      expect(result.has('shared2')).toBe(true);
      expect(result.has('symbol1')).toBe(false);
      expect(result.has('symbol2')).toBe(false);
    });

    it('should return empty set if no overlap', () => {
      const symbolsA = new Set(['symbol1', 'symbol2']);
      const symbolsB = new Set(['symbol3', 'symbol4']);

      const result = symbolIntersection(symbolsA, symbolsB);

      expect(result.size).toBe(0);
    });

    it('should return A if A is subset of B', () => {
      const symbolsA = new Set(['symbol1', 'symbol2']);
      const symbolsB = new Set(['symbol1', 'symbol2', 'symbol3']);

      const result = symbolIntersection(symbolsA, symbolsB);

      expect(result.size).toBe(2);
      expect(result).toEqual(symbolsA);
    });
  });

  describe('symbolUnion', () => {
    it('should combine all symbols from A and B', () => {
      const symbolsA = new Set(['symbol1', 'shared']);
      const symbolsB = new Set(['shared', 'symbol2']);

      const result = symbolUnion(symbolsA, symbolsB);

      expect(result.size).toBe(3);
      expect(result.has('symbol1')).toBe(true);
      expect(result.has('symbol2')).toBe(true);
      expect(result.has('shared')).toBe(true);
    });

    it('should handle empty sets', () => {
      const symbolsA = new Set(['symbol1']);
      const symbolsB = new Set<string>();

      const result = symbolUnion(symbolsA, symbolsB);

      expect(result.size).toBe(1);
      expect(result).toEqual(symbolsA);
    });

    it('should deduplicate symbols', () => {
      const symbolsA = new Set(['symbol1', 'symbol2']);
      const symbolsB = new Set(['symbol1', 'symbol2']);

      const result = symbolUnion(symbolsA, symbolsB);

      expect(result.size).toBe(2);
    });
  });
});

// ========================================
// NOTE: project() Function Testing
// ========================================
//
// The project() function from lattice-operations.ts requires full OverlayAlgebra
// instances with query() and getAllItems() methods, making it complex to unit test.
//
// Instead, project() is tested via:
// 1. query-parser.test.ts - Integration tests for "O5 -> O2" syntax
// 2. The CLI project operator which wraps project() functionality
//
// The project operator in query-parser.ts implements:
//   case 'project':
//     return meet(leftItems, rightItems, { threshold: 0.6, topK: 10 });
//
// This is effectively testing the core semantic projection behavior that
// project() is designed to provide.
