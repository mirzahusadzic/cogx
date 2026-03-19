import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type {
  WorkbenchHealthStatus,
  BackgroundTask,
} from '../../core/state/tui-sync/types.js';
import { TUITheme } from '../theme.js';
import { IBasePanelProps } from '../types/props.js';

import { environmentService } from '../../core/services/environment/EnvironmentService.js';
import { tuiSyncManager } from '../../core/state/tui-sync/TUISyncManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../../package.json'), 'utf-8')
);
const VERSION = packageJson.version;

// Platform-specific brand emoji (phoenix ZWJ breaks on macOS terminals)
const BRAND_EMOJI = environmentService.isMac() ? '🐉' : '🐦‍🔥';

/**
 * Props for OverlaysBar component
 */
export interface OverlaysBarProps extends IBasePanelProps {
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
 * - 🌿 Nodes: Count of conversation turns analyzed
 * - 🐘 Edges: Memory connections between related turns
 * - 🦋 Shifts: Detected paradigm shifts (metamorphosis!)
 * - 🐇 Novelty: Avg semantic novelty score (0-1)
 * - 🐍 Importance: Avg importance score (0-10)
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

const OverlaysBarComponent: React.FC<OverlaysBarProps> = ({
  sigmaStats: propsSigmaStats,
  activeTask: propsActiveTask,
  pendingMessageCount: propsPendingMessageCount = 0,
  monitorError: propsMonitorError,
  workbenchHealth: propsWorkbenchHealth,
}) => {
  // Sync with TUISyncStateMachine
  const [syncState, setSyncState] = useState(tuiSyncManager.getState());

  useEffect(() => {
    return tuiSyncManager.subscribe((_status, state) => {
      setSyncState({ ...state });
    });
  }, []);

  // Use state from state machine, falling back to props if not set in state machine
  const sigmaStats =
    syncState.sigmaStats.nodes > 0 ? syncState.sigmaStats : propsSigmaStats;
  const activeTask = syncState.activeTask || propsActiveTask;
  const pendingMessageCount =
    syncState.pendingMessageCount || propsPendingMessageCount;
  const monitorError = syncState.monitorError || propsMonitorError;
  const workbenchHealth = syncState.workbenchHealth || propsWorkbenchHealth;

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
        <Text color={TUITheme.overlays.o1_structural}>🌿 Nodes: {nodes}</Text>
        <Text color={TUITheme.ui.border.dim}>|</Text>
        <Text color={TUITheme.overlays.o5_operational}>🐘 Edges: {edges}</Text>
        <Text color={TUITheme.ui.border.dim}>|</Text>
        <Text color={TUITheme.overlays.o4_mission}>🦋 Shifts: {shifts}</Text>
        <Text color={TUITheme.ui.border.dim}>|</Text>
        <Text color={TUITheme.overlays.o3_lineage}>🐇 Novelty: {novelty}</Text>
        <Text color={TUITheme.ui.border.dim}>|</Text>
        <Text color={TUITheme.overlays.o6_mathematical}>
          🐍 Importance: {importance}
        </Text>
        {pendingMessageCount > 0 && (
          <>
            <Text color={TUITheme.ui.border.dim}>|</Text>
            <Text color={TUITheme.overlays.o2_security}>
              🐦 Messages: {pendingMessageCount}
            </Text>
          </>
        )}
      </>
    );
  };

  return (
    <Box
      paddingX={1}
      borderBottom
      borderColor={TUITheme.ui.border.default}
      flexDirection="row"
      justifyContent="space-between"
      width="100%"
    >
      <Box flexDirection="row">
        {monitorError ? (
          // Show error if monitor failed
          <Box paddingRight={1}>
            <Text color={TUITheme.text.error}>
              ⚠ Message Monitor: {monitorError}
            </Text>
          </Box>
        ) : hasWorkbenchIssues ? (
          // Show workbench issues when health check failed
          <>
            <Box paddingRight={1}>
              <Text color={TUITheme.text.error}>
                ⚠️ Workbench: {workbenchIssues.join(', ')}
              </Text>
            </Box>
            {pendingMessageCount > 0 && (
              <>
                <Text color={TUITheme.ui.border.dim}>|</Text>
                <Box paddingX={1}>
                  <Text color={TUITheme.overlays.o2_security}>
                    🐦 Messages: {pendingMessageCount}
                  </Text>
                </Box>
              </>
            )}
          </>
        ) : !sigmaStats || sigmaStats.nodes === 0 ? (
          <>
            <Box paddingRight={1}>
              <Text color={TUITheme.text.secondary}>
                Lattice: Warming up...
              </Text>
            </Box>
            {/* Always show pending messages, even when lattice is warming up */}
            {pendingMessageCount > 0 && (
              <>
                <Text color={TUITheme.ui.border.dim}>|</Text>
                <Box paddingX={1}>
                  <Text color={TUITheme.overlays.o2_security}>
                    🐦 Messages: {pendingMessageCount}
                  </Text>
                </Box>
              </>
            )}
          </>
        ) : (
          <Box gap={1}>{renderSigmaStats()}</Box>
        )}
      </Box>
      <Box>
        {showTaskStatus && activeTask ? (
          <TaskStatusDisplay task={activeTask} />
        ) : (
          <>
            <Text
              bold
              color={TUITheme.overlays.o7_strategic}
            >{`COGNITION Σ CLI v${VERSION}`}</Text>
            <Text> {BRAND_EMOJI}</Text>
          </>
        )}
      </Box>
    </Box>
  );
};

export const OverlaysBar = React.memo(OverlaysBarComponent);

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
      <Text color={TUITheme.text.secondary}>{message}</Text>
    </Box>
  );
};
