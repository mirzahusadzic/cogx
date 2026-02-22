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
import { cleanAnsi as stripAnsi } from '../../utils/string-utils.js';
import { systemLog } from '../../utils/debug-logger.js';
import { useTUI } from '../context/TUIContext.js';
import {
  stripCursorSequences,
  getStyleAnsi,
  ANSI_RESET,
} from '../utils/ansi-utils.js';
import {
  markdownToLines,
  type StyledLine,
} from '../utils/markdown-renderer.js';
import type { TUIMessage } from '../hooks/useAgent.js';
import { TUITheme } from '../theme.js';
import {
  MAX_STREAM_STABILIZATION_LINES,
  TUI_LAYOUT_OVERHEAD,
} from '../hooks/useAgent/constants.js';

/**
 * Ensures each line has a stable key for efficient TUI rendering.
 * Should be called in useMemo blocks that produce StyledLine arrays.
 * This prevents expensive string concatenation during every render cycle.
 */
function ensureLineKeys(lines: StyledLine[], prefix: string): StyledLine[] {
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].key) {
      const content = lines[i].chunks
        .map((c) => c.text)
        .join('')
        .slice(0, 32);
      lines[i].key = `${prefix}-${i}-${content}`;
    }
  }
  return lines;
}

/**
 * Props for ClaudePanelAgent component
 */
export interface ClaudePanelAgentProps {
  /** Array of conversation messages to display */
  messages: TUIMessage[];

  /** Whether the agent is currently thinking/streaming a response */
  isThinking: boolean;

  /** Number of retries attempted (for Gemini 429 errors) */
  retryCount?: number;

  /** Whether this panel is currently focused for scrolling */
  focused: boolean;

