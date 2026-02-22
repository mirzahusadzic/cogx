import React from 'react';
import { Box, Text } from 'ink';
import { TUITheme } from '../theme.js';
import type { SigmaTasks } from '../hooks/useAgent/types.js';
import type { TokenCount } from '../hooks/tokens/useTokenCount.js';

/**
 * Props for SigmaTaskPanel component
 */
export interface SigmaTaskPanelProps {
  /** Current sigma tasks state */
  sigmaTasks: SigmaTasks;

  /** Current token count */
  tokenCount: TokenCount;

  /** Overall session token usage */
  sessionTokenCount: TokenCount;

  /** Optional width of the panel (default: 40) */
  width?: number;
}

/**
 * Sigma Task and Token Panel - Persistent Status Sidebar.
 *
 * Displays the current task list and token usage statistics in a persistent
 * sidebar panel to give the user visibility into the agent's progress and cost.
 */
export const SigmaTaskPanel: React.FC<SigmaTaskPanelProps> = ({
  sigmaTasks,
  tokenCount,
  sessionTokenCount,
  width = 40,
}) => {
  const { todos } = sigmaTasks;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'in_progress':
        return '→';
      case 'pending':
        return '○';
      case 'delegated':
        return '🤖';
      default:
        return '?';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return TUITheme.text.success;
      case 'in_progress':
        return TUITheme.text.warning;
      case 'delegated':
        return TUITheme.text.secondary;
      default:
        return TUITheme.text.tertiary;
    }
  };

  return (
    <Box
      flexDirection="column"
      borderTop
      borderBottom
      borderColor={TUITheme.ui.border.default}
      paddingX={1}
      paddingY={0}
      width={width}
    >
      <Box marginBottom={1} marginTop={1}>
        <Text bold color={TUITheme.overlays.o7_strategic}>
          ━━━━━━━━━━━━ Σ TASK LIST ━━━━━━━━━━━━
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        {todos.length === 0 ? (
          <Text dimColor italic>
            {'  '}No active tasks
          </Text>
        ) : (
          todos.map((task) => (
            <Box key={task.id} marginLeft={1} flexDirection="column">
              <Box>
                <Text color={getStatusColor(task.status)}>
                  [{getStatusIcon(task.status)}]{' '}
                  {task.status === 'in_progress'
                    ? task.activeForm
                    : task.content}
                  {(task.status === 'completed' ||
                    task.status === 'in_progress') &&
                    task.tokensUsed !== undefined && (
                      <Text dimColor>
                        {' '}
                        ({task.tokensUsed.toLocaleString()} tokens)
                      </Text>
                    )}
                </Text>
              </Box>
              {task.status === 'completed' && task.result_summary && (
                <Box marginLeft={4}>
                  <Text dimColor italic wrap="wrap">
                    ↳ {task.result_summary}
                  </Text>
                </Box>
              )}
            </Box>
          ))
        )}
      </Box>

      <Box marginBottom={1}>
        <Text bold color={TUITheme.overlays.o7_strategic}>
          ━━━━━━━━━━━━ Σ CTX TOKENS ━━━━━━━━━━━━
        </Text>
      </Box>

      <Box flexDirection="column" marginLeft={1} marginBottom={1}>
        <Box>
          <Text color={TUITheme.text.primary}>Total: </Text>
          <Text color={TUITheme.text.success}>
            {tokenCount.total.toLocaleString()}
          </Text>
        </Box>
        <Box>
          <Text dimColor>In: {tokenCount.input.toLocaleString()} | </Text>
          <Text dimColor>Out: {tokenCount.output.toLocaleString()}</Text>
        </Box>
      </Box>

      <Box marginBottom={1}>
        <Text bold color={TUITheme.overlays.o7_strategic}>
          ━━━━━━━━━━ Σ SESSION TOKENS ━━━━━━━━━━
        </Text>
      </Box>

      <Box flexDirection="column" marginLeft={1} marginBottom={1}>
        <Box>
          <Text color={TUITheme.text.primary}>Total: </Text>
          <Text color={TUITheme.text.success}>
            {sessionTokenCount.total.toLocaleString()}
          </Text>
        </Box>
        <Box>
          <Text dimColor>
            In: {sessionTokenCount.input.toLocaleString()} |{' '}
          </Text>
          <Text dimColor>Out: {sessionTokenCount.output.toLocaleString()}</Text>
        </Box>
      </Box>
    </Box>
  );
};
