/**
 * Centralized Tool Definitions
 *
 * This file serves as the single source of truth for all tools available to LLM agents.
 * It defines the schema, metadata, and the common execution interface.
 */

import { z } from 'zod';

/**
 * Common tool metadata and schema definition
 */
export interface ToolDefinition<T extends z.ZodObject<z.ZodRawShape>> {
  name: string;
  description: string;
  parameters: T;
}

/**
 * read_file tool definition
 */
export const ReadFileSchema = z.object({
  file_path: z.string().describe('Absolute path to the file to read'),
  limit: z.coerce
    .number()
    .optional()
    .describe('Max lines to read (use for large files!)'),
  offset: z.coerce.number().optional().describe('Line offset to start from'),
});

export const readFileTool: ToolDefinition<typeof ReadFileSchema> = {
  name: 'read_file',
  description:
    'Reads a file, prioritizing partial reads. STANDARD WORKFLOW: 1. Use `grep` to find relevant line numbers. 2. Use this tool with `offset` and `limit` to read that specific section. Avoid reading whole files.',
  parameters: ReadFileSchema,
};

/**
 * write_file tool definition
 */
export const WriteFileSchema = z.object({
  file_path: z.string().describe('Absolute path to write to'),
  content: z.string().describe('Content to write'),
});

export const writeFileTool: ToolDefinition<typeof WriteFileSchema> = {
  name: 'write_file',
  description: 'Write content to a file at the given path',
  parameters: WriteFileSchema,
};

/**
 * bash tool definition
 */
export const BashSchema = z.object({
  command: z.string().describe('The command to execute'),
  cwd: z
    .string()
    .optional()
    .describe('Working directory to run the command in'),
  timeout: z.coerce
    .number()
    .optional()
    .describe('Timeout in ms (default 120000)'),
});

export const bashTool: ToolDefinition<typeof BashSchema> = {
  name: 'bash',
  description:
    'Execute shell commands in bash. REQUIRED for: git (status/diff/add/commit/push), npm/yarn (install/build/test), system commands (grep/ls/cd/mkdir/mv/cp), package managers, build tools. IMPORTANT: Always use this tool for ANY terminal/shell command - do not attempt to execute commands without it. EFFICIENCY TIP: Pipe to head/tail for large outputs.',
  parameters: BashSchema,
};

/**
 * glob tool definition
 */
export const GlobSchema = z.object({
  pattern: z.string().describe('Glob pattern (e.g., "**/*.ts")'),
  path: z.string().optional().describe('Directory to search in'),
  exclude: z
    .string()
    .optional()
    .describe('Glob pattern to exclude (e.g., "**/node_modules/**")'),
});

export const globTool: ToolDefinition<typeof GlobSchema> = {
  name: 'glob',
  description:
    'Find files matching a glob pattern. EFFICIENCY TIP: Use this BEFORE read_file to find the right files first.',
  parameters: GlobSchema,
};

/**
 * grep tool definition
 */
export const GrepSchema = z.object({
  pattern: z.string().describe('Regex pattern to search'),
  path: z.string().optional().describe('Path to search in'),
  glob_filter: z
    .string()
    .optional()
    .describe('File glob filter (e.g., "*.ts")'),
  is_literal: z
    .boolean()
    .optional()
    .describe('Search for literal string instead of regex'),
});

export const grepTool: ToolDefinition<typeof GrepSchema> = {
  name: 'grep',
  description:
    'Search for pattern in files using ripgrep. EFFICIENCY TIP: Use this BEFORE read_file to find exactly what you need.',
  parameters: GrepSchema,
};

/**
 * edit_file tool definition
 */
export const EditFileSchema = z.object({
  file_path: z.string().describe('Absolute path to the file'),
  old_string: z.string().describe('Text to replace'),
  new_string: z.string().describe('Replacement text'),
  is_regex: z
    .boolean()
    .optional()
    .describe('Whether old_string should be treated as a regex'),
  replace_all: z.coerce
    .boolean()
    .optional()
    .describe('Replace all occurrences'),
});

export const editFileTool: ToolDefinition<typeof EditFileSchema> = {
  name: 'edit_file',
  description: 'Replace text in a file (old_string must be unique)',
  parameters: EditFileSchema,
};

/**
 * fetch_url tool definition
 */
export const FetchUrlSchema = z.object({
  url: z.string().url().describe('The URL to fetch content from'),
});

