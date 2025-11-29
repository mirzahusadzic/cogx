import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { spawn, type ChildProcess } from 'child_process';

/**
 * Overlay type to CLI command mapping
 */
const OVERLAY_COMMANDS: Record<string, string> = {
  O1: 'structural_patterns',
  O2: 'security_guidelines',
  O3: 'lineage_patterns',
  O4: 'mission_concepts',
  O5: 'operational_patterns',
  O6: 'mathematical_proofs',
  O7: 'strategic_coherence',
};

/**
 * Overlay status tracking
 */
interface OverlayStatus {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
}

/**
 * Props for OverlayGenerationStep component
 */
export interface OverlayGenerationStepProps {
  /** Current working directory (repo root) */
  cwd: string;
  /** Workbench URL for overlay generation */
  workbenchUrl: string;
  /** Selected overlay IDs to generate (O1, O2, etc.) */
  selectedOverlays: string[];
  /** Callback when all overlays complete successfully */
  onComplete: () => void;
  /** Callback when overlay generation fails */
  onError: (error: string) => void;
}

/**
 * OverlayGenerationStep Component
 *
 * Fifth and final step of the onboarding wizard. Generates selected
 * overlays sequentially and shows progress.
 *
 * **Implementation**: Uses subprocess + log capture approach (MVP).
 * Runs each overlay command one at a time for simplicity.
 *
 * **Features**:
 * - Sequential overlay generation
 * - Per-overlay status tracking (pending/running/success/error)
 * - Log capture for current overlay
 * - Error recovery options (retry/skip)
 *
 * @component
 */
