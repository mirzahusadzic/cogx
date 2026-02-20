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
  strategy: 'head' | 'tail' | 'head-tail' = 'head'
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

  if (strategy === 'tail') {
    const truncated = output.substring(output.length - maxChars);
    const lineCount = (output.match(/\n/g) || []).length;
    const truncatedLineCount = (truncated.match(/\n/g) || []).length;
    return `... [TRUNCATED: showing last ${truncatedLineCount} of ${lineCount} lines. Use limit/offset params for specific sections]\n\n${truncated}`;
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
  workbenchUrl?: string,
  currentPromptTokens?: number
): Promise<string> {
  // Tier 0: Dynamic Truncation based on token pressure
  // If we don't have currentPromptTokens, we use static defaults.
  // If we are nearing 200k tokens, we aggressively truncate to save the session.
  let dynamicLimit = maxChars;
  if (currentPromptTokens) {
    if (currentPromptTokens > 150000) {
      // High pressure: Aggressive 10k limit
      dynamicLimit = Math.min(maxChars || 10000, 10000);
    } else if (currentPromptTokens > 50000) {
      // Medium pressure: 20k limit
      dynamicLimit = Math.min(maxChars || 20000, 20000);
    } else {
      // Low pressure: Standard 30k limit for bash
      dynamicLimit =
        maxChars || (toolType === 'bash' ? 30000 : MAX_TOOL_OUTPUT_CHARS);
    }
  }

  // Use tool-specific defaults if dynamicLimit still not settled
  const limit =
    dynamicLimit ||
    (toolType === 'read_file' ? MAX_READ_FILE_CHARS : MAX_TOOL_OUTPUT_CHARS);

  // Tier 1: Small outputs pass through untouched.
  if (output.length <= limit) {
    return output;
  }

  // Tier 2: Read file is capped at 1MB to prevent TUI crashes, but generally
  // returned untruncated below that to support refactoring large files.
  // The agent is responsible for using offset/limit if they want to optimize.
  if (toolType === 'read_file') {
    if (output.length > 1024 * 1024) {
      return truncateOutput(output, 1024 * 1024);
    }
    return output;
  }

  // Tier 3: Bash gets Head + Tail truncation to preserve errors at the end
  if (toolType === 'bash') {
    // If output is extremely large, try to summarize via eGemma first
    if (output.length > limit && output.length > EGEMMA_SUMMARIZE_THRESHOLD) {
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
    return truncateOutput(output, limit, 'head-tail');
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

/**
 * Get dynamic SigmaTaskUpdate description based on mode
 */
export function getSigmaTaskUpdateDescription(
  mode: 'solo' | 'full' = 'full'
): string {
  if (mode === 'solo') {
    // Strip IPC and PGC sections for solo mode to save ~500 tokens
    return SIGMA_TASK_UPDATE_DESCRIPTION.replace(
      /## Delegation \(Manager\/Worker Pattern\)[\s\S]*?## PGC Grounding/m,
      '## PGC Grounding'
    )
      .replace(
        /## PGC Grounding \(v2\.0 Protocol\)[\s\S]*?Benefits of delegation:/m,
        'Benefits of task tracking:'
      )
      .replace(
        /Benefits of delegation:[\s\S]*?Worker agents handle implementation details/m,
        ''
      )
      .replace(
        /### IPC Message Format for Delegation[\s\S]*?\*\*Example 4:/m,
        '**Example 4:'
      )
      .replace(/- Use 'grounding' and 'grounding_evidence'[\s\S]*?\n/m, '')
      .replace(
        /- delegated: Task assigned to another agent via IPC \(Manager\/Worker pattern\)\n/m,
        ''
      )
      .replace(/, or IPC delegation/g, '');
  }
  return SIGMA_TASK_UPDATE_DESCRIPTION;
}

/**
 * SigmaTaskUpdate tool description - shared between standalone and bound versions
 */
export const SIGMA_TASK_UPDATE_DESCRIPTION = `Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.

## When to Use This Tool
Use this tool proactively in these scenarios:
1. Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
3. User explicitly requests task list - When the user directly asks you to use the task list
4. User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)
5. After receiving new instructions - Immediately capture user requirements as tasks
6. When you start working on a task - Mark it as in_progress BEFORE beginning tool work (e.g., research, read_file, bash). This ensures tool outputs are tagged with the active task ID for surgical context eviction upon completion.
7. After completing a task - Mark it as completed and add any new follow-up tasks discovered during implementation

## When NOT to Use This Tool
Skip using this tool when:
1. There is only a single, straightforward task
2. The task is trivial and tracking it provides no organizational benefit
3. The task can be completed in less than 3 trivial steps
4. The task is purely conversational or informational

## Task States
- pending: Task not yet started
- in_progress: Currently working on (limit to ONE task at a time)
- completed: Task finished successfully
- delegated: Task assigned to another agent via IPC (Manager/Worker pattern)

## Token Health (Surgical Eviction)
Cognition Σ uses task IDs to tag tool outputs for context pruning. To maximize context efficiency, follow these three rules:
1. **Always Start First**: Mark a task as 'in_progress' BEFORE running tools. This ensures logs are tagged and can be surgically evicted upon task completion.
2. **Research Continuity**: If you complete a "Research" task, its detailed tool logs will be evicted. Ensure you have summarized all key findings into your internal thought process or subsequent task descriptions before marking the research task 'completed'.
3. **Immediate completion**: Mark a task 'completed' as soon as it's finished to trigger log eviction and reclaim tokens for the next turn.

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
- Task descriptions must have two forms: content (imperative, e.g., "Run tests") and activeForm (present continuous, e.g., "Running tests")
- Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
- ONLY mark a task as completed when you have FULLY accomplished it
- If you encounter errors or blockers, keep the task as in_progress and create a new task describing what needs to be resolved
- **Reasoning First**: You MUST engage your internal reasoning/thinking process first to plan the action and validate parameters. **CRITICAL: NEVER include the JSON for SigmaTaskUpdate in your assistant response text. ONLY use it as the direct input to the SigmaTaskUpdate tool call. If you include JSON in your response text, the TUI will not update and the user will see raw data.**

**Example of Internal Planning (NOT for Response Text):**
\`\`\`json
{
  "todos": [
    { "id": "task-1", "content": "Update tests", "activeForm": "Updating tests", "status": "in_progress" }
  ],
  "grounding": [
    { "id": "task-1", "strategy": "pgc_first" }
  ]
}
\`\`\`
`;
