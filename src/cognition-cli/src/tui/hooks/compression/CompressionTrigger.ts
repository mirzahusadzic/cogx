/**
 * Compression Trigger
 *
 * Isolated, testable logic for determining when context compression should trigger.
 * Implements decision logic based on token thresholds, turn counts, and session state.
 *
 * DESIGN:
 * CompressionTrigger is a stateful class that encapsulates compression decision logic.
 * It maintains:
 * 1. Configuration (thresholds, minimums, enabled flag)
 * 2. State (whether already triggered in current session)
 * 3. Decision logic (shouldTrigger method)
 *
 * This separation enables:
 * - Unit testing of trigger logic without React hooks
 * - Reusability across different contexts (TUI, CLI, tests)
 * - Clear encapsulation of compression rules
 *
 * Decision Algorithm:
 * Compression triggers when ALL conditions are met:
 * 1. Compression is enabled
 * 2. Not already triggered in this session
 * 3. Current turns >= minimum turns
 * 4. Current tokens > token threshold
 *
 * If any condition fails, compression does not trigger and reason is provided.
 *
 * RATIONALE:
 * By extracting trigger logic from useClaudeAgent hook:
 * - Tests can verify decision logic without React
 * - Logic is reusable in non-React contexts
 * - Easier to reason about (pure state machine)
 * - Better separation of concerns
 *
 * @example
 * // Creating and using a trigger
 * const trigger = new CompressionTrigger({
 *   tokenThreshold: 120000,
 *   minTurns: 5,
 *   enabled: true
 * });
 *
 * const result = trigger.shouldTrigger(125000, 8);
 * if (result.shouldTrigger) {
 *   performCompression();
 *   trigger.markTriggered();
 * }
 *
 * @example
 * // Updating configuration dynamically
 * trigger.updateOptions({ tokenThreshold: 100000 });
 *
 * @example
 * // Resetting for new session
 * trigger.reset();
 * const newResult = trigger.shouldTrigger(130000, 10);
 * // Can trigger again after reset
 *
 * Extracted from useClaudeAgent.ts to make trigger logic testable and maintainable.
 */

import type { CompressionOptions, CompressionTriggerResult } from './types.js';

/**
 * Manages compression trigger logic
 *
 * Stateful class that determines when context compression should occur based on
 * token count thresholds, minimum turn requirements, and session state.
 *
 * State Machine:
 * - Initial: triggered = false, can trigger if conditions met
 * - Triggered: triggered = true, cannot trigger again until reset
 * - Reset: triggered = false, can trigger again
 *
 * This prevents multiple compressions within a single session while allowing
 * compression in subsequent sessions.
 *
 * @example
 * const trigger = new CompressionTrigger({
 *   tokenThreshold: 120000,
 *   minTurns: 5
 * });
 *
 * // Check if should trigger
 * const result = trigger.shouldTrigger(125000, 8);
 * if (result.shouldTrigger) {
 *   trigger.markTriggered();
 *   // Perform compression...
 * }
 */
export class CompressionTrigger {
  /**
   * Configuration options for compression trigger
   * All fields are required (defaults applied in constructor)
   */
  private options: Required<CompressionOptions>;

  /**
   * Whether compression has been triggered in current session
   * Prevents multiple compressions within a single session
   */
  private triggered: boolean = false;

  /**
   * Create a new compression trigger with configuration
   *
   * Applies defaults for any missing options:
   * - tokenThreshold: 120000 (120k tokens)
   * - minTurns: 5 (minimum conversation exchanges)
   * - enabled: true (compression active)
   *
   * @param options - Compression configuration options
   *
   * @example
   * const trigger = new CompressionTrigger({
   *   tokenThreshold: 100000,
   *   minTurns: 10
   * });
   */
  constructor(options: CompressionOptions = {}) {
    this.options = {
      tokenThreshold: options.tokenThreshold ?? 120000,
      minTurns: options.minTurns ?? 5,
      enabled: options.enabled ?? true,
    };
  }

