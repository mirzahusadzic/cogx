/**
 * Unit tests for SigmaTaskUpdate delegation schema validation
 *
 * Tests that the Zod schema properly validates delegation fields
 * across all providers (Gemini, OpenAI, Claude MCP).
 */

import { describe, test, expect } from 'vitest';
import { z } from 'zod';

/**
 * This is the shared schema used by all providers for SigmaTaskUpdate
 * Extracted from adk-tools.ts, agent-tools.ts, and sigma-task-update-tool.ts
 */
const createSigmaTaskUpdateSchema = () => {
  return z.object({
    todos: z
      .array(
        z
          .object({
            id: z
              .string()
              .min(1)
              .describe(
                'Unique stable identifier for this task (use nanoid, UUID, or semantic slug like "fix-ruff-api")'
              ),
            content: z
              .string()
              .min(1)
              .describe(
                'The imperative form describing what needs to be done (e.g., "Run tests", "Build the project")'
              ),
            activeForm: z
              .string()
              .min(1)
              .describe(
                'The present continuous form shown during execution (e.g., "Running tests", "Building the project")'
              ),
            status: z
              .enum(['pending', 'in_progress', 'completed', 'delegated'])
              .describe(
                'Task status. Use "delegated" when assigning task to another agent via IPC'
              ),
            // Delegation fields (Manager/Worker paradigm)
            acceptance_criteria: z
              .array(z.string())
              .optional()
              .describe(
                'Success criteria for task completion (e.g., ["Must pass \'npm test\'", "No breaking changes"]). Required when delegating.'
              ),
            delegated_to: z
              .string()
              .optional()
              .describe(
                'Agent ID this task was delegated to (e.g., "flash1"). Set when status is "delegated".'
              ),
            context: z
              .string()
              .optional()
              .describe(
                'Additional context for delegated worker (e.g., "Refactoring auth system - keep OAuth flow intact")'
              ),
            delegate_session_id: z
              .string()
              .optional()
              .describe("Worker's session ID (for audit trail)"),
            result_summary: z
              .string()
              .optional()
              .describe("Worker's completion report"),
          })
          .refine(
            (data) => {
              // When delegating, acceptance_criteria and delegated_to are required
              if (data.status === 'delegated') {
                return (
                  data.acceptance_criteria &&
                  data.acceptance_criteria.length > 0 &&
                  data.delegated_to &&
                  data.delegated_to.length > 0
                );
              }
              return true;
            },
            {
              message:
                "Tasks with status 'delegated' must have 'acceptance_criteria' and 'delegated_to' fields",
            }
          )
      )
      .describe('The updated task list'),
  });
};

