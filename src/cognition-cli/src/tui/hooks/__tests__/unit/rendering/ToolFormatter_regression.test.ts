/* eslint-disable no-control-regex */
import { describe, it, expect } from 'vitest';
import { formatToolResult } from '../../../rendering/ToolFormatter.js';
import { stripSigmaMarkers } from '../../../../../utils/string-utils.js';
import stripAnsi from 'strip-ansi';

describe('ToolFormatter regression tests', () => {
  it('should correctly parse and format "unknown" exit code', () => {
    const input = 'Exit code: unknown';
    const result = formatToolResult('bash', input);

    // Check if "Exit code: unknown" is present
    expect(result).toContain('Exit code:');
    expect(result).toContain('unknown');

    // Check for gray color \x1b[90m
    expect(result).toContain('\x1b[90munknown');
  });

  it('should correctly parse exit code when followed by task markers', () => {
    // This simulates the case where a task marker is appended to the output
    const input = 'Exit code: 0\n\n<!-- sigma-task: some-task-id -->';
    const result = formatToolResult('bash', input);

    expect(result).toContain('Exit code:');
    expect(result).toContain('0');
    expect(result).toContain('\x1b[32m0'); // Green
    expect(result).not.toContain('sigma-task');
  });

  it('should correctly parse "unknown" exit code when followed by task markers', () => {
    const input = 'Exit code: unknown\n\n<!-- sigma-task: some-task-id -->';
    const result = formatToolResult('bash', input);

    expect(result).toContain('Exit code:');
    expect(result).toContain('unknown');
    expect(result).toContain('\x1b[90munknown'); // Gray
    expect(result).not.toContain('sigma-task');
  });

  it('should handle ansi codes around "unknown"', () => {
    const input =
      'Exit code: \x1b[31munknown\x1b[0m\n<!-- sigma-task: task-123 -->';
    const result = formatToolResult('bash', input);

    expect(result).toContain('Exit code:');
    expect(result).toContain('unknown');
    expect(result).toContain('\x1b[90munknown');
    expect(result).not.toContain('sigma-task');
  });

  it('should simulate useAgentHandlers logic with task markers and ANSI', () => {
    const rawInput =
      'Exit code: \x1b[31munknown\x1b[0m\n\n<!-- sigma-task: task-123 -->';

    // 1. stripAnsi(stripSigmaMarkers(rawInput)).trim()
    const strippedData = stripAnsi(stripSigmaMarkers(rawInput)).trim();
    expect(strippedData).toBe('Exit code: unknown');

    // 2. Test with the regex used in useAgentHandlers
    const regex =
      /^Exit code:\s*(?:(?:\x1b\[[0-9;]*m)|\[[0-9;]*m)*\s*(-?\d+|null|unknown)(?:\x1b\[0m|\[0m)?(?:\s+<!-- sigma-task: [^>]+ -->)?\s*$/;

    expect(regex.test(strippedData)).toBe(true);

    const match = strippedData.match(regex);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('unknown');
  });

  it('should handle multiple markers and weird whitespace in useAgentHandlers logic', () => {
    const rawInput =
      'Standard output\nExit code: 0\n\n<!-- sigma-task: task-1 -->\n<!-- sigma-task: task-2 -->\n  ';
    const strippedData = stripAnsi(stripSigmaMarkers(rawInput)).trim();

    // strippedData should be "Standard output\nExit code: 0"
    expect(strippedData).toContain('Standard output');
    expect(strippedData).toContain('Exit code: 0');
    expect(strippedData).not.toContain('sigma-task');

    const regex =
      /Exit code:\s*(?:(?:\x1b\[[0-9;]*m)|\[[0-9;]*m)*\s*(-?\d+|null|unknown)(?:\x1b\[0m|\[0m)?(?:\s+<!-- sigma-task: [^>]+ -->)?\s*$/m;
    const match = strippedData.match(regex);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('0');
  });

  it('should handle bash JSON object result with exitCode 0', () => {
    const input = { exitCode: 0, stdout: 'hello', stderr: '' };
    const result = formatToolResult('bash', input);
    // It should NOT contain "unknown"
    expect(result).not.toContain('unknown');
    // It should contain the output
    expect(result).toContain('hello');
    // It should contain the green exit code 0
    expect(result).toContain('\x1b[32m0\x1b[0m');
  });

  it('should handle truncated bash output and still find the exit code', () => {
    const input =
      'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10\nline 11\nline 12\nline 13\nline 14\nline 15\nline 16\nline 17\nline 18\nline 19\nline 20\nline 21\nExit code: 0';
    const result = formatToolResult('bash', input);

    // It should contain the truncation marker
    expect(result).toContain('... (truncated) ...');
    // It should still contain the green exit code 0
    expect(result).toContain('\x1b[32m0\x1b[0m');
    expect(result).not.toContain('unknown');
  });

  it('should handle bash JSON string result with exitCode 0', () => {
    const input = JSON.stringify({
      exitCode: 0,
      stdout: 'hello from json string',
      stderr: '',
    });
    const result = formatToolResult('bash', input);
    expect(result).toContain('hello from json string');
    expect(result).toContain('\x1b[32m0\x1b[0m');
    expect(result).not.toContain('unknown');
  });

  it('should handle bash JSON string result with exitCode 1', () => {
    const input = JSON.stringify({
      exitCode: 1,
      stdout: '',
      stderr: 'error from json string',
    });
    const result = formatToolResult('bash', input);
    expect(result).toContain('error from json string');
    expect(result).toContain('\x1b[31m1\x1b[0m');
  });
});
