/**
 * IPC Module - ZeroMQ Pub/Sub for Multi-Agent Communication
 *
 * Provides federated multi-agent communication via ZeroMQ.
 * Supports both interactive TUI instances and background tasks.
 */

// Check if ZeroMQ is available (graceful degradation)
let ZeroMQAvailable = true;
let ZeroMQLoadError: Error | null = null;

try {
  // Try to import ZeroMQ
  require('zeromq');
} catch (err) {
  ZeroMQAvailable = false;
  ZeroMQLoadError = err as Error;

  console.warn('⚠️  ZeroMQ not available. Multi-agent features disabled.');
  console.warn('   Install with: npm install zeromq');
  console.warn('   Or rebuild with: npm rebuild zeromq');
}

// Export types and classes
export * from './AgentMessage.js';
export * from './ZeroMQBus.js';
export * from './BusCoordinator.js';
export * from './AgentRegistry.js';

// Export availability check
export const isMultiAgentAvailable = ZeroMQAvailable;
export const multiAgentLoadError = ZeroMQLoadError;

/**
 * Check if multi-agent features are available
 * If not, TUI falls back to single-agent mode
 */
export function checkMultiAgentAvailability(): boolean {
  if (!ZeroMQAvailable) {
    console.warn('');
    console.warn('╔══════════════════════════════════════════════════════════════╗');
    console.warn('║  ⚠️  Multi-Agent Mode Unavailable                           ║');
    console.warn('║                                                              ║');
    console.warn('║  ZeroMQ native bindings failed to load.                     ║');
    console.warn('║  Running in single-agent mode (no pub/sub).                 ║');
    console.warn('║                                                              ║');
    console.warn('║  To enable multi-agent features:                            ║');
    console.warn('║  1. Install build tools: npm install -g node-gyp            ║');
    console.warn('║  2. Rebuild ZeroMQ: npm rebuild zeromq                      ║');
    console.warn('║                                                              ║');
    console.warn('╚══════════════════════════════════════════════════════════════╝');
    console.warn('');

    return false;
  }

  return true;
}
