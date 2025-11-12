import React from 'react';
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

  if (!isVisible || commands.length === 0) {
    return null;
  }

  // Adjust max height for small terminals
  const terminalHeight = stdout?.rows || 24;
  const adjustedMaxHeight = Math.min(maxHeight, Math.floor(terminalHeight / 3));

  // Limit visible commands (handle scrolling in Layer 5)
  const visibleCommands = commands.slice(0, adjustedMaxHeight);
  const hasMore = commands.length > adjustedMaxHeight;

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
      {visibleCommands.map((command, index) => {
        const isSelected = index === selectedIndex;

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
            ... and {commands.length - adjustedMaxHeight} more
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
