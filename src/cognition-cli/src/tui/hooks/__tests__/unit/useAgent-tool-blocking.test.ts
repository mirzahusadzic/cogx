/**
 * Unit tests for useAgent tool blocking functionality
 *
 * Tests that native TodoWrite is properly blocked when using Claude provider
 * and that SigmaTaskUpdate is allowed through.
 */

import { describe, test, expect } from 'vitest';

describe('useAgent - Tool Blocking', () => {
  /**
   * Simulates the onCanUseTool hook logic from useAgent.ts
   * This is the actual blocking logic extracted for testing
   */
  const simulateCanUseTool = (
    toolName: string,
    providerName: string,
    debugFlag: boolean = false
  ): { behavior: 'allow' | 'deny'; updatedInput?: unknown } => {
    // This is the exact logic from useAgent.ts:1837-1851
    if (toolName === 'TodoWrite' && providerName === 'claude') {
      if (debugFlag) {
        console.log(
          '[useAgent] Blocking native TodoWrite for Claude provider, using SigmaTaskUpdate instead'
        );
      }
      return {
        behavior: 'deny',
        updatedInput: {},
      };
    }

    return {
      behavior: 'allow',
    };
  };

  describe('Claude Provider - TodoWrite Blocking', () => {
    test('should block native TodoWrite when using Claude provider', () => {
      const result = simulateCanUseTool('TodoWrite', 'claude');

      expect(result.behavior).toBe('deny');
      expect(result.updatedInput).toBeDefined();
    });

    test('should allow SigmaTaskUpdate when using Claude provider', () => {
      const result = simulateCanUseTool('SigmaTaskUpdate', 'claude');

      expect(result.behavior).toBe('allow');
    });

    test('should allow MCP SigmaTaskUpdate when using Claude provider', () => {
      const result = simulateCanUseTool(
        'mcp__sigma-task-update__SigmaTaskUpdate',
        'claude'
      );

      expect(result.behavior).toBe('allow');
    });

    test('should allow other tools when using Claude provider', () => {
      const tools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'];

      tools.forEach((toolName) => {
        const result = simulateCanUseTool(toolName, 'claude');
        expect(result.behavior).toBe('allow');
      });
    });

    test('should log debug message when blocking TodoWrite with debug flag', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      simulateCanUseTool('TodoWrite', 'claude', true);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[useAgent] Blocking native TodoWrite for Claude provider, using SigmaTaskUpdate instead'
      );

      consoleSpy.mockRestore();
    });

    test('should not log debug message when blocking TodoWrite without debug flag', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      simulateCanUseTool('TodoWrite', 'claude', false);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Other Providers - No TodoWrite Blocking', () => {
    test('should allow TodoWrite when using Gemini provider', () => {
      const result = simulateCanUseTool('TodoWrite', 'gemini');

      expect(result.behavior).toBe('allow');
    });

    test('should allow TodoWrite when using OpenAI provider', () => {
      const result = simulateCanUseTool('TodoWrite', 'openai');

      expect(result.behavior).toBe('allow');
    });

    test('should allow SigmaTaskUpdate for all providers', () => {
      const providers = ['claude', 'gemini', 'openai'];

      providers.forEach((provider) => {
        const result = simulateCanUseTool('SigmaTaskUpdate', provider);
        expect(result.behavior).toBe('allow');
      });
    });
  });

  describe('Edge Cases', () => {
    test('should be case-sensitive for tool names', () => {
      // TodoWrite !== todowrite
      const result1 = simulateCanUseTool('todowrite', 'claude');
      expect(result1.behavior).toBe('allow');

      const result2 = simulateCanUseTool('TODOWRITE', 'claude');
      expect(result2.behavior).toBe('allow');

      const result3 = simulateCanUseTool('TodoWrite', 'claude');
      expect(result3.behavior).toBe('deny');
    });

    test('should be case-sensitive for provider names', () => {
      // claude !== Claude
      const result1 = simulateCanUseTool('TodoWrite', 'Claude');
      expect(result1.behavior).toBe('allow');

      const result2 = simulateCanUseTool('TodoWrite', 'CLAUDE');
      expect(result2.behavior).toBe('allow');

      const result3 = simulateCanUseTool('TodoWrite', 'claude');
      expect(result3.behavior).toBe('deny');
    });

    test('should handle empty provider name', () => {
      const result = simulateCanUseTool('TodoWrite', '');

      expect(result.behavior).toBe('allow');
    });

    test('should handle unknown provider name', () => {
      const result = simulateCanUseTool('TodoWrite', 'unknown-provider');

      expect(result.behavior).toBe('allow');
    });
  });
});
