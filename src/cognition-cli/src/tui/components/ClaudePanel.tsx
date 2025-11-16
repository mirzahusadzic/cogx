import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { IPty } from 'node-pty';

interface ClaudePanelProps {
  ptySession: IPty | null;
  focused: boolean;
}

/**
 * Main panel showing streaming Claude output
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
      // eslint-disable-next-line no-control-regex
      let cleaned = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
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