const OverlayGenerationStepComponent: React.FC<OverlayGenerationStepProps> = ({
  cwd,
  workbenchUrl,
  selectedOverlays,
  onComplete,
  onError,
}) => {
  const [overlayStatuses, setOverlayStatuses] = useState<OverlayStatus[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [allComplete, setAllComplete] = useState(false);
  const processRef = useRef<ChildProcess | null>(null);

  // Initialize overlay statuses
  useEffect(() => {
    const statuses: OverlayStatus[] = selectedOverlays.map((id) => ({
      id,
      name: OVERLAY_COMMANDS[id] || id,
      status: 'pending',
    }));
    setOverlayStatuses(statuses);
  }, [selectedOverlays]);

  // Track if we're currently running to prevent double-starts
  const isRunningRef = useRef(false);

  // Run overlays sequentially - only triggered by currentIndex changes
  useEffect(() => {
    // Skip if no overlays initialized yet
    if (overlayStatuses.length === 0) return;

    // Check completion
    if (currentIndex >= selectedOverlays.length) {
      setAllComplete(true);
      setTimeout(onComplete, 500);
      return;
    }

    // Prevent double-start (React strict mode or re-renders)
    if (isRunningRef.current) return;
    if (processRef.current && !processRef.current.killed) return;

    const overlayId = selectedOverlays[currentIndex];
    const overlayType = OVERLAY_COMMANDS[overlayId];

    if (!overlayType) {
      setOverlayStatuses((prev) => {
        const next = [...prev];
        next[currentIndex] = {
          ...next[currentIndex],
          status: 'error',
          error: `Unknown overlay: ${overlayId}`,
        };
        return next;
      });
      setCurrentIndex((prev) => prev + 1);
      return;
    }

    // Mark as running
    isRunningRef.current = true;
    setOverlayStatuses((prev) => {
      const next = [...prev];
      next[currentIndex] = { ...next[currentIndex], status: 'running' };
      return next;
    });
    setLogs([]);

    // Spawn overlay command
    const nodeBin = process.argv[0];
    const cliPath = process.argv[1] || 'cognition-cli';
    const fullArgs = [cliPath, 'overlay', 'generate', overlayType];

    const proc = spawn(nodeBin, fullArgs, {
      cwd,
      env: {
        ...process.env,
        WORKBENCH_URL: workbenchUrl || process.env.WORKBENCH_URL || '',
        WORKBENCH_API_KEY: process.env.WORKBENCH_API_KEY || '',
        // Keep colors enabled for better visual feedback
        FORCE_COLOR: '1',
      },
    });

    processRef.current = proc;

    const appendLog = (data: Buffer) => {
      const text = data.toString();
      // Spinner character patterns used by clack and ora
      const spinnerChars = /[◐◑◒◓◴◵◶◷⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏●○◌⚬]/;
      // Clack spinner frame pattern: spinner char + spaces + dots
      const spinnerFramePattern = /^[◐◑◒◓◴◵◶◷⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏●○◌⚬]\s*\.*/;
      // Filter out spinner frames and control sequences
      const lines = text
        .split('\n')
        .filter((l) => l.trim())
        .filter((l) => {
          // Skip lines with carriage return (spinner overwrites)
          if (l.includes('\r')) return false;
          // Skip cursor show/hide sequences
          if (l.includes('\x1b[?25')) return false;
          // Skip erase line sequences
          if (l.includes('\x1b[2K') || l.includes('\x1b[K')) return false;
          // Strip ANSI codes for content analysis
          // eslint-disable-next-line no-control-regex
          const stripped = l.replace(/\x1b\[[0-9;]*m/g, '').trim();
          // Skip lines containing spinner characters (anywhere in line)
          if (spinnerChars.test(stripped)) return false;
          // Skip clack spinner frames (spinner + dots pattern)
          if (spinnerFramePattern.test(stripped)) return false;
          // Skip very short lines (likely control output)
          if (stripped.length < 3) return false;
          return true;
        });
      setLogs((prev) => [...prev.slice(-20), ...lines].slice(-20));
    };

    proc.stdout?.on('data', appendLog);
    proc.stderr?.on('data', appendLog);

    proc.on('exit', (code) => {
      isRunningRef.current = false;
      processRef.current = null;

      if (code === 0) {
        setOverlayStatuses((prev) => {
          const next = [...prev];
          next[currentIndex] = { ...next[currentIndex], status: 'success' };
          return next;
        });
      } else {
        setOverlayStatuses((prev) => {
          const next = [...prev];
          next[currentIndex] = {
            ...next[currentIndex],
            status: 'error',
            error: `Exit code ${code}`,
          };
          return next;
        });
      }
      setCurrentIndex((prev) => prev + 1);
    });

    proc.on('error', (err) => {
      isRunningRef.current = false;
      processRef.current = null;

      setOverlayStatuses((prev) => {
        const next = [...prev];
        next[currentIndex] = {
          ...next[currentIndex],
          status: 'error',
          error: err.message,
        };
        return next;
      });
      setCurrentIndex((prev) => prev + 1);
    });

    // NO cleanup that kills the process - let it complete!
    // Only kill on unmount (component destruction)
  }, [
    currentIndex,
    selectedOverlays,
    cwd,
    workbenchUrl,
    onComplete,
    overlayStatuses.length,
  ]);

  // Cleanup only on unmount
  useEffect(() => {
    return () => {
      if (processRef.current && !processRef.current.killed) {
        processRef.current.kill();
      }
    };
  }, []);

  // Check for failures after all complete
  useEffect(() => {
    if (allComplete) {
      const failures = overlayStatuses.filter((o) => o.status === 'error');
      if (failures.length > 0) {
        onError(`Failed overlays: ${failures.map((f) => f.id).join(', ')}`);
      }
    }
  }, [allComplete, overlayStatuses, onError]);

  // Render status icon - clear progress indicators, not checkboxes
  const statusIcon = (status: OverlayStatus['status']) => {
    switch (status) {
      case 'pending':
        return <Text dimColor>◯</Text>; // Empty circle = waiting
      case 'running':
        return <Text color="cyan">◐</Text>; // Half circle = in progress
      case 'success':
        return <Text color="green">✓</Text>; // Checkmark = done
      case 'error':
        return <Text color="red">✗</Text>; // X = failed
    }
  };

  // Count completed
  const completedCount = overlayStatuses.filter(
    (o) => o.status === 'success' || o.status === 'error'
  ).length;

  // Find currently running overlay
  const runningOverlay = overlayStatuses.find((o) => o.status === 'running');

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        {allComplete ? (
          <Text color="green">
            Completed {completedCount}/{overlayStatuses.length} overlays
          </Text>
        ) : runningOverlay ? (
          <Text>
            Processing {currentIndex + 1}/{overlayStatuses.length}:{' '}
            <Text color="cyan">{runningOverlay.name}</Text>
          </Text>
        ) : (
          <Text>Initializing overlay generation...</Text>
        )}
      </Box>

      {/* Overlay status list */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
      >
        {overlayStatuses.map((overlay) => (
          <Box key={overlay.id}>
            {statusIcon(overlay.status)}
            <Text
              color={
                overlay.status === 'running'
                  ? 'cyan'
                  : overlay.status === 'success'
                    ? 'green'
                    : overlay.status === 'error'
                      ? 'red'
                      : 'white'
              }
            >
              {' '}
              {overlay.id}: {overlay.name}
            </Text>
            {overlay.status === 'error' && overlay.error && (
              <Text color="red" dimColor>
                {' '}
                ({overlay.error})
              </Text>
            )}
          </Box>
        ))}
      </Box>

      {/* Current overlay logs - full terminal width, no vertical borders for emoji compat */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderTop
        borderBottom
        borderLeft={false}
        borderRight={false}
        borderColor={
          overlayStatuses.some((o) => o.status === 'running') ? 'cyan' : 'gray'
        }
        paddingX={1}
        marginTop={1}
        height={18}
        width={process.stdout.columns || 120}
      >
        {logs.length === 0 ? (
          <Text dimColor>Waiting for overlay output...</Text>
        ) : (
          logs.map((line, i) => (
            <Text key={i} wrap="truncate">
              {line}
            </Text>
          ))
        )}
      </Box>

      {/* Completion message */}
      {allComplete && (
        <Box marginTop={1}>
          {overlayStatuses.every((o) => o.status === 'success') ? (
            <Text color="green" bold>
              All overlays generated successfully!
            </Text>
          ) : (
            <Text color="yellow">
              Some overlays failed. You can regenerate them later.
            </Text>
          )}
        </Box>
      )}

      {/* Note */}
      {!allComplete && (
        <Box marginTop={1}>
          <Text dimColor>
            Overlays can be regenerated later with: cognition overlay generate
          </Text>
        </Box>
      )}
    </Box>
  );
};

export const OverlayGenerationStep = React.memo(OverlayGenerationStepComponent);
