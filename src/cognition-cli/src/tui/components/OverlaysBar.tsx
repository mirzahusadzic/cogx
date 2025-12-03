import React from 'react';
import { Box, Text } from 'ink';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { BackgroundTask } from '../services/BackgroundTaskManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../../package.json'), 'utf-8')
);
const VERSION = packageJson.version;

/**
 * Sigma conversation lattice statistics
 */
export interface SigmaStats {
  /** Number of conversation nodes in lattice */
  nodes: number;

  /** Number of edges connecting nodes */
  edges: number;

  /** Count of detected paradigm shifts */
  paradigmShifts: number;

  /** Average novelty score (0-1) */
  avgNovelty: number;

  /** Average importance score (0-10) */
  avgImportance: number;
}

/**
 * Props for OverlaysBar component
 */
export interface OverlaysBarProps {
  /** Sigma lattice statistics to display */
  sigmaStats?: SigmaStats;
  /** Active background task (if any) - when set, shows status instead of branding */
  activeTask?: BackgroundTask | null;
  /** Number of pending messages in the message queue */
  pendingMessageCount?: number;
  /** Error message from message queue monitor (if any) */
  monitorError?: string | null;
}

/**
 * Overlays Bar Component - Sigma Lattice Statistics Display.
 *
 * Horizontal status bar showing real-time Sigma conversation lattice metrics
 * and CLI version. Appears at the top of the TUI.
 *
 * **Features**:
 * - Real-time lattice statistics (nodes, edges, shifts)
 * - Semantic analysis metrics (novelty, importance)
 * - Color-coded metrics for visual scanning
 * - CLI version display
 * - "Warming up" state for empty lattice
 *
 * **Metrics Displayed**:
 * - 🕸️ Nodes: Count of conversation turns analyzed
 * - 🔗 Edges: Connections between related turns
 * - ⚡ Shifts: Detected paradigm shifts in conversation
 * - 📊 Novelty: Avg semantic novelty score (0-1)
 * - 🎯 Importance: Avg importance score (0-10)
 *
 * **Color Scheme**:
 * - Blue (#58a6ff): Nodes (structural)
 * - Light blue (#79c0ff): Edges (connections)
 * - Orange (#d29922): Paradigm shifts (critical events)
 * - Green (#56d364): Novelty (positive metric)
 * - Purple (#bc8cff): Importance (priority)
 *
 * @component
 * @param {OverlaysBarProps} props - Component props
 *
 * @example
 * <OverlaysBar
 *   sigmaStats={{
 *     nodes: 42,
 *     edges: 41,
 *     paradigmShifts: 3,
 *     avgNovelty: 0.67,
 *     avgImportance: 6.2
 *   }}
 * />
 *
 * @example
 * // Empty state (no analysis yet)
 * <OverlaysBar sigmaStats={undefined} />
 */
/**
 * Format task label for display
 */
function getTaskLabel(task: BackgroundTask): string {
  switch (task.type) {
    case 'genesis':
      return 'Genesis';
    case 'genesis-docs':
      return 'Document Ingestion';
    case 'overlay':
      return task.overlay ? `${task.overlay} Overlay` : 'Overlay Generation';
    default:
      return 'Processing';
  }
}

/**
 * Get status indicator and color based on task state
 */
function getStatusIndicator(task: BackgroundTask): {
  symbol: string;
  color: string;
} {
  switch (task.status) {
    case 'pending':
      return { symbol: '○', color: '#8b949e' };
    case 'running':
      return { symbol: '●', color: '#58a6ff' };
    case 'completed':
      return { symbol: '✓', color: '#56d364' };
    case 'failed':
      return { symbol: '✗', color: '#f85149' };
    case 'cancelled':
      return { symbol: '⊘', color: '#d29922' };
    default:
      return { symbol: '●', color: '#8b949e' };
  }
}

export const OverlaysBar: React.FC<OverlaysBarProps> = ({
  sigmaStats,
  activeTask,
  pendingMessageCount = 0,
  monitorError,
}) => {
  // Determine if we should show status instead of branding
  const showTaskStatus =
    activeTask &&
    (activeTask.status === 'running' || activeTask.status === 'pending');

  return (
    <Box
      paddingX={1}
      borderBottom
      borderColor="#30363d"
      flexDirection="row"
      justifyContent="space-between"
      width="100%"
    >
      <Box flexDirection="row" gap={1}>
        {monitorError ? (
          // Show error if monitor failed
          <Text color="#f85149">⚠ Message Monitor: {monitorError}</Text>
        ) : showTaskStatus ? (
          // Hide stats when task is running to prevent line wrapping
          <>
            <Text color="#8b949e">Background Task:</Text>
            {/* Always show pending messages, even during background tasks */}
            {pendingMessageCount > 0 && (
              <>
                <Text color="#8b949e">|</Text>
                <Text color="#f0883e">{pendingMessageCount} 📬</Text>
              </>
            )}
          </>
        ) : !sigmaStats || sigmaStats.nodes === 0 ? (
          <>
            <Text color="#8b949e">Lattice: Warming up...</Text>
            {/* Always show pending messages, even when lattice is warming up */}
            {pendingMessageCount > 0 && (
              <>
                <Text color="#8b949e">|</Text>
                <Text color="#f0883e">{pendingMessageCount} messages 📬</Text>
              </>
            )}
          </>
        ) : (
          <>
            <Text color="#58a6ff">{sigmaStats.nodes ?? 0} nodes 🕸️</Text>
            <Text color="#8b949e">|</Text>
            <Text color="#79c0ff">{sigmaStats.edges ?? 0} edges 🔗</Text>
            <Text color="#8b949e">|</Text>
            <Text color="#d29922">
              {sigmaStats.paradigmShifts ?? 0} shifts ⚡
            </Text>
            {pendingMessageCount > 0 && (
              <>
                <Text color="#8b949e">|</Text>
                <Text color="#f0883e">{pendingMessageCount} messages 📬</Text>
              </>
            )}
            <Text color="#8b949e">|</Text>
            <Text color="#56d364">
              novelty: {(sigmaStats.avgNovelty ?? 0).toFixed(2)} 📊
            </Text>
            <Text color="#8b949e">|</Text>
            <Text color="#bc8cff">
              importance: {(sigmaStats.avgImportance ?? 0).toFixed(1)} 🎯
            </Text>
          </>
        )}
      </Box>
      <Box>
        {showTaskStatus && activeTask ? (
          <TaskStatusDisplay task={activeTask} />
        ) : (
          <Text bold color="cyan">
            COGNITION Σ CLI v{VERSION} 🧠
          </Text>
        )}
      </Box>
    </Box>
  );
};

/**
 * Task status display component
 * Shows: ● structural_patterns Overlay Embedding 31/131
 */
const TaskStatusDisplay: React.FC<{ task: BackgroundTask }> = ({ task }) => {
  const { symbol, color } = getStatusIndicator(task);
  const label = getTaskLabel(task);
  const message = task.message || '';

  return (
    <Box flexDirection="row" gap={1}>
      <Text color={color}>{symbol}</Text>
      <Text color={color} bold>
        {label}
      </Text>
      {message && <Text color="#8b949e">{message}</Text>}
    </Box>
  );
};
