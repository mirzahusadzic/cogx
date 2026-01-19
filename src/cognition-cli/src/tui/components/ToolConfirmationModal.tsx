import React from 'react';
import { Box, Text } from 'ink';
import { formatToolInput, extractBaseCommand } from '../utils/tool-safety.js';
import { formatToolUse } from '../hooks/rendering/ToolFormatter.js';
import type { ToolConfirmationState } from '../hooks/useToolConfirmation.js';
import { TUITheme } from '../theme.js';

/**
 * Props for ToolConfirmationModal component
 */
export interface ToolConfirmationModalProps {
  /** Current tool confirmation state with tool name and input */
  state: ToolConfirmationState;
  /** Current working directory for path relativization */
  cwd?: string;
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
  cwd,
}) => {
  const { toolName, input } = state;

  // Format tool name and icon using ToolFormatter
  const formattedTool = React.useMemo(
    () =>
      formatToolUse(
        {
          name: toolName,
          input: input as Record<string, unknown>,
        },
        cwd
      ),
    [toolName, input, cwd]
  );

  // Format tool input once to prevent re-calculations
  const formattedInput = React.useMemo(
    () => formatToolInput(toolName, input),
    [toolName, input]
  );

  // For confirmation modal, show relevant info without overwhelming
  const displayDescription = React.useMemo(() => {
    const inputObj = input as Record<string, unknown>;
    // For Edit/Write/Read - show the full file path
    if (inputObj.file_path) {
      return inputObj.file_path as string;
    }
    // For Bash - show first line only (handles multi-line git commits)
    if (inputObj.command) {
      const cmd = inputObj.command as string;
      const firstLine = cmd.split('\n')[0];
      // Truncate long commands
      if (firstLine.length > 100) {
        return firstLine.slice(0, 100) + '...';
      }
      return firstLine + (cmd.includes('\n') ? ' ...' : '');
    }
    // Fallback to formatted description (truncated for unknown tools)
    const desc = formattedTool.description;
    const firstLine = desc.split('\n')[0];
    if (firstLine.length > 100) {
      return firstLine.slice(0, 100) + '...';
    }
    return firstLine + (desc.includes('\n') ? ' ...' : '');
  }, [input, formattedTool.description]);

  // For bash commands, extract the base command for "Always" label
  const alwaysLabel = React.useMemo(() => {
    if (toolName.toLowerCase() === 'bash') {
      const baseCommand = extractBaseCommand(formattedInput);
      return baseCommand ? `all ${baseCommand}` : `all ${toolName}`;
    }
    return `all ${formattedTool.name}`;
  }, [toolName, formattedInput, formattedTool.name]);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={TUITheme.ui.warning}
      paddingX={1}
    >
      {/* Tool and file path only - diff shown in main window */}
      <Box>
        <Text color={TUITheme.ui.warning} bold>
          [!]{' '}
        </Text>
        <Text bold>{formattedTool.name}</Text>
        <Text dimColor>: </Text>
        <Text color={TUITheme.text.primary}>{displayDescription}</Text>
      </Box>

      {/* Compact footer with options - same style as CommandDropdown */}
      <Box
        borderTop
        borderColor={TUITheme.ui.border.dim}
        justifyContent="space-between"
      >
        <Text color={TUITheme.text.secondary} dimColor>
          Y Allow | N Deny | A Always ({alwaysLabel}) | Esc
        </Text>
      </Box>
    </Box>
  );
};

// Memoize to prevent re-renders when parent (index.tsx) re-renders
// This prevents terminal flickering - EXACT same pattern as CommandDropdown
export const ToolConfirmationModal = React.memo(ToolConfirmationModalComponent);
