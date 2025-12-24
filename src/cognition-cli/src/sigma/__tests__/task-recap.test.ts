import { describe, it, expect } from 'vitest';
import { reconstructChatContext } from '../context-reconstructor.ts';
import type {
  ConversationLattice,
  ConversationNode,
  SigmaTask,
} from '../types.js';

describe('ContextReconstructor Task List Recap', () => {
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

  it('should include completed tasks in the recap', async () => {
    const lattice: ConversationLattice = {
      nodes: [
        { ...baseNode, id: '1', role: 'user', content: 'Task 1 done' },
        {
          ...baseNode,
          id: '2',
          role: 'assistant',
          content: 'Completed task 1',
        },
      ] as ConversationNode[],
      edges: [],
    };

    const todos: SigmaTask[] = [
      {
        id: 't1',
        content: 'Task 1',
        activeForm: 'Completing task 1',
        status: 'completed',
      },
      {
        id: 't2',
        content: 'Task 2',
        activeForm: 'Completing task 2',
        status: 'in_progress',
      },
    ];

    // @ts-expect-error - lattice node structure might vary slightly but reconstructChatContext is exported
    const recap = await reconstructChatContext(
      lattice,
      '/test',
      undefined,
      'gemini',
      todos
    );

    expect(recap).toContain('## 📋 Task List');
    expect(recap).toContain('[✓] Task 1');
    expect(recap).toContain('[→] Completing task 2');
    expect(recap).toContain('**Continue with: "Completing task 2"**');
  });

  it('should show "All tasks completed" when no tasks are left', async () => {
    const lattice: ConversationLattice = {
      nodes: [
        { ...baseNode, id: '1', role: 'user', content: 'All done?' },
        { ...baseNode, id: '2', role: 'assistant', content: 'Yes!' },
      ] as ConversationNode[],
      edges: [],
    };

    const todos: SigmaTask[] = [
      {
        id: 't1',
        content: 'Task 1',
        activeForm: 'Completing task 1',
        status: 'completed',
      },
    ];

    // @ts-expect-error - Lattice structure in test is simplified
    const recap = await reconstructChatContext(
      lattice,
      '/test',
      undefined,
      'gemini',
      todos
    );

    expect(recap).toContain('## 📋 Task List');
    expect(recap).toContain('[✓] Task 1');
    expect(recap).toContain('**All tasks in the current list are completed.**');
  });
});
