/**
 * OpenAI Agent SDK Tool Definitions for Cognition
 *
 * Maps Cognition tools to @openai/agents tool() format.
 * Mirrors gemini-adk-tools.ts but uses OpenAI's tool() function.
 *
 * TOOL PARITY:
 * - Core: read_file, write_file, glob, grep, bash, edit_file
 * - Memory: recall_past_conversation
 * - Background: get_background_tasks
 * - IPC: list_agents, send_agent_message, broadcast_agent_message,
 *        list_pending_messages, mark_message_read
 */

import { tool } from '@openai/agents';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { glob } from 'glob';
import type { MessagePublisher } from '../../ipc/MessagePublisher.js';
import type { MessageQueue } from '../../ipc/MessageQueue.js';
import {
  formatListAgents,
  formatMessageSent,
  formatBroadcastSent,
  formatPendingMessages,
  formatMessageMarked,
  formatMessageContent,
  formatError,
  formatNotInitialized,
  formatNotFound,
} from '../../ipc/agent-messaging-formatters.js';
import { getActiveAgents, resolveAgentId } from '../../ipc/agent-discovery.js';
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
 * OpenAI tool type (return type of tool())
 */
type OpenAITool = ReturnType<typeof tool>;

/**
 * Maximum characters for tool output before truncation.
 */
const MAX_TOOL_OUTPUT_CHARS = 50000;

/**
 * Threshold for eGemma summarization (chars).
 */
const EGEMMA_SUMMARIZE_THRESHOLD = 50000;

/**
 * Absolute max size for tool output before it's truncated without summarization.
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
 * Truncate output if it exceeds max length
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

  // Tier 3: Catastrophically large outputs - truncate THEN summarize
  // Don't just truncate and return - still summarize the truncated content!
  let contentToSummarize = output;
  let wasTruncated = false;
  if (output.length > PRE_TRUNCATE_THRESHOLD) {
    contentToSummarize = output.substring(0, EGEMMA_SUMMARIZE_THRESHOLD);
    wasTruncated = true;
  }

  // Tier 2: Medium outputs are suitable for intelligent summarization.
  if (workbenchAvailable === null) {
    try {
      const client = getWorkbenchClient(workbenchUrl);
      await client.health();
      workbenchAvailable = true;
    } catch {
      workbenchAvailable = false;
    }
  }

  if (!workbenchAvailable) {
    return truncateOutput(contentToSummarize, maxChars);
  }

  try {
    const client = getWorkbenchClient(workbenchUrl);
    const truncationNote = wasTruncated
      ? `\n[NOTE: Original output was ${output.length} chars, truncated to ${contentToSummarize.length} before summarization]`
      : '';
    const response = await client.summarize({
      content: `Tool: ${toolType}\nOutput length: ${output.length} chars${truncationNote}\n\n${contentToSummarize}`,
      filename: `tool_output.${toolType}`,
      persona: PERSONA_TOOL_OUTPUT_SUMMARIZER,
      max_tokens: DEFAULT_SUMMARIZER_MAX_TOKENS,
      temperature: 0.1,
      model_name: DEFAULT_SUMMARIZER_MODEL_NAME,
    });

    const prefix = wasTruncated
      ? `[eGemma Summary - ${output.length} chars (truncated+summarized)]`
      : `[eGemma Summary - ${output.length} chars compressed]`;
    return `${prefix}\n\n${response.summary}`;
  } catch {
    return truncateOutput(contentToSummarize, maxChars);
  }
}

/**
 * Create a tool executor wrapped with permission check
 */
function withPermissionCheck<T>(
  toolName: string,
  originalExecute: (input: T) => Promise<string>,
  onCanUseTool?: OnCanUseTool
): (input: T) => Promise<string> {
  if (!onCanUseTool) {
    return originalExecute;
  }

  return async (input: T) => {
    const decision = await onCanUseTool(toolName, input);

    if (decision.behavior === 'deny') {
      return 'User declined this action. Please continue with alternative approaches without asking why.';
    }

    const finalInput = (decision.updatedInput ?? input) as T;
    return originalExecute(finalInput);
  };
}

