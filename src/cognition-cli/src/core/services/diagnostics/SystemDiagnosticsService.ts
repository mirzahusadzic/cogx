import fs from 'fs';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';
import { AnyProgressEvent } from '../../../utils/progress-protocol.js';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEvent {
  timestamp: string;
  level: LogLevel;
  message: string;
  source?: string;
  data?: Record<string, unknown>;
}

export interface NoiseState {
  originalConsoleLog: typeof console.log;
  originalConsoleError: typeof console.error;
  originalConsoleWarn: typeof console.warn;
  originalConsoleInfo: typeof console.info;
  originalStderrWrite: typeof process.stderr.write;
  originalStdoutWrite: typeof process.stdout.write;
  originalEmitWarning: typeof process.emitWarning;
}

/**
 * Patterns of SDK noise to suppress from stdout.
 */
const STDOUT_NOISE_PATTERNS = [
  'Pub/Sub',
  'google-cloud',
  'google-auth',
  'transport',
  'gRPC',
  'ALTS',
  'metadata',
  'credential',
  'Default Credentials',
  '[GoogleAuth]',
  'The user provided Google Cloud credentials',
  'Requesting active client',
  'Sending request',
  'precedence',
  'Vertex AI SDK',
  'openai-agents',
  'anthropic-sdk',
];

/**
 * SystemDiagnosticsService provides unified error formatting, logging,
 * noise suppression, and progress reporting.
 */
export class SystemDiagnosticsService {
  private static instance: SystemDiagnosticsService;
  private logEmitter = new EventEmitter();
  private debugLogPath: string | null = null;
  private debugEnabled = false;
  private noiseState: NoiseState | null = null;
  private debugLevel: 'none' | 'info' | 'debug' | 'verbose' = 'none';

  private constructor() {
    // Initialize debug level from environment
    if (process.env.COGNITION_VERBOSE === '1') {
      this.debugLevel = 'verbose';
    } else if (process.env.NODE_DEBUG?.includes('cognition')) {
      this.debugLevel = 'debug';
    }
  }

  public static getInstance(): SystemDiagnosticsService {
    if (!SystemDiagnosticsService.instance) {
      SystemDiagnosticsService.instance = new SystemDiagnosticsService();
    }
    return SystemDiagnosticsService.instance;
  }

  /**
   * Initialize debug logging to a file.
   */
  public initDebugLog(projectRoot: string = process.cwd()): void {
    this.debugEnabled = true;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const cogDir = path.join(projectRoot, '.open_cognition');

    // Use .open_cognition if it exists, otherwise use temp directory
    if (fs.existsSync(cogDir)) {
      this.debugLogPath = path.join(cogDir, `debug-${timestamp}.log`);
    } else {
      this.debugLogPath = path.join(
        os.tmpdir(),
        `cognition-debug-${timestamp}.log`
      );
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

    try {
      fs.writeFileSync(this.debugLogPath, header);
    } catch {
      // Silently fail if we can't write to the log
    }

    this.debugLog('Environment', {
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
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? '[SET]' : '[NOT SET]',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? '[SET]' : '[NOT SET]',
    });
  }

  public isDebugEnabled(): boolean {
    return this.debugEnabled;
  }

  public getDebugLogPath(): string | null {
    return this.debugLogPath;
  }

  public getLogEmitter(): EventEmitter {
    return this.logEmitter;
  }

  /**
   * Write a debug log entry.
   */
  public debugLog(message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();

    this.logEmitter.emit('log', {
      timestamp,
      level: 'debug',
      message,
      data,
    });

    if (!this.debugEnabled || !this.debugLogPath) return;

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
      fs.appendFileSync(this.debugLogPath, line);
    } catch {
      // Silently fail
    }
  }

