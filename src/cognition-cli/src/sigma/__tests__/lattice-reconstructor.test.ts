import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  rebuildTurnAnalysesFromLanceDB,
  rebuildLatticeFromLanceDB,
} from '../lattice-reconstructor.js';

const { mockLanceStore } = vi.hoisted(() => ({
  mockLanceStore: {
    initialize: vi.fn(),
    getSessionTurns: vi.fn(),
  },
}));

vi.mock('../conversation-lance-store.js', () => ({
  ConversationLanceStore: vi.fn().mockImplementation(() => mockLanceStore),
}));

describe('LatticeReconstructor', () => {
  const sessionId = 'test-session';
  const projectRoot = '/tmp/project';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTurns = [
    {
      id: 'turn-1',
      role: 'user',
      content: 'Hello',
      timestamp: 1000,
      embedding: [0.1],
      novelty: 0.5,
      importance: 5,
      is_paradigm_shift: false,
      alignment_O1: 1,
      alignment_O2: 2,
      alignment_O3: 3,
      alignment_O4: 4,
      alignment_O5: 5,
      alignment_O6: 6,
      alignment_O7: 7,
      references: [],
      semantic_tags: ['greeting'],
    },
    {
      id: 'turn-2',
      role: 'assistant',
      content: 'Hi there',
      timestamp: 1001,
      embedding: [0.2],
      novelty: 0.6,
      importance: 6,
      is_paradigm_shift: true,
      alignment_O1: 2,
      alignment_O2: 3,
      alignment_O3: 4,
      alignment_O4: 5,
      alignment_O5: 6,
      alignment_O6: 7,
      alignment_O7: 8,
      references: [],
      semantic_tags: ['response'],
    },
  ];

  it('should rebuild turn analyses from LanceDB', async () => {
    mockLanceStore.getSessionTurns.mockResolvedValue(mockTurns);

    const result = await rebuildTurnAnalysesFromLanceDB(sessionId, projectRoot);

    expect(result).toHaveLength(2);
    expect(result[0].turn_id).toBe('turn-1');
    expect(result[0].overlay_scores.O1_structural).toBe(1);
    expect(result[1].is_paradigm_shift).toBe(true);
    expect(result[1].semantic_tags).toEqual(['response']);
  });

  it('should return empty array if no turns found', async () => {
    mockLanceStore.getSessionTurns.mockResolvedValue([]);
    const result = await rebuildTurnAnalysesFromLanceDB(sessionId, projectRoot);
    expect(result).toEqual([]);
  });

  it('should rebuild full lattice with temporal edges', async () => {
    mockLanceStore.getSessionTurns.mockResolvedValue(mockTurns);

    const lattice = await rebuildLatticeFromLanceDB(sessionId, projectRoot);

    expect(lattice.nodes).toHaveLength(2);
    expect(lattice.edges).toHaveLength(1);
    expect(lattice.edges[0]).toEqual({
      from: 'turn-1',
      to: 'turn-2',
      type: 'temporal',
      weight: 1.0,
    });
    expect(lattice.metadata.session_id).toBe(sessionId);
    expect(lattice.metadata.original_turn_count).toBe(2);
  });
});
