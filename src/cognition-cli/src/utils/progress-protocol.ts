/**
 * Progress Protocol
 *
 * Shared types and helpers for streaming progress events from long-running
 * CLI commands (genesis, overlay generation) to consumers like the TUI.
 *
 * When --json flag is passed (or stdout is not a TTY), commands emit
 * newline-delimited JSON events instead of chalk/spinner output.
 *
 * @example
 * // Emitting progress
 * emitProgress({ type: 'start', task: 'genesis', total: 290, message: 'Starting...' });
 * emitProgress({ type: 'progress', task: 'genesis', current: 1, total: 290, percent: 0, message: 'Processing src/index.ts' });
 * emitProgress({ type: 'complete', task: 'genesis', duration: 32110, stats: { files: 290 } });
 *
 * @example
 * // Consuming progress (TUI)
 * proc.stdout.on('data', (chunk) => {
 *   for (const event of parseProgressEvents(chunk)) {
 *     handleEvent(event);
 *   }
 * });
 */

/**
 * Base progress event - all events extend this
 */
export interface BaseProgressEvent {
  /** Event type discriminator */
  type: 'start' | 'progress' | 'complete' | 'error' | 'warning';
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Task identifier: 'genesis' or overlay name like 'O1', 'O3' */
  task: string;
}

/**
 * Emitted when a task begins
 */
export interface StartEvent extends BaseProgressEvent {
  type: 'start';
  /** Total items to process (if known upfront) */
  total?: number;
  /** Human-readable description */
  message: string;
}

/**
 * Emitted during task execution to report progress
 */
export interface ProgressEvent extends BaseProgressEvent {
  type: 'progress';
  /** Current item index (1-based) */
  current: number;
  /** Total items */
  total: number;
  /** Progress percentage (0-100) */
  percent: number;
  /** Current operation description */
  message: string;
  /** Current file being processed (optional) */
  file?: string;
  /** Current phase within the task (optional) */
  phase?: string;
}

/**
 * Emitted when a task completes successfully
 */
export interface CompleteEvent extends BaseProgressEvent {
  type: 'complete';
  /** Total duration in milliseconds */
  duration: number;
  /** Task-specific statistics */
  stats?: Record<string, number>;
  /** Summary message */
  message?: string;
}

/**
 * Emitted when an error occurs
 */
export interface ErrorEvent extends BaseProgressEvent {
  type: 'error';
  /** Error description */
  message: string;
  /** Whether the task can continue after this error */
  recoverable: boolean;
  /** Additional details (stack trace, etc.) */
  details?: string;
}

/**
 * Emitted for non-fatal warnings
 */
export interface WarningEvent extends BaseProgressEvent {
  type: 'warning';
  /** Warning description */
  message: string;
  /** Related file (optional) */
  file?: string;
}

/**
 * Union of all progress event types
 */
export type AnyProgressEvent =
  | StartEvent
  | ProgressEvent
  | CompleteEvent
  | ErrorEvent
  | WarningEvent;

/**
 * Check if JSON progress mode should be used
 *
 * Returns true when:
 * - --json flag was passed (COGNITION_FORMAT=json)
 * - stdout is not a TTY (piped/subprocess)
 *
 * @param forceJson - Explicit --json flag from command options
 */
export function shouldUseJsonProgress(forceJson?: boolean): boolean {
  if (forceJson) return true;
  if (process.env.COGNITION_FORMAT === 'json') return true;
  if (!process.stdout.isTTY) return true;
  return false;
}

/**
 * Emit a progress event to stdout as JSON line
 *
 * @param event - Progress event (without timestamp, added automatically)
 */
export function emitProgress(event: Omit<AnyProgressEvent, 'timestamp'>): void {
  const fullEvent: AnyProgressEvent = {
    ...event,
    timestamp: Date.now(),
  } as AnyProgressEvent;

  console.log(JSON.stringify(fullEvent));
}

/**
 * Create a progress emitter for a specific task
 *
 * Provides convenience methods for emitting typed events.
 *
 * @param task - Task identifier ('genesis', 'O1', etc.)
 * @returns Object with typed emit methods
 *
 * @example
 * const progress = createProgressEmitter('genesis');
 * progress.start({ total: 100, message: 'Starting genesis...' });
 * progress.update({ current: 1, total: 100, percent: 1, message: 'Processing...' });
 * progress.complete({ duration: 5000, stats: { files: 100 } });
 */
export function createProgressEmitter(task: string) {
  return {
    start(opts: { total?: number; message: string }) {
      emitProgress({ type: 'start', task, ...opts });
    },

    update(opts: {
      current: number;
      total: number;
      percent: number;
      message: string;
      file?: string;
      phase?: string;
    }) {
      emitProgress({ type: 'progress', task, ...opts });
    },

    complete(opts: {
      duration: number;
      stats?: Record<string, number>;
      message?: string;
    }) {
      emitProgress({ type: 'complete', task, ...opts });
    },

    error(opts: { message: string; recoverable: boolean; details?: string }) {
      emitProgress({ type: 'error', task, ...opts });
    },

    warning(opts: { message: string; file?: string }) {
      emitProgress({ type: 'warning', task, ...opts });
    },
  };
}

/**
 * Parse progress events from a data chunk
 *
 * Handles partial lines by returning unparsed remainder.
 * Used by TUI to consume subprocess stdout.
 *
 * @param chunk - Data chunk from stdout
 * @param remainder - Unparsed remainder from previous chunk
 * @returns Parsed events and new remainder
 *
 * @example
 * let buffer = '';
 * proc.stdout.on('data', (chunk) => {
 *   const { events, remainder } = parseProgressChunk(chunk.toString(), buffer);
 *   buffer = remainder;
 *   for (const event of events) {
 *     handleEvent(event);
 *   }
 * });
 */
export function parseProgressChunk(
  chunk: string,
  remainder: string = ''
): { events: AnyProgressEvent[]; remainder: string } {
  const combined = remainder + chunk;
  const lines = combined.split('\n');

  // Last element might be incomplete line
  const newRemainder = lines.pop() || '';

  const events: AnyProgressEvent[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed);
      // Basic validation - must have type and task
      if (parsed.type && parsed.task) {
        events.push(parsed as AnyProgressEvent);
      }
    } catch {
      // Skip non-JSON lines (shouldn't happen with --json, but defensive)
    }
  }

  return { events, remainder: newRemainder };
}

/**
 * Type guard for StartEvent
 */
export function isStartEvent(event: AnyProgressEvent): event is StartEvent {
  return event.type === 'start';
}

/**
 * Type guard for ProgressEvent
 */
export function isProgressEvent(
  event: AnyProgressEvent
): event is ProgressEvent {
  return event.type === 'progress';
}

/**
 * Type guard for CompleteEvent
 */
export function isCompleteEvent(
  event: AnyProgressEvent
): event is CompleteEvent {
  return event.type === 'complete';
}

/**
 * Type guard for ErrorEvent
 */
export function isErrorEvent(event: AnyProgressEvent): event is ErrorEvent {
  return event.type === 'error';
}

/**
 * Type guard for WarningEvent
 */
export function isWarningEvent(event: AnyProgressEvent): event is WarningEvent {
  return event.type === 'warning';
}
