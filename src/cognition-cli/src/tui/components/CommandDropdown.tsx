import React, { useState, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import { Command } from '../commands/loader.js';

export interface CommandDropdownProps {
  commands: Command[];
  selectedIndex: number;
  isVisible: boolean;
  maxHeight?: number;
}

export function CommandDropdown({
  commands,
  selectedIndex,
  isVisible,
  maxHeight = 10,
}: CommandDropdownProps): React.ReactElement | null {
  const { stdout } = useStdout();
  const [scrollOffset, setScrollOffset] = useState(0);

  // Reset scroll when dropdown closes or commands change
  useEffect(() => {
    if (!isVisible) {
      setScrollOffset(0);
    }
  }, [isVisible]);

  useEffect(() => {
    setScrollOffset(0);
  }, [commands.length]);

  // Auto-scroll to keep selected item visible when keyboard navigating
  useEffect(() => {
    if (!isVisible) return;

    const adjustedMaxHeight = Math.min(maxHeight, Math.floor((stdout?.rows || 24) / 3));

    // If selected item is below visible window, scroll down to show it
    if (selectedIndex >= scrollOffset + adjustedMaxHeight) {
      setScrollOffset(selectedIndex - adjustedMaxHeight + 1);
    }
    // If selected item is above visible window, scroll up to show it
    else if (selectedIndex < scrollOffset) {
      setScrollOffset(selectedIndex);
    }
  }, [selectedIndex, isVisible, scrollOffset, maxHeight, stdout?.rows]);

  if (!isVisible || commands.length === 0) {
    return null;
  }

  // Adjust max height for small terminals
  const terminalHeight = stdout?.rows || 24;
  const adjustedMaxHeight = Math.min(maxHeight, Math.floor(terminalHeight / 3));

  // Calculate visible window with scroll offset
  const totalCommands = commands.length;
  const maxOffset = Math.max(0, totalCommands - adjustedMaxHeight);
  const actualOffset = Math.min(scrollOffset, maxOffset);
  const visibleCommands = commands.slice(actualOffset, actualOffset + adjustedMaxHeight);
  const hasMore = totalCommands > adjustedMaxHeight;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      marginTop={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          Commands ({commands.length})
        </Text>
      </Box>

      {/* Command list */}
      {visibleCommands.map((command, visibleIndex) => {
        // Calculate actual index in full commands array
        const actualIndex = actualOffset + visibleIndex;
        const isSelected = actualIndex === selectedIndex;

        return (
          <Box key={command.name} marginBottom={0}>
            <Text color={isSelected ? 'green' : 'white'}>
              {isSelected ? '▸ ' : '  '}
              /{command.name}
            </Text>
            {command.description && (
              <Text color="gray" dimColor>
                {' - '}
                {command.description.slice(0, 40)}
                {command.description.length > 40 ? '...' : ''}
              </Text>
            )}
          </Box>
        );
      })}

      {hasMore && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            {actualOffset > 0 && `↑ ${actualOffset} above `}
            {actualOffset < maxOffset && `↓ ${maxOffset - actualOffset} below`}
          </Text>
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1} borderStyle="single" borderTop borderColor="gray">
        <Text color="gray" dimColor>
          ↑↓ Navigate • Enter Select • Esc Cancel
        </Text>
      </Box>
    </Box>
  );
}