  /**
   * Log an error with stack trace to the debug log.
   */
  public debugError(message: string, error: unknown): void {
    const timestamp = new Date().toISOString();

    this.logEmitter.emit('log', {
      timestamp,
      level: 'error',
      message,
      data: { error: error instanceof Error ? error.message : String(error) },
    });

    if (!this.debugEnabled || !this.debugLogPath) return;

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
      fs.appendFileSync(this.debugLogPath, line);
    } catch {
      // Silently fail
    }
  }

  /**
   * Log a system event from a specific source.
   */
  public systemLog(
    source: string,
    message: string,
    data?: Record<string, unknown>,
    level: LogLevel = 'info'
  ): void {
    const timestamp = new Date().toISOString();

    if (process.env.NODE_ENV === 'test') {
      const args: unknown[] = [message];
      if (data !== undefined) args.push(data);
      if (level === 'error') console.error(...args);
      else if (level === 'warn') console.warn(...args);
      else console.log(...args);
    }

    this.logEmitter.emit('log', {
      timestamp,
      level,
      source,
      message,
      data,
    });

    if (this.debugEnabled && this.debugLogPath) {
      const levelPrefix = level !== 'info' ? `${level.toUpperCase()}: ` : '';
      let line = `[${timestamp}] [${source}] ${levelPrefix}${message}`;
      if (data) {
        try {
          line += '\n  ' + JSON.stringify(data, null, 2).replace(/\n/g, '\n  ');
        } catch {
          line += '\n  [Unable to serialize data]';
        }
      }
      line += '\n';

      try {
        fs.appendFileSync(this.debugLogPath, line);
      } catch {
        // Silently fail
      }
    }
  }

  /**
   * Create a debug timing helper.
   */
  public debugTimer(label: string): () => void {
    if (!this.debugEnabled) return () => {};

    const start = process.hrtime.bigint();
    return () => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      this.debugLog(`TIMING: ${label}`, { durationMs: durationMs.toFixed(2) });
    };
  }

  /**
   * Finalize debug log with summary.
   */
  public finalizeDebugLog(success: boolean, exitCode?: number): void {
    if (!this.debugEnabled || !this.debugLogPath) return;

    const footer = [
      '',
      '='.repeat(60),
      `Completed: ${new Date().toISOString()}`,
      `Success: ${success}`,
      exitCode !== undefined ? `Exit Code: ${exitCode}` : '',
      `Log File: ${this.debugLogPath}`,
      '='.repeat(60),
    ]
      .filter(Boolean)
      .join('\n');

    try {
      fs.appendFileSync(this.debugLogPath, footer);
    } catch {
      // Silently fail
    }
  }

  /**
   * Suppress console and process output that looks like SDK noise.
   */
  public suppressNoise(): void {
    if (this.noiseState) return;

    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    const originalConsoleInfo = console.info;
    const originalStderrWrite = process.stderr.write;
    const originalStdoutWrite = process.stdout.write;
    const originalEmitWarning = process.emitWarning;

    const isNoise = (str: string): boolean => {
      if (typeof str === 'string' && str.startsWith('\x1b')) return false;
      const s = typeof str === 'string' ? str : String(str);
      return STDOUT_NOISE_PATTERNS.some((p) => s.includes(p));
    };

    const suppress = (original: (...args: unknown[]) => void) => {
      return (...args: unknown[]) => {
        const firstArg = args[0];
        if (typeof firstArg === 'string' && isNoise(firstArg)) return;
        original(...args);
      };
    };

    console.log = suppress(originalConsoleLog) as typeof console.log;
    console.error = suppress(originalConsoleError) as typeof console.error;
    console.warn = suppress(originalConsoleWarn) as typeof console.warn;
    console.info = suppress(originalConsoleInfo) as typeof console.info;

    process.stdout.write = ((
      chunk: string | Uint8Array,
      encoding?: BufferEncoding,
      callback?: (error?: Error | null) => void
    ) => {
      if (typeof chunk === 'string' && isNoise(chunk)) {
        if (typeof callback === 'function') callback();
        return true;
      }
      return originalStdoutWrite.call(
        process.stdout,
        chunk,
        encoding as BufferEncoding,
        callback
      );
    }) as unknown as typeof process.stdout.write;

    process.stderr.write = ((
      chunk: string | Uint8Array,
      encoding?: BufferEncoding,
      callback?: (error?: Error | null) => void
    ) => {
      if (typeof chunk === 'string' && isNoise(chunk)) {
        if (typeof callback === 'function') callback();
        return true;
      }
      return originalStderrWrite.call(
        process.stderr,
        chunk,
        encoding as BufferEncoding,
        callback
      );
    }) as unknown as typeof process.stderr.write;

    process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
      if (typeof warning === 'string' && isNoise(warning)) return;
      return (
        originalEmitWarning as (
          warning: string | Error,
          ...args: unknown[]
        ) => void
      ).call(process, warning, ...args);
    }) as unknown as typeof process.emitWarning;

    this.noiseState = {
      originalConsoleLog,
      originalConsoleError,
      originalConsoleWarn,
      originalConsoleInfo,
      originalStderrWrite,
      originalStdoutWrite,
      originalEmitWarning,
    };
  }

  /**
   * Restore console and process output functions.
   */
  public restoreNoise(): void {
    if (!this.noiseState) return;

    console.log = this.noiseState.originalConsoleLog;
    console.error = this.noiseState.originalConsoleError;
    console.warn = this.noiseState.originalConsoleWarn;
    console.info = this.noiseState.originalConsoleInfo;
    process.stdout.write = this.noiseState.originalStdoutWrite;
    process.stderr.write = this.noiseState.originalStderrWrite;
    process.emitWarning = this.noiseState.originalEmitWarning;

    this.noiseState = null;
  }

  /**
   * Emit a progress event to stdout as JSON line.
   */
  public emitProgress(event: Omit<AnyProgressEvent, 'timestamp'>): void {
    const fullEvent: AnyProgressEvent = {
      ...event,
      timestamp: Date.now(),
    } as AnyProgressEvent;

    console.log(JSON.stringify(fullEvent));
  }

  /**
   * Set the current debug/verbosity level.
   */
  public setDebugLevel(level: 'none' | 'info' | 'debug' | 'verbose'): void {
    this.debugLevel = level;
    if (level === 'verbose') {
      process.env.COGNITION_VERBOSE = '1';
    } else {
      process.env.COGNITION_VERBOSE = '0';
    }
  }

  /**
   * Get the current debug/verbosity level.
   */
  public getDebugLevel(): 'none' | 'info' | 'debug' | 'verbose' {
    return this.debugLevel;
  }

  /**
   * Format an error for diagnostic display.
   */
  public formatDiagnosticError(error: unknown): string {
    if (error instanceof Error) {
      let msg = `[${error.name}] ${error.message}`;
      if (this.debugLevel === 'debug' || this.debugLevel === 'verbose') {
        if (error.stack) {
          msg += `\nStack Trace:\n${error.stack}`;
        }
      }
      return msg;
    }
    return String(error);
  }
}

export const systemDiagnosticsService = SystemDiagnosticsService.getInstance();
