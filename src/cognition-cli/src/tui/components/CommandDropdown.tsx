import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useStdout } from 'ink';
import { Command } from '../commands/loader.js';

/**
 * Props for CommandDropdown component
 */
export interface CommandDropdownProps {
  /** Array of slash commands to display */
  commands: Command[];

  /** Index of currently selected command (controlled by parent) */
  selectedIndex: number;

  /** Whether dropdown should be visible */
  isVisible: boolean;

  /** Maximum number of commands to show before scrolling */
  maxHeight?: number;
}

/**
 * Slash Command Autocomplete Dropdown Component.
 *
 * Displays available slash commands as the user types "/" in the input box.
 * Features auto-scrolling to keep the selected command visible, keyboard navigation,
 * and compact display optimized for terminal environments.
 *
 * **Features**:
 * - Auto-complete dropdown triggered by "/"
 * - Keyboard navigation (↑↓ arrows)
 * - Auto-scroll to keep selected item visible
 * - Scroll indicators when more commands are available
 * - Compact display (max 25% of terminal height)
 * - Command descriptions truncated to fit
 *
 * **Keyboard Controls**:
 * - ↑/↓: Navigate command list
 * - Enter: Select command
 * - Esc: Close dropdown
 *
 * @component
 * @param {CommandDropdownProps} props - Component props
 *
 * @example
 * <CommandDropdown
 *   commands={availableCommands}
 *   selectedIndex={2}
 *   isVisible={inputStartsWith('/') && inputLength > 1}
 *   maxHeight={5}
 * />
 */
const CommandDropdownComponent = ({
  commands,
  selectedIndex,
  isVisible,
  maxHeight = 5, // Reduced from 10 for more compact display
}: CommandDropdownProps): React.ReactElement | null => {
  const { stdout } = useStdout();
  const [scrollOffset, setScrollOffset] = useState(0);

  // Memoize terminal height calculation to prevent recalculation on every render
  const adjustedMaxHeight = useMemo(
    () => Math.min(maxHeight, Math.floor((stdout?.rows || 24) / 4)), // Changed from /3 to /4 for smaller dropdown
    [maxHeight, stdout?.rows]
  );

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

    // If selected item is below visible window, scroll down to show it
    if (selectedIndex >= scrollOffset + adjustedMaxHeight) {
      setScrollOffset(selectedIndex - adjustedMaxHeight + 1);
    }
    // If selected item is above visible window, scroll up to show it
    else if (selectedIndex < scrollOffset) {
      setScrollOffset(selectedIndex);
    }
  }, [selectedIndex, isVisible, scrollOffset, adjustedMaxHeight]);

  if (!isVisible || commands.length === 0) {
    return null;
  }

  // Calculate visible window with scroll offset
  const totalCommands = commands.length;
  const maxOffset = Math.max(0, totalCommands - adjustedMaxHeight);
  const actualOffset = Math.min(scrollOffset, maxOffset);
  const visibleCommands = commands.slice(
    actualOffset,
    actualOffset + adjustedMaxHeight
  );
  const hasMore = totalCommands > adjustedMaxHeight;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
    >
      {/* Command list - compact, no header */}
      {visibleCommands.map((command, visibleIndex) => {
        const actualIndex = actualOffset + visibleIndex;
        const isSelected = actualIndex === selectedIndex;

        return (
          <Box key={command.name}>
            <Text color={isSelected ? 'green' : 'white'}>
              {isSelected ? '▸ ' : '  '}/{command.name}
            </Text>
            {command.description && (
              <Text color="gray" dimColor>
                {' - '}
                {command.description.slice(0, 25)}
                {command.description.length > 25 ? '…' : ''}
              </Text>
            )}
          </Box>
        );
      })}

      {/* Compact footer with scroll indicator */}
      <Box borderTop borderColor="gray" justifyContent="space-between">
        <Text color="gray" dimColor>
          ↑↓ ⏎ Esc
        </Text>
        {hasMore && (
          <Text color="gray" dimColor>
            {actualOffset > 0 && `↑${actualOffset} `}
            {actualOffset < maxOffset && `↓${maxOffset - actualOffset}`}
          </Text>
        )}
      </Box>
    </Box>
  );
};

// Memoize to prevent re-renders when parent (InputBox) re-renders
// This prevents terminal flickering when navigating the dropdown
export const CommandDropdown = React.memo(CommandDropdownComponent);
