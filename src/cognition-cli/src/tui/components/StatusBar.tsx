import React, { useEffect } from 'react';
import { Box, Text } from 'ink';
import { terminal } from '../services/TerminalService.js';
import { TUITheme } from '../theme.js';

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
  claude: { color: TUITheme.providers.anthropic, emoji: '🟠' },
  gemini: { color: TUITheme.providers.google, emoji: '🔵' },
  'gemini-agent': { color: TUITheme.providers.google, emoji: '🤖' },
  openai: { color: TUITheme.providers.openai, emoji: '⚪️' },
  minimax: { color: '#00D4AA', emoji: '🟢' },
};

// Model ID to display name mapping
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  // Claude models
  'claude-opus-4-5-20251101': 'Opus 4.5',
  'claude-sonnet-4-5-20250929': 'Sonnet 4.5',
  'claude-sonnet-4-20250514': 'Sonnet 4',
  // Gemini models
  'gemini-3-flash-preview': 'Gemini 3f',
  'gemini-3-pro-preview': 'Gemini 3p',
  'gemini-3.1-pro-preview': 'Gemini 3.1p',
  'gemini-3.1-pro-preview-customtools': 'Gemini 3.1p CustomTools',
  'gemini-2.5-flash': 'Gemini 2.5f (EOL)',
  'gemini-2.5-pro': 'Gemini 2.5p (EOL)',
  // Minimax models
  'MiniMax-M2.5': 'Minimax M2.5',
  'MiniMax-M2.5-highspeed': 'M2.5 Fast',
  'MiniMax-M2.1': 'Minimax M2.1',
  'MiniMax-M2.1-highspeed': 'M2.1 Fast',
  'MiniMax-M2': 'Minimax M2',
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
const StatusBarComponent: React.FC<StatusBarProps> = ({
  sessionId,
  focused,
  tokenCount,
  compressionThreshold = 120000,
  providerName = 'claude',
  modelId,
}) => {
  // Ensure terminal cursor is hidden when rendering the bottom bar.
  useEffect(() => {
    terminal.setCursorVisibility(false);
  }, []); // Run only on mount

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
    color: TUITheme.text.secondary,
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
        <Text color={providerStyle.color}>{providerStyle.emoji}</Text>
        <Text color={TUITheme.text.secondary}> {displayName}</Text>
        <Text color={TUITheme.ui.border.dim}> | </Text>
        <Text color={TUITheme.text.secondary}>[Tab] Toggle Focus</Text>
        <Text color={TUITheme.ui.border.dim}> | </Text>
        {!focused ? (
          <Text color={TUITheme.text.secondary}>[↑↓/⌨️ ] Scroll</Text>
        ) : (
          <Text color={TUITheme.text.secondary}>[ESC ESC] Clear</Text>
        )}
        <Text color={TUITheme.ui.border.dim}> | </Text>
        <Text color={TUITheme.text.secondary}>[Ctrl+S] 💬 Save</Text>
        <Text color={TUITheme.ui.border.dim}> | </Text>
        <Text color={TUITheme.text.secondary}>[Ctrl+C] Quit</Text>
        {sessionId && (
          <>
            <Text color={TUITheme.ui.border.dim}> | </Text>
            <Text color={TUITheme.text.secondary}>
              🪪 {sessionId.replace(/^[a-z]+-/, '').slice(0, 8)}
            </Text>
          </>
        )}
        {tokenCount && tokenCount.total > 0 && (
          <>
            <Text color={TUITheme.ui.border.dim}> | </Text>
            <Text color={TUITheme.text.secondary}>
              📊 {formatTokens(tokenCount.total)} ({tokenPercentage}%)
            </Text>
            <Text color={TUITheme.ui.border.dim}> | </Text>
            <Text color={TUITheme.text.secondary}>
              🗜️{EMOJI_SPACER} {formatTokens(compressionThreshold)}
            </Text>
          </>
        )}
      </>
    );
  };

  return (
    <Box
      borderTop
      borderColor={TUITheme.ui.border.default}
      paddingX={1}
      width="100%"
    >
      {renderStatusText()}
    </Box>
  );
};

export const StatusBar = React.memo(StatusBarComponent);
