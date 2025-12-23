import { describe, it, expect, vi, beforeEach } from 'vitest';
import { meet } from '../../core/algebra/lattice-operations.js';
import type {
  OverlayItem,
  OverlayMetadata,
} from '../../core/algebra/overlay-algebra.js';

const { mockLanceVectorStore } = vi.hoisted(() => ({
  mockLanceVectorStore: {
    initialize: vi.fn(),
    storeVector: vi.fn(),
    similaritySearch: vi.fn(),
    close: vi.fn(),
  },
}));

vi.mock('../../core/overlays/vector-db/lance-store.js', () => ({
  LanceVectorStore: vi.fn().mockImplementation(() => mockLanceVectorStore),
}));

describe('LatticeOperations (Meet)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should find semantic alignment between two sets of items', async () => {
    const itemsA: OverlayItem<OverlayMetadata>[] = [
      { id: 'a1', embedding: [0.1, 0.2], metadata: { text: 'Turn A1' } },
    ];
    const itemsB: OverlayItem<OverlayMetadata>[] = [
      { id: 'b1', embedding: [0.1, 0.2], metadata: { text: 'Turn B1' } },
    ];

    mockLanceVectorStore.similaritySearch.mockResolvedValue([
      { id: 'b1', similarity: 0.95 },
    ]);

    const results = await meet(itemsA, itemsB, {
      threshold: 0.9,
    });

    expect(results).toHaveLength(1);
    expect(results[0].itemA.id).toBe('a1');
    expect(results[0].itemB.id).toBe('b1');
    expect(results[0].similarity).toBe(0.95);

    expect(mockLanceVectorStore.storeVector).toHaveBeenCalled();
    expect(mockLanceVectorStore.similaritySearch).toHaveBeenCalled();
  });

  it('should filter items below threshold', async () => {
    const itemsA: OverlayItem<OverlayMetadata>[] = [
      { id: 'a1', embedding: [0.1], metadata: { text: '' } },
    ];
    const itemsB: OverlayItem<OverlayMetadata>[] = [
      { id: 'b1', embedding: [0.5], metadata: { text: '' } },
    ];

    mockLanceVectorStore.similaritySearch.mockResolvedValue([
      { id: 'b1', similarity: 0.4 },
    ]);

    const results = await meet(itemsA, itemsB, {
      threshold: 0.8,
    });

    expect(results).toHaveLength(0);
  });
});
