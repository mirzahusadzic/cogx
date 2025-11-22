/**
 * Tool Confirmation Modal
 *
 * Interactive prompt for confirming tool execution.
 * Shows tool details, risk level, and allows user to approve/deny/always allow.
 */

import React, { useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { ToolRiskLevel } from '../utils/tool-safety.js';
import { formatToolInput } from '../utils/tool-safety.js';
import type { ToolConfirmationState } from '../hooks/useToolConfirmation.js';

interface ToolConfirmationModalProps {
  state: ToolConfirmationState;
  onAllow: () => void;
  onDeny: () => void;
  onAlwaysAllow: () => void;
}

/**
 * Get color for risk level
 */
function getRiskColor(
  riskLevel: ToolRiskLevel
): 'green' | 'yellow' | 'red' | 'magenta' {
  switch (riskLevel) {
    case ToolRiskLevel.SAFE:
      return 'green';
    case ToolRiskLevel.MODERATE:
      return 'yellow';
    case ToolRiskLevel.DANGEROUS:
      return 'red';
    case ToolRiskLevel.CRITICAL:
      return 'magenta';
  }
}

/**
 * Get emoji for risk level
 */
function getRiskEmoji(riskLevel: ToolRiskLevel): string {
  switch (riskLevel) {
    case ToolRiskLevel.SAFE:
      return '✅';
    case ToolRiskLevel.MODERATE:
      return '⚠️';
    case ToolRiskLevel.DANGEROUS:
      return '🚨';
    case ToolRiskLevel.CRITICAL:
      return '💀';
  }
}

export const ToolConfirmationModal: React.FC<ToolConfirmationModalProps> = ({
  state,
  onAllow,
  onDeny,
  onAlwaysAllow,
}) => {
  const { toolName, input, riskLevel, reason } = state;
  const riskColor = getRiskColor(riskLevel);
  const riskEmoji = getRiskEmoji(riskLevel);

  // Handle keyboard input
  useInput((inputChar, key) => {
    if (inputChar === 'y' || inputChar === 'Y') {
      onAllow();
    } else if (inputChar === 'n' || inputChar === 'N') {
      onDeny();
    } else if (inputChar === 'a' || inputChar === 'A') {
      onAlwaysAllow();
    } else if (key.escape) {
      onDeny();
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={riskColor}
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color={riskColor}>
          {riskEmoji} Tool Confirmation Required
        </Text>
      </Box>

      {/* Tool details */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text dimColor>Tool: </Text>
          <Text bold>{toolName}</Text>
        </Box>

        <Box marginTop={1}>
          <Text dimColor>Risk Level: </Text>
          <Text color={riskColor} bold>
            {riskLevel.toUpperCase()}
          </Text>
        </Box>

        <Box marginTop={1}>
          <Text dimColor>Reason: </Text>
          <Text>{reason}</Text>
        </Box>
      </Box>

      {/* Command/input preview */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        marginBottom={1}
      >
        <Text dimColor>Command:</Text>
        <Text color="cyan">{formatToolInput(toolName, input)}</Text>
      </Box>

      {/* Options */}
      <Box flexDirection="column">
        <Text dimColor>Options:</Text>
        <Box marginTop={1} flexDirection="column">
          <Text>
            <Text color="green" bold>
              [Y]
            </Text>
            <Text> Allow once</Text>
          </Text>
          <Text>
            <Text color="red" bold>
              [N]
            </Text>
            <Text> Deny</Text>
          </Text>
          <Text>
            <Text color="blue" bold>
              [A]
            </Text>
            <Text> Always allow (this session)</Text>
          </Text>
          <Text dimColor>
            <Text>[ESC] Cancel</Text>
          </Text>
        </Box>
      </Box>

      {/* Warning for critical operations */}
      {riskLevel === ToolRiskLevel.CRITICAL && (
        <Box marginTop={1} borderStyle="double" borderColor="red" paddingX={1}>
          <Text color="red" bold>
            ⚠️ WARNING: This operation is CRITICAL and may cause data loss!
          </Text>
        </Box>
      )}
    </Box>
  );
};
