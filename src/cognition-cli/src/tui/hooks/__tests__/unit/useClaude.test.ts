/**
 * Tests for useClaude hook (Legacy PTY-based)
 *
 * Tests the legacy PTY-based Claude session management hook.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { EventEmitter } from 'events';

// Mock PTY session
class MockPtySession extends EventEmitter {
  write = vi.fn();
  kill = vi.fn();
  onData = vi.fn((callback: (data: string) => void) => {
    this.on('data', callback);
    return { dispose: () => this.off('data', callback) };
  });
  onExit = vi.fn((callback: (event: { exitCode: number }) => void) => {
    this.on('exit', callback);
  });
}

let mockSession: MockPtySession;

// Mock node-pty
vi.mock('node-pty', () => ({
  spawn: vi.fn(() => {
    mockSession = new MockPtySession();
    return mockSession;
  }),
}));

// Import after mocking
import { useClaude } from '../../useClaude.js';
import * as pty from 'node-pty';

describe('useClaude', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = new MockPtySession();
  });

  describe('initialization', () => {
    it('should not spawn PTY without sessionId', () => {
      const { result } = renderHook(() => useClaude({}));

      expect(pty.spawn).not.toHaveBeenCalled();
      expect(result.current.ptySession).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should spawn PTY with sessionId', () => {
      renderHook(() => useClaude({ sessionId: 'test-session-123' }));

      expect(pty.spawn).toHaveBeenCalledWith(
        'claude',
        ['--resume', 'test-session-123'],
        expect.objectContaining({
          name: 'xterm-color',
          cwd: expect.any(String),
          env: expect.any(Object),
        })
      );
    });

    it('should set ptySession after spawn', async () => {
      const { result } = renderHook(() =>
        useClaude({ sessionId: 'test-session' })
      );

      await waitFor(() => {
        expect(result.current.ptySession).not.toBeNull();
      });
    });

    it('should use current terminal dimensions', () => {
      renderHook(() => useClaude({ sessionId: 'test' }));

      expect(pty.spawn).toHaveBeenCalledWith(
        'claude',
        expect.any(Array),
        expect.objectContaining({
          cols: expect.any(Number),
          rows: expect.any(Number),
        })
      );

      // Verify the spawn call includes terminal dimensions
      const spawnCall = (pty.spawn as ReturnType<typeof vi.fn>).mock.calls[0];
      const options = spawnCall[2];
      expect(options.cols).toBeGreaterThan(0);
      expect(options.rows).toBeGreaterThan(0);
    });

    it('should use default dimensions if not available', () => {
      // In test environment, process.stdout may not have columns/rows
      // The hook should fall back to defaults (80x30)
      renderHook(() => useClaude({ sessionId: 'test' }));

      expect(pty.spawn).toHaveBeenCalledWith(
        'claude',
        expect.any(Array),
        expect.objectContaining({
          cols: expect.any(Number),
          rows: expect.any(Number),
        })
      );

      // Verify reasonable defaults are used
      const spawnCall = (pty.spawn as ReturnType<typeof vi.fn>).mock.calls[0];
      const options = spawnCall[2];
      // Default should be at least 80 cols and 24 rows (common minimums)
      expect(options.cols).toBeGreaterThanOrEqual(80);
      expect(options.rows).toBeGreaterThanOrEqual(24);
    });
  });

  describe('write function', () => {
    it('should write to PTY session', async () => {
      const { result } = renderHook(() =>
        useClaude({ sessionId: 'test-session' })
      );

      await waitFor(() => {
        expect(result.current.ptySession).not.toBeNull();
      });

      act(() => {
        result.current.write('Hello, Claude!\n');
      });

      expect(mockSession.write).toHaveBeenCalledWith('Hello, Claude!\n');
    });

    it('should not throw if ptySession is null', () => {
      const { result } = renderHook(() => useClaude({}));

      // Should not throw
      act(() => {
        result.current.write('test');
      });

      expect(result.current.ptySession).toBeNull();
    });
  });

  describe('exit handling', () => {
    it('should set error on non-zero exit code', async () => {
      const { result } = renderHook(() =>
        useClaude({ sessionId: 'test-session' })
      );

      await waitFor(() => {
        expect(result.current.ptySession).not.toBeNull();
      });

      act(() => {
        mockSession.emit('exit', { exitCode: 1 });
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Claude session exited with code 1');
        expect(result.current.ptySession).toBeNull();
      });
    });

    it('should clear session on zero exit code', async () => {
      const { result } = renderHook(() =>
        useClaude({ sessionId: 'test-session' })
      );

      await waitFor(() => {
        expect(result.current.ptySession).not.toBeNull();
      });

      act(() => {
        mockSession.emit('exit', { exitCode: 0 });
      });

      await waitFor(() => {
        expect(result.current.ptySession).toBeNull();
        expect(result.current.error).toBeNull();
      });
    });
  });

  describe('cleanup', () => {
    it('should kill PTY on unmount', async () => {
      const { unmount } = renderHook(() =>
        useClaude({ sessionId: 'test-session' })
      );

      await waitFor(() => {
        expect(mockSession).toBeDefined();
      });

      unmount();

      expect(mockSession.kill).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle spawn errors', () => {
      (pty.spawn as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Failed to spawn PTY');
      });

      const { result } = renderHook(() =>
        useClaude({ sessionId: 'test-session' })
      );

      expect(result.current.error).toBe('Failed to spawn PTY');
      expect(result.current.ptySession).toBeNull();
    });
  });

  describe('session changes', () => {
    it('should restart PTY when sessionId changes', async () => {
      const { rerender } = renderHook(
        ({ sessionId }) => useClaude({ sessionId }),
        { initialProps: { sessionId: 'session-1' } }
      );

      await waitFor(() => {
        expect(pty.spawn).toHaveBeenCalledTimes(1);
      });

      rerender({ sessionId: 'session-2' });

      await waitFor(() => {
        expect(pty.spawn).toHaveBeenCalledTimes(2);
      });

      expect(pty.spawn).toHaveBeenLastCalledWith(
        'claude',
        ['--resume', 'session-2'],
        expect.any(Object)
      );
    });
  });

  describe('return value', () => {
    it('should return ptySession, write, and error', () => {
      const { result } = renderHook(() => useClaude({}));

      expect(result.current).toHaveProperty('ptySession');
      expect(result.current).toHaveProperty('write');
      expect(result.current).toHaveProperty('error');
      expect(typeof result.current.write).toBe('function');
    });
  });
});
