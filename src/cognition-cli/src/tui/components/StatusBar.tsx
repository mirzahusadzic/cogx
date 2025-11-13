import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  sessionId?: string;
  focused: boolean;
  tokenCount?: { input: number; output: number; total: number };
  compressionThreshold?: number;
}

/**
 * Bottom status bar with help text and session info
 */
export const StatusBar: React.FC<StatusBarProps> = ({
  sessionId,
  focused,
  tokenCount,
  compressionThreshold = 120000,
}) => {
  // Format token count with K suffix for readability
  const formatTokens = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  // Calculate percentage of compression threshold
  const tokenPercentage = tokenCount
    ? ((tokenCount.total / compressionThreshold) * 100).toFixed(1)
    : '0.0';

  // Build status bar as single string to avoid wrapping issues
  const buildStatusText = () => {
    let text = '[Tab] Toggle Focus';

    if (!focused) {
      text += ' | [↑↓/🖱️ ] Scroll';
    } else {
      text += ' | [ESC ESC] Clear';
    }

    text += ' | [Ctrl+S] 💬 Save | [Ctrl+C] Quit';

    if (sessionId) {
      text += ` | 🔗 ${sessionId.slice(0, 8)}`;
    }

    if (tokenCount && tokenCount.total > 0) {
      text += ` | 📊 ${formatTokens(tokenCount.total)} (${tokenPercentage}%)`;
      text += ` | 🗜️  ${formatTokens(compressionThreshold)}`;
    }

    return text;
  };

  return (
    <Box borderTop borderColor="#30363d" paddingX={1} width="100%">
      <Text color="#8b949e">{buildStatusText()}</Text>
    </Box>
  );
};
