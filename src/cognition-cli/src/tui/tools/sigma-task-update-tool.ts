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
2. The task is purely conversational or informational
3. The task can be completed in less than 3 trivial steps

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

## PGC Grounding (v2.0 Protocol)
Use the 'grounding' and 'grounding_evidence' arrays to manage task grounding (correlate via 'id').
- Strategies:
  - pgc_first: Query PGC before acting (for research/planning)
  - pgc_verify: Verify changes against PGC (for safety/security)
  - pgc_cite: Must include citations in evidence
- Manager: Set 'grounding' requirements in the 'grounding' array when delegating.
- Worker: Populate 'grounding_evidence' array with citations and confidence when completing tasks.

Benefits of delegation:
- Keeps Manager context clean (no linter noise, verbose outputs)
- Manager stays focused on architecture and planning
- Worker agents handle implementation details

## Important
- Each task MUST have a unique 'id' field (use nanoid, UUID, or semantic slug)
- Use 'grounding' and 'grounding_evidence' top-level arrays for PGC data (correlate via 'id')
- Task descriptions must have two forms: content (imperative) and activeForm (present continuous)
- Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
- ONLY mark a task as completed when you have FULLY accomplished it
- If you encounter errors or blockers, keep the task as in_progress and create a new task describing what needs to be resolved
- **Reasoning First**: You MUST engage your internal reasoning/thinking process first to plan the action and validate parameters.`,
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
            result_summary: z
              .string()
              .optional()
              .describe("Worker's completion report"),
          })
        )
        .describe('The updated task list'),
      grounding: z
        .array(
          z.object({
            id: z.string(),
            strategy: z
              .enum(['pgc_first', 'pgc_verify', 'pgc_cite', 'none'])
              .describe('Strategy for how worker should approach the task'),
            overlay_hints: z
              .array(z.enum(['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7']))
              .nullable()
              .describe('Hints about which overlays are most relevant'),
            query_hints: z
              .array(z.string())
              .nullable()
              .describe("Semantic query hints for the worker's PGC"),
            evidence_required: z
              .union([z.boolean(), z.string()])
              .nullable()
              .describe('Whether response must include evidence citations'),
          })
        )
        .nullable()
        .describe(
          'Grounding strategy and hints for tasks (correlate via id). Optional PGC Grounding Instructions for the worker'
        ),
      grounding_evidence: z
        .array(
          z.object({
            id: z.string(),
            queries_executed: z.array(z.string()),
            overlays_consulted: z.array(
              z.enum(['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'])
            ),
            citations: z.array(
              z.object({
                overlay: z.string(),
                content: z.string(),
                relevance: z.string(),
                file_path: z.string().optional(),
              })
            ),
            grounding_confidence: z.enum(['high', 'medium', 'low']),
            overlay_warnings: z.array(z.string()).nullable(),
          })
        )
        .nullable()
        .describe('Structured evidence returned by worker (correlate via id)'),
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
      grounding?: Array<{
        id: string;
        strategy: 'pgc_first' | 'pgc_verify' | 'pgc_cite' | 'none';
        overlay_hints?: Array<
          'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'
        > | null;
        query_hints?: string[] | null;
        evidence_required?: boolean | string | null;
      }> | null;
      grounding_evidence?: Array<{
        id: string;
        queries_executed: string[];
        overlays_consulted: Array<
          'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'
        >;
        citations: Array<{
          overlay: string;
          content: string;
          relevance: string;
          file_path?: string;
        }>;
        grounding_confidence: 'high' | 'medium' | 'low';
        overlay_warnings?: string[] | null;
      }> | null;
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
          // Merge top-level arrays back into todo items for the executor
          args.todos.map((todo) => {
            const cleanTodo: Parameters<
              typeof executeSigmaTaskUpdate
            >[0][number] = {
              id: todo.id,
              content: todo.content,
              status: todo.status,
              activeForm: todo.activeForm,
            };

            if (todo.acceptance_criteria)
              cleanTodo.acceptance_criteria = todo.acceptance_criteria;
            if (todo.delegated_to) cleanTodo.delegated_to = todo.delegated_to;
            if (todo.context) cleanTodo.context = todo.context;
            if (todo.delegate_session_id)
              cleanTodo.delegate_session_id = todo.delegate_session_id;
            if (todo.result_summary)
              cleanTodo.result_summary = todo.result_summary;

            const grounding = args.grounding?.find((g) => g.id === todo.id);
            const evidence = args.grounding_evidence?.find(
              (e) => e.id === todo.id
            );

            if (grounding) {
              cleanTodo.grounding = {
                strategy: grounding.strategy,
              };
              if (grounding.overlay_hints) {
                cleanTodo.grounding.overlay_hints = grounding.overlay_hints;
              }
              if (grounding.query_hints) {
                cleanTodo.grounding.query_hints = grounding.query_hints;
              }
              if (
                grounding.evidence_required !== null &&
                grounding.evidence_required !== undefined
              ) {
                cleanTodo.grounding.evidence_required =
                  grounding.evidence_required;
              }
            }

            if (evidence) {
              const cleanEvidence: NonNullable<
                Parameters<
                  typeof executeSigmaTaskUpdate
                >[0][number]['grounding_evidence']
              > = {
                queries_executed: evidence.queries_executed,
                overlays_consulted: evidence.overlays_consulted,
                citations: evidence.citations,
                grounding_confidence: evidence.grounding_confidence,
              };
              if (evidence.overlay_warnings !== undefined) {
                cleanEvidence.overlay_warnings = evidence.overlay_warnings;
              }
              cleanTodo.grounding_evidence = cleanEvidence;
            }

            return cleanTodo;
          }),
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
