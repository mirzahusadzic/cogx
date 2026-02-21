/**
 * Shared Tool Executors
 *
 * Core tool execution logic used by both OpenAI and Gemini providers.
 * Each provider wraps these executors in their SDK-specific tool format.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { cleanAnsi as stripAnsi } from '../../utils/string-utils.js';
import { SessionState } from '../../sigma/session-state.js';
import { spawn, exec } from 'child_process';
import { glob as globLib } from 'glob';
import { smartCompressOutput } from './tool-helpers.js';
import { systemLog } from '../../utils/debug-logger.js';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Helper to tag tool output with the currently active Sigma task ID.
 * This enables surgical token eviction and log archiving.
 *
 * @param output - The raw tool output
 * @param anchorId - Session anchor ID
 * @param projectRoot - Project root directory
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

/**
 * Helper to get the repository root
 */
async function getRepoRoot(cwd: string): Promise<string | null> {
  try {
    const { stdout: rootOut } = await execAsync(
      'git rev-parse --show-toplevel',
      { cwd }
    );
    return rootOut.trim();
  } catch {
    return null;
  }
}

/**
 * Helper to relativize git output paths (file lists)
 *
 * Transforms git's repo-relative paths to be relative to the current working directory.
 * e.g. if CWD is src/app and git returns src/app/main.ts, this returns main.ts
 */
async function relativizeGitPaths(
  output: string,
  cwd: string
): Promise<string> {
  // fast check: if output is empty or error, skip
  const trimmed = output.trim();
  if (
    !trimmed ||
    trimmed.startsWith('fatal:') ||
    trimmed.startsWith('error:')
  ) {
    return output;
  }

  const repoRoot = await getRepoRoot(cwd);
  if (!repoRoot) return output;

  // If we're at root, no change needed
  if (path.relative(repoRoot, cwd) === '') {
    return output;
  }

  const lines = output.split(/\r?\n/);
  const processed = lines.map((line) => {
    // Preserve leading indentation for structured output like git status (if it were ever intercepted)
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    const trimmed = line.trim();
    if (!trimmed) return line;

    // Simple heuristic: if line looks like a path (no spaces, or escaped spaces)
    // We assume the whole line is a path for --name-only and ls-files

    // Construct absolute path from repo root
    const absPath = path.join(repoRoot, trimmed);

    // Relativize to CWD
    const relPath = path.relative(cwd, absPath);

    return indent + relPath;
  });

  return processed.join('\n');
}

/**
 * Helper to relativize standard git diff output
 *
 * Adjusts paths in diff headers (diff --git, ---, +++) to be relative to CWD.
 */
async function relativizeDiffOutput(
  output: string,
  cwd: string
): Promise<string> {
  // fast check
  const trimmed = output.trim();
  if (
    !trimmed ||
    trimmed.startsWith('fatal:') ||
    trimmed.startsWith('error:')
  ) {
    return output;
  }

  const repoRoot = await getRepoRoot(cwd);
  if (!repoRoot) return output;

  // If we're at root, no change needed
  const relCwd = path.relative(repoRoot, cwd);
  if (relCwd === '') {
    return output;
  }

  // Normalize separator for regex
  const prefix = relCwd.split(path.sep).join('/');

  // Also need to handle the second path in "diff --git"
  // The line looks like: diff --git a/src/file.ts b/src/file.ts
  // The first regex handles the start of line. The second path is harder to target safely with global regex.
  // We'll iterate lines for safety.

  const lines = output.split(/\r?\n/);
  const processed = lines.map((line) => {
    // Target: diff --git a/path b/path
    if (line.startsWith('diff --git ')) {
      // Replace a/prefix/ with a/ and b/prefix/ with b/
      // We assume paths don't contain spaces for simple replacement,
      // but to be safer we can replace strict occurrences.
      let newLine = line.replace(` a/${prefix}/`, ' a/');
      newLine = newLine.replace(` b/${prefix}/`, ' b/');
      return newLine;
    }
    // Target: --- a/path
    if (line.startsWith('--- a/')) {
      return line.replace(`--- a/${prefix}/`, '--- a/');
    }
    // Target: +++ b/path
    if (line.startsWith('+++ b/')) {
      return line.replace(`+++ b/${prefix}/`, '+++ b/');
    }

    // Also handle "rename from", "rename to", "copy from", "copy to"
    // These usually look like: "rename from src/file.ts"
    // But git output for these doesn't have a/ b/ prefixes usually?
    // Wait, "rename from" usually shows the path relative to repo root.
    // Let's check: "rename from src/cognition-cli/..."
    if (
      line.startsWith('rename from ') ||
      line.startsWith('rename to ') ||
      line.startsWith('copy from ') ||
      line.startsWith('copy to ')
    ) {
      return line.replace(` ${prefix}/`, ' ');
    }

    return line;
  });

  return processed.join('\n');
}

/**
 * Read file executor
 */
