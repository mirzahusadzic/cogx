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
import {
  markdownToLines,
  type StyledLine,
} from '../utils/markdown-renderer.js';
import type { TUIMessage } from '../hooks/useAgent.js';
import { TUITheme } from '../theme.js';

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
  // PERFORMANCE: Decouple message rendering from paste streaming
  // This memo only re-runs when messages change or terminal width changes
  const renderedMessages = useMemo(() => {
    const lines: StyledLine[] = [];
    const width = (stdout?.columns || 100) - 4; // Account for padding

    messages.forEach((msg) => {
      let prefix = '';
      let color = TUITheme.text.primary;
      let bg: string | undefined = undefined;

      switch (msg.type) {
        case 'user':
          prefix = '> ';
          color = TUITheme.messages.user.text;
          bg = TUITheme.messages.user.bg;
          break;
        case 'system':
          prefix = '* ';
          color = TUITheme.messages.system.text;
          bg = TUITheme.messages.system.bg;
          break;
        case 'assistant':
          prefix = '';
          color = TUITheme.messages.assistant.text;
          bg = TUITheme.messages.assistant.bg;
          break;
        case 'thinking':
          prefix = '🤖 ';
          color = TUITheme.messages.thinking.text;
          bg = TUITheme.messages.thinking.bg;
          break;
        case 'tool_progress': {
          prefix = '  ';
          let baseColor = TUITheme.roles.toolResult;
          bg = TUITheme.messages.assistant.bg;

          if (
            msg.content.includes('📋 Tasks:') ||
            msg.content.includes('🔧 Tasks:')
          ) {
            baseColor = TUITheme.roles.tool; // Consistent green for Tasks
          } else if (msg.content.match(/[🔧📋📄🧠🔍🌐🛑📊🤖📨📢📬✅✨🚀]/u)) {
            baseColor = TUITheme.roles.tool; // Green for all tools
          }

          // Use [\s\S]* to capture multi-line content (dot (.) doesn't match newlines)
          const toolMatch = msg.content.match(
            /^([🔧📋📄🧠🔍🌐🛑📊🤖📨📢📬✅✨🚀]\s+[^:]+:)\s?([\s\S]*)$/u
          );
          if (toolMatch) {
            const toolName = toolMatch[1];
            const details = toolMatch[2];

            // FIX: Handle carriage returns to stabilize streaming output
            // This collapses "Progress 10%\rProgress 20%" into "Progress 20%"
            let finalDetails = details.replace(/.*\r/g, '');

            const isEdit = toolName.includes('Edit:');
            const isTasks = toolName.includes('Tasks:');

            // Strip ANSI codes for cleaner detection and rendering
            // (ToolFormatter adds ANSI colors and line numbers that we want to remove for Diff view)
            // Also remove the 4-space indentation added by ToolFormatter to all tool outputs.
            // EXCEPT for Edit and Tasks, where we want to keep ANSI and indentation.
            if (isEdit || isTasks) {
              finalDetails = finalDetails.replace(/^ {4}/gm, '');
            } else {
              finalDetails = stripAnsi(finalDetails).replace(/^ {4}/gm, '');
            }

            // Determine if we should treat this as a diff
            let lang = 'text';
            if (isTasks) {
              lang = 'sigma-tasks';
            } else if (
              !isEdit &&
              (finalDetails.includes('diff --git') ||
                finalDetails.includes('\nindex ') ||
                (finalDetails.includes('@@') &&
                  finalDetails.includes('+') &&
                  finalDetails.includes('-')) ||
                toolName.toLowerCase().includes('diff'))
            ) {
              lang = 'diff';
              // Remove line numbers (123│) and indentation added by ToolFormatter
              finalDetails = finalDetails.replace(/^\s*(\d+│\s)?/gm, '');
            }

            // Wrap raw tool output (bash, read_file, diffs) in code blocks to prevent
            // accidental markdown parsing (e.g. diffs becoming lists)
            const shouldWrapInCode =
              finalDetails.includes('\n') ||
              toolName.includes('bash') ||
              toolName.includes('read_file') ||
              toolName.includes('grep') ||
              toolName.includes('glob') ||
              isEdit ||
              lang === 'diff';

            // Stabilize output:
            // 1. Trim end to remove trailing junk (preserved leading newlines if intended)
            // 2. DO NOT trim start if it starts with a newline (respect ToolFormatter intent)
            // 3. Wrap in code block to prevent markdown parsing of raw output
            const trimmedDetails = finalDetails.trimEnd();
            const startsWithNewline = trimmedDetails.startsWith('\n');
            const processDetails = shouldWrapInCode
              ? '```' + lang + '\n' + trimmedDetails + '\n```'
              : trimmedDetails;

            const detailLines = markdownToLines(
              processDetails,
              width - prefix.length - stripAnsi(toolName).length - 1,
              {
                baseColor: TUITheme.roles.toolResult,
                baseBg: bg,
                // Only force code block color if it's NOT a diff or sigma-tasks, to allow custom highlighting
                codeBlockColor:
                  lang === 'diff' || lang === 'sigma-tasks'
                    ? undefined
                    : TUITheme.roles.toolResult,
              }
            );

            if (detailLines.length > 0) {
              const firstLine = detailLines[0];
              // Use spread to avoid mutating the original chunks array if it's reused (safety first)
              const firstLineChunks = [
                { text: prefix, color: baseColor, bg },
                { text: toolName, color: baseColor, bg, bold: true },
                { text: ' ', color: baseColor, bg },
                ...firstLine.chunks.map((chunk) => ({
                  ...chunk,
                  // If the chunk is using the default tool result color, upgrade it to baseColor (Green)
                  // for the first line (which contains the tool command/parameters)
                  color:
                    chunk.color === TUITheme.roles.toolResult
                      ? baseColor
                      : chunk.color,
                })),
              ];
              lines.push({ chunks: firstLineChunks });

              for (let i = 1; i < detailLines.length; i++) {
                // If the details started with a newline, we want subsequent lines to be indented
                // less (just aligned with the prefix) to create a list-like appearance.
                const indentSize = startsWithNewline
                  ? prefix.length
                  : prefix.length + stripAnsi(toolName).length + 1;
                const indent = ' '.repeat(indentSize);
                detailLines[i].chunks.unshift({
                  text: indent,
                  color: baseColor,
                  bg,
                });
                lines.push(detailLines[i]);
              }
            } else {
              lines.push({
                chunks: [
                  { text: prefix, color: baseColor, bg },
                  { text: toolName, color: baseColor, bg, bold: true },
                ],
              });
            }

            // Only add a trailing gap if there's actual content to separate from
            lines.push({ chunks: [] });
            return;
          }

          color = baseColor;
          break;
        }
      }

      // Universal Markdown Renderer for all message types
      const renderedLines = markdownToLines(
        msg.content,
        width - prefix.length,
        {
          baseColor: color,
          baseBg: bg,
          baseDim: msg.type === 'thinking',
          bulletColor: msg.type === 'thinking' ? color : undefined,
          // For thinking blocks, force code to match the vibrant role color
          // while the surrounding text is dimmed.
          inlineCodeColor:
            msg.type === 'thinking'
              ? TUITheme.roles.thinkingInlineCode
              : undefined,
          inlineCodeDim: msg.type === 'thinking' ? false : undefined,
          codeBlockColor: msg.type === 'thinking' ? color : undefined,
          codeBlockDim: msg.type === 'thinking' ? false : undefined,
          headingColor:
            msg.type === 'thinking'
              ? TUITheme.roles.thinkingInlineCode
              : undefined,
          headingDim: msg.type === 'thinking' ? false : undefined,
          strongDim: msg.type === 'thinking' ? false : undefined,
          emphasisDim: msg.type === 'thinking' ? false : undefined,
          vibrantTitles:
            msg.type === 'thinking' ? TUITheme.cognition.vibrantTitles : [],
        }
      );

      if (renderedLines.length > 0) {
        // Prepend prefix to the first line
        renderedLines[0].chunks.unshift({
          text: prefix,
          color,
          bg,
          bold: msg.type === 'user',
          dim: msg.type === 'thinking',
        });

        // Add subsequent lines with proper indentation
        if (prefix.length > 0) {
          for (let i = 1; i < renderedLines.length; i++) {
            renderedLines[i].chunks.unshift({
              text: ' '.repeat(prefix.length),
              color,
              bg,
              dim: msg.type === 'thinking',
            });
          }
        }
        lines.push(...renderedLines);
      } else if (prefix) {
        lines.push({ chunks: [{ text: prefix, color }] });
      }

      lines.push({ chunks: [] });
    });

    return lines;
  }, [messages, stdout?.columns]);

  // Merge static messages with dynamic paste content
  // This is the HOT path during pastes, so we keep it very light
  const allLines = useMemo(() => {
    if (!streamingPaste) return renderedMessages;

    const lines = [...renderedMessages];
    const pasteLines = streamingPaste.split('\n');

    lines.push({
      chunks: [
        {
          text: '📋 Pasting...',
          color: TUITheme.ui.paste.header,
          bold: true,
        },
      ],
    });

    pasteLines.forEach((line) => {
      lines.push({
        chunks: [{ text: line, color: TUITheme.ui.paste.content }],
      });
    });

    return lines;
  }, [renderedMessages, streamingPaste]);

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
  }, [layoutVersion, stdout?.rows, stdout?.columns]); // Only re-measure when layout or terminal size changes

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
      borderColor={
        focused ? TUITheme.ui.border.focused : TUITheme.ui.border.default
      }
      width="100%"
      paddingX={1}
    >
      <Box flexDirection="column" flexGrow={1}>
        {visibleLines.map((line, idx) => (
          <Text key={idx}>
            {line.chunks.length === 0
              ? ' '
              : line.chunks.map((chunk, cIdx) => {
                  const hasAnsi = stripAnsi(chunk.text) !== chunk.text;
                  return (
                    <Text
                      key={cIdx}
                      color={hasAnsi ? undefined : chunk.color}
                      backgroundColor={chunk.bg}
                      bold={chunk.bold}
                      italic={chunk.italic}
                      dimColor={chunk.dim}
                      inverse={chunk.inverse}
                    >
                      {hasAnsi ? stripCursorSequences(chunk.text) : chunk.text}
                    </Text>
                  );
                })}
          </Text>
        ))}
        {isThinking && (
          <Box>
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
