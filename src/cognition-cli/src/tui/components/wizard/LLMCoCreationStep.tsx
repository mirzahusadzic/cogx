import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';

/**
 * Overlay definition with metadata
 */
interface OverlayOption {
  id: string;
  name: string;
  description: string;
  requiresDocs: boolean;
  selected: boolean;
}

/**
 * Code-only overlays (no docs required)
 */
const CODE_ONLY_OVERLAYS: OverlayOption[] = [
  {
    id: 'O1',
    name: 'Structural Patterns',
    description: 'Code architecture and roles',
    requiresDocs: false,
    selected: true,
  },
  {
    id: 'O3',
    name: 'Lineage Patterns',
    description: 'Dependency chains and type lineage',
    requiresDocs: false,
    selected: true,
  },
];

/**
 * Doc-dependent overlays (shown as info about what's needed)
 */
const DOC_DEPENDENT_OVERLAYS = [
  { id: 'O2', name: 'Security Guidelines', doc: 'SECURITY.md' },
  { id: 'O4', name: 'Mission Concepts', doc: 'VISION.md' },
  { id: 'O5', name: 'Operational Patterns', doc: 'OPERATIONAL.md' },
  { id: 'O6', name: 'Mathematical Proofs', doc: 'MATHEMATICAL.md' },
  { id: 'O7', name: 'Strategic Coherence', doc: 'VISION.md (O4)' },
];

/**
 * Props for LLMCoCreationStep component
 */
export interface LLMCoCreationStepProps {
  /** Current working directory (repo root) */
  cwd: string;
  /** Workbench URL for future LLM calls */
  workbenchUrl: string;
  /** LLM provider name */
  provider: string;
  /** Callback when overlay selection is confirmed */
  onComplete: (selectedOverlays: string[]) => void;
  /** Callback to skip overlay generation */
  onSkip: () => void;
}

/**
 * LLMCoCreationStep Component
 *
 * Fourth step of the onboarding wizard. Shows codebase summary and
 * allows user to select which overlays to generate.
 *
 * **MVP Implementation**:
 * - Shows codebase statistics from genesis index
 * - Presents overlay options for selection
 * - Disables doc-dependent overlays if no docs selected
 *
 * **Future Enhancement**:
 * - LLM-assisted overlay suggestions based on codebase
 * - Interactive documentation co-creation
 *
 * **Keyboard Controls**:
 * - Space: Toggle overlay selection
 * - Up/Down: Navigate list
 * - Enter: Confirm and generate
 * - S: Skip overlay generation
 *
 * @component
 */
