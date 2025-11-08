/**
 * Session Management Layer
 *
 * Exports all session management components
 */

export { useSessionManager } from './useSessionManager.js';
export type {
  UseSessionManagerOptions,
  UseSessionManagerResult,
} from './useSessionManager.js';

export { SessionStateStore } from './SessionStateStore.js';
export type { SessionStats } from './SessionStateStore.js';

export type {
  SessionOptions,
  SessionState,
  SessionLoadResult,
  SessionUpdateEvent,
} from './types.js';
