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
 * Workbench health status for display
 */
export interface WorkbenchHealthStatus {
  /** Whether workbench is reachable */
  reachable: boolean;
  /** Whether embedding model is loaded */
  embeddingReady: boolean;
  /** Whether summarization is available */
  summarizationReady: boolean;
  /** Whether API key is set */
  hasApiKey: boolean;
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
  /** Workbench health status (if unhealthy, shows issues instead of lattice) */
  workbenchHealth?: WorkbenchHealthStatus;
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
      return task.overlay || 'Overlay Generation';
    default:
      return 'Processing';
  }
}

/**
 * Build workbench health issues string for display
 */
function getWorkbenchIssues(health: WorkbenchHealthStatus): string[] {
  const issues: string[] = [];
  if (!health.reachable) {
    issues.push('unreachable');
  } else {
    if (!health.embeddingReady) issues.push('no embeddings');
    if (!health.summarizationReady) issues.push('no summarization');
    if (!health.hasApiKey) issues.push('no API key');
  }
  return issues;
}

export const OverlaysBar: React.FC<OverlaysBarProps> = ({
  sigmaStats,
  activeTask,
  pendingMessageCount = 0,
  monitorError,
  workbenchHealth,
}) => {
  // Determine if we should show status instead of branding
  const showTaskStatus =
    activeTask &&
    (activeTask.status === 'running' || activeTask.status === 'pending');

  // Check if workbench has issues (not healthy = show issues)
  const workbenchIssues = workbenchHealth
    ? getWorkbenchIssues(workbenchHealth)
    : [];
  const hasWorkbenchIssues = workbenchIssues.length > 0;

  // Build sigma stats with dimmed pipe separators
  const renderSigmaStats = () => {
    const nodes = sigmaStats?.nodes ?? 0;
    const edges = sigmaStats?.edges ?? 0;
    const shifts = sigmaStats?.paradigmShifts ?? 0;
    const novelty = (sigmaStats?.avgNovelty ?? 0).toFixed(2);
    const importance = (sigmaStats?.avgImportance ?? 0).toFixed(1);

    return (
      <>
        <Text color="#8b949e">{nodes} nodes 🕸️ </Text>
        <Text color="#3a3f4b">|</Text>
        <Text color="#8b949e">{edges} edges 🔗</Text>
        <Text color="#3a3f4b">|</Text>
        <Text color="#8b949e">{shifts} shifts ⚡</Text>
        <Text color="#3a3f4b">|</Text>
        <Text color="#8b949e">novelty: {novelty} 🐇</Text>
        <Text color="#3a3f4b">|</Text>
        <Text color="#8b949e">importance: {importance} ☝️ </Text>
        {pendingMessageCount > 0 && (
          <>
            <Text color="#3a3f4b">|</Text>
            <Text color="#f0883e">{pendingMessageCount} messages 📬</Text>
          </>
        )}
      </>
    );
  };

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
        ) : hasWorkbenchIssues ? (
          // Show workbench issues when health check failed
          <>
            <Text color="#f85149">
              ⚠️ Workbench: {workbenchIssues.join(', ')}
            </Text>
            {pendingMessageCount > 0 && (
              <>
                <Text color="#3a3f4b">|</Text>
                <Text color="#f0883e">{pendingMessageCount} messages 📬</Text>
              </>
            )}
          </>
        ) : !sigmaStats || sigmaStats.nodes === 0 ? (
          <>
            <Text color="#8b949e">Lattice: Warming up...</Text>
            {/* Always show pending messages, even when lattice is warming up */}
            {pendingMessageCount > 0 && (
              <>
                <Text color="#3a3f4b">|</Text>
                <Text color="#f0883e">{pendingMessageCount} messages 📬</Text>
              </>
            )}
          </>
        ) : (
          renderSigmaStats()
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
 * Get icon for overlay type (matches SigmaInfoPanel icons)
 */
function getOverlayIcon(overlay: string | undefined): string {
  switch (overlay) {
    case 'structural_patterns':
      return '🏗️ ';
    case 'security_guidelines':
      return '🛡️ ';
    case 'lineage_patterns':
      return '🌳 ';
    case 'mission_concepts':
      return '🎯 ';
    case 'operational_patterns':
      return '⚙️ ';
    case 'mathematical_proofs':
      return '📐 ';
    case 'strategic_coherence':
      return '🧭 ';
    default:
      return '🏗️ ';
  }
}

/**
 * Task status display component
 * Shows: 🏗️  Embedding 387/832 patterns (47%)
 */
const TaskStatusDisplay: React.FC<{ task: BackgroundTask }> = ({ task }) => {
  const message = task.message || getTaskLabel(task);
  const icon = task.type === 'overlay' ? getOverlayIcon(task.overlay) : '🏗️ ';

  return (
    <Box flexDirection="row">
      <Text>{icon}</Text>
      <Text color="#8b949e">{message}</Text>
    </Box>
  );
};
