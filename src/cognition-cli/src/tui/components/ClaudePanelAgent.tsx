import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Box,
  Text,
  useInput,
  useStdout,
  measureElement,
  DOMElement,
} from 'ink';
import { Spinner } from '@inkjs/ui';
import stripAnsi from 'strip-ansi';
import { systemLog } from '../../utils/debug-logger.js';
import { useTUI } from '../context/TUIContext.js';
import { terminal } from '../services/TerminalService.js';
import { stripCursorSequences } from '../utils/ansi-utils.js';
import type { TUIMessage } from '../hooks/useAgent.js';

/**
 * Props for ClaudePanelAgent component
 */
export interface ClaudePanelAgentProps {
  /** Array of conversation messages to display */
  messages: TUIMessage[];

  /** Whether the agent is currently thinking/streaming a response */
  isThinking: boolean;

  /** Whether this panel is currently focused for scrolling */
  focused: boolean;

  /** Content being streamed during paste operation */
  streamingPaste?: string;

  /**
   * A string that changes whenever the layout around this component might have changed.
   * This ensures the component re-measures its available height even if other props are stable.
   */
  layoutVersion?: string;
}

/**
 * Claude Agent SDK Message Panel Component.
 *
 * Displays conversation messages from the Agent SDK (Claude, Gemini, etc.)
 * with color-coded message types, auto-scrolling, and keyboard navigation.
 *
 * **Features**:
 * - Color-coded messages by type (user, assistant, system, thinking, tool)
 * - Auto-scroll to bottom on new messages
 * - Keyboard scrolling when panel is focused (↑↓, PgUp/PgDn, Enter to jump to bottom)
 * - Markdown bold syntax processing (**text**)
 * - Streaming paste visualization
 *
 * **Message Types & Colors**:
 * - user: Green (O3 lineage)
 * - assistant: Blue (O1 structural)
 * - system: Gray (muted)
 * - thinking: Gray with 🤖 prefix
 * - tool_progress: Amber-orange for commands, blue for edit diffs
 *
 * @component
 * @param {ClaudePanelAgentProps} props - Component props
 *
 * @example
 * <ClaudePanelAgent
 *   messages={conversationMessages}
 *   isThinking={isProcessing}
 *   focused={isPanelFocused}
 *   streamingPaste={pasteContent}
 *   />
 */
