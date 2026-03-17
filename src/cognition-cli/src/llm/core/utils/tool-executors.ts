/**
 * Shared Tool Executors
 *
 * Core tool execution logic used by OpenAI, Gemini and Minimax providers.
 * Each provider wraps these executors in their SDK-specific tool format.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { terminalFormatter } from '../../../core/services/terminal-formatter/TerminalFormatterService.js';
import { SessionState } from '../../../sigma/session-state.js';
import { spawn } from 'child_process';
import { glob as globLib } from 'glob';
import { smartCompressOutput } from './tool-helpers.js';
import { TOOL_CONFIG } from './tool-config.js';
import { systemDiagnosticsService } from '../../../core/services/diagnostics/SystemDiagnosticsService.js';

/**
 * Helper to tag tool output with the currently active Sigma task ID.
 * This enables surgical token eviction and log archiving.
 *
 * @param output - The raw tool output
 * @param getActiveTaskId - Function to get active task ID
 * @returns Tagged output
 */
export function tagOutputWithActiveTask(
  output: string,
  getActiveTaskId?: () => string | null
): string {
  if (!getActiveTaskId) return output;

  try {
    const activeTaskId = getActiveTaskId();
    if (!activeTaskId) return output;

    // Append hidden task tag for eviction tracking
    // Using HTML comment format which Gemini/OpenAI tolerate well
    return `${output}\n\n<!-- sigma-task: ${activeTaskId} -->`;
  } catch {
    return output;
  }
}

import type { ToolResult } from '../types.js';

/**
 * Read file executor
 */
