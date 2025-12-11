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
 */
export const MAX_TOOL_OUTPUT_CHARS = 50000;

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
export async function smartCompressOutput(
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