const ClaudePanelAgentComponent: React.FC<ClaudePanelAgentProps> = ({
  messages,
  isThinking,
  focused,
  streamingPaste = '',
  layoutVersion, // Used implicitly by React.memo to trigger re-renders on layout changes
}) => {
  const { stdout } = useStdout();
  const { state: tuiState, clearScrollSignal } = useTUI();
  const { scrollSignal } = tuiState;
  const [scrollOffset, setScrollOffset] = useState(0);
  const lastProcessedSignalTs = useRef<number>(0);
  const containerRef = useRef<DOMElement>(null);

  // Initial dimensions guess
  const [availableHeight, setAvailableHeight] = useState(
    () => (stdout?.rows || 24) / 2
  );

  // Build colored text lines with color metadata
  const allLines = useMemo(() => {
    const lines: Array<{ text: string; color: string }> = [];

    // Helper to strip markdown bold (**text**) markers
    // Let Ink handle all coloring to avoid ANSI/Ink conflicts that cause bleeding
    // Tool messages (Edit diffs, etc.) have their own ANSI codes in the content itself
    const processBold = (text: string): string => {
      // Simply remove ** markers and let Ink's color prop handle coloring
      return text.replace(/\*\*/g, '');
    };

    messages.forEach((msg) => {
      let prefix = '';
      let color = '#58a6ff'; // Default: O1 structural blue

      switch (msg.type) {
        case 'user':
          prefix = '> ';
          color = '#56d364'; // O3 lineage green
          break;
        case 'system':
          prefix = '• ';
          color = '#8b949e'; // Muted gray
          break;
        case 'assistant':
          prefix = '';
          color = '#58a6ff'; // O1 structural blue
          break;
        case 'thinking':
          prefix = '🤖 ';
          color = '#8b949e'; // Muted gray for thinking (matches system)
          break;
        case 'tool_progress': {
          prefix = '  ';
          // Use amber-orange for tool commands, but blue for Edit diffs (they have their own formatting)
          // Results (no 🔧) are rendered in muted gray
          if (msg.content.includes('🔧 Edit:')) {
            color = '#58a6ff';
          } else if (msg.content.includes('🔧')) {
            color = '#f5a623';
          } else {
            color = '#c9d1d9'; // Brighter off-white for tool results
          }

          // Special handling: split tool name from command/details
          // Format: "🔧 ToolName: command/details"
          const toolMatch = msg.content.match(/^(🔧\s+\S+:)\s*(.*)$/);
          if (toolMatch && !msg.content.includes('🔧 Edit:')) {
            // Tool name in amber-orange, details rendered by Ink (no inline ANSI)
            const toolName = toolMatch[1];
            const details = processBold(toolMatch[2]);
            lines.push({
              text: `${prefix}${toolName} ${details}`,
              color,
            });
            lines.push({ text: '', color }); // Empty line between messages
            return; // Skip normal processing
          }
          break;
        }
      }

      // Split content into lines and store with color
      const contentLines = msg.content.split('\n');
      contentLines.forEach((line, index) => {
        // Process markdown bold syntax (adds resets only if colors were added)
        const processedLine = processBold(line);

        if (msg.type === 'thinking') {
          // Thinking messages: 🤖 icon on first line, aligned on subsequent lines
          // We don't add extra indentation here to keep the icon close to the text
          if (index === 0) {
            lines.push({ text: '🤖 ' + processedLine, color });
          } else {
            lines.push({ text: '   ' + processedLine, color });
          }
        } else {
          // Only show prefix on the first line for other message types
          const linePrefix = index === 0 ? prefix : ' '.repeat(prefix.length);
          lines.push({ text: linePrefix + processedLine, color });
        }
      });
      lines.push({ text: '', color }); // Empty line between messages
    });

    // Add streaming paste content if present
    if (streamingPaste) {
      const pasteLines = streamingPaste.split('\n');
      const pasteColor = '#f5a623'; // Amber-orange for pasted content
      lines.push({ text: '📋 Pasting...', color: '#2eb572' }); // Green header
      pasteLines.forEach((line) => {
        lines.push({ text: line, color: pasteColor });
      });
    }

    return lines;
  }, [messages, streamingPaste]);

  // Handle global scroll signals (e.g. from InputBox)
  useEffect(() => {
    if (!scrollSignal || scrollSignal.ts === lastProcessedSignalTs.current)
      return;

    lastProcessedSignalTs.current = scrollSignal.ts;

    const maxOffset = Math.max(0, allLines.length - availableHeight);
    switch (scrollSignal.type) {
      case 'up':
        setScrollOffset((prev) => Math.min(prev + 1, maxOffset));
        break;
      case 'down':
        setScrollOffset((prev) => Math.max(0, prev - 1));
        break;
      case 'pageUp':
        setScrollOffset((prev) => Math.min(prev + availableHeight, maxOffset));
        break;
      case 'pageDown':
        setScrollOffset((prev) => Math.max(0, prev - availableHeight));
        break;
      case 'bottom':
        setScrollOffset(0);
        break;
    }

    // Clear the signal so it doesn't re-trigger on other dependency changes
    clearScrollSignal();
  }, [scrollSignal, availableHeight, allLines.length, clearScrollSignal]);

  // Use measureElement to get the actual height allocated by Yoga
  useEffect(() => {
    // Layer 8: Ensure cursor is hidden while message panel is rendering/scrolling
    terminal.setCursorVisibility(false);

    if (containerRef.current) {
      const dimensions = measureElement(containerRef.current);
      // Dimensions minus borders
      const newHeight = Math.max(1, dimensions.height - 2);

      if (newHeight !== availableHeight) {
        systemLog('tui', '[ClaudePanelAgent] New dimensions measured', {
          height: dimensions.height,
          availableHeight: newHeight,
          totalLines: allLines.length,
          messagesCount: messages.length,
          layoutVersion,
        });
        setAvailableHeight(newHeight);
      }
    }
  }); // Run on every render. Since component is memoized, this only runs when props change.

  // Note: Paste streaming is handled by parent component (index.tsx)
  // The [PASTE:filepath] message is sent after streaming completes

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    setScrollOffset(0); // Reset to bottom
  }, [messages.length]);

  // Auto-scroll to bottom when switching focus back to input
  useEffect(() => {
    if (!focused) {
      setScrollOffset(0); // Input focused - scroll to bottom
    }
  }, [focused]);

  // Handle keyboard scrolling when panel is focused
  useInput(
    (input, key) => {
      if (!focused) return;

      const maxOffset = Math.max(0, allLines.length - availableHeight);

      // Support multiple ways to trigger Page Up/Down and Home/End
      // Some terminals don't correctly map pageUp/pageDown in Ink's useInput
      const isPageUp =
        key.pageUp || (key.ctrl && input === 'u') || input === '\x1b[5~';
      const isPageDown =
        key.pageDown || (key.ctrl && input === 'd') || input === '\x1b[6~';
      // Ink 6.6.0+ supports key.home and key.end natively
      const isHome = key.home || input === '\x1b[H' || input === '\x1b[1~';
      const isEnd = key.end || input === '\x1b[F' || input === '\x1b[4~';

      if (process.env.DEBUG_INPUT) {
        if (isPageUp || isPageDown || isHome || isEnd) {
          systemLog(
            'tui',
            `INPUT DEBUG [ClaudePanelAgent]: ${JSON.stringify({
              input,
              key,
              isPageUp,
              isPageDown,
              isHome,
              isEnd,
            })}`
          );
        }

        if (isPageUp || isPageDown) {
          systemLog(
            'tui',
            `[ClaudePanelAgent] Received ${isPageUp ? 'PageUp' : 'PageDown'} action`,
            {
              focused,
              isThinking,
              availableHeight,
              allLinesLength: allLines.length,
              method: key.pageUp || key.pageDown ? 'key' : 'manual',
            }
          );
        }
      }

      if (key.upArrow) {
        if (key.shift) {
          // Shift+Up as a fallback for PageUp
          setScrollOffset((prev) =>
            Math.min(prev + availableHeight, maxOffset)
          );
        } else {
          setScrollOffset((prev) => Math.min(prev + 1, maxOffset));
        }
      } else if (key.downArrow) {
        if (key.shift) {
          // Shift+Down as a fallback for PageDown
          setScrollOffset((prev) => Math.max(0, prev - availableHeight));
        } else {
          setScrollOffset((prev) => Math.max(0, prev - 1));
        }
      } else if (isPageUp) {
        setScrollOffset((prev) => Math.min(prev + availableHeight, maxOffset));
      } else if (isPageDown) {
        setScrollOffset((prev) => Math.max(0, prev - availableHeight));
      } else if (isHome) {
        setScrollOffset(maxOffset);
      } else if (isEnd || key.return) {
        setScrollOffset(0); // Jump to bottom
      }
    },
    { isActive: focused }
  );

  // Calculate visible window - return line objects, not joined string
  const visibleLines = useMemo(() => {
    const totalLines = allLines.length;
    if (totalLines <= availableHeight) {
      return allLines; // Show all
    }

    const maxOffset = Math.max(0, totalLines - availableHeight);
    const actualOffset = Math.min(scrollOffset, maxOffset);
    const startIdx = Math.max(0, totalLines - availableHeight - actualOffset);
    const endIdx = totalLines - actualOffset;

    return allLines.slice(startIdx, endIdx);
  }, [allLines, availableHeight, scrollOffset]);

  // Calculate scroll indicator
  const scrollInfo = useMemo(() => {
    if (allLines.length <= availableHeight) {
      return null; // No scrolling needed
    }

    const maxOffset = allLines.length - availableHeight;
    const actualOffset = Math.min(scrollOffset, maxOffset);
    const percentage = Math.round((1 - actualOffset / maxOffset) * 100);

    return `↕ ${percentage}%`;
  }, [allLines.length, availableHeight, scrollOffset]);

  return (
    <Box
      ref={containerRef}
      flexDirection="column"
      flexGrow={1}
      height="100%"
      minHeight={3}
      borderTop
      borderBottom
      borderColor={focused ? '#2ea043' : '#30363d'}
      width="100%"
      paddingX={1}
    >
      <Box flexDirection="column" flexGrow={1}>
        {visibleLines.map((line, idx) => {
          // Check if line contains ANSI escape codes (colors)
          const hasAnsi = stripAnsi(line.text) !== line.text;
          return (
            <Text key={idx} color={hasAnsi ? undefined : line.color}>
              {hasAnsi
                ? `\u001b[0m${stripCursorSequences(line.text)}\u001b[0m`
                : line.text}
            </Text>
          );
        })}
        {isThinking && (
          <Box marginTop={1}>
            <Spinner label="Thinking…" />
          </Box>
        )}
      </Box>
      {scrollInfo && focused && (
        <Box justifyContent="flex-end">
          <Text dimColor>{scrollInfo}</Text>
        </Box>
      )}
    </Box>
  );
};

// Memoize to prevent re-renders when parent re-renders but props haven't changed
// This fixes flickering when navigating dropdown with keyboard
export const ClaudePanelAgent = React.memo(ClaudePanelAgentComponent);
