/**
 * Compression Layer Types
 *
 * Defines interfaces and types for the compression system that manages
 * context compression when token thresholds are exceeded.
 */

/**
 * Options for configuring compression behavior
 */
export interface CompressionOptions {
  /**
   * Token threshold at which compression should trigger
   * @default 120000
   */
  tokenThreshold?: number;

  /**
   * Minimum number of turns required before compression can trigger
   * @default 5
   */
  minTurns?: number;

  /**
   * Whether compression is enabled
   * @default true
   */
  enabled?: boolean;
}

/**
 * Result of checking if compression should trigger
 */
export interface CompressionTriggerResult {
  /**
   * Whether compression should be triggered now
   */
  shouldTrigger: boolean;

  /**
   * Reason why compression should or shouldn't trigger
   */
  reason: string;

  /**
   * Current token count
   */
  currentTokens: number;

  /**
   * Token threshold for compression
   */
  threshold: number;

  /**
   * Current number of analyzed turns
   */
  currentTurns: number;

  /**
   * Minimum turns required
   */
  minTurns: number;
}

/**
 * Compression state tracking
 */
export interface CompressionState {
  /**
   * Whether compression has been triggered in the current session
   */
  triggered: boolean;

  /**
   * Timestamp of last compression
   */
  lastCompression?: Date;

  /**
   * Number of times compression has been triggered
   */
  compressionCount: number;

  /**
   * Token count at last compression
   */
  lastCompressedTokens?: number;
}
