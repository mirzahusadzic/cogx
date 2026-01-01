/**
 * Debug Logger Utility
 *
 * Provides file-based debug logging for troubleshooting CLI issues.
 * When --debug flag is enabled, writes detailed logs to:
 *   .open_cognition/debug-{timestamp}.log
 *
 * Unlike --verbose (which shows more info inline), --debug:
 * - Writes to a file (won't clutter terminal output)
 * - Includes timestamps and stack traces
 * - Captures internal state for bug reports
 *
 * @example
 * // In any command
 * import { debugLog, getDebugLogPath } from '../utils/debug-logger.js';
 *
 * debugLog('Processing file', { file: 'src/index.ts', size: 1024 });
 * // ... later ...
 * console.log(`Debug log: ${getDebugLogPath()}`);
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';

/**
 * Global log emitter for real-time observation.
 * Used by the TUI to display logs without flicker.
 */
export const logEmitter = new EventEmitter();

export interface LogEvent {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
  data?: Record<string, unknown>;
}

let debugLogPath: string | null = null;
let debugEnabled = false;

/**
 * Initialize debug logging
 *
 * Creates a new debug log file. Should be called once at CLI startup
 * when --debug flag is present.
 *
 * @param projectRoot - Project root directory (for .open_cognition location)
 */
export function initDebugLog(projectRoot: string = process.cwd()): void {
  debugEnabled = true;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const cogDir = path.join(projectRoot, '.open_cognition');

  // Use .open_cognition if it exists, otherwise use temp directory
  if (fs.existsSync(cogDir)) {
    debugLogPath = path.join(cogDir, `debug-${timestamp}.log`);
  } else {
    debugLogPath = path.join(os.tmpdir(), `cognition-debug-${timestamp}.log`);
  }

  // Write header
  const header = [
    '='.repeat(60),
    `Cognition CLI Debug Log`,
    `Started: ${new Date().toISOString()}`,
    `Platform: ${process.platform} ${os.release()}`,
    `Node: ${process.version}`,
    `CWD: ${process.cwd()}`,
    `Args: ${process.argv.slice(2).join(' ')}`,
    '='.repeat(60),
    '',
  ].join('\n');

  fs.writeFileSync(debugLogPath, header);

  // Log environment variables (redact sensitive ones)
  debugLog('Environment', {
    COGNITION_NO_COLOR: process.env.COGNITION_NO_COLOR,
    COGNITION_NO_EMOJI: process.env.COGNITION_NO_EMOJI,
    COGNITION_FORMAT: process.env.COGNITION_FORMAT,
    COGNITION_VERBOSE: process.env.COGNITION_VERBOSE,
    COGNITION_QUIET: process.env.COGNITION_QUIET,
    COGNITION_NO_INPUT: process.env.COGNITION_NO_INPUT,
    WORKBENCH_URL: process.env.WORKBENCH_URL,
    NO_COLOR: process.env.NO_COLOR,
    CI: process.env.CI,
    TERM: process.env.TERM,
    // Redact API keys
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? '[SET]' : '[NOT SET]',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? '[SET]' : '[NOT SET]',
  });
}

/**
 * Check if debug logging is enabled
 */
export function isDebugEnabled(): boolean {
  return debugEnabled;
}

/**
 * Get the current debug log file path
 *
 * @returns Path to debug log file, or null if debug not enabled
 */
export function getDebugLogPath(): string | null {
  return debugLogPath;
}

/**
 * Write a debug log entry
 *
 * Only writes if debug mode is enabled (--debug flag).
 * Safe to call even when debug is disabled (becomes a no-op).
 *
 * @param message - Log message
 * @param data - Optional structured data to include
 *
 * @example
 * debugLog('Starting genesis', { source: 'src/', fileCount: 47 });
 * debugLog('Error in parser', { file: 'foo.ts', error: err.message });
 */
export function debugLog(
  message: string,
  data?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();

  // NEW: Emit event for observers (TUI)
  logEmitter.emit('log', {
    timestamp,
    level: 'debug',
    message,
    data,
  });

  if (!debugEnabled || !debugLogPath) return;

  let line = `[${timestamp}] ${message}`;

  if (data) {
    try {
      line += '\n  ' + JSON.stringify(data, null, 2).replace(/\n/g, '\n  ');
    } catch {
      line += '\n  [Unable to serialize data]';
    }
  }

  line += '\n';

  try {
    fs.appendFileSync(debugLogPath, line);
  } catch {
    // Silently fail if we can't write to the log
  }
}

