/**
 * ADK Tool Definitions for Gemini Agent Provider
 *
 * Maps Cognition tools to Google ADK FunctionTool format.
 */

import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { glob } from 'glob';
import type { MessagePublisher } from '../../ipc/MessagePublisher.js';
import type { MessageQueue, QueuedMessage } from '../../ipc/MessageQueue.js';
import * as fsSync from 'fs';
import * as pathMod from 'path';
import type { ConversationOverlayRegistry } from '../../sigma/conversation-registry.js';
import { queryConversationLattice } from '../../sigma/query-conversation.js';
import { WorkbenchClient } from '../../core/executors/workbench-client.js';
import type { BackgroundTaskManager } from '../../tui/services/BackgroundTaskManager.js';
import {
  PERSONA_TOOL_OUTPUT_SUMMARIZER,
  DEFAULT_SUMMARIZER_MODEL_NAME,
  DEFAULT_SUMMARIZER_MAX_TOKENS,
} from '../../config.js';

/**
 * Tool permission callback (from AgentRequest interface)
 */
type OnCanUseTool = (
  toolName: string,
  input: unknown
) => Promise<{ behavior: 'allow' | 'deny'; updatedInput?: unknown }>;

/**
 * Maximum characters for tool output before truncation.
 * Helps keep context window manageable and reduces token costs.
 */
const MAX_TOOL_OUTPUT_CHARS = 50000;

/**
 * Threshold for eGemma summarization (chars).
 * Only bash outputs larger than this will be summarized.
 * read_file/grep/glob are left untouched (agent needs raw content).
 */
const EGEMMA_SUMMARIZE_THRESHOLD = 50000;

/**
 * Absolute max size for tool output before it's truncated without summarization.
 * Prevents sending excessively large data (e.g., `ls -R` on a large repo)
 * to the summarizer model.
 */
const PRE_TRUNCATE_THRESHOLD = 250000;

/**
 * Workbench client for eGemma summarization (lazy initialized)
 */
let workbenchClient: WorkbenchClient | null = null;
let workbenchAvailable: boolean | null = null;

/**
 * Initialize workbench client for eGemma summarization
 */
function getWorkbenchClient(workbenchUrl?: string): WorkbenchClient {
  if (!workbenchClient) {
    workbenchClient = new WorkbenchClient(
      workbenchUrl || process.env.WORKBENCH_URL || 'http://localhost:8000'
    );
  }
  return workbenchClient;
}

/**
 * Truncate output if it exceeds max length (fallback when eGemma unavailable)
 */
function truncateOutput(
  output: string,
  maxChars: number = MAX_TOOL_OUTPUT_CHARS
): string {
  if (output.length <= maxChars) return output;
  const truncated = output.substring(0, maxChars);
  const lineCount = (output.match(/\n/g) || []).length;
  const truncatedLineCount = (truncated.match(/\n/g) || []).length;
  return `${truncated}\n\n... [TRUNCATED: showing ${truncatedLineCount} of ${lineCount} lines. Use limit/offset params for specific sections]`;
}

/**
 * Intelligently compress tool output using eGemma summarization.
 * Falls back to truncation if eGemma is unavailable.
 *
 * @param output - Raw tool output
 * @param toolType - Type of tool (bash, grep, read_file, glob) for context
 * @param maxChars - Maximum output characters
 * @param workbenchUrl - Optional workbench URL override
 */
