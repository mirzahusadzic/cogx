/**
 * Compression Layer Types
 *
 * Defines interfaces and types for the context compression system that manages
 * conversation history compression when token thresholds are exceeded.
 *
 * DESIGN:
 * The compression system protects against context window exhaustion by monitoring
 * token usage and triggering compression when thresholds are reached. This enables
 * long-running conversations within Claude's context limits.
 *
 * Key Concepts:
 * 1. Token Threshold: Maximum tokens before compression triggers (default: 200k)
 * 2. Minimum Turns: Required conversation turns before compression (prevents premature compression)
 * 3. Compression State: Tracks compression history and prevents multiple compressions
 *
 * Integration with Grounded Context Pool (PGC):
 * The compression system works with PGC to maintain semantic coherence:
 * - Monitors token usage from PGC updates
 * - Triggers compression to free context window
 * - Preserves important context via PGC semantic storage
 *
 * RATIONALE:
 * Gemini and Claude have large context windows (~200k-1M+ tokens). As conversations grow,
 * we must compress older context to make room for new interactions while
 * preserving semantic coherence through PGC.
 *
 * @example
 * // Configuring compression
 * const options: CompressionOptions = {
 *   tokenThreshold: 200000,  // Trigger at 200k tokens
 *   minTurns: 5,             // Require at least 5 turns
 *   enabled: true
 * };
 *
 * @example
 * // Checking compression trigger result
 * const result: CompressionTriggerResult = {
 *   shouldTrigger: true,
 *   reason: "205000 tokens > 200000 threshold with 8 turns",
 *   currentTokens: 205000,
 *   threshold: 200000,
 *   currentTurns: 8,
 *   minTurns: 5
 * };
 */

/**
 * Options for configuring compression behavior
 *
 * Configuration parameters that control when and how compression triggers.
 * These options balance between preserving context and preventing window exhaustion.
 *
 * @example
 * const options: CompressionOptions = {
 *   tokenThreshold: 100000,  // Lower threshold for smaller models
 *   minTurns: 10,            // Require more turns for stability
 *   enabled: true
 * };
 */
export interface CompressionOptions {
  /**
   * Token threshold at which compression should trigger
   *
   * When token count exceeds this value, compression will be triggered
   * (subject to minTurns requirement). Default is 200k tokens, which
   * provides buffer room within Claude's ~200k context window and
   * Gemini's 1M+ window.
   *
   * @default 200000
   */
  tokenThreshold?: number;

  /**
   * Lower token threshold for semantic events (e.g., task updates)
   *
   * If a semantic event is detected (like SigmaTaskUpdate), we trigger
   * compression at a much lower threshold (e.g. 50k) to keep the context lean.
   *
   * @default 50000
   */
  semanticThreshold?: number;

  /**
   * Maximum Tokens Per Minute (TPM) for the model.
   * If current session tokens approach this limit, compression is forced
   * regardless of other thresholds.
   *
   * @default 1000000 (1M for Gemini 3.0)
   */
  tpmLimit?: number;

  /**
   * Minimum number of turns required before compression can trigger
   *
   * Prevents premature compression in short conversations where compression
   * overhead would outweigh benefits. A turn is a user-assistant exchange.
   *
   * @default 1
   */
  minTurns?: number;

  /**
   * Whether compression is enabled
   *
   * Master switch for compression system. When false, no compression
   * will occur regardless of token count or turns.
   *
   * @default true
   */
  enabled?: boolean;
}

/**
 * Result of checking if compression should trigger
 *
 * Detailed information about compression trigger decision, including
 * current state, thresholds, and human-readable reasoning.
 *
 * This type enables:
 * 1. Transparent decision-making (reason field explains why/why not)
 * 2. Debugging (all relevant values exposed)
 * 3. User feedback (can display reason to user)
 *
 * @example
 * const result: CompressionTriggerResult = {
 *   shouldTrigger: false,
 *   reason: "85000 tokens (threshold: 120000)",
 *   currentTokens: 85000,
 *   threshold: 120000,
 *   currentTurns: 7,
 *   minTurns: 5
 * };
 */
export interface CompressionTriggerResult {
  /**
   * Whether compression should be triggered now
   *
   * True if all conditions met:
   * - Enabled
   * - currentTokens > threshold
   * - currentTurns >= minTurns
   * - Not already triggered in this session
   */
  shouldTrigger: boolean;

  /**
   * Reason why compression should or shouldn't trigger
   *
   * Human-readable explanation for the decision.
   * Examples:
   * - "125000 tokens > 120000 threshold with 8 turns"
   * - "Only 4 turns analyzed, need 5"
   * - "Compression already triggered in this session"
   */
  reason: string;

  /**
   * Current token count
   *
   * Total tokens used in conversation (from PGC tracking)
   */
  currentTokens: number;

  /**
   * Token threshold for compression
   *
   * Configured threshold value
   */
  threshold: number;

  /**
   * Current number of analyzed turns
   *
   * Number of user-assistant exchanges completed
   */
  currentTurns: number;

  /**
   * Minimum turns required
   *
   * Configured minimum turns value
   */
  minTurns: number;

  /**
   * Whether the check was triggered by a semantic event
   */
  isSemanticEvent?: boolean;
}

/**
 * Compression state tracking
 *
 * Maintains state about compression history for the current session.
 * Prevents multiple compressions and tracks compression metrics.
 *
 * @example
 * const state: CompressionState = {
 *   triggered: true,
 *   lastCompression: new Date('2025-11-15T10:30:00Z'),
 *   compressionCount: 1,
 *   lastCompressedTokens: 125000
 * };
 */
export interface CompressionState {
  /**
   * Whether compression has been triggered in the current session
   *
   * Used to prevent multiple compressions within a single session.
   * Reset when new session starts.
   */
  triggered: boolean;

  /**
   * Timestamp of last compression
   *
   * Useful for analytics and debugging compression patterns.
   */
  lastCompression?: Date;

  /**
   * Number of times compression has been triggered
   *
   * Incremented each time compression occurs.
   * Can be used for session analytics.
   */
  compressionCount: number;

  /**
   * Token count at last compression
   *
   * Snapshot of token count when compression was triggered.
   * Useful for measuring compression effectiveness.
   */
  lastCompressedTokens?: number;
}
