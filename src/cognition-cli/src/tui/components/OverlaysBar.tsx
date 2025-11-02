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

interface SigmaStats {
  nodes: number;
  edges: number;
  paradigmShifts: number;
  avgNovelty: number;
  avgImportance: number;
}

interface OverlaysBarProps {
  sigmaStats?: SigmaStats;
}

/**
 * Compact horizontal bar showing Sigma lattice statistics
 */
export const OverlaysBar: React.FC<OverlaysBarProps> = ({ sigmaStats }) => {
  return (
    <Box paddingX={1} borderBottom borderColor="#30363d" flexDirection="row" justifyContent="space-between" width="100%">
      <Box flexDirection="row" gap={1}>
        {!sigmaStats || sigmaStats.nodes === 0 ? (
          <Text color="#8b949e">Lattice: Warming up...</Text>
        ) : (
          <>
            <Text color="#58a6ff">
              🕸️  {sigmaStats.nodes} nodes
            </Text>
            <Text color="#8b949e">|</Text>
            <Text color="#79c0ff">
              🔗 {sigmaStats.edges} edges
            </Text>
            <Text color="#8b949e">|</Text>
            <Text color="#d29922">
              ⚡ {sigmaStats.paradigmShifts} shifts
            </Text>
            <Text color="#8b949e">|</Text>
            <Text color="#56d364">
              📊 novelty: {sigmaStats.avgNovelty.toFixed(2)}
            </Text>
            <Text color="#8b949e">|</Text>
            <Text color="#bc8cff">
              🎯 importance: {sigmaStats.avgImportance.toFixed(1)}
            </Text>
          </>
        )}
      </Box>
      <Box>
        <Text bold color="cyan">COGNITION Σ CLI v{VERSION} 🧠</Text>
      </Box>
    </Box>
  );
};
