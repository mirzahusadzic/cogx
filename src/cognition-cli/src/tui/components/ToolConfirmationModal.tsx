import React from 'react';
import { Box, Text } from 'ink';
import { formatToolInput, extractBaseCommand } from '../utils/tool-safety.js';
import type { ToolConfirmationState } from '../hooks/useToolConfirmation.js';

/**
 * Props for ToolConfirmationModal component
 */
export interface ToolConfirmationModalProps {
  /** Current tool confirmation state with tool name and input */
  state: ToolConfirmationState;
}

/**
 * Tool Confirmation Modal Component.
 *
 * Displays a confirmation dialog when the agent attempts to use potentially
 * dangerous tools (bash, write_file, edit_file). Follows the CommandDropdown
 * minimal design pattern for consistency.
 *
 * **Design Philosophy**:
 * - Purely presentational - keyboard handling in parent (index.tsx)
 * - Minimal rendering to prevent terminal flickering
 * - Memoized to avoid unnecessary re-renders
 *
 * **Features**:
 * - Compact display with tool name and truncated input
 * - Smart command extraction for bash (shows base command only)
 * - Visual warning indicator (⚠️ yellow border)
 * - Clear keyboard shortcuts in footer
 *
 * **Keyboard Controls** (handled by parent):
 * - Y: Allow this operation
 * - N: Deny this operation
 * - A: Always allow (adds to whitelist)
 * - Esc: Cancel
 *
 * @component
 * @param {ToolConfirmationModalProps} props - Component props
 *
 * @example
 * <ToolConfirmationModal
 *   state={{
 *     toolName: 'bash',
 *     input: { command: 'rm -rf temp/*' }
 *   }}
 * />
 */
const ToolConfirmationModalComponent: React.FC<ToolConfirmationModalProps> = ({
  state,
}) => {
  const { toolName, input } = state;

  // Format tool input once to prevent re-calculations
  const formattedInput = React.useMemo(
    () => formatToolInput(toolName, input),
    [toolName, input]
  );

  // For bash commands, extract the base command for "Always" label
  const alwaysLabel = React.useMemo(() => {
    if (toolName.toLowerCase() === 'bash') {
      const baseCommand = extractBaseCommand(formattedInput);
      return baseCommand ? `all ${baseCommand}` : `all ${toolName}`;
    }
    return `all ${toolName}`;
  }, [toolName, formattedInput]);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
    >
      {/* Tool and command - compact display */}
      <Box>
        <Text color="yellow">⚠️ </Text>
        <Text bold>{toolName}</Text>
        <Text dimColor> - </Text>
        <Text color="cyan">
          {formattedInput.slice(0, 50)}
          {formattedInput.length > 50 ? '…' : ''}
        </Text>
      </Box>

      {/* Compact footer with options - same style as CommandDropdown */}
      <Box borderTop borderColor="gray" justifyContent="space-between">
        <Text color="gray" dimColor>
          Y Allow | N Deny | A Always ({alwaysLabel}) | Esc
        </Text>
      </Box>
    </Box>
  );
};

// Memoize to prevent re-renders when parent (index.tsx) re-renders
// This prevents terminal flickering - EXACT same pattern as CommandDropdown
export const ToolConfirmationModal = React.memo(ToolConfirmationModalComponent);
