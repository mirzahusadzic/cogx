import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  sessionId?: string;
  focused: boolean;
}

/**
 * Bottom status bar with help text and session info
 */
export const StatusBar: React.FC<StatusBarProps> = ({ sessionId, focused }) => {
  return (
    <Box borderTop borderColor="gray" paddingX={1} width="100%">
      <Text dimColor>[Tab] Toggle Focus</Text>
      <Text dimColor> | </Text>
      {!focused && (
        <>
          <Text dimColor>[↑↓] Scroll</Text>
          <Text dimColor> | </Text>
        </>
      )}
      <Text dimColor>[Ctrl+C] Quit</Text>
      {sessionId && (
        <>
          <Text dimColor> | Session: </Text>
          <Text color="cyan">{sessionId.slice(0, 8)}</Text>
        </>
      )}
    </Box>
  );
};
