import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  detectSources,
  type DetectedDirectory,
} from '../../../utils/source-detector.js';

/**
 * Props for DocDiscoveryStep component
 */
export interface DocDiscoveryStepProps {
  /** Current working directory (repo root) */
  cwd: string;
  /** Callback when selection is confirmed */
  onComplete: (selectedDocs: string[]) => void;
}

/**
 * DocDiscoveryStep Component
 *
 * Third step of the onboarding wizard. Discovers existing documentation
 * files and allows user to select which to include.
 *
 * **Features**:
 * - Reuses detectSources() documentation detection from CLI
 * - Checkbox-style selection UI
 * - Auto-selects README.md, VISION.md, docs/
 * - Option to skip if no docs exist
 *
 * **Keyboard Controls**:
 * - Space: Toggle selection
 * - Up/Down: Navigate list
 * - Enter: Confirm selection
 * - S: Skip (continue without docs)
 *
 * @component
 */
const DocDiscoveryStepComponent: React.FC<DocDiscoveryStepProps> = ({
  cwd,
  onComplete,
}) => {
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<DetectedDirectory[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cursorIndex, setCursorIndex] = useState(0);

  // Run detection on mount
  useEffect(() => {
    const runDetection = async () => {
      try {
        setLoading(true);
        const result = await detectSources(cwd);
        setDocs(result.docs);

        // Pre-select recommended docs
        const autoSelected = new Set<string>();
        for (const doc of result.docs) {
          if (doc.selected) {
            autoSelected.add(doc.path);
          }
        }
        setSelected(autoSelected);
        setLoading(false);
      } catch {
        setLoading(false);
      }
    };

    runDetection();
  }, [cwd]);

  // Toggle selection
  const toggleSelection = useCallback((path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Confirm selection
  const confirmSelection = useCallback(() => {
    onComplete(Array.from(selected));
  }, [selected, onComplete]);

  // Skip docs
  const skipDocs = useCallback(() => {
    onComplete([]);
  }, [onComplete]);

  // Handle keyboard input
  useInput((input, key) => {
    if (loading) return;

    if (key.upArrow && docs.length > 0) {
      setCursorIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow && docs.length > 0) {
      setCursorIndex((prev) => Math.min(docs.length - 1, prev + 1));
    } else if (input === ' ' && docs.length > 0) {
      const doc = docs[cursorIndex];
      if (doc) {
        toggleSelection(doc.path);
      }
    } else if (key.return) {
      confirmSelection();
    } else if (input === 's' || input === 'S') {
      skipDocs();
    }
  });

  // Render loading state
  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Scanning for documentation...</Text>
      </Box>
    );
  }

  // Render no docs found
  if (docs.length === 0) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="yellow">No documentation files detected.</Text>
        </Box>
        <Text dimColor>
          Looked for: README.md, VISION.md, ARCHITECTURE.md, docs/
        </Text>
        <Box marginTop={1}>
          <Text dimColor>[Enter] Continue without docs [S] Skip</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Instructions */}
      <Box marginBottom={1}>
        <Text>Select documentation to include:</Text>
      </Box>

      {/* Doc list */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
      >
        {docs.map((doc, index) => {
          const isSelected = selected.has(doc.path);
          const isCursor = index === cursorIndex;

          return (
            <Box key={doc.path}>
              <Text color={isCursor ? 'green' : 'white'}>
                {isCursor ? '>' : ' '} [{isSelected ? 'x' : ' '}] {doc.path}
              </Text>
              {doc.fileCount > 1 && (
                <Text dimColor> ({doc.fileCount} files)</Text>
              )}
            </Box>
          );
        })}

        {/* Footer */}
        <Box borderTop borderColor="gray" marginTop={1} paddingTop={0}>
          <Text color="gray" dimColor>
            [Space] Toggle [Enter] Confirm [S] Skip ({selected.size} selected)
          </Text>
        </Box>
      </Box>

      {/* Info about docs */}
      <Box marginTop={1}>
        <Text dimColor>
          Documentation enables Mission (O4) and Coherence (O7) overlays.
        </Text>
      </Box>
    </Box>
  );
};

export const DocDiscoveryStep = React.memo(DocDiscoveryStepComponent);
