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
import type { ConversationOverlayRegistry } from '../../sigma/conversation-registry.js';
import { queryConversationLattice } from '../../sigma/query-conversation.js';
import { WorkbenchClient } from '../../core/executors/workbench-client.js';
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
    'Read file contents. EFFICIENCY TIP: Use glob/grep first to find files, use limit/offset for large files. Do NOT re-read files you just edited.',
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
 * Get all ADK tools for Cognition
 *
 * Tool safety/confirmation is handled via onCanUseTool callback (matching Claude's behavior).
 * Each tool is wrapped to call onCanUseTool before execution.
 *
 * @param conversationRegistry - Optional conversation registry for recall tool
 * @param workbenchUrl - Optional workbench URL for recall tool
 * @param onCanUseTool - Optional permission callback (from AgentRequest)
 */
export function getCognitionTools(
  conversationRegistry?: ConversationOverlayRegistry,
  workbenchUrl?: string,
  onCanUseTool?: OnCanUseTool
) {
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

  // Add recall tool if conversation registry is available
  if (conversationRegistry) {
    const recallTool = createRecallTool(conversationRegistry, workbenchUrl);
    return [...baseTools, recallTool];
  }

  return baseTools;
}
