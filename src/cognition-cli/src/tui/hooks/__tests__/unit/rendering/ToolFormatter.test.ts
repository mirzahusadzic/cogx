/**
 * Tests for ToolFormatter
 *
 * Week 2 Day 9-10: Extract Rendering Layer
 */

import { describe, it, expect } from 'vitest';
import {
  formatToolUse,
  formatToolUseMessage,
  type ToolUse,
} from '../../../rendering/ToolFormatter.js';

describe('ToolFormatter', () => {
  describe('formatToolUse()', () => {
    it('formats recall tool with query', () => {
      const tool: ToolUse = {
        name: 'mcp__conversation-memory__recall_past_conversation',
        input: { query: 'previous discussion about testing' },
      };

      const result = formatToolUse(tool);

      expect(result.icon).toBe('🧠');
      expect(result.name).toBe('Recall');
      expect(result.description).toBe('"previous discussion about testing"');
    });

    it('formats tool with description', () => {
      const tool: ToolUse = {
        name: 'Read',
        input: { description: 'Read src/index.ts', file_path: 'src/index.ts' },
      };

      const result = formatToolUse(tool);

      expect(result.icon).toBe('🔧');
      expect(result.name).toBe('Read');
      expect(result.description).toBe('Read src/index.ts');
    });

    it('formats Edit tool without diff (no old_string/new_string)', () => {
      const tool: ToolUse = {
        name: 'Write',
        input: { file_path: 'src/test.ts' },
      };

      const result = formatToolUse(tool);

      expect(result.description).toBe('file: src/test.ts');
    });

    it('formats Edit tool with diff', () => {
      const tool: ToolUse = {
        name: 'Edit',
        input: {
          file_path: 'src/test.ts',
          old_string: 'const x = 1;',
          new_string: 'const x = 2;',
        },
      };

      const result = formatToolUse(tool);

      expect(result.description).toContain('src/test.ts');
      expect(result.description).toContain('const x = 1');
      expect(result.description).toContain('const x = 2');
      // Check for ANSI color codes
      expect(result.description).toContain('\x1b['); // Has color codes
    });

    it('formats Bash tool with command', () => {
      const tool: ToolUse = {
        name: 'Bash',
        input: { command: 'npm test' },
      };

      const result = formatToolUse(tool);

      expect(result.description).toBe('npm test');
    });

    it('formats Grep tool with pattern', () => {
      const tool: ToolUse = {
        name: 'Grep',
        input: { pattern: 'TODO' },
      };

      const result = formatToolUse(tool);

      expect(result.description).toBe('pattern: TODO');
    });

    it('formats SigmaTaskUpdate with status icons', () => {
      const tool: ToolUse = {
        name: 'SigmaTaskUpdate',
        input: {
          todos: [
            { content: 'Task 1', status: 'completed', activeForm: 'Task 1' },
            {
              content: 'Task 2',
              status: 'in_progress',
              activeForm: 'Working on Task 2',
            },
            { content: 'Task 3', status: 'pending', activeForm: 'Task 3' },
          ],
        },
      };

      const result = formatToolUse(tool);

      expect(result.description).toContain('✓'); // Completed icon
      expect(result.description).toContain('→'); // In progress icon
      expect(result.description).toContain('○'); // Pending icon
      expect(result.description).toContain('Task 1');
      expect(result.description).toContain('Working on Task 2'); // Uses activeForm
      expect(result.description).toContain('Task 3');
      // Check for color codes
      expect(result.description).toContain('\x1b[32m'); // Green for completed
      expect(result.description).toContain('\x1b[33m'); // Yellow for in_progress
      expect(result.description).toContain('\x1b[90m'); // Gray for pending
    });

    it('formats generic tool with JSON input', () => {
      const tool: ToolUse = {
        name: 'CustomTool',
        input: { foo: 'bar', baz: 123 },
      };

      const result = formatToolUse(tool);

      expect(result.description).toBe('{"foo":"bar","baz":123}');
    });
  });

  describe('formatToolUseMessage()', () => {
    it('formats complete tool message', () => {
      const tool: ToolUse = {
        name: 'Read',
        input: { description: 'Read src/index.ts' },
      };

      const message = formatToolUseMessage(tool);

      expect(message).toBe('🔧 Read: Read src/index.ts');
    });

    it('formats recall tool message', () => {
      const tool: ToolUse = {
        name: 'mcp__conversation-memory__recall_past_conversation',
        input: { query: 'test' },
      };

      const message = formatToolUseMessage(tool);

      expect(message).toBe('🧠 Recall: "test"');
    });
  });

  describe('diff formatting edge cases', () => {
    it('handles multiline diffs', () => {
      const tool: ToolUse = {
        name: 'Edit',
        input: {
          file_path: 'test.ts',
          old_string: 'line1\nline2\nline3',
          new_string: 'line1\nmodified\nline3',
        },
      };

      const result = formatToolUse(tool);

      expect(result.description).toContain('line1');
      expect(result.description).toContain('line2');
      expect(result.description).toContain('modified');
      expect(result.description).toContain('line3');
    });

    it('handles empty old_string (falls back to file path)', () => {
      const tool: ToolUse = {
        name: 'Edit',
        input: {
          file_path: 'test.ts',
          old_string: '',
          new_string: 'new content',
        },
      };

      const result = formatToolUse(tool);

      // Empty old_string is falsy, so it falls back to file path display
      expect(result.description).toBe('file: test.ts');
    });
  });

  describe('SigmaTaskUpdate formatting edge cases', () => {
    it('handles empty todos list', () => {
      const tool: ToolUse = {
        name: 'SigmaTaskUpdate',
        input: {
          todos: [],
        },
      };

      const result = formatToolUse(tool);

      expect(result.description).toBe('\n');
    });

    it('handles single todo', () => {
      const tool: ToolUse = {
        name: 'SigmaTaskUpdate',
        input: {
          todos: [
            {
              content: 'Single task',
              status: 'pending',
              activeForm: 'Single task',
            },
          ],
        },
      };

      const result = formatToolUse(tool);

      expect(result.description).toContain('Single task');
      expect(result.description).toContain('○');
    });
  });
});
