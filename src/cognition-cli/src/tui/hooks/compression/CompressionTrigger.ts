/**
 * Compression Trigger
 *
 * Isolated logic for determining when compression should trigger.
 * Extracted from useClaudeAgent.ts to make trigger logic testable and maintainable.
 */

import type { CompressionOptions, CompressionTriggerResult } from './types.js';

/**
 * Manages compression trigger logic
 *
 * Determines when context compression should occur based on:
 * - Token count thresholds
 * - Minimum turn requirements
 * - Whether compression has already been triggered
 */
export class CompressionTrigger {
  private options: Required<CompressionOptions>;
  private triggered: boolean = false;

  constructor(options: CompressionOptions = {}) {
    this.options = {
      tokenThreshold: options.tokenThreshold ?? 120000,
      minTurns: options.minTurns ?? 5,
      enabled: options.enabled ?? true,
    };
  }

  /**
   * Check if compression should trigger based on current state
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
   * This prevents compression from triggering multiple times in the same session
   */
  markTriggered(): void {
    this.triggered = true;
  }

  /**
   * Reset the trigger state
   * Call this when starting a new session (after compression completes)
   */
  reset(): void {
    this.triggered = false;
  }

  /**
   * Check if compression has been triggered
   */
  isTriggered(): boolean {
    return this.triggered;
  }

  /**
   * Get current options
   */
  getOptions(): Required<CompressionOptions> {
    return { ...this.options };
  }

  /**
   * Update options (useful for dynamic threshold changes)
   */
  updateOptions(options: Partial<CompressionOptions>): void {
    this.options = {
      ...this.options,
      ...options,
    };
  }
}