const LLMCoCreationStepComponent: React.FC<LLMCoCreationStepProps> = ({
  cwd,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  workbenchUrl, // Reserved for future LLM co-creation
  provider,
  onComplete,
  onSkip,
}) => {
  const [loading, setLoading] = useState(true);
  const [overlays, setOverlays] = useState<OverlayOption[]>([]);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [codebaseStats, setCodebaseStats] = useState<{
    fileCount: number;
    symbolCount: number;
    directories: string[];
  } | null>(null);

  // Load codebase statistics on mount
  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);

        // Try to get stats from genesis index
        const indexDir = path.join(cwd, '.open_cognition', 'index');
        let fileCount = 0;
        let symbolCount = 0;
        const directories = new Set<string>();

        if (await fs.pathExists(indexDir)) {
          const indexFiles = await glob('*.json', { cwd: indexDir });
          fileCount = indexFiles.length;

          // Count symbols by reading a sample of index files
          const sample = indexFiles.slice(0, 10);
          for (const file of sample) {
            try {
              const content = await fs.readJSON(path.join(indexDir, file));
              if (content.symbols) {
                symbolCount += content.symbols.length;
              }
              // Extract directory from filename (files are named like src_foo_bar.json)
              const dir = file.split('_')[0];
              if (dir) directories.add(dir);
            } catch {
              // Ignore parse errors
            }
          }

          // Extrapolate symbol count
          if (sample.length > 0) {
            symbolCount = Math.round((symbolCount / sample.length) * fileCount);
          }
        }

        setCodebaseStats({
          fileCount,
          symbolCount,
          directories: Array.from(directories),
        });

        // Initialize with code-only overlays (no doc-dependent ones)
        setOverlays([...CODE_ONLY_OVERLAYS]);

        setLoading(false);
      } catch {
        setLoading(false);
        setOverlays([...CODE_ONLY_OVERLAYS]);
      }
    };

    loadStats();
  }, [cwd]);

  // Toggle overlay selection
  const toggleOverlay = useCallback((index: number) => {
    setOverlays((prev) => {
      const next = [...prev];
      const overlay = next[index];
      next[index] = { ...overlay, selected: !overlay.selected };
      return next;
    });
  }, []);

  // Confirm selection
  const confirmSelection = useCallback(() => {
    const selected = overlays.filter((o) => o.selected).map((o) => o.id);
    onComplete(selected);
  }, [overlays, onComplete]);

  // Handle keyboard input - isActive: true ensures input is captured
  useInput(
    (input, key) => {
      if (loading) return;

      if (key.upArrow || input === 'k') {
        setCursorIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow || input === 'j') {
        setCursorIndex((prev) => Math.min(overlays.length - 1, prev + 1));
      } else if (input === ' ' || input === 'x') {
        toggleOverlay(cursorIndex);
      } else if (key.return || input === 'g') {
        confirmSelection();
      } else if (input === 's' || input === 'S') {
        onSkip();
      }
    },
    { isActive: !loading }
  );

  // Render loading state
  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Analyzing codebase structure...</Text>
      </Box>
    );
  }

  const selectedCount = overlays.filter((o) => o.selected).length;

  return (
    <Box flexDirection="column">
      {/* Codebase summary */}
      {codebaseStats && codebaseStats.fileCount > 0 && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="blue"
          paddingX={1}
          marginBottom={1}
        >
          <Text bold>Codebase Indexed</Text>
          <Text>
            <Text dimColor>Files: </Text>
            <Text color="cyan">{codebaseStats.fileCount}</Text>
            <Text dimColor> | Symbols: </Text>
            <Text color="cyan">~{codebaseStats.symbolCount}</Text>
          </Text>
          {codebaseStats.directories.length > 0 && (
            <Text>
              <Text dimColor>Modules: </Text>
              <Text color="cyan">
                {codebaseStats.directories.slice(0, 5).join(', ')}
              </Text>
            </Text>
          )}
        </Box>
      )}

      {/* Instructions */}
      <Box marginBottom={1} flexDirection="column">
        <Text bold>Code-Only Overlays</Text>
        <Text dimColor>These analyze code structure directly:</Text>
      </Box>

      {/* Code-only overlay list */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
      >
        {overlays.map((overlay, index) => {
          const isCursor = index === cursorIndex;

          return (
            <Box key={overlay.id}>
              <Text color={isCursor ? 'green' : 'white'}>
                {isCursor ? '>' : ' '} [{overlay.selected ? 'x' : ' '}]{' '}
                {overlay.id}: {overlay.name}
              </Text>
              <Text dimColor> - {overlay.description}</Text>
            </Box>
          );
        })}
      </Box>

      {/* Keyboard hints - prominent and clear */}
      <Box marginTop={1} flexDirection="column">
        <Text bold color="cyan">
          ↑/↓ Navigate | Space/X Toggle | Enter/G Generate | S Skip
        </Text>
        <Text color="green">
          {selectedCount} overlay{selectedCount !== 1 ? 's' : ''} selected →
          Press Enter to generate
        </Text>
      </Box>

      {/* Doc-dependent overlays notice */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="yellow"
        paddingX={1}
        marginTop={1}
      >
        <Text bold color="yellow">
          After Wizard: Create Strategic Docs
        </Text>
        <Text dimColor>
          Run /onboard-project in TUI to generate docs, then:
        </Text>
        {DOC_DEPENDENT_OVERLAYS.map((o) => (
          <Text key={o.id} dimColor>
            {'  '}○ {o.id}: {o.name} ← {o.doc}
          </Text>
        ))}
      </Box>

      {/* Provider info */}
      <Box marginTop={1}>
        <Text dimColor>Provider: {provider}</Text>
      </Box>
    </Box>
  );
};

export const LLMCoCreationStep = React.memo(LLMCoCreationStepComponent);
