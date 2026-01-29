import { describe, it, expect } from 'vitest';
import { classifyConversationMode } from '../context-reconstructor.ts';
import type { ConversationLattice, ConversationNode } from '../types.js';

describe('ContextReconstructor', () => {
  const baseNode: Partial<ConversationNode> = {
    id: '1',
    role: 'user',
    content: 'hello',
    timestamp: Date.now(),
    embedding: [],
    importance_score: 5,
    overlay_scores: {
      O1_structural: 0,
      O2_security: 0,
      O3_lineage: 0,
      O4_mission: 0,
      O5_operational: 0,
      O6_mathematical: 0,
      O7_strategic: 0,
    },
    is_paradigm_shift: false,
  };

  describe('classifyConversationMode', () => {
    it('should default to chat for empty lattice', () => {
      const lattice: ConversationLattice = { nodes: [], edges: [] };
      expect(classifyConversationMode(lattice)).toBe('chat');
    });

    it('should classify as quest for high tool use and code blocks', () => {
      const lattice: ConversationLattice = {
        nodes: [
          { ...baseNode, content: '> Use tool bash', id: '1' },
          { ...baseNode, content: '> Use tool write', id: '2' },
          { ...baseNode, content: '> Use tool edit', id: '3' },
          { ...baseNode, content: '> Use tool read', id: '4' },
          { ...baseNode, content: '> Use tool grep', id: '5' },
          { ...baseNode, content: '> Use tool glob', id: '6' },
          { ...baseNode, content: '```typescript\nconst x = 1;\n```', id: '7' },
          { ...baseNode, content: '```typescript\nconst y = 2;\n```', id: '8' },
          { ...baseNode, content: '```typescript\nconst z = 3;\n```', id: '9' },
          {
            ...baseNode,
            content: '```typescript\nconst a = 4;\n```',
            id: '10',
          },
        ] as ConversationNode[],
        edges: [],
      };
      expect(classifyConversationMode(lattice)).toBe('quest');
    });

    it('should classify as quest for high structural scores', () => {
      const lattice: ConversationLattice = {
        nodes: Array(5)
          .fill(null)
          .map((_, i) => ({
            ...baseNode,
            id: String(i),
            overlay_scores: {
              ...baseNode.overlay_scores,
              O1_structural: 6,
              O5_operational: 6,
              O6_mathematical: 6,
            },
          })) as ConversationNode[],
        edges: [],
      };
      // structuralScore = 6+6+6 = 18 (> 15) -> +3
      // file references test: / \.(ts|tsx|js|jsx|py|md|json) /
      // Let's add some file refs to reach score 5
      lattice.nodes.forEach((n) => (n.content = 'editing file.ts'));
      // Now it should have:
      // +3 from structuralScore > 15
      // +2 from file references > 5 (if we have 6 nodes)

      // Add one more node to make it 6 file refs
      lattice.nodes.push({
        ...baseNode,
        id: '5',
        content: 'editing file2.ts',
        overlay_scores: {
          ...baseNode.overlay_scores,
          O1_structural: 6,
          O5_operational: 6,
          O6_mathematical: 6,
        },
      } as ConversationNode);

      expect(classifyConversationMode(lattice)).toBe('quest');
    });

    it('should classify as chat for casual conversation', () => {
      const lattice: ConversationLattice = {
        nodes: [
          { ...baseNode, content: 'How are you?', id: '1' },
          { ...baseNode, content: 'I am fine, thanks!', id: '2' },
        ] as ConversationNode[],
        edges: [],
      };
      expect(classifyConversationMode(lattice)).toBe('chat');
    });
  });
});
