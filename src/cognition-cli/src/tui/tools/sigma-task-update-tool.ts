/**
 * SigmaTaskUpdate Tool (MCP Server for Claude)
 *
 * Provides task management with delegation support for Claude agents.
 * This replaces the native TodoWrite tool which lacks delegation capabilities.
 */

import { z } from 'zod';
import { executeSigmaTaskUpdate } from '../../llm/core/utils/tool-executors.js';
import { getSigmaTaskUpdateDescription } from '../../llm/core/utils/tool-helpers.js';
import { systemLog } from '../../utils/debug-logger.js';
import type { SigmaTask } from '../../sigma/session-state.js';

interface ToolArgs {
  todos?: {
    id: string;
    content: string;
    activeForm: string;
    status: 'pending' | 'in_progress' | 'completed' | 'delegated';
    acceptance_criteria?: string[];
    delegated_to?: string;
    context?: string;
    delegate_session_id?: string;
    result_summary?: string;
  }[];
  grounding?: {
    id: string;
    strategy: 'none' | 'pgc_first' | 'pgc_verify' | 'pgc_cite';
    overlay_hints?: ('O2' | 'O4' | 'O5' | 'O6' | 'O1' | 'O3' | 'O7')[];
    query_hints?: string[];
    evidence_required?: boolean;
  }[];
  grounding_evidence?: {
    id: string;
    queries_executed?: string[];
    overlays_consulted?: ('O2' | 'O4' | 'O5' | 'O6' | 'O1' | 'O3' | 'O7')[];
    citations?: {
      overlay: string;
      content: string;
      relevance: 'low' | 'medium' | 'high';
      file_path?: string;
    }[];
    grounding_confidence?: 'low' | 'medium' | 'high';
    overlay_warnings?: string[] | null;
  }[];
}

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
 * @param solo - Whether to run in solo mode (disables delegation/grounding properties)
 * @returns MCP server instance with SigmaTaskUpdate tool
 */
export function createSigmaTaskUpdateMcpServer(
  cwd: string,
  anchorId: string | undefined,
  claudeAgentSdk: ClaudeAgentSdk | undefined,
  solo: boolean = false
) {
  if (!claudeAgentSdk) {
    return undefined;
  }

  if (!anchorId) {
    systemLog(
      'tui',
      '[Sigma] SigmaTaskUpdate MCP server initialized without anchorId. Tasks will NOT be persisted.',
      {},
      'warn'
    );
  }

  const { tool, createSdkMcpServer } = claudeAgentSdk;

  const todoSchema: Record<string, z.ZodTypeAny> = {
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
      .enum(
        solo
          ? ['pending', 'in_progress', 'completed']
          : ['pending', 'in_progress', 'completed', 'delegated']
      )
      .describe(
        solo
          ? 'Task status.'
          : 'Task status. Use "delegated" when assigning task to another agent via IPC'
      ),
  };

  if (!solo) {
    // Delegation fields (Manager/Worker paradigm)
    todoSchema.acceptance_criteria = z
      .array(z.string())
      .optional()
      .describe(
        'Success criteria for task completion (e.g., ["Must pass \'npm test\'", "No breaking changes"]). Required when delegating.'
      );
    todoSchema.delegated_to = z
      .string()
      .optional()
      .describe(
        'Agent ID this task was delegated to (e.g., "flash1"). Set when status is "delegated".'
      );
    todoSchema.context = z
      .string()
      .optional()
      .describe(
        'Additional context for delegated worker (e.g., "Refactoring auth system - keep OAuth flow intact")'
      );
    todoSchema.delegate_session_id = z
      .string()
      .optional()
      .describe("Worker's session ID (for audit trail)");
    todoSchema.result_summary = z
      .string()
      .optional()
      .describe("Worker's completion report");
  }

  const parameters: Record<string, z.ZodTypeAny> = {
    todos: z.array(z.object(todoSchema)).describe('The updated task list'),
  };

  if (!solo) {
    parameters.grounding = z
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
      );

    parameters.grounding_evidence = z
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
      .describe('Structured evidence returned by worker (correlate via id)');
  }

  const sigmaTaskUpdateTool = tool(
    'SigmaTaskUpdate',
    getSigmaTaskUpdateDescription(solo ? 'solo' : 'full'),
    parameters,
    async (args: Record<string, unknown>) => {
      const typedArgs = args as unknown as ToolArgs;
      try {
        // Validate delegation requirements (moved from .refine() for cross-provider compatibility)
        for (const task of typedArgs.todos || []) {
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
          (typedArgs.todos || []).map((todo) => {
            const cleanTodo: Partial<SigmaTask> & { id: string } = {
              id: todo.id,
            };

            if (todo.content !== undefined && todo.content !== null)
              cleanTodo.content = todo.content;
            if (todo.status !== undefined && todo.status !== null)
              cleanTodo.status = todo.status as SigmaTask['status'];
            if (todo.activeForm !== undefined && todo.activeForm !== null)
              cleanTodo.activeForm = todo.activeForm;
            if (
              todo.result_summary !== undefined &&
              todo.result_summary !== null
            )
              cleanTodo.result_summary = todo.result_summary;

            if (todo.acceptance_criteria)
              cleanTodo.acceptance_criteria = todo.acceptance_criteria;
            if (todo.delegated_to) cleanTodo.delegated_to = todo.delegated_to;
            if (todo.context) cleanTodo.context = todo.context;
            if (todo.delegate_session_id)
              cleanTodo.delegate_session_id = todo.delegate_session_id;
            if (todo.result_summary)
              cleanTodo.result_summary = todo.result_summary;

            const grounding = typedArgs.grounding?.find(
              (g) => g.id === todo.id
            );
            const evidence = typedArgs.grounding_evidence?.find(
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
              const cleanEvidence: SigmaTask['grounding_evidence'] = {
                queries_executed: evidence.queries_executed || [],
                overlays_consulted: (evidence.overlays_consulted ||
                  []) as Array<'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'>,
                citations: (evidence.citations || []).map((c) => ({
                  overlay: c.overlay,
                  content: c.content,
                  relevance: c.relevance,
                  file_path: c.file_path,
                })),
                grounding_confidence: (evidence.grounding_confidence ||
                  'medium') as 'high' | 'medium' | 'low',
                overlay_warnings:
                  evidence.overlay_warnings === null
                    ? undefined
                    : evidence.overlay_warnings,
              };
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
