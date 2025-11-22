import React from 'react';
import { Box, Text } from 'ink';

/**
 * Props for StatusBar component
 */
export interface StatusBarProps {
  /** Current session ID (displayed truncated) */
  sessionId?: string;

  /** Whether message panel has focus (changes keyboard help text) */
  focused: boolean;

  /** Current token usage statistics */
  tokenCount?: { input: number; output: number; total: number };

  /** Token threshold for compression trigger */
  compressionThreshold?: number;

  /** AI provider name (claude, openai, gemini, gemini-agent) */
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
 * Bottom Status Bar Component.
 *
 * Displays session information, keyboard shortcuts, token usage, and
 * provider status in a compact single-line footer.
 *
 * **Features**:
 * - Provider indicator with emoji and color
 * - Context-aware keyboard help (changes based on focus)
 * - Token usage with K suffix (e.g., "45.2K")
 * - Compression threshold percentage
 * - Truncated session ID for cleanliness
 *
 * **Keyboard Shortcuts Shown**:
 * - [Tab] Toggle Focus
 * - [↑↓/⌨️] Scroll (when panel focused) or Clear (when input focused)
 * - [ESC ESC] Interrupt/Clear
 * - [Ctrl+S] Save conversation
 * - [Ctrl+C] Quit
 *
 * **Token Display**:
 * - Shows current total tokens (formatted with K suffix)
 * - Shows percentage of compression threshold
 * - Shows threshold value for reference
 * - Example: "📊 45.2K (37.7%) | 🗜️ 120K"
 *
 * @component
 * @param {StatusBarProps} props - Component props
 *
 * @example
 * <StatusBar
 *   sessionId="claude-abc123def456"
 *   focused={panelFocused}
 *   tokenCount={{ input: 5000, output: 10000, total: 15000 }}
 *   compressionThreshold={80000}
 *   providerName="claude"
 * />
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