export const fetchUrlTool: ToolDefinition<typeof FetchUrlSchema> = {
  name: 'fetch_url',
  description:
    'Fetch content from a URL to read documentation, APIs, or external resources. Returns text content with basic HTML stripping.',
  parameters: FetchUrlSchema,
};

/**
 * WebSearch tool definition
 */
export const WebSearchSchema = z.object({
  request: z.string().describe('The search query or request'),
  max_results: z.coerce
    .number()
    .optional()
    .describe('Maximum number of results to return (default: 10)'),
});

export const webSearchTool: ToolDefinition<typeof WebSearchSchema> = {
  name: 'WebSearch',
  description:
    'Search the web for current information, news, facts, and real-time data using Google Search',
  parameters: WebSearchSchema,
};

/**
 * recall_past_conversation tool definition
 */
export const RecallPastConversationSchema = z.object({
  query: z
    .string()
    .describe(
      'What to search for in past conversation (e.g., "What did we discuss about TUI scrolling?" or "What were the goals mentioned?")'
    ),
});

export const recallPastConversationTool: ToolDefinition<
  typeof RecallPastConversationSchema
> = {
  name: 'recall_past_conversation',
  description:
    'Retrieve FULL untruncated messages from conversation history. The recap you see is truncated to 256 chars - when you see "..." it means more content is available. Use this tool to get complete details. Searches all 7 overlays (O1-O7) in LanceDB with semantic search. Ask about topics, not exact phrases.',
  parameters: RecallPastConversationSchema,
};

/**
 * get_background_tasks tool definition
 */
export const GetBackgroundTasksSchema = z.object({
  filter: z
    .enum(['all', 'active', 'completed', 'failed'])
    .optional()
    .describe(
      'Filter tasks by status: "all" (default) for everything, "active" for running/pending, "completed" for finished, "failed" for errors'
    ),
});

export const getBackgroundTasksTool: ToolDefinition<
  typeof GetBackgroundTasksSchema
> = {
  name: 'get_background_tasks',
  description:
    'Query status of background operations (genesis, overlay generation). Use this to check if work is in progress, view progress percentage, or see completed/failed tasks.',
  parameters: GetBackgroundTasksSchema,
};

/**
 * SigmaTaskUpdate tool definition
 */
export const SigmaTaskUpdateSchema = z.object({
  todos: z
    .array(
      z.object({
        id: z
          .string()
          .describe(
            'Unique stable identifier for this task (use nanoid, UUID, or semantic slug like "fix-ruff-api")'
          ),
        content: z
          .string()
          .nullable()
          .optional()
          .describe(
            'The imperative form describing what needs to be done (e.g., "Run tests", "Build the project")'
          ),
        activeForm: z
          .string()
          .nullable()
          .optional()
          .describe(
            'The present continuous form shown during execution (e.g., "Running tests", "Building the project")'
          ),
        status: z
          .enum(['pending', 'in_progress', 'completed', 'delegated'])
          .describe(
            'Task status. Use "delegated" when assigning task to another agent via IPC'
          ),
        result_summary: z
          .string()
          .min(15)
          .nullable()
          .optional()
          .describe(
            "REQUIRED when status is 'completed'. A concise summary of the essential findings, code changes, or decisions made during this task. This summary will survive log eviction."
          ),
        delegated_to: z
          .string()
          .nullable()
          .optional()
          .describe(
            'Agent ID this task was delegated to (e.g., "flash1"). Set when status is "delegated".'
          ),
        context: z
          .string()
          .nullable()
          .optional()
          .describe(
            'Additional context for delegated worker (e.g., "Refactoring auth system - keep OAuth flow intact")'
          ),
        delegate_session_id: z
          .string()
          .nullable()
          .optional()
          .describe("Worker's session ID (for audit trail)"),
      })
    )
    .describe('The updated task list'),
  grounding: z
    .array(
      z.object({
        id: z.string(),
        strategy: z
          .enum(['pgc_first', 'pgc_verify', 'pgc_cite', 'none'])
          .nullable()
          .optional()
          .describe('Grounding strategy to use'),
        overlay_hints: z
          .array(z.string())
          .nullable()
          .optional()
          .describe('Hints for overlay selection'),
        query_hints: z
          .array(z.string())
          .nullable()
          .optional()
          .describe('Hints for semantic search queries'),
        evidence_required: z
          .union([z.boolean(), z.string()])
          .nullable()
          .optional()
          .describe('Whether evidence (citations) is required'),
      })
    )
    .nullable()
    .optional()
    .describe('Grounding strategy and hints for tasks (correlate via id)'),
  grounding_evidence: z
    .array(
      z.object({
        id: z.string(),
        queries_executed: z.array(z.string()).nullable().optional(),
        overlays_consulted: z.array(z.string()).nullable().optional(),
        citations: z
          .array(
            z.object({
              overlay: z.string(),
              content: z.string(),
              relevance: z.string(),
              file_path: z.string().nullable().optional(),
            })
          )
          .nullable()
          .optional(),
        grounding_confidence: z
          .enum(['high', 'medium', 'low'])
          .nullable()
          .optional(),
        overlay_warnings: z.array(z.string()).nullable().optional(),
      })
    )
    .nullable()
    .optional()
    .describe('Structured evidence returned by worker (correlate via id)'),
});

