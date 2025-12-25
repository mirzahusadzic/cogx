/**
 * SigmaTaskUpdate Tool (MCP Server for Claude)
 *
 * Provides task management with delegation support for Claude agents.
 * This replaces the native TodoWrite tool which lacks delegation capabilities.
 */

import { z } from 'zod';
import { executeSigmaTaskUpdate } from '../../llm/providers/tool-executors.js';

type ClaudeAgentSdk = {
  tool: (
    name: string,
    description: string,
    inputSchema: unknown,
    action: unknown
  ) => unknown;
  createSdkMcpServer: (config: unknown) => unknown;
};

/**
 * Create SigmaTaskUpdate MCP server for Claude
 *
 * This MCP server provides Claude with task management capabilities including:
 * - Task tracking with stable IDs
 * - Manager/Worker delegation pattern
 * - Acceptance criteria validation
 * - Session state persistence
 *
 * @param cwd - Working directory for session state
 * @param anchorId - Session anchor ID for state persistence
 * @param claudeAgentSdk - The dynamically imported Claude Agent SDK module
 * @returns MCP server instance with SigmaTaskUpdate tool
 */
export function createSigmaTaskUpdateMcpServer(
  cwd: string,
  anchorId: string | undefined,
  claudeAgentSdk: ClaudeAgentSdk | undefined
) {
  if (!claudeAgentSdk) {
    return undefined;
  }

  if (!anchorId) {
    console.warn(
      '[Sigma] SigmaTaskUpdate MCP server initialized without anchorId. Tasks will NOT be persisted.'
    );
  }

  const { tool, createSdkMcpServer } = claudeAgentSdk;

  const sigmaTaskUpdateTool = tool(
    'SigmaTaskUpdate',
    `Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.

## When to Use This Tool
Use this tool proactively in these scenarios:
1. Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
3. User explicitly requests task list - When the user directly asks you to use the task list
4. User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)
5. After receiving new instructions - Immediately capture user requirements as tasks
6. When you start working on a task - Mark it as in_progress BEFORE beginning work
7. After completing a task - Mark it as completed and add any new follow-up tasks
8. When delegating tasks - Create a task with status 'delegated' before sending the IPC message

## When NOT to Use This Tool
1. There is only a single, straightforward task
2. The task is trivial and tracking it provides no organizational benefit
3. The task can be completed in less than 3 trivial steps
4. The task is purely conversational or informational

## Task States
- pending: Task not yet started
- in_progress: Currently working on (limit to ONE task at a time)
- completed: Task finished successfully
- delegated: Task assigned to another agent via IPC (Manager/Worker pattern)

## Delegation (Manager/Worker Pattern)
When delegating a task to another agent:
1. Set status to 'delegated' and provide delegated_to (agent ID like "flash1")
2. MUST include acceptance_criteria (array of strings defining success)
3. Optionally provide context (additional background for the worker)
4. Use send_agent_message to dispatch the task payload to the worker
5. Worker reports back via send_agent_message when complete
6. Manager verifies acceptance_criteria before marking task 'completed'

## Important
- Each task MUST have a unique 'id' field (use nanoid, UUID, or semantic slug)
- Task descriptions must have two forms: content (imperative) and activeForm (present continuous)
- Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
- ONLY mark a task as completed when you have FULLY accomplished it`,
    {
      todos: z
        .array(
          z.object({
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
            // PGC Grounding fields (v2.0 protocol)
            grounding: z
              .object({
                strategy: z
                  .enum(['pgc_first', 'pgc_verify', 'pgc_cite', 'none'])
                  .describe('Strategy for how worker should approach the task'),
                overlay_hints: z
                  .array(z.enum(['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7']))
                  .optional()
                  .describe('Hints about which overlays are most relevant'),
                query_hints: z
                  .array(z.string())
                  .optional()
                  .describe("Semantic query hints for the worker's PGC"),
                evidence_required: z
                  .boolean()
                  .optional()
                  .describe('Whether response must include evidence citations'),
              })
              .optional()
              .describe('Optional PGC Grounding Instructions for the worker'),
            result_summary: z
              .string()
              .optional()
              .describe("Worker's completion report"),
          })
          // NOTE: .refine() creates ZodEffects which Gemini ADK doesn't support.
          // For cross-provider consistency, validation is done in execute function.
        )
        .describe('The updated task list'),
    },
    async (args: {
      todos: Array<{
        id: string;
        content: string;
        status: string;
        activeForm: string;
        acceptance_criteria?: string[];
        delegated_to?: string;
        context?: string;
        delegate_session_id?: string;
        result_summary?: string;
      }>;
    }) => {
      try {
        // Validate delegation requirements (moved from .refine() for cross-provider compatibility)
        for (const task of args.todos || []) {
          if (task.status === 'delegated') {
            if (
              !task.acceptance_criteria ||
              task.acceptance_criteria.length === 0
            ) {
              throw new Error(
                `Task "${task.id}" has status 'delegated' but missing 'acceptance_criteria'`
              );
            }
            if (!task.delegated_to || task.delegated_to.length === 0) {
              throw new Error(
                `Task "${task.id}" has status 'delegated' but missing 'delegated_to'`
              );
            }
          }
        }

        const result = await executeSigmaTaskUpdate(
          args.todos,
          cwd,
          anchorId || 'no-anchor'
        );

        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to update tasks: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return createSdkMcpServer({
    name: 'sigma-task-update',
    version: '1.0.0',
    tools: [sigmaTaskUpdateTool],
  });
}
