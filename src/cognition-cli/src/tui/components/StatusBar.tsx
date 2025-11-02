import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  sessionId?: string;
  focused: boolean;
  tokenCount?: { input: number; output: number; total: number };
}

/**
 * Bottom status bar with help text and session info
 */
export const StatusBar: React.FC<StatusBarProps> = ({
  sessionId,
  focused,
  tokenCount,
}) => {
  // Format token count with K suffix for readability
  const formatTokens = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  // Calculate percentage of 200K limit
  const tokenPercentage = tokenCount
    ? ((tokenCount.total / 200000) * 100).toFixed(1)
    : '0.0';

  return (
    <Box borderTop borderColor="gray" paddingX={1} width="100%">
      <Text dimColor>[Tab] Toggle Focus</Text>
      <Text dimColor> | </Text>
      {!focused && (
        <>
          <Text dimColor>[↑↓/🖱️ ] Scroll</Text>
          <Text dimColor> | </Text>
        </>
      )}
      {focused && (
        <>
          <Text dimColor>[ESC ESC] Clear</Text>
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
      {tokenCount && tokenCount.total > 0 && (
        <>
          <Text dimColor> | Tokens: </Text>
          <Text color={tokenCount.total > 160000 ? 'red' : 'yellow'}>
            {formatTokens(tokenCount.total)}
          </Text>
          <Text dimColor> (</Text>
          <Text color={tokenCount.total > 160000 ? 'red' : 'yellow'}>
            {tokenPercentage}%
          </Text>
          <Text dimColor>)</Text>
        </>
      )}
    </Box>
  );
};
