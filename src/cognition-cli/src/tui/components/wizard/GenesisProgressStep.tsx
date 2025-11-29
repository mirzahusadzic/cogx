import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { spawn, type ChildProcess } from 'child_process';
import { initWorkspaceProgrammatic } from '../../../commands/init.js';

/**
 * Props for GenesisProgressStep component
 */
export interface GenesisProgressStepProps {
  /** Current working directory (repo root) */
  cwd: string;
  /** Selected source directories to index */
  sourceDirs: string[];
  /** Workbench URL for genesis */
  workbenchUrl: string;
  /** Callback when genesis completes successfully */
  onComplete: () => void;
  /** Callback when genesis fails */
  onError: (error: string) => void;
}

/**
 * GenesisProgressStep Component
 *
 * Second step of the onboarding wizard. Runs genesis command and shows
 * real-time progress via log capture.
 *
 * **Implementation**: Uses subprocess + log capture approach (MVP).
 * Future: Add progress callbacks to genesis orchestrator.
 *
 * **Features**:
 * - Spawns cognition-cli genesis as subprocess
 * - Captures and displays stdout/stderr
 * - Shows last N lines in scrolling log view
 * - Handles success/failure states
 *
 * @component
 */
const GenesisProgressStepComponent: React.FC<GenesisProgressStepProps> = ({
  cwd,
  sourceDirs,
  workbenchUrl,
  onComplete,
  onError,
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'running' | 'success' | 'error'>(
    'running'
  );
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const processRef = useRef<ChildProcess | null>(null);

  useEffect(() => {
    let isMounted = true;

    const runGenesisWithInit = async () => {
      // Step 1: Run programmatic init to create .open_cognition
      setLogs(['Initializing workspace...']);

      const initResult = await initWorkspaceProgrammatic(cwd, sourceDirs);

      if (!isMounted) return;

      if (!initResult.success) {
        setStatus('error');
        setLogs((prev) => [
          ...prev,
          `✗ Init failed: ${initResult.error || 'Unknown error'}`,
        ]);
        onError(
          `Failed to initialize workspace: ${initResult.error || 'Unknown error'}\n\nCWD: ${cwd}\nSource dirs: ${sourceDirs.join(', ')}`
        );
        return;
      }

      setLogs((prev) => [
        ...prev,
        '✓ Workspace initialized',
        'Starting genesis...',
      ]);

      // Step 2: Run genesis
      // Use process.argv[0] (node) + process.argv[1] (cli entrypoint) to spawn self
      const cliPath = process.argv[1] || 'cognition-cli';
      const args = ['genesis', ...sourceDirs, '--workbench', workbenchUrl];

      const proc = spawn(process.argv[0], [cliPath, ...args], {
        cwd,
        env: {
          ...process.env,
          // Re-export workbench env vars for subprocess
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

        for (const line of lines) {
          // Try to parse progress from output
          const progressMatch = line.match(/\((\d+)\/(\d+)\)/);
          if (progressMatch) {
            setProgress({
              current: parseInt(progressMatch[1], 10),
              total: parseInt(progressMatch[2], 10),
            });
          }

          setLogs((prev) => [...prev.slice(-25), line]);
        }
      };

      proc.stdout?.on('data', appendLog);
      proc.stderr?.on('data', appendLog);

      proc.on('exit', (code) => {
        if (!isMounted) return;
        if (code === 0) {
          setStatus('success');
          // Small delay to show success before transitioning
          setTimeout(onComplete, 500);
        } else {
          setStatus('error');
          // Include last few log lines in error for debugging
          setLogs((currentLogs) => {
            const errorContext = currentLogs.slice(-10).join('\n');
            onError(
              `Genesis failed (exit code ${code}):\n\nCommand: cognition-cli genesis ${sourceDirs.join(' ')} --workbench ${workbenchUrl}\nCWD: ${cwd}\n\nOutput:\n${errorContext || 'No output captured'}`
            );
            return currentLogs;
          });
        }
      });

      proc.on('error', (err) => {
        if (!isMounted) return;
        setStatus('error');
        onError(`Failed to start genesis: ${err.message}`);
      });
    };

    // Start the init + genesis flow
    runGenesisWithInit();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (processRef.current && !processRef.current.killed) {
        processRef.current.kill();
      }
    };
  }, [cwd, sourceDirs, workbenchUrl, onComplete, onError]);

  // Calculate progress percentage
  const progressPercent = progress
    ? Math.round((progress.current / progress.total) * 100)
    : null;

  // Render progress bar
  const renderProgressBar = () => {
    if (!progressPercent) return null;

    const width = 50; // Wider progress bar
    const filled = Math.round((progressPercent / 100) * width);
    const empty = width - filled;

    return (
      <Box marginY={1}>
        <Text>
          {'['}
          <Text color="green">{'█'.repeat(filled)}</Text>
          <Text dimColor>{'░'.repeat(empty)}</Text>
          {'] '}
          {progressPercent}%
        </Text>
        {progress && (
          <Text dimColor>
            {' '}
            ({progress.current}/{progress.total} files)
          </Text>
        )}
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      {/* Status header */}
      <Box marginBottom={1}>
        {status === 'running' && (
          <Text>
            <Text color="cyan">{'◐ '}</Text>
            Building code index...
          </Text>
        )}
        {status === 'success' && <Text color="green">Genesis complete!</Text>}
        {status === 'error' && <Text color="red">Genesis failed</Text>}
      </Box>

      {/* Progress bar */}
      {renderProgressBar()}

      {/* Log output - full terminal width, no vertical borders for emoji compat */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderTop
        borderBottom
        borderLeft={false}
        borderRight={false}
        borderColor={status === 'error' ? 'red' : 'cyan'}
        paddingX={1}
        height={20}
        width={process.stdout.columns || 120}
      >
        {logs.length === 0 ? (
          <Text dimColor>Initializing genesis...</Text>
        ) : (
          logs.map((line, i) => (
            <Text key={i} wrap="truncate">
              {line}
            </Text>
          ))
        )}
      </Box>

      {/* Source directories being indexed */}
      <Box marginTop={1}>
        <Text dimColor>Indexing: {sourceDirs.join(', ')}</Text>
      </Box>

      {/* Note about cancelation */}
      {status === 'running' && (
        <Box marginTop={1}>
          <Text dimColor color="yellow">
            To restart wizard: rm -rf .open_cognition && cognition tui
          </Text>
        </Box>
      )}
    </Box>
  );
};

export const GenesisProgressStep = React.memo(GenesisProgressStepComponent);