async function smartCompressOutput(
  output: string,
  toolType: 'bash' | 'grep' | 'read_file' | 'glob',
  maxChars: number = MAX_TOOL_OUTPUT_CHARS,
  workbenchUrl?: string
): Promise<string> {
  // Tier 1: Small outputs pass through untouched.
  if (output.length <= EGEMMA_SUMMARIZE_THRESHOLD) {
    return output;
  }

  // Only summarize bash output - agent needs raw content for read_file/grep/glob
  if (toolType !== 'bash') {
    return truncateOutput(output, maxChars);
  }

  // Tier 3: Catastrophically large outputs are truncated immediately
  // without attempting to summarize. This protects the summarizer model.
  if (output.length > PRE_TRUNCATE_THRESHOLD) {
    const truncated = truncateOutput(output, EGEMMA_SUMMARIZE_THRESHOLD);
    return `[OUTPUT TOO LARGE FOR SUMMARIZATION: Truncated to ${EGEMMA_SUMMARIZE_THRESHOLD} of ${output.length} chars]\n\n${truncated}`;
  }

  // Tier 2: Medium outputs are suitable for intelligent summarization.
  // Check workbench availability (cached after first check)
  if (workbenchAvailable === null) {
    try {
      const client = getWorkbenchClient(workbenchUrl);
      await client.health();
      workbenchAvailable = true;
    } catch {
      workbenchAvailable = false;
    }
  }

  // Tier 4: Fallback to truncation if summarizer is unavailable or fails.
  if (!workbenchAvailable) {
    return truncateOutput(output, maxChars);
  }

  try {
    const client = getWorkbenchClient(workbenchUrl);
    const response = await client.summarize({
      content: `Tool: ${toolType}\nOutput length: ${output.length} chars\n\n${output}`,
      filename: `tool_output.${toolType}`,
      persona: PERSONA_TOOL_OUTPUT_SUMMARIZER,
      max_tokens: DEFAULT_SUMMARIZER_MAX_TOKENS,
      temperature: 0.1,
      model_name: DEFAULT_SUMMARIZER_MODEL_NAME,
    });

    return `[eGemma Summary - ${output.length} chars compressed]\n\n${response.summary}`;
  } catch {
    // Tier 4: Fallback to truncation on any summarization error.
    return truncateOutput(output, maxChars);
  }
}

/**
 * Read file tool - reads file contents
 */
