import { useEffect, useState } from 'react';
import * as pty from 'node-pty';
import { IPty } from 'node-pty';

interface UseClaudeOptions {
  sessionId?: string;
}

/**
 * Hook to manage Claude PTY session
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