export async function executeReadFile(
  file_path: string,
  limit?: number,
  offset?: number,
  workbenchUrl?: string,
  currentPromptTokens?: number,
  getActiveTaskId?: () => string | null
): Promise<string> {
  try {
    const stats = await fs.stat(file_path);
    // 1MB safety cap for total file read without limits
    if (stats.size > 1024 * 1024 && !limit) {
      return `Error: File is too large (${(stats.size / 1024 / 1024).toFixed(2)} MB). Please use 'limit' and 'offset' to read specific parts of the file.`;
    }

    // Absolute hard limit to prevent OOM
    if (stats.size > 50 * 1024 * 1024) {
      return `Error: File is too large (${(stats.size / 1024 / 1024).toFixed(2)} MB). Maximum supported file size is 50MB.`;
    }

    const content = await fs.readFile(file_path, 'utf-8');
    const lines = content.split(/\r?\n/);

    const start = offset || 0;
    const end = limit ? start + limit : lines.length;
    const sliced = lines.slice(start, end);

    const result = sliced
      .map((line, i) => {
        // Cap extremely long lines to prevent TUI crashes
        const displayLine =
          line.length > 2000
            ? line.substring(0, 2000) +
              ' ... (long line truncated for TUI safety)'
            : line;
        return `${String(start + i + 1).padStart(6)}│${displayLine}`;
      })
      .join('\n');

    const compressed = await smartCompressOutput(
      result,
      'read_file',
      1024 * 1024, // 1MB cap for tool output
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
  getActiveTaskId?: () => string | null
): Promise<string> {
  try {
    await fs.mkdir(path.dirname(file_path), { recursive: true });
    await fs.writeFile(file_path, content, 'utf-8');
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
  getActiveTaskId?: () => string | null
): Promise<string> {
  try {
    const files = await globLib(pattern, {
      cwd,
      nodir: true,
      absolute: false,
    });
    const result = files.slice(0, 100).join('\n') || 'No matches found';
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
  workbenchUrl?: string,
  currentPromptTokens?: number,
  getActiveTaskId?: () => string | null
): Promise<string> {
  return new Promise((resolve) => {
    const args = [
      '--color=never',
      '-n',
      '--with-filename',
      '--no-heading',
      '--glob',
      '!*.map',
      pattern,
    ];
    if (glob_filter) args.push('--glob', glob_filter);

    const searchPathArg = search_path || cwd;
    const targetPath = path.isAbsolute(searchPathArg)
      ? path.relative(cwd, searchPathArg)
      : searchPathArg;
    args.push(targetPath || '.');

    const proc = spawn('rg', args, { cwd });

    // Set a timeout to kill the process if it takes too long
    // (rg is usually fast, but better safe than sorry)
    const timeoutId = setTimeout(() => {
      proc.kill('SIGTERM');
    }, 30000);

    let output = '';
    const MAX_OUTPUT_SIZE = 1024 * 1024; // 1MB safety cap

    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      if (output.length + chunk.length > MAX_OUTPUT_SIZE) {
        if (output.length < MAX_OUTPUT_SIZE) {
          output += chunk.substring(0, MAX_OUTPUT_SIZE - output.length);
          output += '\n... (output truncated at 1MB)';
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

    proc.on('close', async () => {
      clearTimeout(timeoutId);

      // Final safety check: cap extremely long lines which can crash TUIs
      const lines = output.split(/\r?\n/);
      const cappedLines = lines.map((line) => {
        if (line.length > 2000) {
          return (
            line.substring(0, 2000) +
            ' ... (long line truncated for TUI safety)'
          );
        }
        return line;
      });
      const finalOutput = cappedLines.join('\n');

      const compressed = await smartCompressOutput(
        finalOutput,
        'grep',
        15000,
        workbenchUrl,
        currentPromptTokens
      );

      resolve(
        tagOutputWithActiveTask(compressed || 'No matches', getActiveTaskId)
      );
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
  onChunk?: (chunk: string) => void,
  workbenchUrl?: string,
  currentPromptTokens?: number,
  getActiveTaskId?: () => string | null
): Promise<string> {
  const effectiveTimeout = timeout || 120000;

  return new Promise<string>((resolve) => {
    const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB
    const proc = spawn('bash', ['-c', command], {
      cwd,
      env: { ...process.env, NO_COLOR: undefined },
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    // Manual timeout handling (spawn's timeout option is broken on macOS)
    const timeoutId = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
    }, effectiveTimeout);

    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      if (stdout.length + chunk.length > MAX_BUFFER_SIZE) {
        stdout = stdout.substring(0, MAX_BUFFER_SIZE - 50) + '... (truncated)';
        proc.stdout.removeAllListeners('data'); // Stop accumulating
      } else {
        stdout += chunk;
      }
      if (onChunk) onChunk(stripAnsi(chunk));
    });
    proc.stderr.on('data', (data) => {
      const chunk = data.toString();
      if (stderr.length + chunk.length > MAX_BUFFER_SIZE) {
        stderr = stderr.substring(0, MAX_BUFFER_SIZE - 50) + '... (truncated)';
        proc.stderr.removeAllListeners('data'); // Stop accumulating
      } else {
        stderr += chunk;
      }
      if (onChunk) onChunk(stripAnsi(chunk));
    });
    proc.on('close', async (code) => {
      clearTimeout(timeoutId);
      // Strip ANSI codes from output for the LLM to save tokens and prevent confusion
      const cleanStdout = stripAnsi(stdout);
      let finalStdout = cleanStdout;

      // Intercept git commands that return paths to relativize them
      // This fixes the "CWD vs Repo Root" confusion for the LLM
      if (!killed && code === 0) {
        if (
          (command.includes('git diff') && command.includes('--name-only')) ||
          command.includes('git ls-files')
        ) {
          finalStdout = await relativizeGitPaths(cleanStdout, cwd);
        } else if (
          command.includes('git diff') &&
          !command.includes('--name-only')
        ) {
          finalStdout = await relativizeDiffOutput(cleanStdout, cwd);
        }
      }

      const cleanStderr = stripAnsi(stderr);

      const output =
        finalStdout + (cleanStderr ? `\nSTDERR:\n${cleanStderr}` : '');
      // Determine max output size based on command importance
      // git diffs are critical for context and should be preserved
      const isGitDiff = command.includes('git diff');
      const maxChars = isGitDiff ? 1000000 : 30000;

      const compressed = await smartCompressOutput(
        output,
        'bash',
        maxChars,
        workbenchUrl,
        currentPromptTokens
      );
      if (killed) {
        resolve(
          tagOutputWithActiveTask(
            `Timeout after ${effectiveTimeout}ms\n${compressed}`,
            getActiveTaskId
          )
        );
      } else {
        const color = code === 0 ? '\x1b[32m' : '\x1b[31m'; // Green for 0, Red otherwise
        const exitLine = `Exit code: ${color}${code}\x1b[0m`;
        const finalResult = compressed
          ? `${compressed.trimEnd()}\n${exitLine}`
          : exitLine;
        resolve(tagOutputWithActiveTask(finalResult, getActiveTaskId));
      }
    });
    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      resolve(`Error: ${err.message}`);
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
  replace_all?: boolean,
  getActiveTaskId?: () => string | null
): Promise<string> {
  try {
    const content = await fs.readFile(file_path, 'utf-8');

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

    const newContent = replace_all
      ? content.split(old_string).join(new_string)
      : content.replace(old_string, new_string);

    await fs.writeFile(file_path, newContent, 'utf-8');
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
    const MAX_LENGTH = 200000;
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
    content: string;
    status: string;
    activeForm: string;
    // Delegation fields (Manager/Worker paradigm)
    acceptance_criteria?: string[];
    delegated_to?: string;
    context?: string;
    delegate_session_id?: string;
    grounding?: {
      strategy: 'pgc_first' | 'pgc_verify' | 'pgc_cite' | 'none';
      overlay_hints?: Array<'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'>;
      query_hints?: string[];
      evidence_required?: boolean | string;
    };
    grounding_evidence?: {
      queries_executed: string[];
      overlays_consulted: Array<'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'>;
      citations: Array<{
        overlay: string;
        content: string;
        relevance: string;
        file_path?: string;
      }>;
      grounding_confidence: 'high' | 'medium' | 'low';
      overlay_warnings?: string[] | null;
    };
    result_summary?: string;
  }>,
  cwd: string,
  anchorId: string
): Promise<string> {
  try {
    // Log delegation events for debugging (controlled by DEBUG_DELEGATION env var)
    if (process.env.DEBUG_DELEGATION) {
      const delegatedTasks = todos.filter((t) => t.status === 'delegated');
      const completedDelegations = todos.filter(
        (t) => t.status === 'delegated' && t.result_summary
      );

      if (delegatedTasks.length > 0) {
        systemLog('sigma', 'Delegation lifecycle events:');
        delegatedTasks.forEach((task) => {
          systemLog('sigma', `  📋 Task: ${task.id} - ${task.content}`);
          systemLog('sigma', `     → Delegated to: ${task.delegated_to}`);
          systemLog(
            'sigma',
            `     → Acceptance criteria: ${task.acceptance_criteria?.join(', ')}`
          );
          if (task.context) {
            systemLog('sigma', `     → Context: ${task.context}`);
          }
          if (task.grounding) {
            systemLog(
              'sigma',
              `     → Grounding strategy: ${task.grounding.strategy}`
            );
          }
          if (task.result_summary) {
            systemLog('sigma', `     ✅ Result: ${task.result_summary}`);
          }
          if (task.delegate_session_id) {
            systemLog('sigma', `     → Session: ${task.delegate_session_id}`);
          }
        });
      }

      if (completedDelegations.length > 0) {
        systemLog(
          'sigma',
          `✅ ${completedDelegations.length} delegated task(s) completed`
        );
      }
    }

    // Dynamic import to avoid circular dependencies
    const { updateTasksByAnchorId, loadSessionState } =
      await import('../../sigma/session-state.js');
    const { validateTaskCompletion } =
      await import('../../sigma/validation-service.js');

    const projectRoot = cwd;
    const currentState = loadSessionState(anchorId, projectRoot);

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

    return updateTasksByAnchorId(
      anchorId,
      cwd,
      todos as NonNullable<SessionState['todos']>
    );
  } catch (error) {
    return `Error updating task: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Web search executor
 */
export async function executeWebSearch(
  query: string,
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
}