/**
 * Log an error with stack trace
 *
 * @param message - Error context message
 * @param error - The error object
 */
export function debugError(message: string, error: unknown): void {
  const timestamp = new Date().toISOString();

  // NEW: Emit event for observers (TUI)
  logEmitter.emit('log', {
    timestamp,
    level: 'error',
    message,
    data: { error: error instanceof Error ? error.message : String(error) },
  });

  if (!debugEnabled || !debugLogPath) return;

  let line = `[${timestamp}] ERROR: ${message}\n`;

  if (error instanceof Error) {
    line += `  Name: ${error.name}\n`;
    line += `  Message: ${error.message}\n`;
    if (error.stack) {
      line += `  Stack:\n    ${error.stack.replace(/\n/g, '\n    ')}\n`;
    }
  } else {
    line += `  ${String(error)}\n`;
  }

  try {
    fs.appendFileSync(debugLogPath, line);
  } catch {
    // Silently fail
  }
}

/**
 * Log a system event from a specific source.
 * Always emits to the logEmitter (for TUI visibility),
 * and writes to the debug log file if debug mode is enabled.
 *
 * @param source - Subsystem name (e.g., 'sigma', 'ipc', 'tui')
 * @param message - Log message
 * @param data - Optional structured data
 */
export function systemLog(
  source: string,
  message: string,
  data?: Record<string, unknown>,
  level: 'info' | 'warn' | 'error' | 'debug' = 'info'
): void {
  const timestamp = new Date().toISOString();

  // Redirect to console for tests/CLI if not in TUI mode
  // This ensures tests that spy on console still work
  if (process.env.NODE_ENV === 'test') {
    const args: unknown[] = [message];

    if (data !== undefined) {
      args.push(data);
    }

    if (level === 'error') {
      console.error(...args);
    } else if (level === 'warn') {
      console.warn(...args);
    } else {
      console.log(...args);
    }
  }

  // Always emit for real-time observation
  logEmitter.emit('log', {
    timestamp,
    level,
    source,
    message,
    data,
  });

  // Only write to file if debug enabled
  if (debugEnabled && debugLogPath) {
    const levelPrefix = level !== 'info' ? `${level.toUpperCase()}: ` : '';

    // Log directly to file instead of calling debugLog to avoid duplicate emission
    const timestampLog = new Date().toISOString();
    let line = `[${timestampLog}] [${source}] ${levelPrefix}${message}`;

    if (data) {
      try {
        line += '\n  ' + JSON.stringify(data, null, 2).replace(/\n/g, '\n  ');
      } catch {
        line += '\n  [Unable to serialize data]';
      }
    }
    line += '\n';

    try {
      fs.appendFileSync(debugLogPath, line);
    } catch {
      // Silently fail
    }
  }
}

/**
 * Log timing information for performance analysis
 *
 * @param label - Operation label
 * @param startTime - hrtime.bigint() from when operation started
 */
export function debugTiming(label: string, startTime: bigint): void {
  if (!debugEnabled) return;

  const endTime = process.hrtime.bigint();
  const durationMs = Number(endTime - startTime) / 1_000_000;

  debugLog(`TIMING: ${label}`, { durationMs: durationMs.toFixed(2) });
}

/**
 * Create a debug timing helper
 *
 * @param label - Operation label
 * @returns Function to call when operation completes
 *
 * @example
 * const done = debugTimer('Parse file');
 * // ... do work ...
 * done(); // Logs: "TIMING: Parse file { durationMs: '12.34' }"
 */
export function debugTimer(label: string): () => void {
  if (!debugEnabled) return () => {};

  const start = process.hrtime.bigint();
  return () => debugTiming(label, start);
}

/**
 * Finalize debug log with summary
 *
 * Call at CLI exit to write footer with total time and result.
 *
 * @param success - Whether the command completed successfully
 * @param exitCode - Exit code (if known)
 */
export function finalizeDebugLog(success: boolean, exitCode?: number): void {
  if (!debugEnabled || !debugLogPath) return;

  const footer = [
    '',
    '='.repeat(60),
    `Completed: ${new Date().toISOString()}`,
    `Success: ${success}`,
    exitCode !== undefined ? `Exit Code: ${exitCode}` : '',
    `Log File: ${debugLogPath}`,
    '='.repeat(60),
  ]
    .filter(Boolean)
    .join('\n');

  try {
    fs.appendFileSync(debugLogPath, footer);
  } catch {
    // Silently fail
  }
}