describe('SigmaTaskUpdate - Delegation Schema Validation', () => {
  const schema = createSigmaTaskUpdateSchema();

  describe('Valid Non-Delegated Tasks', () => {
    test('should accept task with pending status', () => {
      const input = {
        todos: [
          {
            id: 'task-1',
            content: 'Write tests',
            status: 'pending',
            activeForm: 'Writing tests',
          },
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    test('should accept task with in_progress status', () => {
      const input = {
        todos: [
          {
            id: 'task-2',
            content: 'Build feature',
            status: 'in_progress',
            activeForm: 'Building feature',
          },
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    test('should accept task with completed status', () => {
      const input = {
        todos: [
          {
            id: 'task-3',
            content: 'Deploy app',
            status: 'completed',
            activeForm: 'Deploying app',
          },
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    test('should accept multiple non-delegated tasks', () => {
      const input = {
        todos: [
          {
            id: 'task-1',
            content: 'Task 1',
            status: 'pending',
            activeForm: 'Working 1',
          },
          {
            id: 'task-2',
            content: 'Task 2',
            status: 'in_progress',
            activeForm: 'Working 2',
          },
          {
            id: 'task-3',
            content: 'Task 3',
            status: 'completed',
            activeForm: 'Working 3',
          },
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('Valid Delegated Tasks', () => {
    test('should accept delegated task with all required fields', () => {
      const input = {
        todos: [
          {
            id: 'delegated-task-1',
            content: 'Fix authentication bug',
            status: 'delegated',
            activeForm: 'Delegating authentication fix',
            delegated_to: 'flash1',
            acceptance_criteria: [
              'All tests pass',
              'No breaking changes',
              'OAuth flow intact',
            ],
          },
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    test('should accept delegated task with optional context field', () => {
      const input = {
        todos: [
          {
            id: 'delegated-task-2',
            content: 'Refactor database',
            status: 'delegated',
            activeForm: 'Delegating database refactor',
            delegated_to: 'haiku2',
            acceptance_criteria: ['Must pass all integration tests'],
            context: 'Refactoring for performance - keep API unchanged',
          },
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    test('should accept delegated task with optional delegate_session_id', () => {
      const input = {
        todos: [
          {
            id: 'delegated-task-3',
            content: 'Write documentation',
            status: 'delegated',
            activeForm: 'Delegating documentation',
            delegated_to: 'sonnet1',
            acceptance_criteria: ['Docs complete', 'Examples included'],
            delegate_session_id: 'session-abc-123',
          },
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    test('should accept delegated task with result_summary', () => {
      const input = {
        todos: [
          {
            id: 'delegated-task-4',
            content: 'Optimize queries',
            status: 'delegated',
            activeForm: 'Delegating query optimization',
            delegated_to: 'flash3',
            acceptance_criteria: ['Query time < 100ms'],
            result_summary: 'Optimized 12 queries, avg time now 45ms',
          },
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('Invalid Delegated Tasks - Missing Fields', () => {
    test('should reject delegated task without acceptance_criteria', () => {
      const input = {
        todos: [
          {
            id: 'invalid-task-1',
            content: 'Invalid task',
            status: 'delegated',
            activeForm: 'Delegating',
            delegated_to: 'worker1',
            // Missing acceptance_criteria
          },
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('acceptance_criteria');
        expect(result.error.message).toContain('delegated_to');
      }
    });

    test('should reject delegated task without delegated_to', () => {
      const input = {
        todos: [
          {
            id: 'invalid-task-2',
            content: 'Invalid task',
            status: 'delegated',
            activeForm: 'Delegating',
            acceptance_criteria: ['Must pass tests'],
            // Missing delegated_to
          },
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('acceptance_criteria');
        expect(result.error.message).toContain('delegated_to');
      }
    });

    test('should reject delegated task with empty acceptance_criteria array', () => {
      const input = {
        todos: [
          {
            id: 'invalid-task-3',
            content: 'Invalid task',
            status: 'delegated',
            activeForm: 'Delegating',
            delegated_to: 'worker1',
            acceptance_criteria: [], // Empty array
          },
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('acceptance_criteria');
      }
    });

    test('should reject delegated task with empty delegated_to string', () => {
      const input = {
        todos: [
          {
            id: 'invalid-task-4',
            content: 'Invalid task',
            status: 'delegated',
            activeForm: 'Delegating',
            delegated_to: '', // Empty string
            acceptance_criteria: ['Must pass tests'],
          },
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('delegated_to');
      }
    });

    test('should reject delegated task without both fields', () => {
      const input = {
        todos: [
          {
            id: 'invalid-task-5',
            content: 'Invalid task',
            status: 'delegated',
            activeForm: 'Delegating',
            // Missing both acceptance_criteria and delegated_to
          },
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('acceptance_criteria');
        expect(result.error.message).toContain('delegated_to');
      }
    });
  });

  describe('Mixed Task Lists', () => {
    test('should accept mix of delegated and non-delegated tasks', () => {
      const input = {
        todos: [
          {
            id: 'task-1',
            content: 'Regular task',
            status: 'pending',
            activeForm: 'Working on regular task',
          },
          {
            id: 'task-2',
            content: 'Delegated task',
            status: 'delegated',
            activeForm: 'Delegating task',
            delegated_to: 'worker1',
            acceptance_criteria: ['Must pass tests'],
          },
          {
            id: 'task-3',
            content: 'Completed task',
            status: 'completed',
            activeForm: 'Completed',
          },
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    test('should reject if any delegated task is invalid', () => {
      const input = {
        todos: [
          {
            id: 'task-1',
            content: 'Valid regular task',
            status: 'pending',
            activeForm: 'Working',
          },
          {
            id: 'task-2',
            content: 'Invalid delegated task',
            status: 'delegated',
            activeForm: 'Delegating',
            // Missing required fields
          },
          {
            id: 'task-3',
            content: 'Another valid task',
            status: 'completed',
            activeForm: 'Done',
          },
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('Required Fields Validation', () => {
    test('should reject task without id', () => {
      const input = {
        todos: [
          {
            // Missing id
            content: 'Task',
            status: 'pending',
            activeForm: 'Working',
          } as unknown,
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });

    test('should reject task with empty id', () => {
      const input = {
        todos: [
          {
            id: '', // Empty string
            content: 'Task',
            status: 'pending',
            activeForm: 'Working',
          },
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });

    test('should reject task without content', () => {
      const input = {
        todos: [
          {
            id: 'task-1',
            // Missing content
            status: 'pending',
            activeForm: 'Working',
          } as unknown,
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });

    test('should reject task without status', () => {
      const input = {
        todos: [
          {
            id: 'task-1',
            content: 'Task',
            // Missing status
            activeForm: 'Working',
          } as unknown,
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });

    test('should reject task with invalid status', () => {
      const input = {
        todos: [
          {
            id: 'task-1',
            content: 'Task',
            status: 'invalid-status', // Not in enum
            activeForm: 'Working',
          } as unknown,
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should accept empty todos array', () => {
      const input = {
        todos: [],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    test('should accept delegated task with single acceptance_criterion', () => {
      const input = {
        todos: [
          {
            id: 'task-1',
            content: 'Task',
            status: 'delegated',
            activeForm: 'Delegating',
            delegated_to: 'worker1',
            acceptance_criteria: ['Single criterion'],
          },
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    test('should accept delegated task with many acceptance_criteria', () => {
      const input = {
        todos: [
          {
            id: 'task-1',
            content: 'Complex task',
            status: 'delegated',
            activeForm: 'Delegating',
            delegated_to: 'worker1',
            acceptance_criteria: [
              'Criterion 1',
              'Criterion 2',
              'Criterion 3',
              'Criterion 4',
              'Criterion 5',
            ],
          },
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    test('should accept delegated task with all optional fields', () => {
      const input = {
        todos: [
          {
            id: 'task-1',
            content: 'Full task',
            status: 'delegated',
            activeForm: 'Delegating',
            delegated_to: 'worker1',
            acceptance_criteria: ['Must work'],
            context: 'Additional context',
            delegate_session_id: 'session-123',
            result_summary: 'Completed successfully',
          },
        ],
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});