// ============================================================
// Core File Tools
// ============================================================

/**
 * Create read_file tool
 */
function createReadFileTool(cwd: string, workbenchUrl?: string): OpenAITool {
  return tool({
    name: 'read_file',
    description:
      'Reads a file, prioritizing partial reads. STANDARD WORKFLOW: 1. Use `grep` to find relevant line numbers. 2. Use this tool with `offset` and `limit` to read that specific section.',
    parameters: z.object({
      file_path: z.string().describe('Absolute path to the file to read'),
      limit: z.number().optional().describe('Max lines to read'),
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

        return await smartCompressOutput(
          result,
          'read_file',
          undefined,
          workbenchUrl
        );
      } catch (error) {
        return `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
}

/**
 * Create write_file tool
 */
function createWriteFileTool(onCanUseTool?: OnCanUseTool): OpenAITool {
  const execute = async ({
    file_path,
    content,
  }: {
    file_path: string;
    content: string;
  }) => {
    try {
      await fs.mkdir(path.dirname(file_path), { recursive: true });
      await fs.writeFile(file_path, content, 'utf-8');
      return `Successfully wrote ${content.length} bytes to ${file_path}`;
    } catch (error) {
      return `Error writing file: ${error instanceof Error ? error.message : String(error)}`;
    }
  };

  return tool({
    name: 'write_file',
    description: 'Write content to a file at the given path',
    parameters: z.object({
      file_path: z.string().describe('Absolute path to write to'),
      content: z.string().describe('Content to write'),
    }),
    execute: withPermissionCheck('write_file', execute, onCanUseTool),
  });
}

/**
 * Create glob tool
 */
function createGlobTool(cwd: string): OpenAITool {
  return tool({
    name: 'glob',
    description:
      'Find files matching pattern. EFFICIENCY TIP: Use this BEFORE read_file to find the right files first.',
    parameters: z.object({
      pattern: z.string().describe('Glob pattern (e.g., "**/*.ts")'),
      search_cwd: z.string().optional().describe('Working directory'),
    }),
    execute: async ({ pattern, search_cwd }) => {
      try {
        const files = await glob(pattern, {
          cwd: search_cwd || cwd,
          nodir: true,
          absolute: true,
        });
        return files.slice(0, 100).join('\n') || 'No matches found';
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
}

/**
 * Create grep tool
 */
function createGrepTool(cwd: string, workbenchUrl?: string): OpenAITool {
  return tool({
    name: 'grep',
    description:
      'Search for pattern in files using ripgrep. EFFICIENCY TIP: Use this BEFORE read_file.',
    parameters: z.object({
      pattern: z.string().describe('Regex pattern to search'),
      search_path: z.string().optional().describe('Path to search in'),
      glob_filter: z.string().optional().describe('File glob filter'),
    }),
    execute: async ({ pattern, search_path, glob_filter }) => {
      return new Promise((resolve) => {
        const args = ['--color=never', '-n', pattern];
        if (glob_filter) args.push('--glob', glob_filter);
        args.push(search_path || cwd);

        const proc = spawn('rg', args, { cwd, timeout: 30000 });

        let output = '';
        proc.stdout.on('data', (data) => (output += data.toString()));
        proc.stderr.on('data', (data) => (output += data.toString()));
        proc.on('close', async () => {
          const compressed = await smartCompressOutput(
            output,
            'grep',
            15000,
            workbenchUrl
          );
          resolve(compressed || 'No matches');
        });
        proc.on('error', () => resolve('Error running grep'));
      });
    },
  });
}

/**
 * Create bash tool
 */
function createBashTool(
  cwd: string,
  workbenchUrl?: string,
  onCanUseTool?: OnCanUseTool
): OpenAITool {
  const execute = async ({
    command,
    timeout,
  }: {
    command: string;
    timeout?: number;
  }) => {
    const effectiveTimeout = timeout || 120000;

    return new Promise<string>((resolve) => {
      // Don't use spawn's timeout option - broken on macOS
      // Use manual setTimeout instead
      const proc = spawn('bash', ['-c', command], { cwd });

      let stdout = '';
      let stderr = '';
      let killed = false;

      // Manual timeout handling
      const timeoutId = setTimeout(() => {
        killed = true;
        proc.kill('SIGTERM');
      }, effectiveTimeout);

      proc.stdout.on('data', (data) => (stdout += data.toString()));
      proc.stderr.on('data', (data) => (stderr += data.toString()));
      proc.on('close', async (code) => {
        clearTimeout(timeoutId);
        const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '');
        const compressed = await smartCompressOutput(
          output,
          'bash',
          30000,
          workbenchUrl
        );
        if (killed) {
          resolve(`Timeout after ${effectiveTimeout}ms\n${compressed}`);
        } else {
          resolve(`Exit code: ${code}\n${compressed}`);
        }
      });
      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        resolve(`Error: ${err.message}`);
      });
    });
  };

  return tool({
    name: 'bash',
    description:
      'Execute bash command (git, npm, etc.). EFFICIENCY TIP: Pipe to head/tail for large outputs.',
    parameters: z.object({
      command: z.string().describe('The command to execute'),
      timeout: z.number().optional().describe('Timeout in ms (default 120000)'),
    }),
    execute: withPermissionCheck('bash', execute, onCanUseTool),
  });
}

/**
 * Create edit_file tool
 */
function createEditFileTool(onCanUseTool?: OnCanUseTool): OpenAITool {
  interface EditInput {
    file_path: string;
    old_string: string;
    new_string: string;
    replace_all?: boolean;
  }

  const execute = async ({
    file_path,
    old_string,
    new_string,
    replace_all,
  }: EditInput) => {
    try {
      const content = await fs.readFile(file_path, 'utf-8');
      const escapedPattern = old_string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const count = (content.match(new RegExp(escapedPattern, 'g')) || [])
        .length;

      if (count === 0) {
        return 'Error: old_string not found in file';
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
  };

  return tool({
    name: 'edit_file',
    description: 'Replace text in a file (old_string must be unique)',
    parameters: z.object({
      file_path: z.string().describe('Absolute path to the file'),
      old_string: z.string().describe('Text to replace'),
      new_string: z.string().describe('Replacement text'),
      replace_all: z.boolean().optional().describe('Replace all occurrences'),
    }),
    execute: withPermissionCheck('edit_file', execute, onCanUseTool),
  });
}

// ============================================================
// Web Tools (fetch_url, web_search)
// ============================================================

/**
 * Create fetch_url tool
 *
 * Fetches content from URLs - useful for reading documentation,
 * APIs, or external resources.
 */
function createFetchUrlTool(): OpenAITool {
  return tool({
    name: 'fetch_url',
    description:
      'Fetch content from a URL to read documentation, APIs, or external resources. Returns text content with basic HTML stripping.',
    parameters: z.object({
      url: z.string().url().describe('The URL to fetch content from'),
    }),
    execute: async ({ url }) => {
      try {
        // Basic URL validation
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          return 'Error: URL must start with http:// or https://';
        }

        // Use native fetch (Node 18+)
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Cognition-CLI/1.0',
            Accept: 'text/html,application/json,text/plain,*/*',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (!response.ok) {
          return `Error: HTTP ${response.status} ${response.statusText}`;
        }

        const contentType = response.headers.get('content-type') || '';
        let text = await response.text();

        // Handle JSON
        if (contentType.includes('application/json')) {
          try {
            const json = JSON.parse(text);
            text = JSON.stringify(json, null, 2);
          } catch {
            // Keep raw text if parse fails
          }
        }
        // Basic HTML stripping
        else if (contentType.includes('text/html')) {
          // Remove script/style tags
          text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gim, '');
          text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gim, '');
          // Remove HTML tags
          text = text.replace(/<[^>]+>/g, ' ');
          // Collapse whitespace
          text = text.replace(/\s+/g, ' ').trim();
        }

        // Truncate if too large (100K chars for OpenAI context)
        const MAX_LENGTH = 100000;
        if (text.length > MAX_LENGTH) {
          text =
            text.substring(0, MAX_LENGTH) +
            `\n\n[Truncated - total length: ${text.length} chars]`;
        }

        return text;
      } catch (error) {
        return `Error fetching URL: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
}

/**
 * Create web_search tool
 *
 * Uses the workbench/eGemma web search endpoint to search the web.
 * Falls back to an informative message if workbench is unavailable.
 */
function createWebSearchTool(workbenchUrl?: string): OpenAITool {
  return tool({
    name: 'WebSearch',
    description:
      'Search the web for information. Use this for current events, documentation, or any information beyond your knowledge cutoff. Returns search results with titles, URLs, and snippets.',
    parameters: z.object({
      query: z.string().describe('The search query'),
    }),
    execute: async ({ query }) => {
      try {
        const baseUrl =
          workbenchUrl || process.env.WORKBENCH_URL || 'http://localhost:8000';

        // Try the workbench web search endpoint
        const response = await fetch(`${baseUrl}/v1/web/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY || 'dummy'}`,
          },
          body: JSON.stringify({ query, max_results: 5 }),
          signal: AbortSignal.timeout(15000), // 15s timeout
        });

        if (!response.ok) {
          // Workbench doesn't have web search endpoint
          if (response.status === 404) {
            return `Web search is not available through the current workbench. You can use fetch_url if you have a specific URL to check, or ask the user for more context.`;
          }
          return `Error: Web search failed with status ${response.status}`;
        }

        const results = (await response.json()) as {
          results?: Array<{
            title: string;
            url: string;
            snippet: string;
          }>;
        };

        if (!results.results || results.results.length === 0) {
          return `No results found for query: "${query}"`;
        }

        // Format results
        const formatted = results.results
          .map(
            (r, i) =>
              `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet || 'No snippet available'}`
          )
          .join('\n\n');

        return `Search results for "${query}":\n\n${formatted}`;
      } catch (error) {
        // Handle timeout or network errors gracefully
        if (
          error instanceof Error &&
          (error.name === 'TimeoutError' || error.name === 'AbortError')
        ) {
          return `Web search timed out. Try a more specific query or use fetch_url with a direct URL.`;
        }
        return `Web search unavailable: ${error instanceof Error ? error.message : String(error)}. Use fetch_url with a specific URL instead.`;
      }
    },
  });
}

// ============================================================
// Memory Tool (recall_past_conversation)
// ============================================================

/**
 * Create recall_past_conversation tool
 */
function createRecallTool(
  conversationRegistry: ConversationOverlayRegistry,
  workbenchUrl?: string
): OpenAITool {
  return tool({
    name: 'recall_past_conversation',
    description:
      'Retrieve FULL untruncated messages from conversation history. The recap you see is truncated - when you see "..." it means more content is available. Use this tool to get complete details. Searches all 7 overlays (O1-O7) in LanceDB with semantic search.',
    parameters: z.object({
      query: z.string().describe('What to search for in past conversation'),
    }),
    execute: async ({ query }) => {
      try {
        const answer = await queryConversationLattice(
          query,
          conversationRegistry,
          {
            workbenchUrl,
            topK: 10,
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

// ============================================================
// Background Tasks Tool
// ============================================================

/**
 * Format task type for display
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
 * Format duration between two dates
 */
function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Create get_background_tasks tool
 */
function createBackgroundTasksTool(
  getTaskManager: () => BackgroundTaskManager | null
): OpenAITool {
  return tool({
    name: 'get_background_tasks',
    description:
      'Query status of background operations (genesis, overlay generation). Use this to check if work is in progress, view progress percentage, or see completed/failed tasks.',
    parameters: z.object({
      filter: z
        .enum(['all', 'active', 'completed', 'failed'])
        .optional()
        .describe('Filter tasks by status'),
    }),
    execute: async ({ filter: filterArg }) => {
      const filter = filterArg || 'all';
      try {
        const taskManager = getTaskManager();

        if (!taskManager) {
          return 'Background task manager not initialized. No background operations are running.';
        }

        const allTasks = taskManager.getAllTasks();

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

// ============================================================
// Agent Messaging Tools (IPC)
// ============================================================

/**
 * Create list_agents tool
 */
function createListAgentsTool(
  projectRoot: string,
  currentAgentId: string
): OpenAITool {
  return tool({
    name: 'list_agents',
    description:
      'List all active agents in the IPC bus. Returns agent aliases, models, and status. Use this to discover other agents before sending messages.',
    parameters: z.object({}),
    execute: async () => {
      try {
        const agents = getActiveAgents(projectRoot, currentAgentId);
        return formatListAgents(agents);
      } catch (err) {
        return formatError('list agents', (err as Error).message);
      }
    },
  });
}

/**
 * Create send_agent_message tool
 */
function createSendMessageTool(
  getMessagePublisher: () => MessagePublisher | null,
  projectRoot: string,
  onCanUseTool?: OnCanUseTool
): OpenAITool {
  const execute = async ({ to, message }: { to: string; message: string }) => {
    try {
      const publisher = getMessagePublisher();

      if (!publisher) {
        return formatNotInitialized('Message publisher');
      }

      const targetAgentId = resolveAgentId(projectRoot, to);

      if (!targetAgentId) {
        return formatNotFound('agent', to);
      }

      await publisher.sendMessage(targetAgentId, message);

      return formatMessageSent(to, targetAgentId, message);
    } catch (err) {
      return formatError('send message', (err as Error).message);
    }
  };

  return tool({
    name: 'send_agent_message',
    description:
      'Send a message to another agent. The recipient will see it in their pending messages. Use list_agents first to discover available agents.',
    parameters: z.object({
      to: z.string().describe('Target agent alias or full agent ID'),
      message: z.string().describe('The message content to send'),
    }),
    execute: withPermissionCheck('send_agent_message', execute, onCanUseTool),
  });
}

/**
 * Create broadcast_agent_message tool
 */
function createBroadcastTool(
  getMessagePublisher: () => MessagePublisher | null,
  projectRoot: string,
  currentAgentId: string,
  onCanUseTool?: OnCanUseTool
): OpenAITool {
  const execute = async ({ message }: { message: string }) => {
    try {
      const publisher = getMessagePublisher();

      if (!publisher) {
        return formatNotInitialized('Message publisher');
      }

      await publisher.broadcast('agent.message', {
        type: 'text',
        message,
      });

      const agents = getActiveAgents(projectRoot, currentAgentId);

      return formatBroadcastSent(agents.length, message);
    } catch (err) {
      return formatError('broadcast message', (err as Error).message);
    }
  };

  return tool({
    name: 'broadcast_agent_message',
    description:
      'Broadcast a message to ALL active agents. Use sparingly - prefer send_agent_message for targeted communication.',
    parameters: z.object({
      message: z.string().describe('The message content to broadcast'),
    }),
    execute: withPermissionCheck(
      'broadcast_agent_message',
      execute,
      onCanUseTool
    ),
  });
}

/**
 * Create list_pending_messages tool
 */
function createListPendingMessagesTool(
  getMessageQueue: () => MessageQueue | null
): OpenAITool {
  return tool({
    name: 'list_pending_messages',
    description:
      'List all pending messages in your message queue. These are messages from other agents that you have not yet processed.',
    parameters: z.object({}),
    execute: async () => {
      try {
        const queue = getMessageQueue();

        if (!queue) {
          return formatNotInitialized('Message queue');
        }

        const messages = await queue.getMessages('pending');

        return formatPendingMessages(messages);
      } catch (err) {
        return formatError('list pending messages', (err as Error).message);
      }
    },
  });
}

/**
 * Create mark_message_read tool
 */
function createMarkMessageReadTool(
  getMessageQueue: () => MessageQueue | null,
  onCanUseTool?: OnCanUseTool
): OpenAITool {
  interface MarkInput {
    messageId: string;
    status?: 'read' | 'injected' | 'dismissed';
  }

  const execute = async ({ messageId, status }: MarkInput) => {
    try {
      const queue = getMessageQueue();

      if (!queue) {
        return formatNotInitialized('Message queue');
      }

      const message = await queue.getMessage(messageId);

      if (!message) {
        return formatNotFound('Message', messageId);
      }

      const newStatus = status || 'injected';
      await queue.updateStatus(messageId, newStatus);

      return formatMessageMarked(
        messageId,
        newStatus,
        message.from,
        formatMessageContent(message)
      );
    } catch (err) {
      return formatError('mark message', (err as Error).message);
    }
  };

  return tool({
    name: 'mark_message_read',
    description:
      'Mark a pending message as read/processed. Use this after you have handled a message from another agent.',
    parameters: z.object({
      messageId: z.string().describe('The message ID to mark as read'),
      status: z
        .enum(['read', 'injected', 'dismissed'])
        .optional()
        .describe('New status (default: injected)'),
    }),
    execute: withPermissionCheck('mark_message_read', execute, onCanUseTool),
  });
}

// ============================================================
// Main Export: Build All Tools
// ============================================================

/**
 * Context for building OpenAI agent tools
 */
export interface OpenAIToolsContext {
  /** Working directory */
  cwd: string;
  /** Workbench URL for eGemma API */
  workbenchUrl?: string;
  /** Tool permission callback */
  onCanUseTool?: OnCanUseTool;
  /** Conversation registry for recall tool */
  conversationRegistry?: ConversationOverlayRegistry;
  /** Background task manager getter */
  getTaskManager?: () => BackgroundTaskManager | null;
  /** Message publisher getter */
  getMessagePublisher?: () => MessagePublisher | null;
  /** Message queue getter */
  getMessageQueue?: () => MessageQueue | null;
  /** Project root for agent discovery */
  projectRoot?: string;
  /** Current agent ID */
  agentId?: string;
}

/**
 * Get all OpenAI tools for Cognition
 *
 * Returns array of tools compatible with @openai/agents SDK.
 * Tool safety is handled via onCanUseTool callback.
 */
export function getOpenAITools(context: OpenAIToolsContext): OpenAITool[] {
  const {
    cwd,
    workbenchUrl,
    onCanUseTool,
    conversationRegistry,
    getTaskManager,
    getMessagePublisher,
    getMessageQueue,
    projectRoot,
    agentId,
  } = context;

  const tools: OpenAITool[] = [];

  // Core file tools (read-only - no permission check needed)
  tools.push(createReadFileTool(cwd, workbenchUrl));
  tools.push(createGlobTool(cwd));
  tools.push(createGrepTool(cwd, workbenchUrl));

  // Mutating tools (with permission check built-in)
  tools.push(createWriteFileTool(onCanUseTool));
  tools.push(createBashTool(cwd, workbenchUrl, onCanUseTool));
  tools.push(createEditFileTool(onCanUseTool));

  // Web tools (read-only)
  tools.push(createFetchUrlTool());
  tools.push(createWebSearchTool(workbenchUrl));

  // Add recall tool if conversation registry is available
  if (conversationRegistry) {
    tools.push(createRecallTool(conversationRegistry, workbenchUrl));
  }

  // Add background tasks tool if task manager is available
  if (getTaskManager) {
    tools.push(createBackgroundTasksTool(getTaskManager));
  }

  // Add agent messaging tools if IPC context is available
  if (getMessagePublisher && getMessageQueue && projectRoot && agentId) {
    // Read-only tools (no permission check)
    tools.push(createListAgentsTool(projectRoot, agentId));
    tools.push(createListPendingMessagesTool(getMessageQueue));

    // Mutating tools (with permission check)
    tools.push(
      createSendMessageTool(getMessagePublisher, projectRoot, onCanUseTool)
    );
    tools.push(
      createBroadcastTool(
        getMessagePublisher,
        projectRoot,
        agentId,
        onCanUseTool
      )
    );
    tools.push(createMarkMessageReadTool(getMessageQueue, onCanUseTool));
  }

  return tools;
}
