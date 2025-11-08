/**
 * Session Management Types
 *
 * Defines interfaces for managing session state, including:
 * - Anchor session IDs (stable, user-facing)
 * - SDK session IDs (transient, changes on compression)
 * - Session persistence and state updates
 */

/**
 * Options for configuring session management
 */
export interface SessionOptions {
  /**
   * User-provided session ID (CLI --session-id flag)
   * If not provided, auto-generates one based on timestamp
   */
  sessionIdProp?: string;

  /**
   * Current working directory for .sigma/ state files
   */
  cwd: string;

  /**
   * Whether to enable debug logging
   * @default false
   */
  debug?: boolean;
}

/**
 * Session state tracking
 */
export interface SessionState {
  /**
   * Anchor ID - stable user-facing session identifier
   * Used for file naming (.sigma/{anchorId}.state.json)
   * NEVER changes across compressions
   */
  anchorId: string;

  /**
   * Current SDK session ID (transient, changes on compression)
   * This is what the Claude Agent SDK uses internally
   */
  currentSessionId: string;

  /**
   * Session ID to resume from (for SDK query)
   * undefined = fresh session with no history
   */
  resumeSessionId: string | undefined;

  /**
   * Intelligent recap injected into the prompt
   * Set when resuming a compressed session
   */
  injectedRecap: string | null;

  /**
   * Whether we've received the SDK session ID yet
   * Tracks if the SDK has assigned a real session UUID
   */
  hasReceivedSDKSessionId: boolean;
}

/**
 * Result of loading session state from disk
 */
export interface SessionLoadResult {
  /**
   * Session ID to resume from (undefined = fresh session)
   */
  resumeSessionId: string | undefined;

  /**
   * Current SDK session ID
   */
  currentSessionId: string;

  /**
   * User-facing message to display (if resuming)
   */
  message?: string;
}

/**
 * Session update event
 * Only for updating EXISTING sessions (compression or expiration)
 * Initial session creation is handled separately by create()
 */
export interface SessionUpdateEvent {
  /**
   * Previous SDK session ID
   */
  previousSessionId: string;

  /**
   * New SDK session ID
   */
  newSessionId: string;

  /**
   * Reason for update (compression or expiration only)
   */
  reason: 'compression' | 'expiration';

  /**
   * Token count at time of compression (if applicable)
   */
  compressedTokens?: number;
}