  /** Whether the Sigma Info Panel (sidebar) is currently visible */
  showInfoPanel?: boolean;

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
  showInfoPanel = false,
  streamingPaste = '',
  layoutVersion, // Used implicitly by React.memo to trigger re-renders on layout changes
  retryCount = 0,
}) => {
  const { stdout } = useStdout();
  const { state: tuiState, clearScrollSignal } = useTUI();
  const { scrollSignal } = tuiState;
  const [scrollOffset, setScrollOffset] = useState(0);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  /**
   * Handles scroll offset changes and updates the userScrolledUp state.
   * This centralizes scroll logic to ensure the userScrolledUp state is
   * always correctly reflecting user interaction.
   * @param {number} newOffset The new scroll offset.
   */
  const handleScroll = (newOffset: number) => {
    setScrollOffset(newOffset);
    setUserScrolledUp(newOffset > 0);
  };
  const lastProcessedSignalTs = useRef<number>(0);
  const containerRef = useRef<DOMElement>(null);

  // Initial dimensions guess
  const [availableHeight, setAvailableHeight] = useState(() =>
    Math.max(1, (stdout?.rows || 24) / 2 - 3)
  );

  // Layer 13: Message rendering cache.
  // We cache the rendered StyledLine arrays for each message to avoid re-parsing
  // markdown for the entire history on every chunk update.
  const messageCache = useRef<Map<string, StyledLine[]>>(new Map());

  // Build colored text lines with color metadata
  // PERFORMANCE: Decouple message rendering from paste streaming
  // This memo only re-runs when messages change, terminal width changes or layout changes
  const renderedMessages = useMemo(() => {
    const lines: StyledLine[] = [];
    // Sidebar is visible if columns > 100, regardless of showInfoPanel (it shows SigmaTaskPanel instead)
    const sidebarVisible = (stdout?.columns || 0) > 100;
    const infoPanelWidth = sidebarVisible ? 41 : 0; // 40 (width) + 1 (marginLeft)
    const width = Math.max(
      20,
      (stdout?.columns || 100) - 3 - infoPanelWidth
    ); // Account for padding, borders, and sidebar

    messages.forEach((msg, idx) => {
      // For performance, we cache rendered lines for all messages EXCEPT the last one
      // (which might still be streaming).
      const isLast = idx === messages.length - 1;
      const cacheKey = `${idx}-${msg.type}-${msg.timestamp.getTime()}-${msg.content.length}-${width}`;

      if (!isLast && messageCache.current.has(cacheKey)) {
        lines.push(...messageCache.current.get(cacheKey)!);
        return;
      }

      // Universal normalization: Handle line endings and carriage returns for all message types
      // to ensure consistent rendering and prevent terminal overwrite artifacts.
      let processedContent = msg.content;
      // Normalize CRLF and standalone CR to LF
      processedContent = processedContent
        .replace(/\r\n/g, '\n')
        .replace(/\r(?!\n)/g, '\n');

      if (msg.type === 'user') {
        // Preserve leading whitespace and newlines for user messages by "protecting" them from markdown parsing.
        // We use \u200D (zero-width joiner) to prevent markdown from trimming leading spaces in paragraphs,
        // and add two trailing spaces to each line to force markdown line breaks.
        processedContent = processedContent
          .split('\n')
          .map((line) => (line.startsWith(' ') ? '\u200D' + line : line))
          .join('  \n');
      }

      const isStreaming =
        processedContent.includes('(streaming)') ||
        processedContent.includes('(tail of stream)');

      if (isStreaming) {
        // Handle streaming carriage returns that overwrite the current line
        processedContent = processedContent.replace(/[^\n]*\r/g, '');
      }
      // Remove any remaining standalone CR characters if they are not part of an overwrite
      processedContent = processedContent.replace(/\r/g, '');

      const messageLines: StyledLine[] = [];
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
            stripAnsi(processedContent).includes('📋 Tasks:') ||
            stripAnsi(processedContent).includes('> Tasks:')
          ) {
            baseColor = TUITheme.roles.tool; // Consistent green for Tasks
          } else if (
            processedContent.match(/[>📋📄🧠🔍🌐🛑📊🤖📨📢📬✅✨🚀]/u)
          ) {
            baseColor = TUITheme.roles.tool; // Same for all tools
          }

          // Use [\s\S]* to capture multi-line content (dot (.) doesn't match newlines)
          /* eslint-disable no-control-regex */
          const toolMatch = processedContent.match(
            /^([>📋📄🔍🌐🛑📊🤖📨📢📬✅✨🚀↪]\s+[^:]+:)[ \t]?([\s\S]*)$/u
          );
          if (toolMatch) {
            const toolName = toolMatch[1];
            const details = toolMatch[2];

            // Normalize tool name for robust detection (remove icon, colons, and spaces)
            const cleanToolName = stripAnsi(toolName)
              .replace(/[>📋📄🧠🔍🌐🛑📊🤖📨📢📬✅✨🚀↪:\s]/gu, '')
              .toLowerCase();

            let finalDetails = details;
            // Create a clean version for detection logic
            const cleanDetails = stripAnsi(details);

            const isEdit = cleanToolName === 'edit';
            const isTasks = cleanToolName === 'tasks';
            const isRead = cleanToolName.startsWith('read');
            const isGrep = cleanToolName.startsWith('grep');
            const isBash =
              cleanToolName.startsWith('bash') ||
              cleanToolName.startsWith('shell');
            const isGlob = cleanToolName.startsWith('glob');
            const isWrite = cleanToolName.startsWith('write');
            const isFetch =
              cleanToolName.startsWith('fetch') ||
              cleanToolName.startsWith('webfetch');
            const isSearch =
              cleanToolName.startsWith('search') ||
              cleanToolName.startsWith('websearch');
            const isQuery = cleanToolName.startsWith('query');
            const isList =
              cleanToolName.startsWith('list') ||
              cleanToolName.startsWith('ls');

            // Determine if we should treat this as a diff
            let lang = 'text';
            if (isTasks) {
              lang = 'sigma-tasks';
            } else if (isEdit) {
              lang = 'diff';
            } else if (
              !isEdit &&
              (cleanDetails.includes('diff --git') ||
                cleanDetails.includes('git diff') ||
                cleanDetails.includes('diff --cc') ||
                cleanDetails.includes('diff --combined') ||
                (cleanDetails.includes('--- ') &&
                  cleanDetails.includes('+++ ')) ||
                cleanDetails.includes('\nindex ') ||
                (cleanDetails.includes('@@') &&
                  cleanDetails.includes('+') &&
                  cleanDetails.includes('-')) ||
                cleanToolName.includes('diff'))
            ) {
              lang = 'diff';
            }

            // Strip ANSI codes for cleaner detection and rendering
            // EXCEPT for Edit, Tasks, Read, Grep, and Diffs where we want to keep ANSI
            // for syntax highlighting.
            if (
              !(
                isEdit ||
                isTasks ||
                isRead ||
                isGrep ||
                isBash ||
                lang === 'diff'
              )
            ) {
              finalDetails = cleanDetails;
            }

            // Strip 4-space indentation that might be present in tool output from the LLM.
            // ONLY for non-raw tools to avoid affecting significant indentation in bash/code.
            if (
              !isEdit &&
              !isRead &&
              !isWrite &&
              !isBash &&
              !isGrep &&
              lang !== 'diff'
            ) {
              finalDetails = finalDetails.replace(/^ {4}/gm, '');
            }

            if (lang === 'diff') {
              // Keep ANSI codes for syntax highlighting (e.g. green/red exit codes),
              // but we must strip line numbers which might contain ANSI sequences themselves.

              // Regex to strip line numbers (e.g. "123│ ") handling optional ANSI codes
              const ansiPattern = '(?:\x1b\\[[0-9;]*m)*';
              const lineNumRegex = new RegExp(
                `^\\s*${ansiPattern}\\d+${ansiPattern}│${ansiPattern}\\s?`,
                'gm'
              );
              finalDetails = finalDetails.replace(lineNumRegex, '');
            } else if (isRead || isWrite) {
              // Try to detect extension from the "file: path" header
              const pathMatch = cleanDetails.match(/file:\s+([^\s\n()]+)/);
              if (pathMatch) {
                const ext = pathMatch[1].split('.').pop();
                if (ext && ext.length < 5) lang = ext;
              }
            } else if (isBash) {
              lang = 'bash';
            }

            // Wrap raw tool output (bash, read_file, diffs) in code blocks to prevent
            // accidental markdown parsing (e.g. diffs becoming lists)
            const shouldWrapInCode =
              finalDetails.includes('\n') ||
              isTasks ||
              isBash ||
              isRead ||
              isWrite ||
              isGrep ||
              isGlob ||
              isFetch ||
              isSearch ||
              isQuery ||
              isList ||
              isEdit ||
              lang === 'diff';

            // Stabilize output:
            // 1. Trim end to remove trailing junk (preserved leading newlines if intended)
            // 2. DO NOT trim start if it starts with a newline (respect ToolFormatter intent)
            // 3. Wrap in code block to prevent markdown parsing of raw output
            const trimmedDetails = finalDetails.trimEnd();

            // Layer 12: Floating Window Stabilization.
            // If we are streaming tool output (e.g. bash), we want to prevent the header
            // from jumping up and down as lines wrap or as the tail-truncation kicks in.
            // We do this by ensuring the output block has a stable height (e.g. 25 lines)
            // during the streaming process.
            // Ensure the stabilized height doesn't exceed the available vertical space
            // to prevent pushing out the OverlaysBar or other UI elements.
            const STABILIZED_HEIGHT = Math.min(
              MAX_STREAM_STABILIZATION_LINES,
              availableHeight - 2 // Leave a small safety buffer for tool header
            );

            // For streaming output or file-related output, force a leading newline.
            // This ensures the "ToolName:" header is always on its own line,
            // separating it from the scrolling content and allowing full-width rendering.
            let effectiveDetails = trimmedDetails
              .trimEnd()
              .replace(/\t/g, '  '); // Use 2 spaces for tabs to save width
            if (
              (isStreaming ||
                isTasks ||
                isBash ||
                isRead ||
                isWrite ||
                isGrep ||
                isGlob ||
                isFetch ||
                isSearch ||
                isQuery ||
                isList ||
                isEdit) &&
              !stripAnsi(effectiveDetails).startsWith('\n') &&
              effectiveDetails.length > 0
            ) {
              effectiveDetails = '\n' + effectiveDetails;
            }

            // If we have multiple leading newlines, collapse them to one
            effectiveDetails = effectiveDetails.replace(/^(\n)+/, '\n');

            const startsWithNewline =
              stripAnsi(effectiveDetails).startsWith('\n');
            // Layer 13: Dynamic Code Block Wrapping (The "Markdown Escape" Fix)
            const maxBackticks = (effectiveDetails.match(/`+/g) || []).reduce(
              (max, match) => Math.max(max, match.length),
              0
            );
            const fence = '`'.repeat(Math.max(3, maxBackticks + 1));

            const processDetails = shouldWrapInCode
              ? fence +
                lang +
                '\n' +
                effectiveDetails.replace(/^\n+/, '') +
                '\n' +
                fence
              : effectiveDetails;

            // Layer 11: Stabilize width for multi-line tool output.
            // If it starts with a newline, it doesn't share the first line with the header,
            // so we don't need to subtract the tool name length.
            const detailsWidthReduction = startsWithNewline
              ? 0
              : stripAnsi(toolName).length + 1;

            // Regression Fix: Use a tighter safety margin (-4) to allow more content
            // to fit on narrow terminals (e.g. when sidebar is open), preventing
            // unexpected wrapping of file paths in git status.
            const targetWidth =
              width - prefix.length - detailsWidthReduction - 4;

            const detailLines = markdownToLines(
              processDetails,
              Math.max(10, targetWidth),
              {
                baseColor: TUITheme.roles.toolResult,
                baseBg: bg,
                wrapIndent: 2,
                // Only force code block color if it's NOT a diff or sigma-tasks, to allow custom highlighting
                codeBlockColor:
                  lang === 'diff' || lang === 'sigma-tasks'
                    ? undefined
                    : TUITheme.roles.toolResult,
              }
            );

            if (detailLines.length > 0) {
              let iStart = 1;
              if (startsWithNewline) {
                // If the details started with a newline, the header gets its own line
                messageLines.push({
                  chunks: [
                    { text: prefix, color: baseColor, bg, dim: true },
                    {
                      text: toolName,
                      color: baseColor,
                      bg,
                      bold: true,
                      dim: true,
                    },
                  ],
                });
                iStart = 0;
              } else {
                const firstLine = detailLines[0];
                const firstLineChunks = [
                  { text: prefix, color: baseColor, bg, dim: true },
                  {
                    text: toolName,
                    color: baseColor,
                    bg,
                    bold: true,
                    dim: true,
                  },
                  { text: ' ', color: baseColor, bg, dim: true },
                  ...firstLine.chunks.map((chunk) => ({
                    ...chunk,
                    // If the chunk is using the default tool result color, upgrade it to baseColor (Green)
                    // for the first line (which contains the tool command/parameters)
                    color:
                      chunk.color === TUITheme.roles.toolResult
                        ? baseColor
                        : chunk.color,
                    dim: true,
                  })),
                ];
                messageLines.push({ chunks: firstLineChunks });
                iStart = 1;
              }

              for (let i = iStart; i < detailLines.length; i++) {
                // If the details started with a newline, we want subsequent lines to be indented
                // to align with the start of the tool header (prefix length).
                const indentSize = startsWithNewline
                  ? prefix.length
                  : prefix.length + stripAnsi(toolName).length + 1;
                const indent = ' '.repeat(indentSize);

                // Clone the line and chunks to prevent mutation bugs during re-renders
                // Regression Fix: Don't add indentation to completely empty lines to avoid
                // trailing whitespace and visual artifacts.
                const hasContent = detailLines[i].chunks.some(
                  (c) => stripAnsi(c.text).trim().length > 0
                );
                const newLine = {
                  ...detailLines[i],
                  chunks: hasContent
                    ? [
                        {
                          text: indent,
                          color: TUITheme.roles.toolResult,
                          bg,
                          dim: true,
                        },
                        ...detailLines[i].chunks,
                      ]
                    : detailLines[i].chunks,
                };
                messageLines.push(newLine);
              }

              // Layer 12: Floating Window Stabilization - Padding
              if (isStreaming && detailLines.length < STABILIZED_HEIGHT) {
                const indentSize = startsWithNewline
                  ? prefix.length
                  : prefix.length + stripAnsi(toolName).length + 1;
                const indent = ' '.repeat(indentSize);

                for (let i = detailLines.length; i < STABILIZED_HEIGHT; i++) {
                  messageLines.push({
                    chunks: [
                      {
                        text: indent,
                        color: TUITheme.roles.toolResult,
                        bg,
                        dim: true,
                      },
                    ],
                  });
                }
              }
            } else {
              messageLines.push({
                chunks: [
                  { text: prefix, color: baseColor, bg, dim: true },
                  {
                    text: toolName,
                    color: baseColor,
                    bg,
                    bold: true,
                    dim: true,
                  },
                ],
              });
            }

            messageLines.push({ chunks: [] });
            lines.push(...messageLines);
            if (!isLast) messageCache.current.set(cacheKey, messageLines);
            return;
          }

          color = baseColor;

          // Layer 13: Universal Markdown Escape for raw tool output.
          // If a tool result doesn't match the standard "Icon Name: Details" format,
          // we must still wrap it in a code block if it contains newlines or backticks.
          // This prevents accidental markdown parsing (e.g. backticks in source code becoming inline blocks).
          const maxBackticks = (processedContent.match(/`+/g) || []).reduce(
            (max, match) => Math.max(max, match.length),
            0
          );
          if (processedContent.includes('\n') || maxBackticks > 0) {
            const fence = '`'.repeat(Math.max(3, maxBackticks + 1));
            processedContent = `${fence}\n${processedContent}\n${fence}`;
          }
          break;
        }
      }

      // Universal Markdown Renderer for all message types
      const renderedLines = markdownToLines(
        processedContent.replace(/\t/g, '  '), // Replace tabs with 2 spaces
        Math.max(
          10,
          width - prefix.length - (msg.type === 'tool_progress' ? 4 : 0)
        ),
        {
          baseColor: color,
          baseBg: bg,
          baseDim: msg.type === 'thinking' || msg.type === 'system',
          wrapIndent: msg.type === 'tool_progress' ? 2 : undefined,
          bulletColor: msg.type === 'thinking' ? color : undefined,
          // For thinking blocks, force code to match the vibrant role color
          // while the surrounding text is dimmed.
          inlineCodeColor:
            msg.type === 'thinking'
              ? TUITheme.roles.thinkingInlineCode
              : undefined,
          inlineCodeDim: msg.type === 'thinking' ? false : undefined,
          codeBlockColor:
            msg.type === 'thinking' || msg.type === 'tool_progress'
              ? color
              : undefined,
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
        if (prefix.length > 0 || msg.type === 'tool_progress') {
          for (let i = 1; i < renderedLines.length; i++) {
            renderedLines[i].chunks.unshift({
              text: ' '.repeat(prefix.length),
              color,
              bg,
              dim: msg.type === 'thinking',
            });
          }
        }
        messageLines.push(...renderedLines);
      } else if (prefix) {
        messageLines.push({ chunks: [{ text: prefix, color }] });
      }

      messageLines.push({ chunks: [] });
      lines.push(...messageLines);

      if (!isLast) {
        messageCache.current.set(cacheKey, messageLines);
      }
    });

    return ensureLineKeys(lines, 'm');
  }, [messages, stdout?.columns, showInfoPanel]);

  // Merge static messages with dynamic paste content
  // This is the HOT path during pastes, so we keep it very light
  const allLines = useMemo(() => {
    if (!streamingPaste) return renderedMessages;

    const lines = [...renderedMessages];
    const pasteLines = streamingPaste.split(/\r?\n/);

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

    return ensureLineKeys(lines, 'p');
  }, [renderedMessages, streamingPaste]);

  // Handle global scroll signals (e.g. from InputBox)
  useEffect(() => {
    if (!scrollSignal || scrollSignal.ts === lastProcessedSignalTs.current)
      return;

    lastProcessedSignalTs.current = scrollSignal.ts;

    const maxOffset = Math.max(0, allLines.length - availableHeight);
    switch (scrollSignal.type) {
      case 'up':
        handleScroll(Math.min(scrollOffset + 1, maxOffset));
        break;
      case 'down':
        handleScroll(Math.max(0, scrollOffset - 1));
        break;
      case 'pageUp':
        handleScroll(Math.min(scrollOffset + availableHeight, maxOffset));
        break;
      case 'pageDown':
        handleScroll(Math.max(0, scrollOffset - availableHeight));
        break;
      case 'bottom':
        handleScroll(0);
        break;
    }

    // Clear the signal so it doesn't re-trigger on other dependency changes
    clearScrollSignal();
  }, [
    scrollSignal,
    availableHeight,
    allLines.length,
    scrollOffset,
    clearScrollSignal,
  ]);

  // Use measureElement to get the actual height allocated by Yoga
  useEffect(() => {
    if (containerRef.current) {
      const dimensions = measureElement(containerRef.current);
      // Dimensions minus borders (2) and footer (1)
      // Cap at terminal rows to prevent content from pushing out the OverlaysBar
      const maxPossible = (stdout?.rows || 24) - TUI_LAYOUT_OVERHEAD;
      const newHeight = Math.max(
        1,
        Math.min(maxPossible, dimensions.height - 3)
      );

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
    if (!userScrolledUp) {
      setScrollOffset(0); // Reset to bottom
    }
  }, [messages.length, userScrolledUp]);

  // Auto-scroll to bottom when switching focus back to input
  useEffect(() => {
    if (!focused) {
      setScrollOffset(0); // Input focused - scroll to bottom
    }
  }, [focused, userScrolledUp]);

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
          handleScroll(Math.min(scrollOffset + availableHeight, maxOffset));
        } else {
          handleScroll(Math.min(scrollOffset + 1, maxOffset));
        }
      } else if (key.downArrow) {
        if (key.shift) {
          // Shift+Down as a fallback for PageDown
          handleScroll(Math.max(0, scrollOffset - availableHeight));
        } else {
          handleScroll(Math.max(0, scrollOffset - 1));
        }
      } else if (isPageUp) {
        handleScroll(Math.min(scrollOffset + availableHeight, maxOffset));
      } else if (isPageDown) {
        handleScroll(Math.max(0, scrollOffset - availableHeight));
      } else if (isHome) {
        handleScroll(maxOffset);
      } else if (isEnd || key.return) {
        handleScroll(0); // Jump to bottom
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
      paddingX={1}
    >
      <Box flexDirection="column" flexGrow={1}>
        {visibleLines.map((line, idx) => {
          return (
            <Text key={line.key || `fallback-${idx}`}>
              {line.chunks.length === 0
                ? ' '
                : line.chunks.map((chunk, cIdx) => {
                    const hasAnsi = stripAnsi(chunk.text) !== chunk.text;
                    const styleAnsi = getStyleAnsi({
                      color: chunk.color,
                      bg: chunk.bg,
                      bold: chunk.bold,
                      italic: chunk.italic,
                      dim: chunk.dim,
                      inverse: chunk.inverse,
                    });

                    // If text has ANSI, ensure reset codes don't bleed into parent style
                    // by replacing \x1b[0m with \x1b[0m + parent's style codes.
                    // We also append the style at the end to ensure it persists if Ink wraps.
                    const content = hasAnsi
                      ? stripCursorSequences(chunk.text).replace(
                          /\x1b\[0m/g,
                          ANSI_RESET + styleAnsi
                        ) +
                        ANSI_RESET +
                        styleAnsi
                      : chunk.text;

                    return (
                      <Text
                        key={cIdx}
                        color={chunk.color}
                        backgroundColor={chunk.bg}
                        bold={chunk.bold}
                        italic={chunk.italic}
                        dimColor={chunk.dim}
                        inverse={chunk.inverse}
                      >
                        {content}
                      </Text>
                    );
                  })}
            </Text>
          );
        })}
      </Box>
      {/* Footer line for status and scroll info - always takes 1 line to prevent jump */}
      <Box height={1} flexDirection="row" justifyContent="space-between">
        <Box>
          {isThinking && (
            <Box>
              <Spinner />
              <Box marginLeft={1}>
                <Text
                  color={
                    retryCount > 0
                      ? retryCount >= 3
                        ? '#ff8a80'
                        : '#ffd54f'
                      : undefined
                  }
                  bold={retryCount >= 2}
                >
                  {retryCount > 0
                    ? `Thinking (retry ${retryCount})…`
                    : 'Thinking…'}
                </Text>
              </Box>
            </Box>
          )}
        </Box>
        <Box>{scrollInfo && focused && <Text dimColor>{scrollInfo}</Text>}</Box>
      </Box>
    </Box>
  );
};

// Memoize to prevent re-renders when parent re-renders but props haven't changed
// This fixes flickering when navigating dropdown with keyboard
export const ClaudePanelAgent = React.memo(ClaudePanelAgentComponent);
