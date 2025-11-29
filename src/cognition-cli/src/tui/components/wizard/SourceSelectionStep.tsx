import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  detectSources,
  type DetectionResult,
} from '../../../utils/source-detector.js';

/**
 * Props for SourceSelectionStep component
 */
export interface SourceSelectionStepProps {
  /** Current working directory (repo root) */
  cwd: string;
  /** Callback when selection is confirmed */
  onComplete: (selectedDirs: string[]) => void;
}

/**
 * SourceSelectionStep Component
 *
 * First step of the onboarding wizard. Auto-detects source directories
 * and allows user to confirm/modify selection.
 *
 * **Features**:
 * - Reuses detectSources() from CLI init command
 * - Checkbox-style selection UI
 * - Shows file counts and languages
 * - Auto-selects recommended directories
 *
 * **Keyboard Controls**:
 * - Space: Toggle selection
 * - Up/Down: Navigate list
 * - Enter: Confirm selection
 *
 * @component
 */
const SourceSelectionStepComponent: React.FC<SourceSelectionStepProps> = ({
  cwd,
  onComplete,
}) => {
  const [loading, setLoading] = useState(true);
  const [detected, setDetected] = useState<DetectionResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cursorIndex, setCursorIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Run detection on mount
  useEffect(() => {
    const runDetection = async () => {
      try {
        setLoading(true);
        const result = await detectSources(cwd);
        setDetected(result);

        // Pre-select recommended directories
        const autoSelected = new Set<string>();
        for (const dir of result.code) {
          if (dir.selected) {
            autoSelected.add(dir.path);
          }
        }
        setSelected(autoSelected);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Detection failed');
        setLoading(false);
      }
    };

    runDetection();
  }, [cwd]);

  // Flatten code directories for navigation
  const directories = useMemo(() => {
    if (!detected) return [];
    return detected.code;
  }, [detected]);

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
    if (selected.size === 0) {
      setError('Please select at least one directory');
      return;
    }
    onComplete(Array.from(selected));
  }, [selected, onComplete]);

  // Handle keyboard input
  useInput((input, key) => {
    if (loading) return;

    if (key.upArrow) {
      setCursorIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setCursorIndex((prev) => Math.min(directories.length - 1, prev + 1));
    } else if (input === ' ') {
      // Space to toggle
      const dir = directories[cursorIndex];
      if (dir) {
        toggleSelection(dir.path);
      }
    } else if (key.return) {
      confirmSelection();
    }
  });

  // Render loading state
  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Detecting source directories...</Text>
      </Box>
    );
  }

  // Render error state
  if (error && !detected) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error: {error}</Text>
      </Box>
    );
  }

  // Render no directories found
  if (directories.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow">No source directories detected.</Text>
        <Text dimColor>
          Supported: TypeScript (.ts, .tsx), JavaScript (.js, .jsx), Python
          (.py)
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Instructions */}
      <Box marginBottom={1}>
        <Text>Select source directories to index:</Text>
      </Box>

      {/* Directory list */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
      >
        {directories.map((dir, index) => {
          const isSelected = selected.has(dir.path);
          const isCursor = index === cursorIndex;

          return (
            <Box key={dir.path}>
              <Text color={isCursor ? 'green' : 'white'}>
                {isCursor ? '>' : ' '} [{isSelected ? 'x' : ' '}] {dir.path}
              </Text>
              <Text dimColor>
                {' '}
                ({dir.fileCount} {dir.language || ''} files)
              </Text>
              {dir.selected && !isSelected && (
                <Text color="yellow" dimColor>
                  {' '}
                  [recommended]
                </Text>
              )}
            </Box>
          );
        })}

        {/* Footer */}
        <Box borderTop borderColor="gray" marginTop={1} paddingTop={0}>
          <Text color="gray" dimColor>
            [Space] Toggle [Enter] Confirm ({selected.size} selected)
          </Text>
        </Box>
      </Box>

      {/* Error message */}
      {error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      {/* Project type indicator */}
      {detected && (
        <Box marginTop={1}>
          <Text dimColor>Project type: {detected.projectType}</Text>
        </Box>
      )}
    </Box>
  );
};

export const SourceSelectionStep = React.memo(SourceSelectionStepComponent);
