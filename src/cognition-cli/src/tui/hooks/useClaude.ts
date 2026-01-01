/**
 * Claude PTY Session Manager (Legacy)
 *
 * React hook for managing Claude CLI sessions via pseudo-terminal (PTY).
 * Spawns a child Claude process in a real terminal emulator, enabling
 * interactive session management with terminal escape sequences.
 *
 * DESIGN:
 * This is a legacy hook - modern TUI uses useClaudeAgent with Agent SDK instead.
 * Kept for backward compatibility and reference.
 *
 * The PTY approach provides:
 * - Real terminal emulation (colors, cursor control, etc.)
 * - Session resumption via --resume flag
 * - Exit code handling
 *
 * However, it has limitations:
 * - Limited programmatic control over Claude behavior
 * - No access to internal state (thinking tokens, tool calls)
 * - Difficult to parse streaming output
 *
 * For new code, prefer useClaudeAgent which uses the Agent SDK
 * for deeper integration.
 *
 * @example
 * // Legacy PTY-based Claude session
 * const { ptySession, write, error } = useClaude({
 *   sessionId: 'my-session-123'
 * });
 *
 * if (ptySession) {
 *   ptySession.onData((data) => {
 *     systemLog('tui', `Claude output: ${data}`);
 *   });
 *
 *   write('What is 2+2?\n');
 * }
 */

import { useEffect, useState } from 'react';
import * as pty from 'node-pty';
import { IPty } from 'node-pty';

/**
 * Configuration options for PTY-based Claude session
 */
export interface UseClaudeOptions {
  /**
   * Session ID to resume (passed to --resume flag)
   * If not provided, starts fresh session
   */
  sessionId?: string;
}

/**
 * Manages Claude CLI session via pseudo-terminal (PTY).
 *
 * ALGORITHM:
 * 1. Spawn Claude process with node-pty
 * 2. Configure terminal size from current stdout
 * 3. Attach exit handler to track session end
 * 4. Return session handle for reading/writing
 * 5. Clean up on unmount
 *
 * The PTY provides bidirectional communication:
 * - write() sends input to Claude's stdin
 * - onData() receives output from Claude's stdout/stderr
 *
 * @param options - Configuration for session management
 * @returns Object with PTY session, write function, and error state
 *
 * @example
 * // Start new PTY session
 * const { ptySession, write } = useClaude({});
 *
 * @example
 * // Resume existing session
 * const { ptySession, write, error } = useClaude({
 *   sessionId: 'abc-123'
 * });
 *
 * if (error) {
 *   systemLog('tui', 'Session failed', { error }, 'error');
 * }
 */
export function useClaude(options: UseClaudeOptions) {
  const [ptySession, setPtySession] = useState<IPty | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!options.sessionId) {
      return;
    }

    try {
      // Spawn Claude in a PTY (real terminal)
      const session = pty.spawn('claude', ['--resume', options.sessionId], {
        name: 'xterm-color',
        cols: process.stdout.columns || 80,
        rows: process.stdout.rows || 30,
        cwd: process.cwd(),
        env: process.env as { [key: string]: string },
      });

      // Note: Not disabling local echo - let PTY handle it naturally

      session.onExit(({ exitCode }) => {
        if (exitCode !== 0) {
          setError(`Claude session exited with code ${exitCode}`);
        }
        setPtySession(null);
      });

      setPtySession(session);

      return () => {
        session.kill();
      };
    } catch (err) {
      setError((err as Error).message);
    }
  }, [options.sessionId]);

  const write = (data: string) => {
    if (ptySession) {
      ptySession.write(data);
    }
  };

  return {
    ptySession,
    write,
    error,
  };
}
