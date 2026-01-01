/**
 * IPC Module - ZeroMQ Pub/Sub for Multi-Agent Communication
 *
 * Provides federated multi-agent communication via ZeroMQ.
 * Supports both interactive TUI instances and background tasks.
 */

import { systemLog } from '../utils/debug-logger.js';

// Check if ZeroMQ is available (graceful degradation)
let ZeroMQAvailable = true;
let ZeroMQLoadError: Error | null = null;

try {
  // Try to import ZeroMQ (runtime check, not static import)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('zeromq');
} catch (err) {
  ZeroMQAvailable = false;
  ZeroMQLoadError = err as Error;

  systemLog(
    'ipc',
    'ZeroMQ not available. Multi-agent features disabled.',
    undefined,
    'warn'
  );
}

// Export types and classes
export * from './AgentMessage.js';
export * from './ZeroMQBus.js';
export * from './BusCoordinator.js';
export * from './AgentRegistry.js';
export { MessageQueueMonitor, AgentInfo } from './MessageQueueMonitor.js';
export { MessagePublisher } from './MessagePublisher.js';
export { MessageQueue } from './MessageQueue.js';
export * from './agent-messaging-formatters.js';

// Export availability check
/**
 * Flag indicating if ZeroMQ is available.
 *
 * If `false`, multi-agent features are disabled, and the CLI
 * will operate in single-agent mode.
 *
 * @example
 * if (isMultiAgentAvailable) {
 *   // Start multi-agent features
 * } else {
 *   // Fallback to single-agent mode
 * }
 */
export const isMultiAgentAvailable = ZeroMQAvailable;

/**
 * Stores the error if ZeroMQ failed to load.
 *
 * This can be useful for debugging native binding issues.
 * Will be `null` if `isMultiAgentAvailable` is `true`.
 *
 * @example
 * if (!isMultiAgentAvailable) {
 *   systemLog('ipc', 'ZeroMQ load error:', { error: multiAgentLoadError?.message }, 'error');
 * }
 */
export const multiAgentLoadError = ZeroMQLoadError;

/**
 * Checks if multi-agent features are available and logs a warning if not.
 *
 * This function provides a user-friendly warning message with instructions
 * on how to enable multi-agent mode if ZeroMQ is not available.
 * It is typically called at application startup.
 *
 * @returns {boolean} `true` if multi-agent features are available, `false` otherwise.
 *
 * @example
 * if (checkMultiAgentAvailability()) {
 *   // Proceed with multi-agent initialization
 * } else {
 *   // Run in single-agent mode
 * }
 */
export function checkMultiAgentAvailability(): boolean {
  if (!ZeroMQAvailable) {
    const warningMessage = [
      '╔══════════════════════════════════════════════════════════════╗',
      '║  ⚠️  Multi-Agent Mode Unavailable                           ║',
      '║                                                              ║',
      '║  ZeroMQ native bindings failed to load.                     ║',
      '║  Running in single-agent mode (no pub/sub).                 ║',
      '║                                                              ║',
      '║  To enable multi-agent features:                            ║',
      '║  1. Install build tools: npm install -g node-gyp            ║',
      '║  2. Rebuild ZeroMQ: npm rebuild zeromq                      ║',
      '║                                                              ║',
      '╚══════════════════════════════════════════════════════════════╝',
    ].join('\n');

    systemLog('ipc', warningMessage, undefined, 'warn');

    return false;
  }

  return true;
}
