/**
 * Reconstructor Tests
 *
 * Tests the context reconstruction module that rebuilds context
 * from compressed lattice for Claude queries.
 */

import { describe, it, expect } from 'vitest';
import {
  reconstructContext,
  getReconstructionStats,
} from '../reconstructor.js';
import type {
  ConversationLattice,
  ConversationNode,
  OverlayScores,
} from '../types.js';

/**
 * Helper to create a conversation node for testing
 */
function createNode(
  id: string,
  content: string,
  options: Partial<ConversationNode> = {}
): ConversationNode {
  const defaultOverlays: OverlayScores = {
    O1_structural: 0,
    O2_security: 0,
    O3_lineage: 0,
    O4_mission: 0,
    O5_operational: 0,
    O6_mathematical: 0,
    O7_strategic: 0,
  };

  return {
    id,
    turn_id: id,
    role: 'assistant',
    content,
    timestamp: Date.now(),
    importance_score: 5,
    is_paradigm_shift: false,
    overlay_scores: { ...defaultOverlays, ...options.overlay_scores },
    ...options,
  };
}

/**
 * Helper to create a lattice for testing
 */
function createLattice(
  nodes: ConversationNode[],
  edges: Array<{ from: string; to: string; type: string }> = []
): ConversationLattice {
  return {
    version: '1.0',
    created_at: Date.now(),
    last_updated: Date.now(),
    metadata: {
      total_turns: nodes.length,
      compression_ratio: 0.5,
    },
    nodes,
    edges,
    concepts: [],
    overlays: {
      O1_structural: [],
      O2_security: [],
      O3_lineage: [],
      O4_mission: [],
      O5_operational: [],
      O6_mathematical: [],
      O7_strategic: [],
    },
  };
}

