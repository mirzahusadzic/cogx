import React from 'react';
import { Box, Text } from 'ink';
import { OverlayInfo } from '../types.js';

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

export const OverlaysBar: React.FC<OverlaysBarProps> = ({ overlays = [] }) => {
  return (
    <Box paddingX={1} borderBottom borderColor="gray" flexDirection="row" justifyContent="space-between" width="100%">
      <Box flexDirection="row">
        {overlays.length === 0 ? (
          <Text dimColor>No overlays loaded</Text>
        ) : (
          overlays.map((overlay, index) => {
            const icon = OVERLAY_ICONS[overlay.id] || '📦';
            const status = overlay.hasData ? '✓' : '○';
            const color = overlay.hasData ? 'green' : 'gray';
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
        <Text bold color="cyan">⚡ COGNITION CLI v1.8.2</Text>
      </Box>
    </Box>
  );
};
