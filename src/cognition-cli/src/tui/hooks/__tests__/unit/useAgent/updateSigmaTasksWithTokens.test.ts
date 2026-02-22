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
});