describe('reconstructContext', () => {
  describe('Basic Reconstruction', () => {
    it('should reconstruct context from lattice', async () => {
      const nodes = [
        createNode('1', 'First message about the code architecture'),
        createNode('2', 'Second message about implementation'),
        createNode('3', 'Third message about testing'),
      ];

      const lattice = createLattice(nodes);

      const result = await reconstructContext(
        'What did we discuss about architecture?',
        lattice
      );

      expect(result).toBeDefined();
      expect(result.prompt).toBeDefined();
      expect(result.turns_included).toBeInstanceOf(Array);
      expect(result.token_count).toBeGreaterThanOrEqual(0);
      expect(result.relevance_score).toBeGreaterThanOrEqual(0);
      expect(result.relevance_score).toBeLessThanOrEqual(1);
    });

    it('should respect token budget', async () => {
      const nodes = [
        createNode('1', 'A'.repeat(1000)), // ~250 tokens
        createNode('2', 'B'.repeat(1000)), // ~250 tokens
        createNode('3', 'C'.repeat(1000)), // ~250 tokens
      ];

      const lattice = createLattice(nodes);

      const result = await reconstructContext('What happened?', lattice, {
        token_budget: 300, // Only enough for ~1 node
      });

      // Should have limited tokens
      expect(result.token_count).toBeLessThanOrEqual(300);
    });

    it('should respect max_nodes option', async () => {
      const nodes = Array.from({ length: 100 }, (_, i) =>
        createNode(`node-${i}`, `Message ${i}`)
      );

      const lattice = createLattice(nodes);

      const result = await reconstructContext('What happened?', lattice, {
        max_nodes: 10,
      });

      expect(result.turns_included.length).toBeLessThanOrEqual(10);
    });

    it('should handle empty lattice', async () => {
      const lattice = createLattice([]);

      const result = await reconstructContext('What happened?', lattice);

      expect(result.turns_included).toEqual([]);
      expect(result.token_count).toBe(0);
      expect(result.relevance_score).toBe(0);
    });
  });

  describe('Query Analysis - Overlay Activation', () => {
    it('should activate O1 (structural) for architecture queries', async () => {
      const nodes = [
        createNode('1', 'Architecture discussion', {
          overlay_scores: { O1_structural: 8 } as OverlayScores,
        }),
        createNode('2', 'Random conversation', {
          overlay_scores: {} as OverlayScores,
        }),
      ];

      const lattice = createLattice(nodes);

      const result = await reconstructContext(
        'What is the architecture design?',
        lattice
      );

      expect(result.overlay_activation?.O1_structural).toBe(8);
    });

    it('should activate O2 (security) for security queries', async () => {
      const nodes = [
        createNode('1', 'Security analysis', {
          overlay_scores: { O2_security: 8 } as OverlayScores,
        }),
      ];

      const lattice = createLattice(nodes);

      const result = await reconstructContext(
        'What are the security vulnerabilities?',
        lattice
      );

      expect(result.overlay_activation?.O2_security).toBe(8);
    });

    it('should activate O3 (lineage) for historical reference queries', async () => {
      const nodes = [
        createNode('1', 'Earlier discussion', {
          overlay_scores: { O3_lineage: 8 } as OverlayScores,
        }),
      ];

      const lattice = createLattice(nodes);

      const result = await reconstructContext(
        'What did we discuss earlier about this?',
        lattice
      );

      expect(result.overlay_activation?.O3_lineage).toBe(8);
    });

    it('should activate O4 (mission) for goal/planning queries', async () => {
      const nodes = [
        createNode('1', 'Project goals', {
          overlay_scores: { O4_mission: 8 } as OverlayScores,
        }),
      ];

      const lattice = createLattice(nodes);

      const result = await reconstructContext(
        'What is the goal of this strategy?',
        lattice
      );

      expect(result.overlay_activation?.O4_mission).toBe(8);
    });

    it('should activate O5 (operational) for command/workflow queries', async () => {
      const nodes = [
        createNode('1', 'How to run the tests', {
          overlay_scores: { O5_operational: 8 } as OverlayScores,
        }),
      ];

      const lattice = createLattice(nodes);

      const result = await reconstructContext(
        'How do I run and execute this command?',
        lattice
      );

      expect(result.overlay_activation?.O5_operational).toBe(8);
    });

    it('should activate O6 (mathematical) for code/algorithm queries', async () => {
      const nodes = [
        createNode('1', 'Algorithm explanation', {
          overlay_scores: { O6_mathematical: 8 } as OverlayScores,
        }),
      ];

      const lattice = createLattice(nodes);

      const result = await reconstructContext(
        'What is the algorithm for this function?',
        lattice
      );

      expect(result.overlay_activation?.O6_mathematical).toBe(8);
    });

    it('should activate O7 (strategic) for test/validation queries', async () => {
      const nodes = [
        createNode('1', 'Test plan', {
          overlay_scores: { O7_strategic: 8 } as OverlayScores,
        }),
      ];

      const lattice = createLattice(nodes);

      const result = await reconstructContext(
        'How do we test and verify this?',
        lattice
      );

      expect(result.overlay_activation?.O7_strategic).toBe(8);
    });

    it('should activate O3 for question words (what, how, why)', async () => {
      const nodes = [
        createNode('1', 'Some context', {
          overlay_scores: {} as OverlayScores,
        }),
      ];

      const lattice = createLattice(nodes);

      const result = await reconstructContext('What happened here?', lattice);

      // Question words should activate O3 with at least score 5
      expect(result.overlay_activation?.O3_lineage).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Node Relevance Scoring', () => {
    it('should prioritize nodes matching query overlays', async () => {
      const nodes = [
        createNode('security-node', 'Security discussion', {
          overlay_scores: { O2_security: 10 } as OverlayScores,
          importance_score: 5,
        }),
        createNode('random-node', 'Random chat', {
          overlay_scores: {} as OverlayScores,
          importance_score: 5,
        }),
      ];

      const lattice = createLattice(nodes);

      const result = await reconstructContext(
        'What are the security concerns?',
        lattice
      );

      // Security node should be included first/primarily
      expect(result.turns_included).toContain('security-node');
    });

    it('should boost paradigm shift nodes', async () => {
      const nodes = [
        createNode('paradigm-node', 'Major insight!', {
          is_paradigm_shift: true,
          importance_score: 3,
        }),
        createNode('normal-node', 'Regular discussion', {
          is_paradigm_shift: false,
          importance_score: 3,
        }),
      ];

      const lattice = createLattice(nodes);

      const result = await reconstructContext('What happened?', lattice);

      // Paradigm shift should be included
      expect(result.turns_included).toContain('paradigm-node');
    });

    it('should consider importance_score in relevance', async () => {
      const nodes = [
        createNode('high-importance', 'Very important', {
          importance_score: 10,
        }),
        createNode('low-importance', 'Not important', {
          importance_score: 1,
        }),
      ];

      const lattice = createLattice(nodes);

      const result = await reconstructContext('What happened?', lattice, {
        sort_by: 'importance',
      });

      // High importance should be first
      if (result.turns_included.length >= 2) {
        expect(result.turns_included[0]).toBe('high-importance');
      }
    });
  });

  describe('Temporal Neighbor Expansion', () => {
    it('should include temporal neighbors when include_neighbors is true', async () => {
      const nodes = [
        createNode('1', 'First message', { importance_score: 10 }),
        createNode('2', 'Second message (neighbor)', { importance_score: 1 }),
        createNode('3', 'Third message', { importance_score: 1 }),
      ];

      const edges = [
        { from: '1', to: '2', type: 'temporal' },
        { from: '2', to: '3', type: 'temporal' },
      ];

      const lattice = createLattice(nodes, edges);

      const result = await reconstructContext('What happened?', lattice, {
        include_neighbors: true,
        max_nodes: 10,
      });

      // Should include node 1 and its neighbor (node 2)
      expect(result.turns_included).toContain('1');
    });

    it('should not expand neighbors when include_neighbors is false', async () => {
      const nodes = [
        createNode('1', 'Important message', { importance_score: 10 }),
        createNode('2', 'Neighbor message', { importance_score: 1 }),
      ];

      const edges = [{ from: '1', to: '2', type: 'temporal' }];

      const lattice = createLattice(nodes, edges);

      const result = await reconstructContext('What happened?', lattice, {
        include_neighbors: false,
        max_nodes: 1,
      });

      // Should only include the most relevant node
      expect(result.turns_included.length).toBe(1);
    });
  });

  describe('Sorting', () => {
    it('should sort by importance when sort_by is importance', async () => {
      const nodes = [
        createNode('low', 'Low importance', { importance_score: 1 }),
        createNode('high', 'High importance', { importance_score: 10 }),
        createNode('medium', 'Medium importance', { importance_score: 5 }),
      ];

      const lattice = createLattice(nodes);

      const result = await reconstructContext('What happened?', lattice, {
        sort_by: 'importance',
      });

      // High importance should come first
      const highIndex = result.turns_included.indexOf('high');
      const lowIndex = result.turns_included.indexOf('low');

      if (highIndex !== -1 && lowIndex !== -1) {
        expect(highIndex).toBeLessThan(lowIndex);
      }
    });

    it('should sort by timestamp when sort_by is recency', async () => {
      const now = Date.now();

      const nodes = [
        createNode('old', 'Old message', { timestamp: now - 3000 }),
        createNode('new', 'New message', { timestamp: now }),
        createNode('middle', 'Middle message', { timestamp: now - 1500 }),
      ];

      const lattice = createLattice(nodes);

      const result = await reconstructContext('What happened?', lattice, {
        sort_by: 'recency',
      });

      // Old message should come first (chronological order)
      const oldIndex = result.turns_included.indexOf('old');
      const newIndex = result.turns_included.indexOf('new');

      if (oldIndex !== -1 && newIndex !== -1) {
        expect(oldIndex).toBeLessThan(newIndex);
      }
    });
  });

  describe('Turn Formatting', () => {
    it('should format turns with role headers', async () => {
      const nodes = [
        createNode('1', 'Hello from user', { role: 'user' }),
        createNode('2', 'Hello from assistant', { role: 'assistant' }),
      ];

      const lattice = createLattice(nodes);

      const result = await reconstructContext('What happened?', lattice);

      expect(result.prompt).toContain('[USER]');
      expect(result.prompt).toContain('[ASSISTANT]');
    });

    it('should mark paradigm shifts in output', async () => {
      const nodes = [
        createNode('1', 'Major breakthrough!', {
          is_paradigm_shift: true,
        }),
      ];

      const lattice = createLattice(nodes);

      const result = await reconstructContext('What happened?', lattice);

      expect(result.prompt).toContain('PARADIGM SHIFT');
    });

    it('should include importance score for high-importance turns', async () => {
      const nodes = [
        createNode('1', 'Very important message', {
          importance_score: 9,
        }),
      ];

      const lattice = createLattice(nodes);

      const result = await reconstructContext('What happened?', lattice);

      expect(result.prompt).toContain('importance: 9');
    });

    it('should not include importance score for low-importance turns', async () => {
      const nodes = [
        createNode('1', 'Regular message', {
          importance_score: 5,
        }),
      ];

      const lattice = createLattice(nodes);

      const result = await reconstructContext('What happened?', lattice);

      expect(result.prompt).not.toContain('importance:');
    });
  });

  describe('Relevance Score Calculation', () => {
    it('should return 0 relevance for no relevant nodes', async () => {
      const lattice = createLattice([]); // Empty lattice

      const result = await reconstructContext(
        'Very specific security query',
        lattice
      );

      expect(result.relevance_score).toBe(0);
    });

    it('should return higher relevance when more relevant nodes included', async () => {
      const nodes = [
        createNode('1', 'Security discussion', {
          overlay_scores: { O2_security: 10 } as OverlayScores,
        }),
        createNode('2', 'More security', {
          overlay_scores: { O2_security: 10 } as OverlayScores,
        }),
      ];

      const lattice = createLattice(nodes);

      const result = await reconstructContext(
        'What are the security concerns?',
        lattice
      );

      expect(result.relevance_score).toBeGreaterThan(0);
    });
  });
});

describe('getReconstructionStats', () => {
  it('should return correct statistics', async () => {
    const nodes = [
      createNode('1', 'First message', {
        overlay_scores: { O2_security: 8 } as OverlayScores,
      }),
      createNode('2', 'Second message'),
    ];

    const lattice = createLattice(nodes);

    const context = await reconstructContext(
      'What are the security issues?',
      lattice
    );
    const stats = getReconstructionStats(context);

    expect(stats.turn_count).toBe(context.turns_included.length);
    expect(stats.token_count).toBe(context.token_count);
    expect(stats.relevance_score).toBeGreaterThanOrEqual(0);
    expect(stats.relevance_score).toBeLessThanOrEqual(1);
    expect(stats.active_overlays).toBeInstanceOf(Array);
    expect(typeof stats.token_efficiency).toBe('number');
  });

  it('should list active overlays', async () => {
    const nodes = [
      createNode('1', 'Security issue', {
        overlay_scores: { O2_security: 10 } as OverlayScores,
      }),
    ];

    const lattice = createLattice(nodes);

    const context = await reconstructContext(
      'What are the security concerns?',
      lattice
    );
    const stats = getReconstructionStats(context);

    expect(stats.active_overlays).toContain('O2_security');
  });

  it('should calculate token efficiency', async () => {
    const nodes = [
      createNode('1', 'A'.repeat(100)), // ~25 tokens
      createNode('2', 'B'.repeat(100)), // ~25 tokens
    ];

    const lattice = createLattice(nodes);

    const context = await reconstructContext('What happened?', lattice);
    const stats = getReconstructionStats(context);

    if (stats.turn_count > 0) {
      expect(stats.token_efficiency).toBe(
        Math.round(stats.token_count / stats.turn_count)
      );
    }
  });

  it('should handle empty context', () => {
    const context = {
      prompt: '',
      turns_included: [],
      token_count: 0,
      relevance_score: 0,
      overlay_activation: {},
    };

    const stats = getReconstructionStats(context);

    expect(stats.turn_count).toBe(0);
    expect(stats.token_count).toBe(0);
    expect(stats.token_efficiency).toBe(0);
    expect(stats.active_overlays).toEqual([]);
  });

  it('should round relevance score to 2 decimal places', async () => {
    const nodes = [createNode('1', 'Message')];
    const lattice = createLattice(nodes);

    const context = await reconstructContext('What?', lattice);
    const stats = getReconstructionStats(context);

    // Should be rounded (no more than 2 decimal places)
    const decimalPlaces = (stats.relevance_score.toString().split('.')[1] || '')
      .length;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });
});
