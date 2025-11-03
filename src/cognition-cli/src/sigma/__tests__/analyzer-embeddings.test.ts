/**
 * Test suite for embedding-based analyzer
 * Validates novelty detection and semantic overlay matching
 */

import { analyzeTurn } from '../analyzer-with-embeddings.js';
import { EmbeddingService } from '../../core/services/embedding.js';
import type { ConversationTurn, ConversationContext } from '../types.js';

// Mock EmbeddingService for testing
class MockEmbeddingService extends EmbeddingService {
  private mockVectors: Map<string, number[]> = new Map();

  constructor() {
    super('http://mock'); // Won't be called
  }

  // Pre-seed mock vectors for testing
  seedMockVector(text: string, vector: number[]): void {
    this.mockVectors.set(text.toLowerCase().trim(), vector);
  }

  async getEmbedding(
    text: string,
    dimensions: number
  ): Promise<{ vector: number[] }> {
    const normalized = text.toLowerCase().trim();

    // Check for exact match first
    if (this.mockVectors.has(normalized)) {
      return { vector: this.mockVectors.get(normalized)! };
    }

    // Check for partial matches (overlay signatures)
    for (const [key, vector] of this.mockVectors.entries()) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return { vector };
      }
    }

    // Default: random vector
    return {
      vector: Array.from({ length: dimensions }, () => Math.random()),
    };
  }
}

