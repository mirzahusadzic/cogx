/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Utility for suppressing SDK noise that can leak into stdout/stderr and mess up the TUI.
 * This is common with third-party SDKs (Google Cloud, OpenAI, Claude, etc.)
 */

/**
 * Patterns of SDK noise to suppress from stdout.
 */
export const STDOUT_NOISE_PATTERNS = [
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
 * Check if a string looks like SDK noise that should be suppressed.
 * Heuristic: TUI output usually starts with ANSI escape codes (\x1b).
 * SDK noise usually starts with plain text.
 */
export function isStdoutNoise(str: string): boolean {
  // If it starts with ANSI escape code, it's likely TUI/Ink - keep it!
  if (typeof str === 'string' && str.startsWith('\x1b')) {
    return false;
  }

  // Check for known noise patterns
  const s = typeof str === 'string' ? str : String(str);
  return STDOUT_NOISE_PATTERNS.some((p) => s.includes(p));
}

/**
 * Type for original console/process functions to restore later
 */
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
 * Suppress console and process output that looks like SDK noise.
 * Returns the state needed to restore the original functions.
 */
export function suppressNoise(): NoiseState {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const originalConsoleInfo = console.info;
  const originalStderrWrite = process.stderr.write;
  const originalStdoutWrite = process.stdout.write;
  const originalEmitWarning = process.emitWarning;

  const suppress = (original: (...args: unknown[]) => void) => {
    return (...args: unknown[]) => {
      const firstArg = args[0];
      if (typeof firstArg === 'string' && isStdoutNoise(firstArg)) {
        return;
      }
      original(...args);
    };
  };

  console.log = suppress(originalConsoleLog) as typeof console.log;
  console.error = suppress(originalConsoleError) as typeof console.error;
  console.warn = suppress(originalConsoleWarn) as typeof console.warn;
  console.info = suppress(originalConsoleInfo) as typeof console.info;

  // process.stdout/stderr.write needs slightly different handling
  // because it's not a simple function but a stream write method
  process.stdout.write = ((
    chunk: string | Uint8Array,
    encoding?: BufferEncoding,
    callback?: (error?: Error | null) => void
  ) => {
    if (typeof chunk === 'string' && isStdoutNoise(chunk)) {
      if (typeof callback === 'function') callback();
      return true;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return originalStdoutWrite.call(
      process.stdout,
      chunk,
      encoding as any,
      callback
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  process.stderr.write = ((
    chunk: string | Uint8Array,
    encoding?: BufferEncoding,
    callback?: (error?: Error | null) => void
  ) => {
    if (typeof chunk === 'string' && isStdoutNoise(chunk)) {
      if (typeof callback === 'function') callback();
      return true;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return originalStderrWrite.call(
      process.stderr,
      chunk,
      encoding as any,
      callback
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  // Suppress Node.js internal warnings (like experimental features)
  process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
    if (typeof warning === 'string' && isStdoutNoise(warning)) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (originalEmitWarning as any).call(process, warning, ...args);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  return {
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
export function restoreNoise(state: NoiseState): void {
  console.log = state.originalConsoleLog;
  console.error = state.originalConsoleError;
  console.warn = state.originalConsoleWarn;
  console.info = state.originalConsoleInfo;
  process.stdout.write = state.originalStdoutWrite;
  process.stderr.write = state.originalStderrWrite;
  process.emitWarning = state.originalEmitWarning;
}
