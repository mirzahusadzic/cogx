import React, { useMemo, useState, useEffect } from 'react';
import { Box, Text, useStdout, useInput } from 'ink';
import { Spinner } from '@inkjs/ui';
import type { ClaudeMessage } from '../hooks/useClaudeAgent.js';

interface ClaudePanelAgentProps {
  messages: ClaudeMessage[];
  isThinking: boolean;
  focused: boolean;
}

/**
 * Panel showing Claude Agent SDK messages
 */
export const ClaudePanelAgent: React.FC<ClaudePanelAgentProps> = ({
  messages,
  isThinking,
  focused,
}) => {
  const { stdout } = useStdout();
  const [scrollOffset, setScrollOffset] = useState(0);

  // Calculate available height for content
  // Terminal height - overlay bar (3) - input box (3) - status bar (3) - borders (2) - padding (2)
  const availableHeight = (stdout?.rows || 24) - 11;

  // Build all content lines
  const allLines = useMemo(() => {
    if (messages.length === 0) {
      return ['Start typing to chat with Claude...'];
    }

    const lines: string[] = [];

    messages.forEach((msg) => {
      let prefix = '';
      switch (msg.type) {
        case 'user':
          prefix = '> ';
          break;
        case 'system':
          prefix = '• ';
          break;
        case 'assistant':
        case 'tool_progress':
          prefix = '';
          break;
      }

      // Split multi-line content and mark diff lines
      const contentLines = (prefix + msg.content).split('\n');
      contentLines.forEach((line) => {
        // Color diff lines
        if (line.trim().startsWith('- ')) {
          lines.push(`\x1b[31m${line}\x1b[0m`); // Red for removals
        } else if (line.trim().startsWith('+ ')) {
          lines.push(`\x1b[32m${line}\x1b[0m`); // Green for additions
        } else {
          lines.push(line);
        }
      });
      lines.push(''); // Empty line between messages
    });

    return lines;
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive OR when panel loses focus
  useEffect(() => {
    setScrollOffset(0); // Reset to bottom
  }, [messages.length]);

  // Auto-scroll to bottom when switching focus back to input
  useEffect(() => {
    if (focused) {
      // Panel is focused - user is scrolling
    } else {
      // Input is focused - auto-scroll to bottom
      setScrollOffset(0);
    }
  }, [focused]);

  // Handle scrolling when panel is focused
  useInput(
    (input, key) => {
      if (!focused) return;

      if (key.upArrow) {
        // Scroll up (increase offset)
        setScrollOffset((prev) => {
          const maxOffset = Math.max(0, allLines.length - availableHeight);
          return Math.min(prev + 1, maxOffset);
        });
      } else if (key.downArrow) {
        // Scroll down (decrease offset)
        setScrollOffset((prev) => Math.max(0, prev - 1));
      } else if (key.pageUp) {
        // Page up
        setScrollOffset((prev) => {
          const maxOffset = Math.max(0, allLines.length - availableHeight);
          return Math.min(prev + availableHeight, maxOffset);
        });
      } else if (key.pageDown) {
        // Page down
        setScrollOffset((prev) => Math.max(0, prev - availableHeight));
      }
    },
    { isActive: focused }
  );

  // Calculate visible window
  const displayContent = useMemo(() => {
    const totalLines = allLines.length;
    const maxOffset = Math.max(0, totalLines - availableHeight);
    const actualOffset = Math.min(scrollOffset, maxOffset);

    // Show lines from bottom minus offset
    const startIdx = Math.max(0, totalLines - availableHeight - actualOffset);
    const endIdx = totalLines - actualOffset;

    const visibleLines = allLines.slice(startIdx, endIdx);
    return visibleLines.join('\n');
  }, [allLines, availableHeight, scrollOffset]);

  // Calculate scroll indicator
  const scrollInfo = useMemo(() => {
    const totalLines = allLines.length;
    if (totalLines <= availableHeight) {
      return null; // No scrolling needed
    }

    const maxOffset = totalLines - availableHeight;
    const actualOffset = Math.min(scrollOffset, maxOffset);
    const percentage = Math.round((1 - actualOffset / maxOffset) * 100);

    return `↕ ${percentage}%`;
  }, [allLines.length, availableHeight, scrollOffset]);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={focused ? 'cyan' : 'gray'}
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
