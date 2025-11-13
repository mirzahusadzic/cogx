import React, { useMemo, useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
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
const ClaudePanelAgentComponent: React.FC<ClaudePanelAgentProps> = ({
  messages,
  isThinking,
  focused,
}) => {
  const { stdout } = useStdout();
  const [scrollOffset, setScrollOffset] = useState(0);

  // Calculate available height - memoize to prevent recalculation on every render
  const availableHeight = useMemo(
    () => (stdout?.rows || 24) - 11,
    [stdout?.rows]
  );

  // Build colored text lines with color metadata
  const allLines = useMemo(() => {
    const lines: Array<{ text: string; color: string }> = [];

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
        case 'tool_progress':
          prefix = '';
          color = '#58a6ff'; // O1 structural blue
          break;
      }

      // Split content into lines and store with color
      const contentLines = (prefix + msg.content).split('\n');
      contentLines.forEach((line) => {
        lines.push({ text: line, color });
      });
      lines.push({ text: '', color }); // Empty line between messages
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
      flexDirection="column"
      borderTop
      borderBottom
      borderColor={focused ? '#2ea043' : '#30363d'}
      width="100%"
      paddingX={1}
    >
      <Box flexDirection="column" flexGrow={1}>
        {visibleLines.map((line, idx) => (
          <Text key={idx} color={line.color}>
            {line.text}
          </Text>
        ))}
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
