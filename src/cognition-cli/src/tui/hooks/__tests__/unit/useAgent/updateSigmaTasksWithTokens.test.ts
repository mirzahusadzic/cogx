import { describe, it, expect } from 'vitest';
import { updateSigmaTasksWithTokens } from '../../../useAgent/useAgentHandlers.js';
import type { SigmaTasks } from '../../../useAgent/types.js';

describe('updateSigmaTasksWithTokens', () => {
  it('should calculate tokensUsed for in_progress tasks', () => {
    const prev: SigmaTasks = {
      todos: [
        {
          id: '1',
          content: 'Task 1',
          activeForm: 'Working on 1',
          status: 'in_progress',
          tokensAtStart: 100,
        },
      ],
    };

    const result = updateSigmaTasksWithTokens(prev, prev, 500);

    expect(result.todos[0].tokensUsed).toBe(400);
    expect(result.todos[0].tokensAtStart).toBe(100);
  });

  it('should initialize tokensAtStart for newly in_progress tasks', () => {
    const prev: SigmaTasks = {
      todos: [
        {
          id: '1',
          content: 'Task 1',
          activeForm: 'Working on 1',
          status: 'pending',
        },
      ],
    };

    const next: SigmaTasks = {
      todos: [
        {
          ...prev.todos[0],
          status: 'in_progress',
        },
      ],
    };

    const result = updateSigmaTasksWithTokens(prev, next, 500);

    expect(result.todos[0].tokensAtStart).toBe(500);
    expect(result.todos[0].tokensUsed).toBe(0);
  });

  it('should handle context eviction by preserving accumulated tokens', () => {
    const prev: SigmaTasks = {
      todos: [
        {
          id: '1',
          content: 'Task 1',
          activeForm: 'Working on 1',
          status: 'in_progress',
          tokensAtStart: 1000,
          tokensUsed: 200,
          tokensAccumulated: 0,
        },
      ],
    };

    // Current tokens (500) < tokensAtStart (1000)
    const result = updateSigmaTasksWithTokens(prev, prev, 500);

    expect(result.todos[0].tokensAtStart).toBe(500);
    expect(result.todos[0].tokensAccumulated).toBe(200);
    expect(result.todos[0].tokensUsed).toBe(200);

    // Further updates should add to accumulated
    const result2 = updateSigmaTasksWithTokens(result, result, 700);
    expect(result2.todos[0].tokensUsed).toBe(400); // 200 accumulated + (700-500)
  });

  it('should calculate final tokensUsed when task is completed', () => {
    const prev: SigmaTasks = {
      todos: [
        {
          id: '1',
          content: 'Task 1',
          activeForm: 'Working on 1',
          status: 'in_progress',
          tokensAtStart: 100,
        },
      ],
    };

    const next: SigmaTasks = {
      todos: [
        {
          ...prev.todos[0],
          status: 'completed',
        },
      ],
    };

    const result = updateSigmaTasksWithTokens(prev, next, 600);

    expect(result.todos[0].tokensUsed).toBe(500);
    expect(result.todos[0].status).toBe('completed');
  });

  it('should preserve tokensUsed for already completed tasks', () => {
    const prev: SigmaTasks = {
      todos: [
        {
          id: '1',
          content: 'Task 1',
          activeForm: 'Working on 1',
          status: 'completed',
          tokensAtStart: 100,
          tokensUsed: 500,
          tokensAccumulated: 0,
        },
      ],
    };

    const result = updateSigmaTasksWithTokens(prev, prev, 1000);

    expect(result.todos[0].tokensUsed).toBe(500);
    expect(result.todos[0].status).toBe('completed');
  });

  it('should ignore 0 effectiveTokens', () => {
    const prev: SigmaTasks = {
      todos: [
        {
          id: '1',
          content: 'Task 1',
          activeForm: 'Working on 1',
          status: 'in_progress',
          tokensAtStart: 100,
          tokensUsed: 400,
          tokensAccumulated: 0,
        },
      ],
    };

    const result = updateSigmaTasksWithTokens(prev, prev, 0);

    expect(result.todos[0].tokensUsed).toBe(400);
    expect(result.todos[0].tokensAtStart).toBe(100);
  });

  it('should merge tasks and preserve old tasks not in the new list', () => {
    const prev: SigmaTasks = {
      todos: [
        {
          id: 'task-1',
          content: 'Task 1',
          status: 'completed',
          result_summary: 'Task 1 completed',
        },
      ],
    };

    const next: SigmaTasks = {
      todos: [
        {
          id: 'task-2',
          content: 'Task 2',
          status: 'in_progress',
          activeForm: 'Working on 2',
        },
      ],
    };

    const result = updateSigmaTasksWithTokens(prev, next, 1000);

    expect(result.todos).toHaveLength(2);
    expect(result.todos.find((t) => t.id === 'task-1')).toBeDefined();
    expect(result.todos.find((t) => t.id === 'task-2')).toBeDefined();
    expect(result.todos.find((t) => t.id === 'task-2')?.tokensAtStart).toBe(
      1000
    );
  });

  it('should merge grounding and grounding_evidence', () => {
    const prev: SigmaTasks = {
      todos: [
        { id: '1', content: 'T1', activeForm: 'A1', status: 'completed' },
      ],
      grounding: [{ id: '1', strategy: 'pgc_first' }],
      grounding_evidence: [
        {
          id: '1',
          queries_executed: ['q1'],
          overlays_consulted: ['O2'],
          citations: [{ overlay: 'O2', content: 'c1', relevance: 'high' }],
          grounding_confidence: 'high',
        },
      ],
    };

    const next: SigmaTasks = {
      todos: [
        { id: '2', content: 'T2', activeForm: 'A2', status: 'in_progress' },
      ],
      grounding: [{ id: '2', strategy: 'pgc_verify' }],
      grounding_evidence: [
        {
          id: '2',
          queries_executed: ['q2'],
          overlays_consulted: ['O4'],
          citations: [{ overlay: 'O4', content: 'c2', relevance: 'high' }],
          grounding_confidence: 'medium',
        },
      ],
    };

    const result = updateSigmaTasksWithTokens(prev, next, 1000);

    expect(result.todos).toHaveLength(2);
    expect(result.grounding).toHaveLength(2);
    expect(result.grounding_evidence).toHaveLength(2);

    expect(result.grounding?.find((g) => g.id === '1')?.strategy).toBe(
      'pgc_first'
    );
    expect(result.grounding?.find((g) => g.id === '2')?.strategy).toBe(
      'pgc_verify'
    );
    expect(
      result.grounding_evidence?.find((e) => e.id === '1')?.queries_executed
    ).toEqual(['q1']);
    expect(
      result.grounding_evidence?.find((e) => e.id === '2')?.queries_executed
    ).toEqual(['q2']);
  });
});
