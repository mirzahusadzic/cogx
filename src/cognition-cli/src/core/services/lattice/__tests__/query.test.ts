import { describe, it, expect, beforeEach } from 'vitest';
import { LatticeQueryService } from '../query.js';
import { ConversationLattice, ConversationNode } from '../../../sigma/types.js';

describe('LatticeQueryService', () => {
  let service: LatticeQueryService;

  beforeEach(() => {
    // Reset singleton
    (LatticeQueryService as unknown as { instance: undefined }).instance =
      undefined;
    service = LatticeQueryService.getInstance();
  });

  const mockNode = (id: string, content: string): ConversationNode => ({
    id,
    type: 'conversation_turn',
    turn_id: id,
    role: 'user',
    content,
    timestamp: Date.now(),
    embedding: [],
    novelty: 0.5,
    overlay_scores: {
      O1_structural: 0,
      O2_security: 0,
      O3_lineage: 0,
      O4_mission: 0,
      O5_operational: 0,
      O6_mathematical: 0,
      O7_strategic: 0,
    },
    importance_score: 5,
    is_paradigm_shift: false,
    semantic_tags: [],
  });

  const mockLattice: ConversationLattice = {
    nodes: [
      {
        ...mockNode('1', 'How does the architecture work?'),
        overlay_scores: {
          O1_structural: 8,
          O2_security: 0,
          O3_lineage: 0,
          O4_mission: 0,
          O5_operational: 0,
          O6_mathematical: 0,
          O7_strategic: 0,
        },
      },
      {
        ...mockNode('2', 'What were the security requirements?'),
        overlay_scores: {
          O1_structural: 0,
          O2_security: 9,
          O3_lineage: 0,
          O4_mission: 0,
          O5_operational: 0,
          O6_mathematical: 0,
          O7_strategic: 0,
        },
      },
    ],
    edges: [],
    metadata: {
      created_at: Date.now(),
      original_turn_count: 2,
      compressed_turn_count: 2,
      compression_ratio: 1,
    },
  };

  it('should be a singleton', () => {
    const instance2 = LatticeQueryService.getInstance();
    expect(service).toBe(instance2);
  });

  it('should estimate tokens', () => {
    expect(service.estimateTokens('1234')).toBe(1);
    expect(service.estimateTokens('12345')).toBe(2);
  });

  it('should analyze query for overlays', () => {
    const scores = service.analyzeQuery('Tell me about the architecture');
    expect(scores.O1_structural).toBeGreaterThan(0);
    expect(scores.O2_security).toBe(0);
  });

  it('should reconstruct context based on query', async () => {
    const context = await service.reconstructContext(
      'architecture',
      mockLattice,
      {
        max_nodes: 1,
      }
    );
    expect(context.turns_included).toContain('1');
    expect(context.turns_included).not.toContain('2');
    expect(context.prompt).toContain('How does the architecture work?');
  });

  it('should get reconstruction stats', async () => {
    const context = await service.reconstructContext(
      'architecture',
      mockLattice,
      {
        max_nodes: 1,
      }
    );
    const stats = service.getReconstructionStats(context);
    expect(stats.turn_count).toBe(1);
    expect(stats.active_overlays).toContain('O1_structural');
  });
});
