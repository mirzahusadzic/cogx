/**
 * Shared Tool Executors
 *
 * Core tool execution logic used by both OpenAI and Gemini providers.
 * Each provider wraps these executors in their SDK-specific tool format.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { glob as globLib } from 'glob';
import { smartCompressOutput } from './tool-helpers.js';

/**
 * Read file executor
 */
export async function executeReadFile(
  file_path: string,
  limit?: number,
  offset?: number,
  workbenchUrl?: string
): Promise<string> {
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
}

/**
 * Write file executor
 */
export async function executeWriteFile(
  file_path: string,
  content: string
): Promise<string> {
  try {
    await fs.mkdir(path.dirname(file_path), { recursive: true });
    await fs.writeFile(file_path, content, 'utf-8');
    return `Successfully wrote ${content.length} bytes to ${file_path}`;
  } catch (error) {
    return `Error writing file: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Glob executor
 */
export async function executeGlob(
  pattern: string,
  cwd: string
): Promise<string> {
  try {
    const files = await globLib(pattern, {
      cwd,
      nodir: true,
      absolute: true,
    });
    return files.slice(0, 100).join('\n') || 'No matches found';
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
  workbenchUrl?: string
): Promise<string> {
  return new Promise((resolve) => {
    const args = ['--color=never', '-n', pattern];
    if (glob_filter) args.push('--glob', glob_filter);
    args.push(search_path || cwd);

    const proc = spawn('rg', args, { cwd });

    // Set a timeout to kill the process if it takes too long
    // (rg is usually fast, but better safe than sorry)
    const timeoutId = setTimeout(() => {
      proc.kill('SIGTERM');
    }, 30000);

    let output = '';
    proc.stdout.on('data', (data) => (output += data.toString()));
    proc.stderr.on('data', (data) => (output += data.toString()));
    proc.on('close', async () => {
      clearTimeout(timeoutId);
      const compressed = await smartCompressOutput(
        output,
        'grep',
        15000,
        workbenchUrl
      );
      resolve(compressed || 'No matches');
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
  workbenchUrl?: string
): Promise<string> {
  const effectiveTimeout = timeout || 120000;

  return new Promise<string>((resolve) => {
    const proc = spawn('bash', ['-c', command], { cwd });

    let stdout = '';
    let stderr = '';
    let killed = false;

    // Manual timeout handling (spawn's timeout option is broken on macOS)
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
}

/**
 * Edit file executor
 */
export async function executeEditFile(
  file_path: string,
  old_string: string,
  new_string: string,
  replace_all?: boolean
): Promise<string> {
  try {
    const content = await fs.readFile(file_path, 'utf-8');
    const escapedPattern = old_string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const count = (content.match(new RegExp(escapedPattern, 'g')) || []).length;

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
}

/**
 * Fetch URL executor
 */
export async function executeFetchUrl(url: string): Promise<string> {
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

    // Truncate if too large (100K chars for context)
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
}

/**
 * TodoWrite executor
 *
 * Embeds todos in session state file via anchorId.
 * Provides agent-specific persistence with auto-restoration on session resume.
 * Supports delegation fields for Manager/Worker paradigm.
 *
 * @param todos - Array of todo items with optional delegation fields
 * @param cwd - Working directory
 * @param anchorId - Session anchor ID for state file embedding (required)
 */
export async function executeTodoWrite(
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
    result_summary?: string;
  }>,
  cwd: string,
  anchorId: string
): Promise<string> {
  try {
    // Dynamic import to avoid circular dependencies
    const { updateTodosByAnchorId } =
      await import('../../sigma/session-state.js');
    return updateTodosByAnchorId(
      anchorId,
      cwd,
      todos as Array<{
        id: string;
        content: string;
        status: 'pending' | 'in_progress' | 'completed' | 'delegated';
        activeForm: string;
        acceptance_criteria?: string[];
        delegated_to?: string;
        context?: string;
        delegate_session_id?: string;
        result_summary?: string;
      }>
    );
  } catch (error) {
    return `Error updating TODO: ${error instanceof Error ? error.message : String(error)}`;
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
