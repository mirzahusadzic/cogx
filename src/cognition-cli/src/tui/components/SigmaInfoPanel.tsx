import React from 'react';
import { Box, Text } from 'ink';

interface SigmaStats {
  nodes: number;
  edges: number;
  paradigmShifts: number;
  avgNovelty: number;
  avgImportance: number;
}

interface OverlayScores {
  O1_structural: number;
  O2_security: number;
  O3_lineage: number;
  O4_mission: number;
  O5_operational: number;
  O6_mathematical: number;
  O7_strategic: number;
}

interface SigmaInfoPanelProps {
  sigmaStats: SigmaStats;
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
 * Info panel showing detailed Sigma statistics
 * Toggle with 'i' key when not in input box
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
          Novelty: {(sigmaStats.avgNovelty ?? 0).toFixed(3)} 📊
        </Text>
        <Text color="#bc8cff">
          {' '}
          Importance: {(sigmaStats.avgImportance ?? 0).toFixed(1)} 🎯
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
