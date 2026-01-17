import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { IPty } from 'node-pty';
import stripAnsi from 'strip-ansi';

/**
 * Props for ClaudePanel component
 */
export interface ClaudePanelProps {
  /** PTY session handle for Claude CLI process */
  ptySession: IPty | null;

  /** Whether this panel has keyboard focus */
  focused: boolean;
}

/**
 * Claude Panel Component (Legacy PTY-based).
 *
 * Displays streaming output from Claude CLI PTY session. This is a legacy
 * component - modern TUI uses ClaudePanelAgent with Agent SDK instead.
 *
 * **Design**:
 * - Connects to Claude CLI via pseudo-terminal (node-pty)
 * - Strips ANSI escape codes and box-drawing characters
 * - Skips conversation history on initial connect (first 2 seconds)
 * - Shows connection status and session availability
 *
 * **Connection States**:
 * 1. No session: Shows "No Claude session active" message
 * 2. Connecting: Shows "⏳ Connecting..." with skip message
 * 3. Connected: Shows "✓ Connected! Start typing..."
 * 4. Streaming: Displays cleaned PTY output
 *
 * **Output Processing**:
 * - Removes ANSI escape sequences
 * - Removes box-drawing characters (│─┌┐└┘├┤┬┴┼)
 * - Collapses excessive newlines
 * - Filters echoed user input
 * - Trims whitespace
 *
 * **Focus Indicator**: Cyan border when focused, gray when not
 *
 * @component
 * @param {ClaudePanelProps} props - Component props
 *
 * @example
 * // Legacy PTY-based panel
 * const { ptySession } = useClaude({ sessionId: 'abc-123' });
 *
 * <ClaudePanel
 *   ptySession={ptySession}
 *   focused={panelFocused}
 * />
 *
 * @deprecated Use ClaudePanelAgent with Agent SDK for modern TUI
 */
export const ClaudePanel: React.FC<ClaudePanelProps> = ({
  ptySession,
  focused,
}) => {
  const [output, setOutput] = useState<string>('');
  const outputRef = useRef<string>('');
  const lastInputRef = useRef<string>('');
  const [skipReplay, setSkipReplay] = useState(true);
  const replayTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!ptySession) return;

    // Skip replay for first 2 seconds (session history)
    setSkipReplay(true);
    setOutput(
      '⏳ Connecting to Claude session...\n(Skipping conversation history)\n'
    );

    replayTimerRef.current = setTimeout(() => {
      setSkipReplay(false);
      setOutput('✓ Connected! Start typing...\n\n');
    }, 2000);

    const handleData = (data: string) => {
      // Skip replay - ignore all output during initial connection
      if (skipReplay) {
        return;
      }

      // Only strip ANSI escape codes and box-drawing characters
      // Keep all text content so user can see status updates
      let cleaned = stripAnsi(data);
      cleaned = cleaned.replace(/[│─┌┐└┘├┤┬┴┼]/g, '');

      // Remove excessive whitespace
      cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
      cleaned = cleaned.trim();

      // Don't display if it's just our echo or empty
      if (cleaned === lastInputRef.current || !cleaned) {
        lastInputRef.current = '';
        return;
      }

      outputRef.current += cleaned + '\n';
      setOutput(outputRef.current);
    };

    ptySession.onData(handleData);

    return () => {
      // Cleanup handled by parent
    };
  }, [ptySession]);

  if (!ptySession) {
    return (
      <Box
        flexDirection="column"
        borderTop
        borderBottom
        borderColor={focused ? 'cyan' : 'gray'}
        flexGrow={1}
        padding={1}
      >
        <Text dimColor>No Claude session active</Text>
        <Text dimColor>
          Start a Claude session first or use --session-id flag
        </Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderTop
      borderBottom
      borderColor={focused ? 'cyan' : 'gray'}
      flexGrow={1}
      paddingX={1}
    >
      <Text>{output}</Text>
    </Box>
  );
};
