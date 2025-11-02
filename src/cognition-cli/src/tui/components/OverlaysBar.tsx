import React from 'react';
import { Box, Text } from 'ink';
import { OverlayInfo } from '../types.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../../package.json'), 'utf-8')
);
const VERSION = packageJson.version;

interface OverlaysBarProps {
  overlays: OverlayInfo[];
}

/**
 * Compact horizontal bar showing all overlay statuses
 */
// Icon mapping for each overlay type
const OVERLAY_ICONS: Record<string, string> = {
  O1: '🏗️', // structural_patterns - building/structure
  O2: '🛡️', // security_guidelines - shield
  O3: '🌳', // lineage_patterns - tree/dependencies
  O4: '🎯', // mission_concepts - target/mission
  O5: '⚙️', // operational_patterns - gears/workflow
  O6: '📐', // mathematical_proofs - ruler/math
  O7: '🧭', // strategic_coherence - compass/alignment
};

// Overlay-specific colors from AIEcho theme
const OVERLAY_COLORS: Record<string, string> = {
  O1: '#58a6ff', // Structural: blue
  O2: '#f0883e', // Security: AIEcho orange
  O3: '#56d364', // Lineage: bright green
  O4: '#d29922', // Mission: golden
  O5: '#79c0ff', // Operational: light blue
  O6: '#bc8cff', // Mathematical: purple
  O7: '#9ed2f5', // Strategic: AIEcho cyan-light
};

export const OverlaysBar: React.FC<OverlaysBarProps> = ({ overlays = [] }) => {
  return (
    <Box paddingX={1} borderBottom borderColor="#30363d" flexDirection="row" justifyContent="space-between" width="100%">
      <Box flexDirection="row">
        {overlays.length === 0 ? (
          <Text color="#8b949e">No overlays loaded</Text>
        ) : (
          overlays.map((overlay, index) => {
            const icon = OVERLAY_ICONS[overlay.id] || '📦';
            const status = overlay.hasData ? '✓' : '○';
            const color = overlay.hasData ? (OVERLAY_COLORS[overlay.id] || '#2ea043') : '#8b949e';
            const count = overlay.hasData && overlay.itemCount ? overlay.itemCount.toString() : '';
            const separator = index < overlays.length - 1 ? ' | ' : '';

            return (
              <Text key={overlay.id} color={color}>
                {icon} {status}{count}{separator}
              </Text>
            );
          })
        )}
      </Box>
      <Box>
        <Text bold color="cyan">COGNITION CLI v{VERSION} ⚡</Text>
      </Box>
    </Box>
  );
};
