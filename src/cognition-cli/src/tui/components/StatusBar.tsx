import React, { useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';
import { terminal } from '../services/TerminalService.js';
import { TUITheme } from '../theme.js';
import { formatCompactNumber } from '../../utils/string-utils.js';
import type { SessionTokenCount } from '../hooks/tokens/useSessionTokenCount.js';

// Extra space needed after certain emojis on macOS/WSL2 (terminal width calculation differs)
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
  tokenCount?: {
    input: number;
    output: number;
    total: number;
    cached?: number;
  };

  /** Cumulative session token statistics */
  sessionTokenCount?: SessionTokenCount;

  /** Token threshold for compression trigger */
  compressionThreshold?: number;

  /** Semantic compression threshold */
  semanticThreshold?: number;

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
 * - Shows proportional bar with cached, active, and remaining tokens
 * - Shows remaining context window capacity (⏳)
 * - Shows compression thresholds (🗜️)
 * - Example: "📊 45.2k/200k [###Σ...] ⏳ 155k | 🗜️ [Σ 50k/200k]"
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
  sessionTokenCount,
  compressionThreshold = 200000,
  semanticThreshold = 50000,
  providerName = 'claude',
  modelId,
}) => {
  // Ensure terminal cursor is hidden when rendering the bottom bar.
  useEffect(() => {
    terminal.setCursorVisibility(false);
  }, []); // Run only on mount

  // Calculate token breakdown for the bar
  const totalTokens = tokenCount?.total || 0;
  const cachedTokens = tokenCount?.cached || 0;
  // Active tokens are what is currently in context and NOT cached
  const activeTokens = Math.max(0, totalTokens - cachedTokens);
  // Remaining tokens are calculated from the semantic threshold (50k)
  const remainingTokens = Math.max(0, semanticThreshold - totalTokens);

  // Calculate proportional bar widths (total 16 characters for better resolution)
  const BAR_WIDTH = 16;
  const markerPos = Math.floor(
    (semanticThreshold / compressionThreshold) * BAR_WIDTH
  );

  // Widths are relative to the compressionThreshold (200k)
  let aWidth = Math.floor((activeTokens / compressionThreshold) * BAR_WIDTH);
  let cWidth = Math.floor((cachedTokens / compressionThreshold) * BAR_WIDTH);
  // Ensure we don't exceed BAR_WIDTH
  if (aWidth + cWidth > BAR_WIDTH) {
    const ratio = BAR_WIDTH / (aWidth + cWidth);
    aWidth = Math.floor(aWidth * ratio);
    cWidth = Math.floor(cWidth * ratio);
  }

  // Ensure visibility for small but non-zero counts
  if (activeTokens > 0 && aWidth === 0) aWidth = 1;
  if (cachedTokens > 0 && cWidth === 0) cWidth = 1;

  // Cap at BAR_WIDTH
  if (aWidth + cWidth > BAR_WIDTH) {
    if (aWidth > cWidth) aWidth = BAR_WIDTH - cWidth;
    else cWidth = BAR_WIDTH - aWidth;
  }

  const rWidth = Math.max(0, BAR_WIDTH - aWidth - cWidth);

  // Get provider style
  const providerStyle = PROVIDER_STYLES[providerName] || {
    color: TUITheme.text.secondary,
    emoji: '⚪',
  };

  // Memoize status text calculation to ensure stability during high-frequency updates
  const statusContent = useMemo(() => {
    // Model/provider indicator at start
    const displayName = modelId
      ? MODEL_DISPLAY_NAMES[modelId] || modelId
      : providerName.charAt(0).toUpperCase() + providerName.slice(1);

    return (
      <>
        <Text color={providerStyle.color}>{providerStyle.emoji}</Text>
        <Text color={TUITheme.text.secondary}> {displayName}</Text>
        <Text color={TUITheme.ui.border.dim}> | </Text>

        {/* Compact help text when narrow? For now just keep it clean */}
        <Text color={TUITheme.text.secondary}>[Tab] Focus</Text>
        <Text color={TUITheme.ui.border.dim}> | </Text>
        {!focused ? (
          <Text color={TUITheme.text.secondary}>[↑↓] Scroll</Text>
        ) : (
          <Text color={TUITheme.text.secondary}>[ESC] Clear</Text>
        )}
        <Text color={TUITheme.ui.border.dim}> | </Text>
        <Text color={TUITheme.text.secondary}>[^S] Save</Text>
        <Text color={TUITheme.ui.border.dim}> | </Text>
        <Text color={TUITheme.text.secondary}>[^C] Quit</Text>

        {sessionId && (
          <>
            <Text color={TUITheme.ui.border.dim}> | </Text>
            <Text color={TUITheme.text.secondary}>
              🪪 {sessionId.replace(/^[a-z]+-/, '').slice(0, 8)}
            </Text>
            {(sessionTokenCount?.total || 0) > 0 && (
              <>
                <Text color={TUITheme.text.secondary}> [</Text>
                <Text color={TUITheme.providers.google}>
                  {formatCompactNumber(sessionTokenCount?.cached || 0)}
                </Text>
                <Text color={TUITheme.text.secondary}>/</Text>
                <Text color={TUITheme.text.success}>
                  {formatCompactNumber(sessionTokenCount?.total || 0)}
                </Text>
                <Text color={TUITheme.text.secondary}>]</Text>
              </>
            )}
          </>
        )}

        {(tokenCount || (sessionTokenCount?.total || 0) > 0) && (
          <>
            <Text color={TUITheme.ui.border.dim}> | </Text>
            <Text color={TUITheme.text.secondary}>
              📊{' '}
              <Text color={TUITheme.providers.google}>
                {formatCompactNumber(cachedTokens)}
              </Text>
              <Text color={TUITheme.text.secondary}>/</Text>
              <Text color={TUITheme.text.success}>
                {formatCompactNumber(totalTokens)}
              </Text>
            </Text>

            {/* Visual Bar [active cached remaining] */}
            <Text color={TUITheme.text.secondary}> [</Text>
            {cWidth > 0 && (
              <Text backgroundColor={TUITheme.providers.google}>
                {' '.repeat(cWidth)}
              </Text>
            )}
            {aWidth > 0 && (
              <Text backgroundColor={TUITheme.text.success}>
                {' '.repeat(aWidth)}
              </Text>
            )}
            {rWidth > 0 && (
              <Text color={TUITheme.ui.border.dim}>
                {Array.from({ length: rWidth })
                  .map((_, i) => {
                    const absolutePos = cWidth + aWidth + i;
                    // If marker is at this position, show Σ, else .
                    return absolutePos === markerPos ? 'Σ' : '.';
                  })
                  .join('')}
              </Text>
            )}
            <Text color={TUITheme.text.secondary}>] </Text>

            {/* Remaining in Context */}
            <Text color={TUITheme.text.secondary}>
              ⏳ {formatCompactNumber(remainingTokens)}
            </Text>

            <Text color={TUITheme.ui.border.dim}> | </Text>

            {/* Threshold */}
            <Text color={TUITheme.text.secondary}>
              🗜️{EMOJI_SPACER} [Σ {formatCompactNumber(semanticThreshold)}/
              {formatCompactNumber(compressionThreshold)}]
            </Text>
          </>
        )}
      </>
    );
  }, [
    providerStyle,
    providerName,
    modelId,
    focused,
    sessionId,
    tokenCount,
    sessionTokenCount,
    totalTokens,
    remainingTokens,
    compressionThreshold,
    semanticThreshold,
    aWidth,
    cWidth,
    rWidth,
  ]);

  return (
    <Box
      borderTop
      flexDirection="row"
      borderColor={TUITheme.ui.border.default}
      paddingX={1}
      width="100%"
    >
      {statusContent}
    </Box>
  );
};

export const StatusBar = React.memo(StatusBarComponent);
