import React from 'react';
import { Box, Text } from 'ink';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
export const OverlaysBar: React.FC<OverlaysBarProps> = ({ sigmaStats }) => {
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
        {!sigmaStats || sigmaStats.nodes === 0 ? (
          <Text color="#8b949e">Lattice: Warming up...</Text>
        ) : (
          <>
            <Text color="#58a6ff">{sigmaStats.nodes ?? 0} nodes 🕸️</Text>
            <Text color="#8b949e">|</Text>
            <Text color="#79c0ff">{sigmaStats.edges ?? 0} edges 🔗</Text>
            <Text color="#8b949e">|</Text>
            <Text color="#d29922">
              {sigmaStats.paradigmShifts ?? 0} shifts ⚡
            </Text>
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
        <Text bold color="cyan">
          COGNITION Σ CLI v{VERSION} 🧠
        </Text>
      </Box>
    </Box>
  );
};