export async function executeReadFile(
  file_path: string,
  cwd: string,
  limit?: number,
  offset?: number,
  workbenchUrl?: string,
  currentPromptTokens?: number,
  getActiveTaskId?: () => string | null
): Promise<string> {
  try {
    const absolutePath = path.isAbsolute(file_path)
      ? file_path
      : path.resolve(cwd, file_path);
    const stats = await fs.stat(absolutePath);
    // 1MB safety cap for total file read without limits
    if (stats.size > TOOL_CONFIG.READ_FILE.SAFETY_CAP_SIZE && !limit) {
      return `Error: File is too large (${(stats.size / 1024 / 1024).toFixed(2)} MB). Please use 'limit' and 'offset' to read specific parts of the file.`;
    }

    // Absolute hard limit to prevent OOM
    if (stats.size > TOOL_CONFIG.READ_FILE.ABSOLUTE_MAX_SIZE) {
      return `Error: File is too large (${(stats.size / 1024 / 1024).toFixed(2)} MB). Maximum supported file size is ${TOOL_CONFIG.READ_FILE.ABSOLUTE_MAX_SIZE / (1024 * 1024)}MB.`;
    }

    const content = await fs.readFile(absolutePath, 'utf-8');
    const lines = content.split(/\r?\n/);

    const start = offset || 0;
    const end = limit ? start + limit : lines.length;
    const sliced = lines.slice(start, end);

    const result = sliced
      .map((line, i) => {
        // Cap extremely long lines to prevent TUI crashes
        const displayLine =
          line.length > TOOL_CONFIG.READ_FILE.MAX_LINE_LENGTH
            ? line.substring(0, TOOL_CONFIG.READ_FILE.MAX_LINE_LENGTH) +
              ' ... (long line truncated for TUI safety)'
            : line;
        return `${String(start + i + 1).padStart(6)}│${displayLine}`;
      })
      .join('\n');

    const compressed = await smartCompressOutput(
      result,
      'read_file',
      TOOL_CONFIG.READ_FILE.COMPRESS_THRESHOLD, // 1MB cap for tool output
      workbenchUrl,
      currentPromptTokens
    );

    return tagOutputWithActiveTask(compressed, getActiveTaskId);
  } catch (error) {
    return `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Write file executor
 */
export async function executeWriteFile(
  file_path: string,
  content: string,
  cwd: string,
  getActiveTaskId?: () => string | null
): Promise<string> {
  try {
    const absolutePath = path.isAbsolute(file_path)
      ? file_path
      : path.resolve(cwd, file_path);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, 'utf-8');
    const result = `Successfully wrote ${content.length} bytes to ${file_path}`;
    return tagOutputWithActiveTask(result, getActiveTaskId);
  } catch (error) {
    return `Error writing file: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Glob executor
 */
export async function executeGlob(
  pattern: string,
  cwd: string,
  exclude?: string,
  getActiveTaskId?: () => string | null,
  timeout?: number
): Promise<string> {
  const effectiveTimeout = timeout || 30000;
  try {
    const files = await Promise.race([
      globLib(pattern, {
        cwd,
        nodir: true,
        absolute: false,
        ignore: exclude,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Timeout after ${effectiveTimeout}ms`)),
          effectiveTimeout
        )
      ),
    ]);
    const result =
      files.slice(0, TOOL_CONFIG.GLOB.MAX_FILES).join('\n') ||
      'No matches found';
    return tagOutputWithActiveTask(result, getActiveTaskId);
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Grep executor
 */
export async function executeGrep(
  pattern: string,
  search_path: string | undefined,
  glob_filter: string | undefined,
  cwd: string,
  is_literal?: boolean,
  workbenchUrl?: string,
  currentPromptTokens?: number,
  getActiveTaskId?: () => string | null,
  timeout?: number
): Promise<string> {
  const effectiveTimeout = timeout || TOOL_CONFIG.GREP.TIMEOUT_MS;
  return new Promise((resolve) => {
    const args = [
      '--color=never',
      '-n',
      '--with-filename',
      '--no-heading',
      '--glob',
      '!*.map',
    ];
    if (is_literal) {
      args.push('-F');
    }
    args.push(pattern);
    if (glob_filter) args.push('--glob', glob_filter);

    const searchPathArg = search_path || cwd;
    const targetPath = path.isAbsolute(searchPathArg)
      ? path.relative(cwd, searchPathArg)
      : searchPathArg;
    args.push(targetPath || '.');

    const proc = spawn('rg', args, { cwd });

    const timeoutId = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve(`Error: Timeout after ${effectiveTimeout}ms`);
    }, effectiveTimeout);

    let output = '';
    const MAX_OUTPUT_SIZE = TOOL_CONFIG.GREP.MAX_OUTPUT_SIZE; // 1MB safety cap

    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      if (output.length + chunk.length > MAX_OUTPUT_SIZE) {
        if (output.length < MAX_OUTPUT_SIZE) {
          output += chunk.substring(0, MAX_OUTPUT_SIZE - output.length);
          output += `\n... (output truncated at ${MAX_OUTPUT_SIZE / 1024}KB)`;
        }
        proc.kill('SIGTERM');
      } else {
        output += chunk;
      }
    });

    proc.stderr.on('data', (data) => {
      const chunk = data.toString();
      if (output.length + chunk.length < MAX_OUTPUT_SIZE) {
        output += chunk;
      }
    });

    proc.on('close', async (code) => {
      clearTimeout(timeoutId);

      // Final safety check: cap extremely long lines which can crash TUIs
      const lines = output.split(/\r?\n/);
      const cappedLines = lines.map((line) => {
        if (line.length > TOOL_CONFIG.GREP.MAX_LINE_LENGTH) {
          return (
            line.substring(0, TOOL_CONFIG.GREP.MAX_LINE_LENGTH) +
            ' ... (long line truncated for TUI safety)'
          );
        }
        return line;
      });
      const finalOutput = cappedLines.join('\n');

      const compressed = await smartCompressOutput(
        finalOutput,
        'grep',
        TOOL_CONFIG.GREP.COMPRESS_THRESHOLD,
        workbenchUrl,
        currentPromptTokens
      );

      const finalCode = code ?? 0;
      const color = finalCode === 0 ? '\x1b[32m' : '\x1b[31m'; // Green for 0, Red otherwise
      const exitLine = `Exit code: ${color}${finalCode}\x1b[0m`;

      const result = compressed
        ? compressed.trimEnd()
        : finalCode === 1
          ? 'No matches found'
          : exitLine;

      resolve(tagOutputWithActiveTask(result, getActiveTaskId));
    });
    proc.on('error', () => {
      clearTimeout(timeoutId);
      resolve('Error running grep');
    });
  });
}

/**
 * Bash executor
 */
export async function executeBash(
  command: string,
  timeout: number | undefined,
  cwd: string,
  bashCwd?: string,
  onChunk?: (
    chunk: string | { type: 'heartbeat' },
    toolCallId?: string
  ) => void,
  workbenchUrl?: string,
  currentPromptTokens?: number,
  getActiveTaskId?: () => string | null,
  toolCallId?: string
): Promise<ToolResult> {
  const effectiveTimeout = timeout || TOOL_CONFIG.BASH.DEFAULT_TIMEOUT_MS;
  const effectiveCwd = bashCwd
    ? path.isAbsolute(bashCwd)
      ? bashCwd
      : path.resolve(cwd, bashCwd)
    : cwd;

  return new Promise<ToolResult>((resolve) => {
    const MAX_BUFFER_SIZE = TOOL_CONFIG.BASH.MAX_BUFFER_SIZE; // 1MB
    const proc = spawn('bash', ['-c', command], {
      cwd: effectiveCwd,
      env: {
        ...process.env,
        NO_COLOR: '1',
        GIT_CONFIG_PARAMETERS:
          "'status.relativePaths=true' 'diff.relative=true' 'show.relative=true'",
      },
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    // Manual timeout handling (spawn's timeout option is broken on macOS)
    const timeoutId = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
    }, effectiveTimeout);

    // Heartbeat mechanism to prevent TUI/ZMQ timeouts during silent execution
    const heartbeatInterval = setInterval(() => {
      if (!killed && onChunk) {
        onChunk({ type: 'heartbeat' }, toolCallId);
      }
    }, 15000); // 15s heartbeat

    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      if (stdout.length + chunk.length > MAX_BUFFER_SIZE) {
        stdout =
          stdout.substring(0, MAX_BUFFER_SIZE - 50) + '... (truncated) ...';
        proc.stdout.removeAllListeners('data'); // Stop accumulating
      } else {
        stdout += chunk;
      }
      if (onChunk) onChunk(terminalFormatter.cleanAnsi(chunk), toolCallId);
    });
    proc.stderr.on('data', (data) => {
      const chunk = data.toString();
      if (stderr.length + chunk.length > MAX_BUFFER_SIZE) {
        stderr =
          stderr.substring(0, MAX_BUFFER_SIZE - 50) + '... (truncated) ...';
        proc.stderr.removeAllListeners('data'); // Stop accumulating
      } else {
        stderr += chunk;
      }
      if (onChunk) onChunk(terminalFormatter.cleanAnsi(chunk), toolCallId);
    });
    proc.on('close', async (code) => {
      clearTimeout(timeoutId);
      clearInterval(heartbeatInterval);
      // Strip ANSI codes from output for the LLM to save tokens and prevent confusion
      const cleanStdout = terminalFormatter.cleanAnsi(stdout);

      const cleanStderr = terminalFormatter.cleanAnsi(stderr);
      const finalCode = code ?? 0;

      const output =
        cleanStdout +
        (cleanStderr ? `\nSTDERR:\n${cleanStderr}` : '') +
        `\nExit code: ${finalCode}`;
      // Determine max output size based on command importance
      // git diffs are critical for context and should be preserved
      const isGitDiff = command.includes('git diff');
      const maxChars = isGitDiff
        ? TOOL_CONFIG.BASH.GIT_DIFF_MAX_CHARS
        : TOOL_CONFIG.BASH.STANDARD_MAX_CHARS;

      const compressed = await smartCompressOutput(
        output,
        'bash',
        maxChars,
        workbenchUrl,
        currentPromptTokens
      );
      if (killed) {
        resolve({
          stdout: '',
          stderr: `Timeout after ${effectiveTimeout}ms\n${compressed}`,
          exitCode: null,
          content: tagOutputWithActiveTask(
            `Timeout after ${effectiveTimeout}ms\n${compressed}`,
            getActiveTaskId
          ),
        });
      } else {
        resolve({
          stdout: cleanStdout,
          stderr: cleanStderr,
          exitCode: finalCode,
          content: tagOutputWithActiveTask(compressed || '', getActiveTaskId),
        });
      }
    });
    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      resolve({
        stdout: '',
        stderr: err.message,
        exitCode: 1,
        content: `Error: ${err.message}`,
      });
    });
  });
}

/**
 * Edit file executor
 */
export async function executeEditFile(
  file_path: string,
  old_string: string,
  new_string: string,
  cwd: string,
  replace_all?: boolean,
  is_regex?: boolean,
  getActiveTaskId?: () => string | null
): Promise<string> {
  try {
    const absolutePath = path.isAbsolute(file_path)
      ? file_path
      : path.resolve(cwd, file_path);
    const content = await fs.readFile(absolutePath, 'utf-8');

    let newContent: string;
    if (is_regex) {
      let regex: RegExp;
      try {
        regex = new RegExp(old_string, replace_all ? 'g' : '');
      } catch (e) {
        return `Error: Invalid regex pattern provided: ${e instanceof Error ? e.message : String(e)}`;
      }

      if (!regex.test(content)) {
        return 'Error: regex pattern not found in file';
      }
      newContent = content.replace(regex, new_string);
    } else {
      // Check if old_string exists
      if (!content.includes(old_string)) {
        return 'Error: old_string not found in file';
      }

      // Check for uniqueness if not replace_all
      if (!replace_all) {
        const occurrences = content.split(old_string).length - 1;
        if (occurrences > 1) {
          return `Error: old_string found ${occurrences} times. Use replace_all=true or make it unique.`;
        }
      }

      newContent = replace_all
        ? content.split(old_string).join(new_string)
        : content.replace(old_string, new_string);
    }

    await fs.writeFile(absolutePath, newContent, 'utf-8');
    const result = `Successfully edited ${file_path}`;
    return tagOutputWithActiveTask(result, getActiveTaskId);
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Fetch URL executor
 */
export async function executeFetchUrl(
  url: string,
  getActiveTaskId?: () => string | null
): Promise<string> {
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
      signal: AbortSignal.timeout(TOOL_CONFIG.FETCH_URL.TIMEOUT_MS), // 10s timeout
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
      if (typeof text !== 'string') {
        return `Unexpected non-string content for HTML: ${typeof text}`;
      }

      // Try to extract main content if present to reduce noise
      const mainContentMatch = text.match(
        /<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i
      );
      if (mainContentMatch) {
        text = mainContentMatch[2];
      }

      // Remove script/style tags
      text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gim, '');
      text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gim, '');

      /**
       * Preserve link URLs by converting <a> tags: <a href="url">text</a> -> text [url]
       * This handles double quotes, single quotes, and unquoted URLs, as well as
       * other attributes appearing before or after the href.
       */
      text = text.replace(
        /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^>\s]+))[^>]*>([\s\S]*?)<\/a>/gim,
        (match, hrefDouble, hrefSingle, hrefUnquoted, content) => {
          const href = hrefDouble || hrefSingle || hrefUnquoted || '';
          const cleanContent = content.replace(/<[^>]+>/g, '').trim();
          return cleanContent ? `${cleanContent} [${href}]` : `[${href}]`;
        }
      );

      /**
       * Preserve document structure by converting block-level HTML tags to newlines.
       * This prevents "text walls" and maintains readability for the model.
       */
      text = text.replace(
        /<(p|br|div|li|h[1-6]|blockquote|tr|table|section|article|nav|aside|header|footer)[^>]*>/gim,
        '\n'
      );

      // Remove all other HTML tags
      text = text.replace(/<[^>]+>/g, ' ');

      // Collapse horizontal whitespace (tabs and spaces)
      text = text.replace(/[ \t]+/g, ' ');

      /**
       * Final cleanup:
       * 1. Remove leading/trailing space from each line
       * 2. Collapse multiple newlines into a single one
       * 3. Trim overall output
       */
      text = text
        .replace(/^[ \t]+|[ \t]+$/gm, '')
        .replace(/\n+/g, '\n')
        .trim();
    }

    // Truncate if too large (200K chars for context)
    const MAX_LENGTH = TOOL_CONFIG.FETCH_URL.MAX_CONTENT_LENGTH;
    if (text.length > MAX_LENGTH) {
      text =
        text.substring(0, MAX_LENGTH) +
        `\n\n[Truncated - total length: ${text.length} chars]`;
    }

    return tagOutputWithActiveTask(text, getActiveTaskId);
  } catch (error) {
    return `Error fetching URL: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * SigmaTaskUpdate executor
 *
 * Embeds todos in session state file via anchorId.
 * Provides agent-specific persistence with auto-restoration on session resume.
 * Supports delegation fields for Manager/Worker paradigm.
 *
 * @param todos - Array of todo items with optional delegation fields
 * @param cwd - Working directory
 * @param anchorId - Session anchor ID for state file embedding (required)
 */
export async function executeSigmaTaskUpdate(
  todos: Array<{
    id: string;
    content?: string | null;
    status?: string | null;
    activeForm?: string | null;
    // Delegation fields (Manager/Worker paradigm)
    acceptance_criteria?: string[] | null;
    delegated_to?: string | null;
    context?: string | null;
    delegate_session_id?: string | null;
    grounding?: {
      strategy: 'pgc_first' | 'pgc_verify' | 'pgc_cite' | 'none' | null;
      overlay_hints?: Array<
        'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'
      > | null;
      query_hints?: string[] | null;
      evidence_required?: boolean | string | null;
    } | null;
    grounding_evidence?: {
      queries_executed: string[] | null;
      overlays_consulted: Array<
        'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'
      > | null;
      citations: Array<{
        overlay: string;
        content: string;
        relevance: string;
        file_path?: string | null;
      }> | null;
      grounding_confidence: 'high' | 'medium' | 'low' | null;
      overlay_warnings?: string[] | null;
    } | null;
    result_summary?: string | null;
  }>,
  cwd: string,
  anchorId: string
): Promise<string> {
  try {
    const inProgressCount = todos.filter(
      (t) => t.status === 'in_progress'
    ).length;
    if (inProgressCount > 1) {
      const inProgressIds = todos
        .filter((t) => t.status === 'in_progress')
        .map((t) => t.id)
        .join("', '");
      throw new Error(
        `Only ONE task can be in_progress at a time. You attempted to set ${inProgressCount} tasks to in_progress ('${inProgressIds}').\n\n` +
          `RECOVERY: Mark exactly one task as 'in_progress' (and provide an 'activeForm'). If you are switching, mark the current one as 'completed' (with a result_summary) in the same call.`
      );
    }

    // Log delegation events for debugging (controlled by DEBUG_DELEGATION env var)
    if (process.env.DEBUG_DELEGATION) {
      const delegatedTasks = todos.filter((t) => t.status === 'delegated');
      const completedDelegations = todos.filter(
        (t) => t.status === 'delegated' && t.result_summary
      );

      if (delegatedTasks.length > 0) {
        systemDiagnosticsService.systemLog(
          'sigma',
          'Delegation lifecycle events:'
        );
        delegatedTasks.forEach((task) => {
          systemDiagnosticsService.systemLog(
            'sigma',
            `  📋 Task: ${task.id} - ${task.content}`
          );
          systemDiagnosticsService.systemLog(
            'sigma',
            `     → Delegated to: ${task.delegated_to}`
          );
          systemDiagnosticsService.systemLog(
            'sigma',
            `     → Acceptance criteria: ${task.acceptance_criteria?.join(', ')}`
          );
          if (task.context) {
            systemDiagnosticsService.systemLog(
              'sigma',
              `     → Context: ${task.context}`
            );
          }
          if (task.grounding) {
            systemDiagnosticsService.systemLog(
              'sigma',
              `     → Grounding strategy: ${task.grounding.strategy}`
            );
          }
          if (task.result_summary) {
            systemDiagnosticsService.systemLog(
              'sigma',
              `     ✅ Result: ${task.result_summary}`
            );
          }
          if (task.delegate_session_id) {
            systemDiagnosticsService.systemLog(
              'sigma',
              `     → Session: ${task.delegate_session_id}`
            );
          }
        });
      }

      if (completedDelegations.length > 0) {
        systemDiagnosticsService.systemLog(
          'sigma',
          `✅ ${completedDelegations.length} delegated task(s) completed`
        );
      }
    }

    // Dynamic import to avoid circular dependencies
    const { updateTasksByAnchorId, loadSessionState } =
      await import('../../../sigma/session-state.js');
    const { validateTaskCompletion } =
      await import('../../../sigma/validation-service.js');

    const projectRoot = cwd;
    const currentState = loadSessionState(anchorId, projectRoot);

    // Enforce Strict Sequential Task Management
    if (currentState?.todos) {
      const currentInProgress = currentState.todos.find(
        (t) => t.status === 'in_progress'
      );
      if (currentInProgress) {
        const matchingNewTodo = todos.find(
          (t) => t.id === currentInProgress.id
        );
        const isCompletingCurrent = matchingNewTodo?.status === 'completed';

        // 1. Prevent starting a NEW task before completing current one
        const startingNew = todos.find(
          (t) => t.id !== currentInProgress.id && t.status === 'in_progress'
        );
        if (startingNew && !isCompletingCurrent) {
          const activeForm =
            startingNew.activeForm ||
            (startingNew.content ? `Doing ${startingNew.content}` : '...ing');
          throw new Error(
            `Strict Sequential Workflow: You must complete task '${currentInProgress.id}' (set status to 'completed') before starting '${startingNew.id}'.\n\n` +
              `RECOVERY: To switch tasks, include both in your update:\n` +
              `{\n` +
              `  "todos": [\n` +
              `    { "id": "${currentInProgress.id}", "status": "completed", "result_summary": "Summary of work done..." },\n` +
              `    { "id": "${startingNew.id}", "status": "in_progress", "activeForm": "${activeForm}" }\n` +
              `  ]\n` +
              `}`
          );
        }

        // 2. Prevent adding NEW tasks to the list while one is in_progress
        // EXCEPTION: Only allow adding pending tasks IF we are completing the current one,
        // but strongly discourage starting the NEXT task in the same call.
        const newTasks = todos.filter(
          (t) => !currentState.todos!.some((old) => old.id === t.id)
        );
        if (!isCompletingCurrent && newTasks.length > 0) {
          throw new Error(
            `Strict Sequential Workflow: You cannot create NEW tasks while task '${currentInProgress.id}' is still in_progress.\n\n` +
              `RECOVERY: Complete '${currentInProgress.id}' first, or include its completion in this call:\n` +
              `{\n` +
              `  "todos": [\n` +
              `    { "id": "${currentInProgress.id}", "status": "completed", "result_summary": "Summary..." },\n` +
              `    { "id": "new-task-id", "content": "Task description", "activeForm": "Doing task description" }\n` +
              `  ]\n` +
              `}`
          );
        }

        if (isCompletingCurrent && startingNew) {
          // This is allowed and encouraged for atomic handoffs.
          // We allow adding new tasks here too, as it often happens during initialization
          // or when a task is broken down into sub-tasks upon completion.
        }
      }
    }

    // Merge separate grounding arrays into tasks for processing
    const processedTodos = todos.map((todo) => {
      // NOTE: We don't have direct access to 'grounding' or 'grounding_evidence' arrays here
      // because they are passed as separate arguments to the tool executor function in the provider,
      // but 'executeSigmaTaskUpdate' interface expects them to be nested in 'todos' for legacy reasons
      // or already merged.

      // However, the interface of this function (executeSigmaTaskUpdate) still defines
      // grounding/grounding_evidence as properties of the todo item.
      // The calling provider MUST merge them before calling this function.
      return todo;
    });

    // Process validation for tasks being completed
    if (currentState?.todos) {
      for (const newTodo of processedTodos) {
        const oldTodo = currentState.todos.find((t) => t.id === newTodo.id);

        // If task is moving to completed and it was previously delegated or in_progress
        if (
          newTodo.status === 'completed' &&
          oldTodo &&
          oldTodo.status !== 'completed' &&
          newTodo.result_summary
        ) {
          const validation = await validateTaskCompletion(
            newTodo as NonNullable<SessionState['todos']>[number],
            newTodo.result_summary
          );

          if (!validation.isValid) {
            // Annotate the result summary with validation warnings
            const warning = `\n\n⚠️ [Sigma Validation] Missing criteria: ${validation.missing_criteria?.join(', ')}`;
            newTodo.result_summary += warning;
          } else {
            // Annotate with validation success
            const success = `\n\n✅ [Sigma Validation] All criteria met (Score: ${validation.score.toFixed(2)})`;
            newTodo.result_summary += success;
          }
        }
      }
    }

    // Implement ID-based merge to prevent accidental task deletion
    const finalTodos = [...(currentState?.todos || [])];

    for (const newTodo of processedTodos) {
      const existingIndex = finalTodos.findIndex((t) => t.id === newTodo.id);
      if (existingIndex !== -1) {
        // Update existing task: Only merge fields that are NOT undefined
        // to support partial updates from the LLM while preserving existing data
        const filteredUpdate = Object.fromEntries(
          Object.entries(newTodo).filter(([, v]) => v !== undefined)
        );

        finalTodos[existingIndex] = {
          ...finalTodos[existingIndex],
          ...filteredUpdate,
        } as NonNullable<SessionState['todos']>[number];
      } else {
        // Add new task
        finalTodos.push(newTodo as NonNullable<SessionState['todos']>[number]);
      }
    }

    return await updateTasksByAnchorId(anchorId, cwd, finalTodos);
  } catch (error) {
    return `Error updating task: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Web search executor
 */
export async function executeWebSearch(
  query: string,
  max_results?: number,
  workbenchUrl?: string
): Promise<string> {
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
      body: JSON.stringify({
        query,
        max_results: max_results || TOOL_CONFIG.WEB_SEARCH.DEFAULT_MAX_RESULTS,
      }),
      signal: AbortSignal.timeout(TOOL_CONFIG.WEB_SEARCH.TIMEOUT_MS), // 15s timeout
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

    const result = `Search results for "${query}":\n\n${formatted}`;

    return await smartCompressOutput(
      result,
      'glob', // Use glob as proxy for generic list truncation
      TOOL_CONFIG.GLOBAL.MAX_TOOL_OUTPUT_CHARS,
      workbenchUrl
    );
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
}
