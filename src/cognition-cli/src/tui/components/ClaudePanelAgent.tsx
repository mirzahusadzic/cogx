import React, { useMemo, useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { Spinner } from '@inkjs/ui';
import type { ClaudeMessage } from '../hooks/useClaudeAgent.js';

interface ClaudePanelAgentProps {
  messages: ClaudeMessage[];
  isThinking: boolean;
  focused: boolean;
  streamingPaste?: string;
}

/**
 * Panel showing Claude Agent SDK messages
 */
const ClaudePanelAgentComponent: React.FC<ClaudePanelAgentProps> = ({
  messages,
  isThinking,
  focused,
  streamingPaste = '',
}) => {
  const { stdout } = useStdout();
  const [scrollOffset, setScrollOffset] = useState(0);

  // Calculate available height - memoize to prevent recalculation on every render
  const availableHeight = useMemo(
    () => (stdout?.rows || 24) - 11,
    [stdout?.rows]
  );

  // Note: Paste streaming is handled by parent component (index.tsx)
  // The [PASTE:filepath] message is sent after streaming completes

  // Build colored text lines with color metadata
  const allLines = useMemo(() => {
    const lines: Array<{ text: string; color: string }> = [];

    // Helper to convert markdown bold (**text**) to electric cyan/green ANSI codes
    const processBold = (text: string): string => {
      return text.replace(/\*\*([^*]+)\*\*/g, '\x1b[38;2;46;181;114m$1\x1b[0m');
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
        case 'tool_progress': {
          prefix = '  ';
          // Use amber-orange for tool commands, but blue for Edit diffs (they have their own formatting)
          color = msg.content.includes('🔧 Edit:') ? '#58a6ff' : '#f5a623';

          // Special handling: split tool name from command/details
          // Format: "🔧 ToolName: command/details"
          const toolMatch = msg.content.match(/^(🔧\s+\S+:)\s*(.*)$/);
          if (toolMatch && !msg.content.includes('🔧 Edit:')) {
            // Tool name in amber-orange, details in muted gray (with bold processing)
            const toolName = toolMatch[1];
            const details = processBold(toolMatch[2]);
            lines.push({
              text: `${prefix}${toolName} \x1b[38;2;138;145;153m${details}\x1b[0m`,
              color,
            });
            lines.push({ text: '', color }); // Empty line between messages
            return; // Skip normal processing
          }
          break;
        }
      }

      // Split content into lines and store with color
      const contentLines = (prefix + msg.content).split('\n');
      contentLines.forEach((line) => {
        // Process markdown bold syntax
        const processedLine = processBold(line);
        lines.push({ text: processedLine, color });
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
