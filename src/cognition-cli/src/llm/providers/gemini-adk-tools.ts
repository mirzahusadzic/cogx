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

/**
 * Read file tool - reads file contents
 */
export const readFileTool = new FunctionTool({
  name: 'read_file',
  description: 'Read the contents of a file at the given path',
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

      return sliced
        .map((line, i) => `${String(start + i + 1).padStart(6)}│${line}`)
        .join('\n');
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
  description: 'Find files matching a glob pattern',
  parameters: z.object({
    pattern: z.string().describe('Glob pattern (e.g., "**/*.ts")'),
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
  description: 'Search for a pattern in files using ripgrep',
  parameters: z.object({
    pattern: z.string().describe('Regex pattern to search'),
    path: z.string().optional().describe('Path to search in'),
    glob_filter: z.string().optional().describe('File glob filter'),
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
      proc.on('close', () => resolve(output.slice(0, 10000) || 'No matches'));
      proc.on('error', () => resolve(`Error running grep`));
    });
  },
});

/**
 * Bash tool - execute shell commands
 */
export const bashTool = new FunctionTool({
  name: 'bash',
  description: 'Execute a bash command (use for git, npm, etc.)',
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
      proc.on('close', (code) => {
        const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '');
        resolve(
          `Exit code: ${code}\n${output.slice(0, 30000)}${output.length > 30000 ? '\n... truncated' : ''}`
        );
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
 * Get all ADK tools for Cognition
 */
export function getCognitionTools(): FunctionTool<unknown>[] {
  return [
    readFileTool,
    writeFileTool,
    globTool,
    grepTool,
    bashTool,
    editFileTool,
  ];
}
