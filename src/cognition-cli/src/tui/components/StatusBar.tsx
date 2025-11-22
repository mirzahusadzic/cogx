import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  sessionId?: string;
  focused: boolean;
  tokenCount?: { input: number; output: number; total: number };
  compressionThreshold?: number;
  providerName?: string;
}

// Provider color/emoji mapping
const PROVIDER_STYLES: Record<string, { color: string; emoji: string }> = {
  claude: { color: '#d4a574', emoji: '🟠' },
  openai: { color: '#10a37f', emoji: '🟢' },
  gemini: { color: '#4285f4', emoji: '🔵' },
  'gemini-agent': { color: '#4285f4', emoji: '🤖' },
};

/**
 * Bottom status bar with help text and session info
 */
export const StatusBar: React.FC<StatusBarProps> = ({
  sessionId,
  focused,
  tokenCount,
  compressionThreshold = 120000,
  providerName = 'claude',
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

  // Get provider style
  const providerStyle = PROVIDER_STYLES[providerName] || {
    color: '#8b949e',
    emoji: '⚪',
  };

  // Build status bar as single string to avoid wrapping issues
  const buildStatusText = () => {
    // Provider indicator at start
    let text = `${providerStyle.emoji} ${providerName}`;

    text += ' | [Tab] Toggle Focus';

    if (!focused) {
      text += ' | [↑↓/⌨️ ] Scroll';
    } else {
      text += ' | [ESC ESC] Clear';
    }

    text += ' | [Ctrl+S] 💬 Save | [Ctrl+C] Quit';

    if (sessionId) {
      // Strip provider prefix (e.g., "gemini-", "claude-") for cleaner display
      const displayId = sessionId.replace(/^[a-z]+-/, '');
      text += ` | 🔗 ${displayId.slice(0, 8)}`;
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
