import React from 'react';
import { Box, Text } from 'ink';

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
 * Overlay activation scores (0-10 scale)
 */
export interface OverlayScores {
  /** O1: Structural analysis overlay */
  O1_structural: number;

  /** O2: Security analysis overlay */
  O2_security: number;

  /** O3: Lineage tracking overlay */
  O3_lineage: number;

  /** O4: Mission alignment overlay */
  O4_mission: number;

  /** O5: Operational analysis overlay */
  O5_operational: number;

  /** O6: Mathematical reasoning overlay */
  O6_mathematical: number;

  /** O7: Strategic planning overlay */
  O7_strategic: number;
}

/**
 * Props for SigmaInfoPanel component
 */
export interface SigmaInfoPanelProps {
  /** Conversation lattice statistics */
  sigmaStats: SigmaStats;

  /** Overlay activation scores */
  overlays: OverlayScores;
}

const OVERLAY_INFO = {
  O1_structural: { icon: '🏗️ ', label: 'Structural', color: '#58a6ff' },
  O2_security: { icon: '🛡️ ', label: 'Security', color: '#f0883e' },
  O3_lineage: { icon: '🌳', label: 'Lineage', color: '#56d364' },
  O4_mission: { icon: '🎯', label: 'Mission', color: '#d29922' },
  O5_operational: { icon: '⚙️ ', label: 'Operational', color: '#79c0ff' },
  O6_mathematical: { icon: '📐', label: 'Mathematical', color: '#bc8cff' },
  O7_strategic: { icon: '🧭', label: 'Strategic', color: '#9ed2f5' },
};

/**
 * Sigma Info Panel Component - Detailed Statistics Sidebar.
 *
 * Displays comprehensive Sigma conversation lattice metrics and overlay
 * activation scores in a toggleable sidebar panel.
 *
 * **Features**:
 * - Lattice statistics (nodes, edges, paradigm shifts)
 * - Semantic analysis averages (novelty, importance)
 * - Overlay activation scores with visual bars
 * - Color-coded metrics matching overlay themes
 * - Compact 50-character width
 *
 * **Toggle**: Press 'i' key (when not in input box) to show/hide
 *
 * **Sections**:
 * 1. **Lattice**: Conversation graph structure
 *    - Nodes: Total conversation turns analyzed
 *    - Edges: Connections between related turns
 *    - Shifts: Detected paradigm shifts
 *
 * 2. **Averages**: Semantic analysis metrics
 *    - Novelty: Average novelty score (0-1, 3 decimals)
 *    - Importance: Average importance (0-10, 1 decimal)
 *
 * 3. **Overlay Activations**: O1-O7 activation scores
 *    - Visual bar chart (5 blocks: █░░░░)
 *    - Numeric score (0-10 scale)
 *    - Color-coded by overlay type
 *
 * @component
 * @param {SigmaInfoPanelProps} props - Component props
 *
 * @example
 * <SigmaInfoPanel
 *   sigmaStats={{
 *     nodes: 24,
 *     edges: 23,
 *     paradigmShifts: 2,
 *     avgNovelty: 0.543,
 *     avgImportance: 6.8
 *   }}
 *   overlays={{
 *     O1_structural: 7.2,
 *     O2_security: 3.5,
 *     O3_lineage: 8.1,
 *     O4_mission: 5.0,
 *     O5_operational: 4.3,
 *     O6_mathematical: 2.1,
 *     O7_strategic: 6.9
 *   }}
 * />
 */
export const SigmaInfoPanel: React.FC<SigmaInfoPanelProps> = ({
  sigmaStats,
  overlays,
}) => {
  const renderBar = (value: number, max: number = 10) => {
    const filled = Math.round((value / max) * 5);
    const empty = 5 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  };

  return (
    <Box
      flexDirection="column"
      borderTop
      borderBottom
      borderColor="cyan"
      paddingX={1}
      paddingY={0}
      width={50}
    >
      <Box marginBottom={1} marginTop={1}>
        <Text bold color="cyan">
          ━━━━━━ SIGMA STATS ━━━━━━
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color="#8b949e">Lattice:</Text>
        <Text color="#58a6ff"> Nodes: {sigmaStats.nodes ?? 0} 🕸️</Text>
        <Text color="#79c0ff"> Edges: {sigmaStats.edges ?? 0} 🔗</Text>
        <Text color="#d29922">
          {' '}
          Shifts: {sigmaStats.paradigmShifts ?? 0} ⚡
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color="#8b949e">Averages:</Text>
        <Text color="#56d364">
          {' '}
          Novelty: {(sigmaStats.avgNovelty ?? 0).toFixed(3)} 🐇
        </Text>
        <Text color="#bc8cff">
          {' '}
          Importance: {(sigmaStats.avgImportance ?? 0).toFixed(1)} ☝️
        </Text>
      </Box>

      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="#8b949e">Overlay Activations:</Text>
        </Box>
        {Object.entries(OVERLAY_INFO).map(([key, info]) => {
          const score = overlays[key as keyof OverlayScores];
          return (
            <Text key={key} color={info.color}>
              {info.icon} {info.label.padEnd(12)} {renderBar(score)}{' '}
              {score.toFixed(1)}/10
            </Text>
          );
        })}
      </Box>

      <Box marginTop={1} marginBottom={1}>
        <Text dimColor>Press 'i' to close</Text>
      </Box>
    </Box>
  );
};
