import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  sessionId?: string;
  focused: boolean;
  tokenCount?: { input: number; output: number; total: number };
  mouseEnabled?: boolean;
  compressionThreshold?: number;
}

/**
 * Bottom status bar with help text and session info
 */
export const StatusBar: React.FC<StatusBarProps> = ({
  sessionId,
  focused,
  tokenCount,
  mouseEnabled = true,
  compressionThreshold = 150000,
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
    <Box borderTop borderColor="#30363d" paddingX={1} width="100%">
      <Text color="#8b949e">[Tab] Toggle Focus</Text>
      <Text color="#8b949e"> | </Text>
      <Text color="#8b949e">[M] Mouse: </Text>
      <Text color={mouseEnabled ? '#56d364' : '#f85149'}>
        {mouseEnabled ? 'ON' : 'OFF'}
      </Text>
      <Text color="#8b949e"> | </Text>
      {!focused && (
        <>
          <Text color="#8b949e">[↑↓/🖱️ ] Scroll</Text>
          <Text color="#8b949e"> | </Text>
        </>
      )}
      {focused && (
        <>
          <Text color="#8b949e">[ESC ESC] Clear</Text>
          <Text color="#8b949e"> | </Text>
        </>
      )}
      <Text color="#8b949e">[Ctrl+S] Save Log</Text>
      <Text color="#8b949e"> | </Text>
      <Text color="#8b949e">[Ctrl+C] Quit</Text>
      {sessionId && (
        <>
          <Text color="#8b949e"> | Session: </Text>
          <Text color="#9ed2f5">{sessionId.slice(0, 8)}</Text>
        </>
      )}
      {tokenCount && tokenCount.total > 0 && (
        <>
          <Text color="#8b949e"> | Tokens: </Text>
          <Text color={tokenCount.total > 160000 ? '#ff9f60' : '#ffc670'}>
            {formatTokens(tokenCount.total)}
          </Text>
          <Text color="#8b949e"> (</Text>
          <Text color={tokenCount.total > 160000 ? '#ff9f60' : '#ffc670'}>
            {tokenPercentage}%
          </Text>
          <Text color="#8b949e">)</Text>
          <Text color="#8b949e"> | Compress at: </Text>
          <Text color="#56d364">{formatTokens(compressionThreshold)}</Text>
        </>
      )}
    </Box>
  );
};