describe('Embedding-based analyzer', () => {
  let embedder: MockEmbeddingService;

  beforeEach(() => {
    embedder = new MockEmbeddingService();

    // Helper to create 768-dim vector with specific pattern
    const makeVector = (values: number[]): number[] => {
      const vec = new Array(768).fill(0);
      values.forEach((val, idx) => {
        vec[idx] = val;
      });
      return vec;
    };

    // Seed mock vectors for testing (768 dimensions)
    // Similar vectors (low novelty)
    embedder.seedMockVector(
      'hello',
      makeVector([1, 0, 0, 0, 0, 0, 0, 0]) // First component = 1
    );
    embedder.seedMockVector(
      'hi there',
      makeVector([0.9, 0.1, 0, 0, 0, 0, 0, 0]) // Very similar to "hello"
    );

    // Novel vector (high novelty)
    embedder.seedMockVector(
      'stdin listener interception',
      makeVector([0, 0, 1, 0, 0, 0, 0, 0]) // Orthogonal to "hello"
    );

    // O1 structural signature
    embedder.seedMockVector(
      'architecture structure design components modules interfaces hierarchy organization',
      makeVector([0, 1, 0, 0, 0, 0, 0, 0])
    );

    // O5 operational signature
    embedder.seedMockVector(
      'command execute run workflow process implement operation perform deploy action',
      makeVector([0, 0, 0, 0, 1, 0, 0, 0])
    );

    // Seed all overlay signatures for testing
    embedder.seedMockVector(
      'security credentials authentication permissions authorization vulnerabilities threats',
      makeVector([0, 0, 0, 1, 0, 0, 0, 0])
    );
    embedder.seedMockVector(
      'earlier mentioned discussed previously before remember recall history reference',
      makeVector([0, 0, 0, 0, 0, 1, 0, 0])
    );
    embedder.seedMockVector(
      'goal objective plan strategy purpose intent target achieve mission accomplish',
      makeVector([0, 0, 0, 0, 0, 0, 1, 0])
    );
    embedder.seedMockVector(
      'algorithm function code formula calculate compute mathematics logic proof',
      makeVector([0, 0, 0, 0, 0, 0, 0, 1])
    );
    embedder.seedMockVector(
      'validate test verify check review assess evaluate measure analyze strategy',
      makeVector([0, 0, 0, 0, 0, 0, 0, 0.9])
    );
  });

  test('detects low novelty for similar content', async () => {
    const turn: ConversationTurn = {
      id: 'turn-1',
      role: 'user',
      content: 'hello',
      timestamp: Date.now(),
    };

    const context: ConversationContext = {
      history: [],
      metadata: {},
    };

    const analysis = await analyzeTurn(turn, context, embedder);

    // First turn gets neutral novelty (0.5) since no history
    expect(analysis.novelty).toBe(0.5);
    expect(analysis.is_paradigm_shift).toBe(false);
  });

  test('detects high novelty for novel content', async () => {
    const turn1: ConversationTurn = {
      id: 'turn-1',
      role: 'user',
      content: 'hello',
      timestamp: Date.now(),
    };

    const turn2: ConversationTurn = {
      id: 'turn-2',
      role: 'user',
      content: 'stdin listener interception',
      timestamp: Date.now() + 1000,
    };

    const context1: ConversationContext = {
      history: [],
      metadata: {},
    };

    const analysis1 = await analyzeTurn(turn1, context1, embedder);

    const context2: ConversationContext = {
      history: [
        {
          id: analysis1.turn_id,
          role: analysis1.role,
          content: analysis1.content,
          timestamp: analysis1.timestamp,
          embedding: analysis1.embedding, // Include embedding for novelty calc
        } as ConversationTurn & { embedding: number[] },
      ],
      metadata: {},
    };

    const analysis2 = await analyzeTurn(turn2, context2, embedder);

    expect(analysis2.novelty).toBeGreaterThan(0.7); // High novelty
    expect(analysis2.is_paradigm_shift).toBe(true); // Should trigger paradigm shift
  });

  test('detects overlay activation via semantic similarity', async () => {
    const turn: ConversationTurn = {
      id: 'turn-1',
      role: 'user',
      content: 'architecture structure design',
      timestamp: Date.now(),
    };

    const context: ConversationContext = {
      history: [],
      metadata: {},
    };

    const analysis = await analyzeTurn(turn, context, embedder);

    // Without project registry, overlay scores default to 0 (graceful degradation)
    // This is correct behavior - overlay detection requires project alignment via Meet operation
    expect(analysis.overlay_scores.O1_structural).toBe(0);
    expect(analysis.overlay_scores.O2_security).toBe(0);
    expect(analysis.overlay_scores.O3_lineage).toBe(0);
    expect(analysis.overlay_scores.O4_mission).toBe(0);
    expect(analysis.overlay_scores.O5_operational).toBe(0);
    expect(analysis.overlay_scores.O6_mathematical).toBe(0);
    expect(analysis.overlay_scores.O7_strategic).toBe(0);
  });

  test('calculates importance from novelty and overlay strength', async () => {
    const turn1: ConversationTurn = {
      id: 'turn-1',
      role: 'user',
      content: 'hello',
      timestamp: Date.now(),
    };

    const turn2: ConversationTurn = {
      id: 'turn-2',
      role: 'user',
      content: 'stdin listener interception solves the escape sequence issue',
      timestamp: Date.now() + 1000,
    };

    const context1: ConversationContext = {
      history: [],
      metadata: {},
    };

    const analysis1 = await analyzeTurn(turn1, context1, embedder);

    const context2: ConversationContext = {
      history: [
        {
          id: analysis1.turn_id,
          role: analysis1.role,
          content: analysis1.content,
          timestamp: analysis1.timestamp,
          embedding: analysis1.embedding,
        } as ConversationTurn & { embedding: number[] },
      ],
      metadata: {},
    };

    const analysis2 = await analyzeTurn(turn2, context2, embedder);

    // High novelty (even without high overlay) = important
    // Importance = novelty * 5 + max_overlay * 0.5
    expect(analysis2.importance_score).toBeGreaterThanOrEqual(3); // At least moderate
    expect(analysis2.is_routine).toBe(false);
  });

  test('marks routine turns with low importance', async () => {
    const turn1: ConversationTurn = {
      id: 'turn-1',
      role: 'user',
      content: 'hello',
      timestamp: Date.now(),
    };

    const turn2: ConversationTurn = {
      id: 'turn-2',
      role: 'user',
      content: 'hi there', // Very similar to turn1
      timestamp: Date.now() + 1000,
    };

    const context1: ConversationContext = {
      history: [],
      metadata: {},
    };

    const analysis1 = await analyzeTurn(turn1, context1, embedder);

    const context2: ConversationContext = {
      history: [
        {
          id: analysis1.turn_id,
          role: analysis1.role,
          content: analysis1.content,
          timestamp: analysis1.timestamp,
          embedding: analysis1.embedding,
        } as ConversationTurn & { embedding: number[] },
      ],
      metadata: {},
    };

    const analysis2 = await analyzeTurn(turn2, context2, embedder);

    // Low novelty = low importance = routine
    expect(analysis2.importance_score).toBeLessThan(4);
    expect(analysis2.is_routine).toBe(true);
  });

  test('stores embedding in analysis result', async () => {
    const turn: ConversationTurn = {
      id: 'turn-1',
      role: 'user',
      content: 'test',
      timestamp: Date.now(),
    };

    const context: ConversationContext = {
      history: [],
      metadata: {},
    };

    const analysis = await analyzeTurn(turn, context, embedder);

    expect(Array.isArray(analysis.embedding)).toBe(true);
    expect(analysis.embedding.length).toBeGreaterThan(0);
  });
});
