/**
 * Shared Tool Helpers
 *
 * Common utilities used by both OpenAI and Gemini tool implementations.
 * Extracted to reduce code duplication.
 */

import { WorkbenchClient } from '../../core/executors/workbench-client.js';
import {
  PERSONA_TOOL_OUTPUT_SUMMARIZER,
  DEFAULT_SUMMARIZER_MODEL_NAME,
  DEFAULT_SUMMARIZER_MAX_TOKENS,
} from '../../config.js';

/**
 * Maximum characters for tool output before truncation.
 * Default is 50k, but we use tighter limits for specific tools to save tokens.
 */
export const MAX_TOOL_OUTPUT_CHARS = 50000;
export const MAX_READ_FILE_CHARS = 20000; // ~5k tokens
export const MAX_BASH_CHARS = 30000; // ~7.5k tokens

/**
 * Threshold for eGemma summarization (chars).
 */
export const EGEMMA_SUMMARIZE_THRESHOLD = 50000;

/**
 * Absolute max size for tool output before it's truncated without summarization.
 */
export const PRE_TRUNCATE_THRESHOLD = 250000;

/**
 * Workbench client for eGemma summarization (lazy initialized)
 */
let workbenchClient: WorkbenchClient | null = null;
let workbenchAvailable: boolean | null = null;

/**
 * Initialize workbench client for eGemma summarization
 */
export function getWorkbenchClient(workbenchUrl?: string): WorkbenchClient {
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
export function truncateOutput(
  output: string,
  maxChars: number = MAX_TOOL_OUTPUT_CHARS,
  strategy: 'tail' | 'head-tail' = 'tail'
): string {
  if (output.length <= maxChars) return output;

  if (strategy === 'head-tail') {
    const headSize = Math.floor(maxChars * 0.3); // 30% head
    const tailSize = maxChars - headSize; // 70% tail
    const head = output.substring(0, headSize);
    const tail = output.substring(output.length - tailSize);
    const middleLines =
      (output.match(/\n/g) || []).length -
      (head.match(/\n/g) || []).length -
      (tail.match(/\n/g) || []).length;

    return `${head}\n\n... [TRUNCATED: ${middleLines} lines omitted for token optimization] ...\n\n${tail}`;
  }

  const truncated = output.substring(0, maxChars);
  const lineCount = (output.match(/\n/g) || []).length;
  const truncatedLineCount = (truncated.match(/\n/g) || []).length;
  return `${truncated}\n\n... [TRUNCATED: showing ${truncatedLineCount} of ${lineCount} lines. Use limit/offset params for specific sections]`;
}

/**
 * Intelligently compress tool output using eGemma summarization.
 */
export async function smartCompressOutput(
  output: string,
  toolType: 'bash' | 'grep' | 'read_file' | 'glob',
  maxChars?: number,
  workbenchUrl?: string
): Promise<string> {
  // Use tool-specific defaults if maxChars not provided
  const limit =
    maxChars ||
    (toolType === 'read_file' ? MAX_READ_FILE_CHARS : MAX_TOOL_OUTPUT_CHARS);

  // Tier 1: Small outputs pass through untouched.
  if (output.length <= limit) {
    return output;
  }

  // Tier 2: Read file gets aggressive truncation with recall pointer
  if (toolType === 'read_file') {
    return truncateOutput(output, limit, 'tail');
  }

  // Tier 3: Bash gets Head + Tail truncation to preserve errors at the end
  if (toolType === 'bash') {
    // If output is extremely large, try to summarize via eGemma first
    if (output.length > EGEMMA_SUMMARIZE_THRESHOLD) {
      if (workbenchAvailable === null) {
        try {
          const client = getWorkbenchClient(workbenchUrl);
          await client.health();
          workbenchAvailable = true;
        } catch {
          workbenchAvailable = false;
        }
      }

      if (workbenchAvailable) {
        try {
          const client = getWorkbenchClient(workbenchUrl);
          const response = await client.summarize({
            content: `Tool: bash\nOutput length: ${output.length} chars\n\n${output.substring(0, EGEMMA_SUMMARIZE_THRESHOLD)}`,
            filename: `bash_output.txt`,
            persona: PERSONA_TOOL_OUTPUT_SUMMARIZER,
            max_tokens: DEFAULT_SUMMARIZER_MAX_TOKENS,
            temperature: 0.1,
            model_name: DEFAULT_SUMMARIZER_MODEL_NAME,
          });
          return `[eGemma Summary - ${output.length} chars compressed]\n\n${response.summary}\n\n[Final 5k chars of raw output follows]\n${output.substring(output.length - 5000)}`;
        } catch {
          // Fallback to head-tail truncation
        }
      }
    }
    return truncateOutput(output, MAX_BASH_CHARS, 'head-tail');
  }

  // Tier 4: Default truncation for grep/glob
  return truncateOutput(output, limit);
}

/**
 * Format task type for display
 */
export function formatTaskType(task: {
  type: string;
  overlay?: string;
}): string {
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
export function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Tool permission callback type (from AgentRequest interface)
 */
export type OnCanUseTool = (
  toolName: string,
  input: unknown
) => Promise<{ behavior: 'allow' | 'deny'; updatedInput?: unknown }>;
