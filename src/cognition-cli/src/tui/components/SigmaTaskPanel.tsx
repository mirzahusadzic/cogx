import React from 'react';
import { Box, Text } from 'ink';
import { TUITheme } from '../theme.js';
import type { SigmaTasks } from '../hooks/useAgent/types.js';
import type { TokenCount } from '../hooks/tokens/useTokenCount.js';
import { SessionTokenCount } from '../hooks/tokens/useSessionTokenCount.js';
import {
  cleanAnsi as stripAnsi,
  formatCompactNumber,
} from '../../utils/string-utils.js';

const MAX_SUMMARY_LENGTH = 140;
const MAX_TASKS_FOR_ALL_SUMMARIES = 3;

const truncate = (str: string, maxLength: number) => {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength).trim() + '...';
};

/**
 * Props for SigmaTaskPanel component
 */
export interface SigmaTaskPanelProps {
  /** Current sigma tasks state */
  sigmaTasks: SigmaTasks;

  /** Current token count */
  tokenCount: TokenCount;

  /** Overall session token usage */
  sessionTokenCount: SessionTokenCount;

  /** Optional width of the panel (default: 50) */
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
  width = 50,
}) => {
  const { todos } = sigmaTasks;

  // Sort tasks: completed first (chronological), then in_progress, then others
  const sortedTodos = [...todos].sort((a, b) => {
    const statusPriority: Record<string, number> = {
      completed: 1,
      in_progress: 2,
      delegated: 3,
      pending: 4,
    };
    const priorityA = statusPriority[a.status] || 99;
    const priorityB = statusPriority[b.status] || 99;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // Maintain relative order for tasks with same status (usually chronological)
    return todos.indexOf(a) - todos.indexOf(b);
  });

  const lastCompletedTaskId = [...todos]
    .reverse()
    .find((t) => t.status === 'completed')?.id;
  const showAllSummaries = todos.length <= MAX_TASKS_FOR_ALL_SUMMARIES;

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

  const renderHeader = (title: string) => {
    const label = ` Σ ${title} `;
    const padding = Math.max(0, width - 2 - label.length);
    const leftPadding = Math.floor(padding / 2);
    const rightPadding = padding - leftPadding;
    return '━'.repeat(leftPadding) + label + '━'.repeat(rightPadding);
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
          {renderHeader('TASK LIST')}
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        {sortedTodos.length === 0 ? (
          <Text dimColor italic>
            {'  '}No active tasks
          </Text>
        ) : (
          sortedTodos.map((task) => (
            <Box key={task.id} marginLeft={1} flexDirection="column">
              <Box flexDirection="column">
                <Text color={getStatusColor(task.status)}>
                  [{getStatusIcon(task.status)}]{' '}
                  {stripAnsi(
                    task.status === 'in_progress'
                      ? task.activeForm
                      : task.content
                  )}
                </Text>
                {(task.status === 'completed' ||
                  task.status === 'in_progress') &&
                  task.tokensUsed !== undefined &&
                  task.tokensUsed > 0 && (
                    <Box marginLeft={4}>
                      <Text color={TUITheme.text.tertiary}>
                        (
                        {task.tokensSaved && task.tokensSaved > 0
                          ? `${formatCompactNumber(task.tokensSaved)} / `
                          : ''}
                        {formatCompactNumber(task.tokensUsed)})
                      </Text>
                    </Box>
                  )}
              </Box>
              {task.status === 'completed' &&
                task.result_summary &&
                (showAllSummaries || task.id === lastCompletedTaskId) && (
                  <Box marginLeft={4}>
                    <Text color={TUITheme.text.tertiary} italic wrap="wrap">
                      ↳{' '}
                      {truncate(
                        stripAnsi(task.result_summary),
                        MAX_SUMMARY_LENGTH
                      )}
                    </Text>
                  </Box>
                )}
            </Box>
          ))
        )}
      </Box>

      {tokenCount.total > 0 && (
        <>
          <Box marginBottom={1}>
            <Text bold color={TUITheme.overlays.o7_strategic}>
              {renderHeader('CTX TOKENS')}
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
              <Text color={TUITheme.text.tertiary}>
                In: {formatCompactNumber(tokenCount.input)} |{' '}
              </Text>
              <Text color={TUITheme.text.tertiary}>
                Out: {formatCompactNumber(tokenCount.output)}
                {tokenCount.cached && tokenCount.cached > 0 ? (
                  <Text color={TUITheme.text.tertiary}>
                    {' '}
                    | Cached: {formatCompactNumber(tokenCount.cached)}
                  </Text>
                ) : null}
              </Text>
            </Box>
          </Box>
        </>
      )}

      {sessionTokenCount.total > 0 && (
        <>
          <Box marginBottom={1}>
            <Text bold color={TUITheme.overlays.o7_strategic}>
              {renderHeader('SESSION TOKENS')}
            </Text>
          </Box>

          <Box flexDirection="column" marginLeft={1} marginBottom={1}>
            <Box>
              <Text color={TUITheme.text.primary}>Total: </Text>
              <Text color={TUITheme.text.success}>
                {sessionTokenCount.total.toLocaleString()}
              </Text>
              {sessionTokenCount.costUsd > 0 && (
                <Text color={TUITheme.text.warning} bold>
                  {' '}
                  (${sessionTokenCount.costUsd.toFixed(2)})
                </Text>
              )}
            </Box>
            {sessionTokenCount.cached && sessionTokenCount.cached > 0 ? (
              <Box>
                <Text color={TUITheme.text.primary}>Cached: </Text>
                <Text color={TUITheme.text.tertiary}>
                  {formatCompactNumber(sessionTokenCount.cached)}
                </Text>
                {sessionTokenCount.savedCostUsd > 0 && (
                  <Text color={TUITheme.text.tertiary}>
                    {' '}
                    (${sessionTokenCount.savedCostUsd.toFixed(2)})
                  </Text>
                )}
              </Box>
            ) : null}
            <Box flexDirection="row">
              <Text color={TUITheme.text.tertiary}>
                In: {formatCompactNumber(sessionTokenCount.input)} |{' '}
              </Text>
              <Text color={TUITheme.text.tertiary}>
                Out: {formatCompactNumber(sessionTokenCount.output)}
              </Text>
              {sessionTokenCount.turns > 0 && (
                <Text color={TUITheme.text.tertiary}>
                  {' '}
                  | Turns: {sessionTokenCount.turns}
                </Text>
              )}
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};
