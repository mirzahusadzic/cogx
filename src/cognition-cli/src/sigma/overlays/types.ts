export interface AlignmentScores {
  alignment_O1: number;
  alignment_O2: number;
  alignment_O3: number;
  alignment_O4: number;
  alignment_O5: number;
  alignment_O6: number;
  alignment_O7: number;
}

export interface ConversationOverlayConfig {
  id: string; // "O1", "O2", etc.
  name: string; // "Structural", "Security", etc.
  slug: string; // "conversation-structural", "conversation-security", etc.
  keywords: string[];
  description: string;
}

export const CONVERSATION_OVERLAY_CONFIGS: Record<
  string,
  ConversationOverlayConfig
> = {
  O1: {
    id: 'O1',
    name: 'Structural',
    slug: 'conversation-structural',
    keywords: [
      'structure',
      'pattern',
      'hierarchy',
      'order',
      'relationship',
      'node',
      'edge',
      'lattice',
      'graph',
      'tree',
    ],
    description: 'Architecture/design discussions',
  },
  O2: {
    id: 'O2',
    name: 'Security',
    slug: 'conversation-security',
    keywords: [
      'security',
      'vulnerability',
      'exploit',
      'threat',
      'risk',
      'safe',
      'policy',
      'compliance',
      'audit',
      'protection',
    ],
    description: 'Security concerns raised',
  },
  O3: {
    id: 'O3',
    name: 'Lineage',
    slug: 'conversation-lineage',
    keywords: [
      'lineage',
      'history',
      'source',
      'origin',
      'evolution',
      'provenance',
      'chain',
      'derivation',
      'attribution',
      'context',
    ],
    description: 'Knowledge evolution ("earlier we...")',
  },
  O4: {
    id: 'O4',
    name: 'Mission',
    slug: 'conversation-mission',
    keywords: [
      'mission',
      'goal',
      'objective',
      'purpose',
      'intent',
      'outcome',
      'strategy',
      'alignment',
      'target',
      'vision',
    ],
    description: 'Goals/objectives for session',
  },
  O5: {
    id: 'O5',
    name: 'Operational',
    slug: 'conversation-operational',
    keywords: [
      'operational',
      'execution',
      'process',
      'workflow',
      'action',
      'performance',
      'efficiency',
      'status',
      'event',
      'state',
    ],
    description: 'Commands/actions executed',
  },
  O6: {
    id: 'O6',
    name: 'Mathematical',
    slug: 'conversation-mathematical',
    keywords: [
      'math',
      'logic',
      'formal',
      'proof',
      'theorem',
      'axiom',
      'set',
      'category',
      'algebra',
      'calculus',
    ],
    description: 'Algorithms/logic discussed',
  },
  O7: {
    id: 'O7',
    name: 'Coherence',
    slug: 'conversation-coherence',
    keywords: [
      'coherence',
      'consistency',
      'link',
      'flow',
      'clarity',
      'connection',
      'unity',
      'harmony',
      'relevance',
      'focus',
    ],
    description: 'Topic drift and conversation flow',
  },
};