export const sigmaTaskUpdateTool: ToolDefinition<typeof SigmaTaskUpdateSchema> =
  {
    name: 'SigmaTaskUpdate',
    description:
      'Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.',
    parameters: SigmaTaskUpdateSchema,
  };

/**
 * list_agents tool definition
 */
export const ListAgentsSchema = z.object({});

export const listAgentsTool: ToolDefinition<typeof ListAgentsSchema> = {
  name: 'list_agents',
  description:
    'List all active agents in the IPC bus. Returns agent aliases, models, and status. Use this to discover other agents before sending messages.',
  parameters: ListAgentsSchema,
};

/**
 * send_agent_message tool definition
 */
export const SendAgentMessageSchema = z.object({
  to: z
    .string()
    .describe('Target agent alias (e.g., "opus1", "sonnet2") or full agent ID'),
  message: z.string().describe('The message content to send'),
});

export const sendAgentMessageTool: ToolDefinition<
  typeof SendAgentMessageSchema
> = {
  name: 'send_agent_message',
  description:
    'Send a message to another agent. The recipient will see it in their pending messages. Use list_agents first to discover available agents.',
  parameters: SendAgentMessageSchema,
};

/**
 * broadcast_agent_message tool definition
 */
export const BroadcastAgentMessageSchema = z.object({
  message: z.string().describe('The message content to broadcast'),
});

export const broadcastAgentMessageTool: ToolDefinition<
  typeof BroadcastAgentMessageSchema
> = {
  name: 'broadcast_agent_message',
  description:
    'Broadcast a message to ALL active agents. Use sparingly - prefer send_agent_message for targeted communication.',
  parameters: BroadcastAgentMessageSchema,
};

/**
 * list_pending_messages tool definition
 */
export const ListPendingMessagesSchema = z.object({
  filter: z
    .enum(['pending', 'read', 'all'])
    .optional()
    .describe('Filter messages by status (default: "pending")'),
});

export const listPendingMessagesTool: ToolDefinition<
  typeof ListPendingMessagesSchema
> = {
  name: 'list_pending_messages',
  description:
    'List messages received from other agents. Use this to check for replies or new requests.',
  parameters: ListPendingMessagesSchema,
};

/**
 * mark_message_read tool definition
 */
export const MarkMessageReadSchema = z.object({
  messageId: z.string().describe('The ID of the message to mark as read'),
  status: z
    .enum(['read', 'injected', 'dismissed'])
    .optional()
    .describe(
      'New status: "injected" (default/processed), "read" (seen), or "dismissed" (ignored)'
    ),
});

export const markMessageReadTool: ToolDefinition<typeof MarkMessageReadSchema> =
  {
    name: 'mark_message_read',
    description:
      'Mark a pending message as read/processed. Use this after you have handled a message from another agent.',
    parameters: MarkMessageReadSchema,
  };

/**
 * query_agent tool definition
 */
export const QueryAgentSchema = z.object({
  agentId: z
    .string()
    .describe('Target agent alias (e.g., "opus1", "sonnet2") or full agent ID'),
  query: z.string().describe('The question or task to ask the target agent'),
});

export const queryAgentTool: ToolDefinition<typeof QueryAgentSchema> = {
  name: 'query_agent',
  description:
    'Send a question to another agent and wait for a response. Synchronous communication pattern.',
  parameters: QueryAgentSchema,
};
