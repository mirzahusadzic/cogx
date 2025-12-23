import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  populateConversationOverlays,
  getConversationStats,
} from '../conversation-populator.js';
import type { TurnAnalysis } from '../types.js';

describe('ConversationPopulator', () => {
  const mockOverlay = () => ({
    addTurn: vi.fn(),
    getInMemoryCount: vi.fn().mockReturnValue(0),
    query: vi.fn(),
  });

  const mockRegistry = {
    get: vi.fn(),
  };

  const turnAnalysis: TurnAnalysis = {
    turn_id: 'turn-1',
    role: 'user',
    content: 'test content',
    timestamp: Date.now(),
    embedding: [0.1, 0.2],
    novelty: 0.5,
    importance_score: 8,
    overlay_scores: {
      'O1: Structural': 9,
      'O2: Security': 2,
    },
    temporal_context: {
      earlier_mentions: [],
      time_since_last_ms: 0,
    },
    reference_context: {
      file_references: [],
      tool_references: [],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should populate all overlays with correct scores', async () => {
    const overlays = {
      O1: mockOverlay(),
      O2: mockOverlay(),
      O3: mockOverlay(),
      O4: mockOverlay(),
      O5: mockOverlay(),
      O6: mockOverlay(),
      O7: mockOverlay(),
    };

    mockRegistry.get.mockImplementation(
      async (id) => overlays[id as keyof typeof overlays]
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await populateConversationOverlays(turnAnalysis, mockRegistry as any);

    expect(overlays.O1.addTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        turn_id: 'turn-1',
        project_alignment_score: 9,
      })
    );

    expect(overlays.O2.addTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        turn_id: 'turn-1',
        project_alignment_score: 2,
      })
    );

    expect(overlays.O3.addTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        turn_id: 'turn-1',
        project_alignment_score: 0, // Default for missing score
      })
    );
  });

  it('should get conversation stats from all overlays', async () => {
    const overlays = {
      O1: mockOverlay(),
      O2: mockOverlay(),
      O3: mockOverlay(),
      O4: mockOverlay(),
      O5: mockOverlay(),
      O6: mockOverlay(),
      O7: mockOverlay(),
    };

    overlays.O1.getInMemoryCount.mockReturnValue(5);
    overlays.O2.getInMemoryCount.mockReturnValue(5);

    mockRegistry.get.mockImplementation(
      async (id) => overlays[id as keyof typeof overlays]
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stats = await getConversationStats(mockRegistry as any);

    expect(stats.total_turns).toBe(5);
    expect(stats.overlay_counts['O1']).toBe(5);
    expect(stats.overlay_counts['O2']).toBe(5);
  });
});
