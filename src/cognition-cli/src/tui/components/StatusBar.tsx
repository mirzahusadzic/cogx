import React from 'react';
import { Box, Text } from 'ink';

// Extra space needed after certain emojis on macOS (terminal width calculation differs)
const EMOJI_SPACER = process.platform === 'darwin' ? ' ' : '';

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

  /** AI provider name (claude, gemini, gemini-agent) */
  providerName?: string;

  /** Model ID for display (e.g., claude-opus-4-5-20251101) */
  modelId?: string;
}

// Provider color/emoji mapping
const PROVIDER_STYLES: Record<string, { color: string; emoji: string }> = {
  claude: { color: '#d4a574', emoji: '🟠' },
  gemini: { color: '#4285f4', emoji: '🔵' },
  'gemini-agent': { color: '#4285f4', emoji: '🤖' },
};

// Model ID to display name mapping
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  // Claude models
  'claude-opus-4-5-20251101': 'Opus 4.5',
  'claude-sonnet-4-5-20250929': 'Sonnet 4.5',
  'claude-sonnet-4-20250514': 'Sonnet 4',
  // Gemini models
  'gemini-2.5-flash': 'Gemini 2.5f',
  'gemini-2.5-pro': 'Gemini 2.5p',
  'gemini-3-pro-preview': 'Gemini 3p',
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
  modelId,
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

  // Build status bar with dimmed pipe separators
  const renderStatusText = () => {
    // Model/provider indicator at start
    // Use model display name if available, otherwise capitalize provider name
    const displayName = modelId
      ? MODEL_DISPLAY_NAMES[modelId] || modelId
      : providerName.charAt(0).toUpperCase() + providerName.slice(1);

    return (
      <>
        <Text color="#8b949e">
          {providerStyle.emoji} {displayName}
        </Text>
        <Text color="#3a3f4b"> | </Text>
        <Text color="#8b949e">[Tab] Toggle Focus</Text>
        <Text color="#3a3f4b"> | </Text>
        {!focused ? (
          <Text color="#8b949e">[↑↓/⌨️ ] Scroll</Text>
        ) : (
          <Text color="#8b949e">[ESC ESC] Clear</Text>
        )}
        <Text color="#3a3f4b"> | </Text>
        <Text color="#8b949e">[Ctrl+S] 💬 Save</Text>
        <Text color="#3a3f4b"> | </Text>
        <Text color="#8b949e">[Ctrl+C] Quit</Text>
        {sessionId && (
          <>
            <Text color="#3a3f4b"> | </Text>
            <Text color="#8b949e">
              🪪 {sessionId.replace(/^[a-z]+-/, '').slice(0, 8)}
            </Text>
          </>
        )}
        {tokenCount && tokenCount.total > 0 && (
          <>
            <Text color="#3a3f4b"> | </Text>
            <Text color="#8b949e">
              📊 {formatTokens(tokenCount.total)} ({tokenPercentage}%)
            </Text>
            <Text color="#3a3f4b"> | </Text>
            <Text color="#8b949e">
              🗜️{EMOJI_SPACER} {formatTokens(compressionThreshold)}
            </Text>
          </>
        )}
      </>
    );
  };

  return (
    <Box borderTop borderColor="#30363d" paddingX={1} width="100%">
      {renderStatusText()}
    </Box>
  );
};
