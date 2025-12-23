/**
 * Tests for useToolConfirmation hook
 *
 * Tests the tool confirmation state machine for interactive prompts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToolConfirmation } from '../../useToolConfirmation.js';

// Mock the tool-safety module
vi.mock('../../../utils/tool-safety.js', () => ({
  checkToolSafety: vi.fn((toolName: string, input: unknown) => {
    // Simulate safe tools
    if (toolName === 'Read' || toolName === 'Glob') {
      return {
        requiresConfirmation: false,
        riskLevel: 'safe',
        reason: 'Read-only operation',
      };
    }
    // Simulate dangerous tools
    if (toolName === 'Bash') {
      const command = (input as { command?: string })?.command || '';
      if (command.includes('rm -rf')) {
        return {
          requiresConfirmation: true,
          riskLevel: 'high',
          reason: 'Destructive command',
        };
      }
      return {
        requiresConfirmation: true,
        riskLevel: 'medium',
        reason: 'Shell command execution',
      };
    }
    return {
      requiresConfirmation: true,
      riskLevel: 'medium',
      reason: 'Unknown tool',
    };
  }),
  formatToolInput: vi.fn((toolName: string, input: unknown) => {
    if (toolName === 'Bash' || toolName.toLowerCase() === 'bash') {
      return (input as { command?: string })?.command || '';
    }
    return JSON.stringify(input);
  }),
  extractBaseCommand: vi.fn((command: string) => {
    const parts = command.trim().split(/\s+/);
    return parts[0] || null;
  }),
  ToolRiskLevel: {
    safe: 'safe',
    low: 'low',
    medium: 'medium',
    high: 'high',
  },
}));

describe('useToolConfirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with no pending confirmation', () => {
      const { result } = renderHook(() => useToolConfirmation());
      expect(result.current.confirmationState).toBeNull();
    });

    it('should provide all required functions', () => {
      const { result } = renderHook(() => useToolConfirmation());
      expect(typeof result.current.requestConfirmation).toBe('function');
      expect(typeof result.current.allow).toBe('function');
      expect(typeof result.current.deny).toBe('function');
      expect(typeof result.current.alwaysAllow).toBe('function');
      expect(typeof result.current.clearSessionAllowList).toBe('function');
    });
  });

  describe('requestConfirmation', () => {
    it('should auto-allow safe tools', async () => {
      const { result } = renderHook(() => useToolConfirmation());

      let decision: string | undefined;
      await act(async () => {
        decision = await result.current.requestConfirmation('Read', {
          file_path: '/test.txt',
        });
      });

      expect(decision).toBe('allow');
      expect(result.current.confirmationState).toBeNull();
    });

    it('should request confirmation for dangerous tools', async () => {
      const { result } = renderHook(() => useToolConfirmation());

      // Start confirmation request (don't await - it will wait for user action)
      let confirmationPromise: Promise<'allow' | 'deny'>;
      act(() => {
        confirmationPromise = result.current.requestConfirmation('Bash', {
          command: 'npm install',
        });
      });

      // Check that confirmation state is set
      expect(result.current.confirmationState).not.toBeNull();
      expect(result.current.confirmationState?.pending).toBe(true);
      expect(result.current.confirmationState?.toolName).toBe('Bash');
      expect(result.current.confirmationState?.riskLevel).toBe('medium');

      // Allow the tool
      await act(async () => {
        result.current.allow();
      });

      const decision = await confirmationPromise!;
      expect(decision).toBe('allow');
      expect(result.current.confirmationState).toBeNull();
    });

    it('should handle deny action', async () => {
      const { result } = renderHook(() => useToolConfirmation());

      let confirmationPromise: Promise<'allow' | 'deny'>;
      act(() => {
        confirmationPromise = result.current.requestConfirmation('Bash', {
          command: 'rm -rf /',
        });
      });

      expect(result.current.confirmationState?.riskLevel).toBe('high');

      await act(async () => {
        result.current.deny();
      });

      const decision = await confirmationPromise!;
      expect(decision).toBe('deny');
      expect(result.current.confirmationState).toBeNull();
    });

    it('should include reason in confirmation state', async () => {
      const { result } = renderHook(() => useToolConfirmation());

      act(() => {
        result.current.requestConfirmation('Bash', { command: 'ls -la' });
      });

      expect(result.current.confirmationState?.reason).toBe(
        'Shell command execution'
      );
    });
  });

  describe('alwaysAllow (session allow list)', () => {
    it('should remember allowed bash commands for session', async () => {
      const { result } = renderHook(() => useToolConfirmation());

      // First request - needs confirmation
      let promise1: Promise<'allow' | 'deny'>;
      act(() => {
        promise1 = result.current.requestConfirmation('Bash', {
          command: 'npm test',
        });
      });

      expect(result.current.confirmationState).not.toBeNull();

      // Use alwaysAllow
      await act(async () => {
        result.current.alwaysAllow();
      });

      const decision1 = await promise1!;
      expect(decision1).toBe('allow');

      // Second request with same base command - should auto-allow
      let decision2: string | undefined;
      await act(async () => {
        decision2 = await result.current.requestConfirmation('Bash', {
          command: 'npm install',
        });
      });

      expect(decision2).toBe('allow');
      expect(result.current.confirmationState).toBeNull();
    });

    it('should not auto-allow different base commands', async () => {
      const { result } = renderHook(() => useToolConfirmation());

      // Allow npm
      let promise1: Promise<'allow' | 'deny'>;
      act(() => {
        promise1 = result.current.requestConfirmation('Bash', {
          command: 'npm test',
        });
      });

      await act(async () => {
        result.current.alwaysAllow();
      });

      await promise1!;

      // git should still require confirmation
      act(() => {
        result.current.requestConfirmation('Bash', { command: 'git status' });
      });

      expect(result.current.confirmationState).not.toBeNull();
      expect(result.current.confirmationState?.toolName).toBe('Bash');
    });

    it('should clear session allow list', async () => {
      const { result } = renderHook(() => useToolConfirmation());

      // Allow a command
      let promise: Promise<'allow' | 'deny'>;
      act(() => {
        promise = result.current.requestConfirmation('Bash', {
          command: 'npm test',
        });
      });

      await act(async () => {
        result.current.alwaysAllow();
      });

      await promise!;

      // Clear the allow list
      act(() => {
        result.current.clearSessionAllowList();
      });

      // Same command should now require confirmation again
      act(() => {
        result.current.requestConfirmation('Bash', { command: 'npm test' });
      });

      expect(result.current.confirmationState).not.toBeNull();
    });
  });

  describe('allow action', () => {
    it('should resolve promise with allow', async () => {
      const { result } = renderHook(() => useToolConfirmation());

      let promise: Promise<'allow' | 'deny'>;
      act(() => {
        promise = result.current.requestConfirmation('Bash', {
          command: 'echo hello',
        });
      });

      await act(async () => {
        result.current.allow();
      });

      const decision = await promise!;
      expect(decision).toBe('allow');
    });

    it('should clear confirmation state', async () => {
      const { result } = renderHook(() => useToolConfirmation());

      act(() => {
        result.current.requestConfirmation('Bash', { command: 'ls' });
      });

      expect(result.current.confirmationState).not.toBeNull();

      await act(async () => {
        result.current.allow();
      });

      expect(result.current.confirmationState).toBeNull();
    });

    it('should handle allow when no confirmation pending', () => {
      const { result } = renderHook(() => useToolConfirmation());

      // Should not throw
      act(() => {
        result.current.allow();
      });

      expect(result.current.confirmationState).toBeNull();
    });
  });

  describe('deny action', () => {
    it('should resolve promise with deny', async () => {
      const { result } = renderHook(() => useToolConfirmation());

      let promise: Promise<'allow' | 'deny'>;
      act(() => {
        promise = result.current.requestConfirmation('Bash', {
          command: 'rm -rf /',
        });
      });

      await act(async () => {
        result.current.deny();
      });

      const decision = await promise!;
      expect(decision).toBe('deny');
    });

    it('should clear confirmation state', async () => {
      const { result } = renderHook(() => useToolConfirmation());

      act(() => {
        result.current.requestConfirmation('Bash', { command: 'ls' });
      });

      await act(async () => {
        result.current.deny();
      });

      expect(result.current.confirmationState).toBeNull();
    });

    it('should handle deny when no confirmation pending', () => {
      const { result } = renderHook(() => useToolConfirmation());

      // Should not throw
      act(() => {
        result.current.deny();
      });

      expect(result.current.confirmationState).toBeNull();
    });
  });

  describe('confirmation state structure', () => {
    it('should include all required fields', async () => {
      const { result } = renderHook(() => useToolConfirmation());

      act(() => {
        result.current.requestConfirmation('Bash', {
          command: 'npm run build',
        });
      });

      const state = result.current.confirmationState;
      expect(state).toMatchObject({
        pending: true,
        toolName: 'Bash',
        input: { command: 'npm run build' },
        riskLevel: expect.any(String),
        reason: expect.any(String),
      });
    });
  });

  describe('concurrent requests', () => {
    it('should handle sequential confirmations', async () => {
      const { result } = renderHook(() => useToolConfirmation());

      // First request
      let promise1: Promise<'allow' | 'deny'>;
      act(() => {
        promise1 = result.current.requestConfirmation('Bash', {
          command: 'echo 1',
        });
      });

      await act(async () => {
        result.current.allow();
      });

      const decision1 = await promise1!;
      expect(decision1).toBe('allow');

      // Second request
      let promise2: Promise<'allow' | 'deny'>;
      act(() => {
        promise2 = result.current.requestConfirmation('Bash', {
          command: 'echo 2',
        });
      });

      await act(async () => {
        result.current.deny();
      });

      const decision2 = await promise2!;
      expect(decision2).toBe('deny');
    });
  });
});