export const readFileTool = new FunctionTool({
  name: 'read_file',
  description:
    'Reads a file, prioritizing partial reads. STANDARD WORKFLOW: 1. Use `grep` to find relevant line numbers. 2. Use this tool with `offset` and `limit` to read that specific section. Avoid reading whole files.',
  parameters: z.object({
    file_path: z.string().describe('Absolute path to the file to read'),
    limit: z
      .number()
      .optional()
      .describe('Max lines to read (use for large files!)'),
    offset: z.number().optional().describe('Line offset to start from'),
  }),
  execute: async ({ file_path, limit, offset }) => {
    try {
      const content = await fs.readFile(file_path, 'utf-8');
      const lines = content.split('\n');

      const start = offset || 0;
      const end = limit ? start + limit : lines.length;
      const sliced = lines.slice(start, end);

      const result = sliced
        .map((line, i) => `${String(start + i + 1).padStart(6)}│${line}`)
        .join('\n');

      return await smartCompressOutput(result, 'read_file');
    } catch (error) {
      return `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

/**
 * Write file tool - writes content to a file
 */
export const writeFileTool = new FunctionTool({
  name: 'write_file',
  description: 'Write content to a file at the given path',
  parameters: z.object({
    file_path: z.string().describe('Absolute path to write to'),
    content: z.string().describe('Content to write'),
  }),
  execute: async ({ file_path, content }) => {
    try {
      await fs.mkdir(path.dirname(file_path), { recursive: true });
      await fs.writeFile(file_path, content, 'utf-8');
      return `Successfully wrote ${content.length} bytes to ${file_path}`;
    } catch (error) {
      return `Error writing file: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

/**
 * Glob tool - find files matching a pattern
 */
export const globTool = new FunctionTool({
  name: 'glob',
  description:
    'Find files matching pattern. EFFICIENCY TIP: Use this BEFORE read_file to find the right files first.',
  parameters: z.object({
    pattern: z
      .string()
      .describe('Glob pattern (e.g., "**/*.ts", "src/**/*.py")'),
    cwd: z.string().optional().describe('Working directory'),
  }),
  execute: async ({ pattern, cwd }) => {
    try {
      const files = await glob(pattern, {
        cwd: cwd || process.cwd(),
        nodir: true,
        absolute: true,
      });
      return files.slice(0, 100).join('\n') || 'No matches found';
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

/**
 * Grep tool - search file contents
 */
export const grepTool = new FunctionTool({
  name: 'grep',
  description:
    'Search for pattern in files using ripgrep. EFFICIENCY TIP: Use this BEFORE read_file to find exactly what you need.',
  parameters: z.object({
    pattern: z.string().describe('Regex pattern to search'),
    path: z.string().optional().describe('Path to search in'),
    glob_filter: z
      .string()
      .optional()
      .describe('File glob filter (e.g., "*.ts")'),
  }),
  execute: async ({ pattern, path: searchPath, glob_filter }) => {
    return new Promise((resolve) => {
      const args = ['--color=never', '-n', pattern];
      if (glob_filter) args.push('--glob', glob_filter);
      args.push(searchPath || '.');

      const proc = spawn('rg', args, {
        cwd: process.cwd(),
        timeout: 30000,
      });

      let output = '';
      proc.stdout.on('data', (data) => (output += data.toString()));
      proc.stderr.on('data', (data) => (output += data.toString()));
      proc.on('close', async () => {
        const compressed = await smartCompressOutput(output, 'grep', 15000);
        resolve(compressed || 'No matches');
      });
      proc.on('error', () => resolve(`Error running grep`));
    });
  },
});

/**
 * Bash tool - execute shell commands
 */
export const bashTool = new FunctionTool({
  name: 'bash',
  description:
    'Execute bash command (git, npm, etc.). EFFICIENCY TIP: Pipe to head/tail for large outputs. Avoid verbose flags.',
  parameters: z.object({
    command: z.string().describe('The command to execute'),
    timeout: z.number().optional().describe('Timeout in ms (default 120000)'),
  }),
  execute: async ({ command, timeout }) => {
    return new Promise((resolve) => {
      const proc = spawn('bash', ['-c', command], {
        cwd: process.cwd(),
        timeout: timeout || 120000,
      });

      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (data) => (stdout += data.toString()));
      proc.stderr.on('data', (data) => (stderr += data.toString()));
      proc.on('close', async (code) => {
        const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '');
        const compressed = await smartCompressOutput(output, 'bash', 30000);
        resolve(`Exit code: ${code}\n${compressed}`);
      });
      proc.on('error', (err) => resolve(`Error: ${err.message}`));
    });
  },
});

/**
 * Edit tool - replace text in a file
 */
export const editFileTool = new FunctionTool({
  name: 'edit_file',
  description: 'Replace text in a file (old_string must be unique)',
  parameters: z.object({
    file_path: z.string().describe('Absolute path to the file'),
    old_string: z.string().describe('Text to replace'),
    new_string: z.string().describe('Replacement text'),
    replace_all: z.boolean().optional().describe('Replace all occurrences'),
  }),
  execute: async ({ file_path, old_string, new_string, replace_all }) => {
    try {
      const content = await fs.readFile(file_path, 'utf-8');
      const count = (
        content.match(
          new RegExp(old_string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
        ) || []
      ).length;

      if (count === 0) {
        return `Error: old_string not found in file`;
      }
      if (count > 1 && !replace_all) {
        return `Error: old_string found ${count} times. Use replace_all=true or make it unique.`;
      }

      const newContent = replace_all
        ? content.split(old_string).join(new_string)
        : content.replace(old_string, new_string);

      await fs.writeFile(file_path, newContent, 'utf-8');
      return `Successfully edited ${file_path}`;
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

/**
 * Create recall conversation tool for Gemini
 *
 * Provides semantic search across conversation history (O1-O7 overlays).
 * Similar to Claude's recall_past_conversation MCP tool.
 */
export function createRecallTool(
  conversationRegistry: ConversationOverlayRegistry,
  workbenchUrl?: string
): FunctionTool {
  return new FunctionTool({
    name: 'recall_past_conversation',
    description:
      'Retrieve FULL untruncated messages from conversation history. The recap you see is truncated to 150 chars - when you see "..." it means more content is available. Use this tool to get complete details. Searches all 7 overlays (O1-O7) in LanceDB with semantic search. Ask about topics, not exact phrases.',
    parameters: z.object({
      query: z
        .string()
        .describe(
          'What to search for in past conversation (e.g., "What did we discuss about TUI scrolling?" or "What were the goals mentioned?")'
        ),
    }),
    execute: async ({ query }) => {
      try {
        // Query conversation lattice with SLM + LLM synthesis
        const answer = await queryConversationLattice(
          query,
          conversationRegistry,
          {
            workbenchUrl,
            topK: 10, // Increased from 5 for better coverage
            verbose: false,
          }
        );

        return `Found relevant context:\n\n${answer}`;
      } catch (err) {
        return `Failed to recall conversation: ${(err as Error).message}`;
      }
    },
  });
}

/**
 * Create a safe wrapper for a tool that calls onCanUseTool before execution
 *
 * This bridges the gap between ADK (which doesn't have built-in permission checks)
 * and our TUI's confirmation system (which expects onCanUseTool to be called).
 *
 * We can't access FunctionTool's private properties, so we recreate each tool
 * with the permission check built in.
 *
 * @param name - Tool name
 * @param description - Tool description
 * @param parameters - Zod schema for input parameters
 * @param originalExecute - Original execute function
 * @param onCanUseTool - Optional permission callback
 * @returns Wrapped FunctionTool
 */
function wrapToolWithPermission<T extends z.ZodRawShape>(
  name: string,
  description: string,
  parameters: z.ZodObject<T>,
  originalExecute: (input: z.infer<z.ZodObject<T>>) => Promise<unknown>,
  onCanUseTool?: OnCanUseTool
): FunctionTool {
  if (!onCanUseTool) {
    // If no callback provided, return original tool
    return new FunctionTool({
      name,
      description,
      parameters,
      execute: originalExecute as (input: unknown) => Promise<unknown>,
    });
  }

  return new FunctionTool({
    name,
    description,
    parameters,
    execute: async (input: unknown) => {
      // Call permission callback
      const decision = await onCanUseTool(name, input);

      // If denied, return denial message
      if (decision.behavior === 'deny') {
        return `User declined this action. Please continue with alternative approaches without asking why.`;
      }

      // Execute with potentially updated input
      const finalInput = decision.updatedInput ?? input;
      return originalExecute(finalInput as z.infer<z.ZodObject<T>>);
    },
  });
}

/**
 * Create background tasks tool for Gemini
 *
 * Allows Gemini to query status of background operations (genesis, overlay generation).
 * Mirrors the functionality of the Claude MCP tool but as an ADK FunctionTool.
 */
function createBackgroundTasksTool(
  getTaskManager: () => BackgroundTaskManager | null
): FunctionTool {
  return new FunctionTool({
    name: 'get_background_tasks',
    description:
      'Query status of background operations (genesis, overlay generation). Use this to check if work is in progress, view progress percentage, or see completed/failed tasks.',
    parameters: z.object({
      filter: z
        .enum(['all', 'active', 'completed', 'failed'])
        .default('all')
        .describe(
          'Filter tasks by status: "all" for everything, "active" for running/pending, "completed" for finished, "failed" for errors'
        ),
    }),
    execute: async ({ filter }) => {
      try {
        const taskManager = getTaskManager();

        if (!taskManager) {
          return 'Background task manager not initialized. No background operations are running.';
        }

        const allTasks = taskManager.getAllTasks();

        // Filter tasks based on requested filter
        let filteredTasks;
        switch (filter) {
          case 'active':
            filteredTasks = allTasks.filter(
              (t) => t.status === 'running' || t.status === 'pending'
            );
            break;
          case 'completed':
            filteredTasks = allTasks.filter((t) => t.status === 'completed');
            break;
          case 'failed':
            filteredTasks = allTasks.filter(
              (t) => t.status === 'failed' || t.status === 'cancelled'
            );
            break;
          default:
            filteredTasks = allTasks;
        }

        const summary = taskManager.getSummary();
        const activeTask = taskManager.getActiveTask();

        // Format response for Gemini
        let text = '';

        if (activeTask) {
          const progress =
            activeTask.progress !== undefined
              ? ` (${Math.round(activeTask.progress)}%)`
              : '';
          text += `**Active Task**: ${formatTaskType(activeTask)}${progress}\n`;
          if (activeTask.message) {
            text += `  Status: ${activeTask.message}\n`;
          }
          text += '\n';
        } else {
          text += '**No active tasks** - all background operations idle.\n\n';
        }

        text += `**Summary**: ${summary.total} total tasks\n`;
        text += `  - Active: ${summary.active}\n`;
        text += `  - Completed: ${summary.completed}\n`;
        text += `  - Failed: ${summary.failed}\n`;
        text += `  - Cancelled: ${summary.cancelled}\n\n`;

        if (filteredTasks.length > 0 && filter !== 'all') {
          text += `**${filter.charAt(0).toUpperCase() + filter.slice(1)} Tasks** (${filteredTasks.length}):\n`;
          for (const task of filteredTasks) {
            const progress =
              task.progress !== undefined
                ? ` ${Math.round(task.progress)}%`
                : '';
            const duration = task.completedAt
              ? ` (${formatDuration(task.startedAt, task.completedAt)})`
              : '';
            text += `  - ${formatTaskType(task)}:${progress}${duration}\n`;
            if (task.error) {
              text += `    Error: ${task.error}\n`;
            }
          }
        }

        return text;
      } catch (err) {
        return `Failed to get background tasks: ${(err as Error).message}`;
      }
    },
  });
}

/**
 * Format task type for display (shared with background-tasks-tool.ts)
 */
function formatTaskType(task: { type: string; overlay?: string }): string {
  switch (task.type) {
    case 'genesis':
      return 'Genesis (code analysis)';
    case 'genesis-docs':
      return 'Document Ingestion';
    case 'overlay':
      return task.overlay
        ? `${task.overlay} Overlay Generation`
        : 'Overlay Generation';
    default:
      return 'Background Task';
  }
}

/**
 * Format duration between two dates (shared with background-tasks-tool.ts)
 */
function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

interface AgentInfo {
  agentId: string;
  model: string;
  alias?: string;
  startedAt: number;
  lastHeartbeat: number;
  status: 'active' | 'idle' | 'disconnected';
}

/**
 * Format message content for display
 */
function formatMessageContent(msg: QueuedMessage): string {
  if (
    typeof msg.content === 'object' &&
    msg.content !== null &&
    'message' in msg.content
  ) {
    return (msg.content as { message: string }).message;
  }
  return JSON.stringify(msg.content);
}

/**
 * Get list of active agents from message_queue directory
 */
function getActiveAgents(
  projectRoot: string,
  excludeAgentId: string
): AgentInfo[] {
  const queueDir = pathMod.join(projectRoot, '.sigma', 'message_queue');

  if (!fsSync.existsSync(queueDir)) {
    return [];
  }

  const agents: AgentInfo[] = [];
  const now = Date.now();
  const ACTIVE_THRESHOLD = 30000; // 30 seconds

  const entries = fsSync.readdirSync(queueDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const infoPath = pathMod.join(queueDir, entry.name, 'agent-info.json');
    if (!fsSync.existsSync(infoPath)) continue;

    try {
      const info: AgentInfo = JSON.parse(
        fsSync.readFileSync(infoPath, 'utf-8')
      );

      // Check if active (recent heartbeat) and not self
      const isActive =
        info.status === 'active' && now - info.lastHeartbeat < ACTIVE_THRESHOLD;

      // Exclude self (check both full ID and base ID)
      const isSelf =
        info.agentId === excludeAgentId ||
        excludeAgentId.startsWith(entry.name);

      if (isActive && !isSelf) {
        agents.push(info);
      }
    } catch {
      // Ignore parse errors
    }
  }

  return agents.sort((a, b) => (a.alias || '').localeCompare(b.alias || ''));
}

/**
 * Resolve alias or partial ID to full agent ID
 */
function resolveAgentId(projectRoot: string, aliasOrId: string): string | null {
  const queueDir = pathMod.join(projectRoot, '.sigma', 'message_queue');

  if (!fsSync.existsSync(queueDir)) {
    return null;
  }

  const entries = fsSync.readdirSync(queueDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const infoPath = pathMod.join(queueDir, entry.name, 'agent-info.json');
    if (!fsSync.existsSync(infoPath)) continue;

    try {
      const info: AgentInfo = JSON.parse(
        fsSync.readFileSync(infoPath, 'utf-8')
      );

      // Match by alias (case-insensitive)
      if (info.alias && info.alias.toLowerCase() === aliasOrId.toLowerCase()) {
        return info.agentId;
      }

      // Match by full agent ID
      if (info.agentId === aliasOrId) {
        return info.agentId;
      }

      // Match by directory name (partial ID)
      if (entry.name === aliasOrId) {
        return info.agentId;
      }
    } catch {
      // Ignore parse errors
    }
  }

  return null;
}

/**
 * Create agent messaging tools for Gemini
 *
 * Allows Gemini to discover other agents, send messages, and read pending messages.
 * Mirrors the functionality of the Claude MCP tool but as ADK FunctionTools.
 */
function createAgentMessagingTools(
  getMessagePublisher: (() => MessagePublisher | null) | undefined,
  getMessageQueue: (() => MessageQueue | null) | undefined,
  projectRoot: string,
  currentAgentId: string,
  onCanUseTool?: OnCanUseTool
): FunctionTool[] {
  const tools: FunctionTool[] = [];

  // Tool: List active agents
  const listAgentsTool = wrapToolWithPermission(
    'list_agents',
    'List all active agents in the IPC bus. Returns agent aliases, models, and status. Use this to discover other agents before sending messages.',
    z.object({}),
    async () => {
      try {
        const agents = getActiveAgents(projectRoot, currentAgentId);

        if (agents.length === 0) {
          return 'No other active agents found. You are the only agent currently running.';
        }

        let text = `**Active Agents (${agents.length})**\\n\\n`;
        text += '| Alias | Model | Agent ID |\\n';
        text += '|-------|-------|----------|\\n';

        for (const agent of agents) {
          text += `| ${agent.alias || 'unknown'} | ${agent.model} | ${agent.agentId} |\\n`;
        }

        text +=
          '\\n**Usage**: Use `send_agent_message` tool with the alias or agent ID to send a message.';

        return text;
      } catch (err) {
        return `Failed to list agents: ${(err as Error).message}`;
      }
    },
    onCanUseTool
  );
  tools.push(listAgentsTool);

  // Tool: Send message to agent
  const sendMessageTool = wrapToolWithPermission(
    'send_agent_message',
    'Send a message to another agent. The recipient will see it in their pending messages. Use list_agents first to discover available agents.',
    z.object({
      to: z
        .string()
        .describe(
          'Target agent alias (e.g., "opus1", "sonnet2") or full agent ID'
        ),
      message: z.string().describe('The message content to send'),
    }),
    async (args: { to: string; message: string }) => {
      try {
        const publisher = getMessagePublisher ? getMessagePublisher() : null;

        if (!publisher) {
          return 'Message publisher not initialized. IPC system may not be running.';
        }

        // Resolve alias to agent ID
        const targetAgentId = resolveAgentId(projectRoot, args.to);

        if (!targetAgentId) {
          return `Agent not found: "${args.to}". Use list_agents to see available agents.`;
        }

        // Send the message
        await publisher.sendMessage(targetAgentId, args.message);

        return `Message sent to ${args.to} (${targetAgentId}).\\n\\nContent: "${args.message}"`;
      } catch (err) {
        return `Failed to send message: ${(err as Error).message}`;
      }
    },
    onCanUseTool
  );
  tools.push(sendMessageTool);

  // Tool: Broadcast message to all agents
  const broadcastTool = wrapToolWithPermission(
    'broadcast_agent_message',
    'Broadcast a message to ALL active agents. Use sparingly - prefer send_agent_message for targeted communication.',
    z.object({
      message: z.string().describe('The message content to broadcast'),
    }),
    async (args: { message: string }) => {
      try {
        const publisher = getMessagePublisher ? getMessagePublisher() : null;

        if (!publisher) {
          return 'Message publisher not initialized. IPC system may not be running.';
        }

        // Broadcast to all agents
        await publisher.broadcast('agent.message', {
          type: 'text',
          message: args.message,
        });

        const agents = getActiveAgents(projectRoot, currentAgentId);

        return `Message broadcast to ${agents.length} agent(s).\\n\\nContent: "${args.message}"`;
      } catch (err) {
        return `Failed to broadcast message: ${(err as Error).message}`;
      }
    },
    onCanUseTool
  );
  tools.push(broadcastTool);

  // Tool: Get pending messages
  const getPendingMessagesTool = wrapToolWithPermission(
    'get_pending_messages',
    'Get all pending messages in your message queue. These are messages from other agents that you have not yet processed.',
    z.object({}),
    async () => {
      try {
        const queue = getMessageQueue ? getMessageQueue() : null;

        if (!queue) {
          return 'Message queue not initialized. IPC system may not be running.';
        }

        const messages = await queue.getMessages('pending');

        if (messages.length === 0) {
          return 'No pending messages. Your message queue is empty.';
        }

        let text = `**Pending Messages (${messages.length})**\\n\\n`;

        for (const msg of messages) {
          const date = new Date(msg.timestamp).toLocaleString();
          const contentText = formatMessageContent(msg);

          text += `---\\n\\n`;
          text += `**From**: \\\`${msg.from}\\\`\\n`;
          text += `**Topic**: \\\`${msg.topic}\\\`\\n`;
          text += `**Received**: ${date}\\n`;
          text += `**Message ID**: \\\`${msg.id}\\\`\\n\\n`;
          text += `${contentText}\\n\\n`;
        }

        text += `---\\n\\n`;
        text += `**Actions**: Use \\\`mark_message_read\\\` with a message ID to mark it as processed.`;

        return text;
      } catch (err) {
        return `Failed to get pending messages: ${(err as Error).message}`;
      }
    },
    onCanUseTool
  );
  tools.push(getPendingMessagesTool);

  // Tool: Mark message as read/injected
  const markMessageReadTool = wrapToolWithPermission(
    'mark_message_read',
    'Mark a pending message as read/processed. Use this after you have handled a message from another agent.',
    z.object({
      messageId: z.string().describe('The message ID to mark as read'),
      status: z
        .enum(['read', 'injected', 'dismissed'])
        .default('injected')
        .describe(
          'New status: "injected" (processed), "read" (seen), or "dismissed" (ignored)'
        ),
    }),
    async (args: {
      messageId: string;
      status?: 'read' | 'injected' | 'dismissed';
    }) => {
      try {
        const queue = getMessageQueue ? getMessageQueue() : null;

        if (!queue) {
          return 'Message queue not initialized. IPC system may not be running.';
        }

        const message = await queue.getMessage(args.messageId);

        if (!message) {
          return `Message not found: ${args.messageId}`;
        }

        const newStatus = args.status || 'injected';
        await queue.updateStatus(args.messageId, newStatus);

        return `Message ${args.messageId} marked as "${newStatus}".\\n\\nFrom: ${message.from}\\nContent: ${formatMessageContent(message)}`;
      } catch (err) {
        return `Failed to mark message: ${(err as Error).message}`;
      }
    },
    onCanUseTool
  );
  tools.push(markMessageReadTool);

  return tools;
}

/**
 * Get all ADK tools for Cognition
 *
 * Tool safety/confirmation is handled via onCanUseTool callback (matching Claude's behavior).
 * Each tool is wrapped to call onCanUseTool before execution.
 *
 * @param conversationRegistry - Optional conversation registry for recall tool
 * @param workbenchUrl - Optional workbench URL for recall tool
 * @param onCanUseTool - Optional permission callback (from AgentRequest)
 * @param getTaskManager - Optional getter for BackgroundTaskManager (for background tasks tool)
 * @param getMessagePublisher - Optional getter for MessagePublisher (for agent messaging tools)
 * @param getMessageQueue - Optional getter for MessageQueue (for agent messaging tools)
 * @param projectRoot - Current project root directory (for agent messaging tools)
 * @param currentAgentId - Current agent's ID (for agent messaging tools, to exclude self)
 */
export function getCognitionTools(
  conversationRegistry?: ConversationOverlayRegistry,
  workbenchUrl?: string,
  onCanUseTool?: OnCanUseTool,
  getTaskManager?: () => BackgroundTaskManager | null,
  getMessagePublisher?: () => MessagePublisher | null,
  getMessageQueue?: () => MessageQueue | null,
  projectRoot?: string,
  currentAgentId?: string
): FunctionTool[] {
  // Create write_file tool with permission check
  const safeWriteFile = wrapToolWithPermission(
    'write_file',
    'Write content to a file at the given path',
    z.object({
      file_path: z.string().describe('Absolute path to write to'),
      content: z.string().describe('Content to write'),
    }),
    async ({ file_path, content }) => {
      try {
        await fs.mkdir(path.dirname(file_path), { recursive: true });
        await fs.writeFile(file_path, content, 'utf-8');
        return `Successfully wrote ${content.length} bytes to ${file_path}`;
      } catch (error) {
        return `Error writing file: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
    onCanUseTool
  );

  // Create bash tool with permission check
  const safeBash = wrapToolWithPermission(
    'bash',
    'Execute a bash command (use for git, npm, etc.)',
    z.object({
      command: z.string().describe('The command to execute'),
      timeout: z.number().optional().describe('Timeout in ms (default 120000)'),
    }),
    async ({ command, timeout }) => {
      return new Promise((resolve) => {
        const proc = spawn('bash', ['-c', command], {
          cwd: process.cwd(),
          timeout: timeout || 120000,
        });

        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (data) => (stdout += data.toString()));
        proc.stderr.on('data', (data) => (stderr += data.toString()));
        proc.on('close', (code) => {
          const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '');
          resolve(
            `Exit code: ${code}\n${output.slice(0, 30000)}${output.length > 30000 ? '\n... truncated' : ''}`
          );
        });
        proc.on('error', (err) => resolve(`Error: ${err.message}`));
      });
    },
    onCanUseTool
  );

  // Create edit_file tool with permission check
  const safeEditFile = wrapToolWithPermission(
    'edit_file',
    'Replace text in a file (old_string must be unique)',
    z.object({
      file_path: z.string().describe('Absolute path to the file'),
      old_string: z.string().describe('Text to replace'),
      new_string: z.string().describe('Replacement text'),
      replace_all: z.boolean().optional().describe('Replace all occurrences'),
    }),
    async ({ file_path, old_string, new_string, replace_all }) => {
      try {
        const content = await fs.readFile(file_path, 'utf-8');
        const count = (
          content.match(
            new RegExp(old_string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
          ) || []
        ).length;

        if (count === 0) {
          return `Error: old_string not found in file`;
        }
        if (count > 1 && !replace_all) {
          return `Error: old_string found ${count} times. Use replace_all=true or make it unique.`;
        }

        const newContent = replace_all
          ? content.split(old_string).join(new_string)
          : content.replace(old_string, new_string);

        await fs.writeFile(file_path, newContent, 'utf-8');
        return `Successfully edited ${file_path}`;
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
    onCanUseTool
  );

  const baseTools = [
    readFileTool, // Read-only, no wrapping needed
    safeWriteFile,
    globTool, // Read-only, no wrapping needed
    grepTool, // Read-only, no wrapping needed
    safeBash,
    safeEditFile,
  ];

  // Build final tool list with optional tools
  const tools = [...baseTools];

  // Add recall tool if conversation registry is available
  if (conversationRegistry) {
    const recallTool = createRecallTool(conversationRegistry, workbenchUrl);
    tools.push(recallTool);
  }

  // Add background tasks tool if task manager is available
  if (getTaskManager) {
    const backgroundTasksTool = createBackgroundTasksTool(getTaskManager);
    tools.push(backgroundTasksTool);
  }

  // Add agent messaging tools if publisher/queue are available
  if (getMessagePublisher && getMessageQueue && projectRoot && currentAgentId) {
    const agentMessagingTools = createAgentMessagingTools(
      getMessagePublisher,
      getMessageQueue,
      projectRoot,
      currentAgentId,
      onCanUseTool
    );
    tools.push(...agentMessagingTools);
  }

  return tools;
}
