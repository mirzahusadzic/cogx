/**
 * Session Management Types
 *
 * Type definitions for managing dual-identity session state in the TUI.
 * Handles the complex interplay between stable anchor IDs and transient SDK session IDs.
 *
 * DESIGN RATIONALE:
 * The TUI uses a dual-identity session model to support context compression:
 *
 * 1. ANCHOR ID (Stable):
 *    - User-facing session identifier
 *    - Never changes across compressions
 *    - Used for file naming (.sigma/{anchorId}.state.json)
 *    - Set via --session-id flag or auto-generated
 *
 * 2. SDK SESSION ID (Transient):
 *    - Internal identifier used by Claude Agent SDK
 *    - Changes when context is compressed (new SDK session)
 *    - Tracked via resumeSessionId for continuity
 *
 * This separation enables:
 * - Seamless context compression without breaking user workflow
 * - Persistent session state across SDK session boundaries
 * - Clear audit trail of compression events
 *
 * SESSION LIFECYCLE:
 * 1. Initial: anchorId = SDK session ID
 * 2. Compression: SDK creates new session, but anchorId unchanged
 * 3. Resume: Load state from anchorId, resume from last SDK session
 *
 * @example
 * // User starts with --session-id my-project
 * anchorId: 'my-project'
 * currentSessionId: 'sdk-uuid-1' (first SDK session)
 * resumeSessionId: undefined
 *
 * // After compression at 100K tokens
 * anchorId: 'my-project' (unchanged)
 * currentSessionId: 'sdk-uuid-2' (new SDK session)
 * resumeSessionId: 'sdk-uuid-2' (for next query)
 *
 * // On restart
 * anchorId: 'my-project' (same)
 * currentSessionId: 'my-project' (temp, until SDK assigns)
 * resumeSessionId: 'sdk-uuid-2' (resume from last session)
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