  /**
   * Check if compression should trigger based on current state
   *
   * Evaluates all compression conditions and returns detailed result with reasoning.
   * This is the core decision logic for the compression system.
   *
   * ALGORITHM:
   * 1. Check if compression is enabled
   *    - If disabled, return false with reason
   * 2. Check if already triggered in this session
   *    - If triggered, return false with reason (prevent double compression)
   * 3. Check if minimum turns requirement met
   *    - If not enough turns, return false with reason
   * 4. Check if token threshold exceeded
   *    - If below threshold, return false with current count
   * 5. All conditions met - return true with detailed reason
   *
   * @param currentTokens - Current total token count from PGC
   * @param currentTurns - Number of conversation turns completed
   * @returns Detailed result including decision and reasoning
   *
   * @example
   * const result = trigger.shouldTrigger(125000, 8);
   * if (result.shouldTrigger) {
   *   console.log(result.reason);
   *   // "125000 tokens > 120000 threshold with 8 turns"
   * }
   *
   * @example
   * const result = trigger.shouldTrigger(85000, 3);
   * console.log(result.shouldTrigger); // false
   * console.log(result.reason); // "Only 3 turns analyzed, need 5"
   */
  shouldTrigger(
    currentTokens: number,
    currentTurns: number
  ): CompressionTriggerResult {
    // Compression disabled
    if (!this.options.enabled) {
      return {
        shouldTrigger: false,
        reason: 'Compression is disabled',
        currentTokens,
        threshold: this.options.tokenThreshold,
        currentTurns,
        minTurns: this.options.minTurns,
      };
    }

    // Already triggered in this session
    if (this.triggered) {
      return {
        shouldTrigger: false,
        reason: 'Compression already triggered in this session',
        currentTokens,
        threshold: this.options.tokenThreshold,
        currentTurns,
        minTurns: this.options.minTurns,
      };
    }

    // Not enough turns yet
    if (currentTurns < this.options.minTurns) {
      return {
        shouldTrigger: false,
        reason: `Only ${currentTurns} turns analyzed, need ${this.options.minTurns}`,
        currentTokens,
        threshold: this.options.tokenThreshold,
        currentTurns,
        minTurns: this.options.minTurns,
      };
    }

    // Token threshold not reached
    if (currentTokens <= this.options.tokenThreshold) {
      return {
        shouldTrigger: false,
        reason: `${currentTokens} tokens (threshold: ${this.options.tokenThreshold})`,
        currentTokens,
        threshold: this.options.tokenThreshold,
        currentTurns,
        minTurns: this.options.minTurns,
      };
    }

    // All conditions met - trigger compression!
    return {
      shouldTrigger: true,
      reason: `${currentTokens} tokens > ${this.options.tokenThreshold} threshold with ${currentTurns} turns`,
      currentTokens,
      threshold: this.options.tokenThreshold,
      currentTurns,
      minTurns: this.options.minTurns,
    };
  }

  /**
   * Mark compression as triggered
   *
   * Sets internal state to prevent multiple compressions in the same session.
   * Should be called immediately after compression is initiated.
   *
   * @example
   * const result = trigger.shouldTrigger(125000, 8);
   * if (result.shouldTrigger) {
   *   trigger.markTriggered();
   *   await performCompression();
   * }
   */
  markTriggered(): void {
    this.triggered = true;
  }

  /**
   * Reset the trigger state
   *
   * Clears the triggered flag to allow compression in a new session.
   * Call this when:
   * - Compression completes successfully
   * - Starting a fresh conversation
   * - Error recovery (compression failed, want to retry)
   *
   * @example
   * // After successful compression
   * await performCompression();
   * trigger.reset();
   * // Can now trigger again if conditions met
   */
  reset(): void {
    this.triggered = false;
  }

  /**
   * Check if compression has been triggered
   *
   * Useful for status reporting and debugging.
   *
   * @returns True if compression triggered in current session
   *
   * @example
   * if (trigger.isTriggered()) {
   *   console.log('Compression already occurred this session');
   * }
   */
  isTriggered(): boolean {
    return this.triggered;
  }

  /**
   * Get current options
   *
   * Returns a copy of current configuration to prevent external mutation.
   *
   * @returns Current compression options
   *
   * @example
   * const options = trigger.getOptions();
   * console.log(`Threshold: ${options.tokenThreshold}`);
   */
  getOptions(): Required<CompressionOptions> {
    return { ...this.options };
  }

  /**
   * Update options (useful for dynamic threshold changes)
   *
   * Allows runtime configuration updates without creating new trigger instance.
   * Useful for:
   * - Adjusting thresholds based on model type
   * - Enabling/disabling compression dynamically
   * - Tuning based on user preferences
   *
   * @param options - Partial options to update (others remain unchanged)
   *
   * @example
   * // Lower threshold for smaller model
   * trigger.updateOptions({ tokenThreshold: 80000 });
   *
   * @example
   * // Disable compression temporarily
   * trigger.updateOptions({ enabled: false });
   */
  updateOptions(options: Partial<CompressionOptions>): void {
    this.options = {
      ...this.options,
      ...options,
    };
  }
}
