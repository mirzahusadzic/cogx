import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { Spinner } from '@inkjs/ui';
import chalk from 'chalk';
import type { ClaudeMessage } from '../hooks/useClaudeAgent.js';
import { useMouse } from '../hooks/useMouse.js';

interface ClaudePanelAgentProps {
  messages: ClaudeMessage[];
  isThinking: boolean;
  focused: boolean;
  onScrollDetected?: () => void;
}

/**
 * Panel showing Claude Agent SDK messages
 */
export const ClaudePanelAgent: React.FC<ClaudePanelAgentProps> = ({
  messages,
  isThinking,
  focused,
  onScrollDetected,
}) => {
  const { stdout } = useStdout();
  const [scrollOffset, setScrollOffset] = useState(0);
  const lastScrollFocus = useRef<number>(0);

  // Calculate available height
  const availableHeight = (stdout?.rows || 24) - 11;

  // Build colored text lines using Chalk (Ink's color engine)
  const allLines = useMemo(() => {
    const lines: string[] = [];

    messages.forEach((msg) => {
      let prefix = '';
      let colorFn = chalk.hex('#58a6ff'); // Default: O1 structural blue

      switch (msg.type) {
        case 'user':
          prefix = '> ';
          colorFn = chalk.hex('#56d364'); // O3 lineage green
          break;
        case 'system':
          prefix = '• ';
          colorFn = chalk.hex('#8b949e'); // Muted gray
          break;
        case 'assistant':
        case 'tool_progress':
          prefix = '';
          colorFn = chalk.hex('#58a6ff'); // O1 structural blue
          break;
      }

      // Split content into lines and color each one
      const contentLines = (prefix + msg.content).split('\n');
      contentLines.forEach((line) => {
        lines.push(colorFn(line));
      });
      lines.push(''); // Empty line between messages
    });

    return lines;
  }, [messages]);

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

      if (key.upArrow) {
        setScrollOffset((prev) => Math.min(prev + 1, maxOffset));
      } else if (key.downArrow) {
        setScrollOffset((prev) => Math.max(0, prev - 1));
      } else if (key.pageUp) {
        setScrollOffset((prev) => Math.min(prev + availableHeight, maxOffset));
      } else if (key.pageDown) {
        setScrollOffset((prev) => Math.max(0, prev - availableHeight));
      } else if (key.return) {
        setScrollOffset(0); // Jump to bottom
      }
    },
    { isActive: focused }
  );

  // Handle mouse scrolling
  useMouse(
    (event) => {
      if (!focused && onScrollDetected) {
        const now = Date.now();
        if (now - lastScrollFocus.current > 100) {
          lastScrollFocus.current = now;
          onScrollDetected();
        }
      }

      const maxOffset = Math.max(0, allLines.length - availableHeight);

      if (event.type === 'scroll_up') {
        setScrollOffset((prev) => Math.min(prev + 3, maxOffset));
      } else if (event.type === 'scroll_down') {
        setScrollOffset((prev) => Math.max(0, prev - 3));
      }
    },
    { isActive: true }
  );

  // Calculate visible window
  const displayContent = useMemo(() => {
    const totalLines = allLines.length;
    if (totalLines <= availableHeight) {
      return allLines.join('\n'); // Show all
    }

    const maxOffset = Math.max(0, totalLines - availableHeight);
    const actualOffset = Math.min(scrollOffset, maxOffset);
    const startIdx = Math.max(0, totalLines - availableHeight - actualOffset);
    const endIdx = totalLines - actualOffset;

    return allLines.slice(startIdx, endIdx).join('\n');
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
      flexDirection="column"
      borderStyle="single"
      borderColor={focused ? '#2ea043' : '#30363d'}
      width="100%"
      paddingX={1}
    >
      <Box flexDirection="column" flexGrow={1}>
        <Text>{displayContent}</Text>
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
