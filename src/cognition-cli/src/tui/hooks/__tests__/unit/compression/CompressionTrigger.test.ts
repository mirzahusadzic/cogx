/**
 * CompressionTrigger Tests
 *
 * Tests for the isolated compression trigger logic that determines
 * when context compression should occur.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CompressionTrigger } from '../../../compression/CompressionTrigger.js';

describe('CompressionTrigger', () => {
  let trigger: CompressionTrigger;

  beforeEach(() => {
    trigger = new CompressionTrigger({
      tokenThreshold: 120000,
      minTurns: 5,
      enabled: true,
    });
  });

  describe('shouldTrigger', () => {
    it('should not trigger when token count below threshold', () => {
      const result = trigger.shouldTrigger(100000, 10);

      expect(result.shouldTrigger).toBe(false);
      expect(result.reason).toContain('100000 tokens');
      expect(result.reason).toContain('120000');
      expect(result.currentTokens).toBe(100000);
      expect(result.threshold).toBe(120000);
    });

    it('should not trigger when turn count below minimum', () => {
      const result = trigger.shouldTrigger(130000, 3);

      expect(result.shouldTrigger).toBe(false);
      expect(result.reason).toContain('3 turns');
      expect(result.reason).toContain('5');
      expect(result.currentTurns).toBe(3);
      expect(result.minTurns).toBe(5);
    });

    it('should trigger when both conditions met', () => {
      const result = trigger.shouldTrigger(130000, 10);

      expect(result.shouldTrigger).toBe(true);
      expect(result.reason).toContain('130000 tokens');
      expect(result.reason).toContain('120000');
      expect(result.reason).toContain('10 turns');
    });

    it('should not trigger twice in same session', () => {
      // First trigger - should succeed
      const result1 = trigger.shouldTrigger(130000, 10);
      expect(result1.shouldTrigger).toBe(true);

      // Mark as triggered
      trigger.markTriggered();

      // Second check - should not trigger
      const result2 = trigger.shouldTrigger(150000, 15);
      expect(result2.shouldTrigger).toBe(false);
      expect(result2.reason).toContain('already triggered');
    });

    it('should trigger at exact threshold', () => {
      const result = trigger.shouldTrigger(120001, 5);

      expect(result.shouldTrigger).toBe(true);
    });

    it('should not trigger at exact threshold (need to exceed)', () => {
      const result = trigger.shouldTrigger(120000, 5);

      expect(result.shouldTrigger).toBe(false);
    });

    it('should not trigger when disabled', () => {
      const disabledTrigger = new CompressionTrigger({
        tokenThreshold: 120000,
        minTurns: 5,
        enabled: false,
      });

      const result = disabledTrigger.shouldTrigger(130000, 10);

      expect(result.shouldTrigger).toBe(false);
      expect(result.reason).toContain('disabled');
    });
  });

  describe('markTriggered', () => {
    it('should mark compression as triggered', () => {
      expect(trigger.isTriggered()).toBe(false);

      trigger.markTriggered();

      expect(trigger.isTriggered()).toBe(true);
    });

    it('should prevent subsequent triggers', () => {
      const result1 = trigger.shouldTrigger(130000, 10);
      expect(result1.shouldTrigger).toBe(true);

      trigger.markTriggered();

      const result2 = trigger.shouldTrigger(150000, 15);
      expect(result2.shouldTrigger).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset triggered state', () => {
      trigger.markTriggered();
      expect(trigger.isTriggered()).toBe(true);

      trigger.reset();

      expect(trigger.isTriggered()).toBe(false);
    });

    it('should allow compression to trigger again after reset', () => {
      // Trigger once
      trigger.markTriggered();
      const result1 = trigger.shouldTrigger(130000, 10);
      expect(result1.shouldTrigger).toBe(false);

      // Reset
      trigger.reset();

      // Should trigger again
      const result2 = trigger.shouldTrigger(130000, 10);
      expect(result2.shouldTrigger).toBe(true);
    });
  });

  describe('getOptions', () => {
    it('should return current options', () => {
      const options = trigger.getOptions();

      expect(options.tokenThreshold).toBe(120000);
      expect(options.minTurns).toBe(5);
      expect(options.enabled).toBe(true);
    });

    it('should use default values when not provided', () => {
      const defaultTrigger = new CompressionTrigger();
      const options = defaultTrigger.getOptions();

      expect(options.tokenThreshold).toBe(120000);
      expect(options.minTurns).toBe(1);
      expect(options.enabled).toBe(true);
    });
  });

  describe('updateOptions', () => {
    it('should update token threshold', () => {
      trigger.updateOptions({ tokenThreshold: 150000 });

      const result = trigger.shouldTrigger(140000, 10);
      expect(result.shouldTrigger).toBe(false);
      expect(result.threshold).toBe(150000);

      const result2 = trigger.shouldTrigger(160000, 10);
      expect(result2.shouldTrigger).toBe(true);
    });

    it('should update minimum turns', () => {
      trigger.updateOptions({ minTurns: 10 });

      const result = trigger.shouldTrigger(130000, 8);
      expect(result.shouldTrigger).toBe(false);
      expect(result.minTurns).toBe(10);

      const result2 = trigger.shouldTrigger(130000, 12);
      expect(result2.shouldTrigger).toBe(true);
    });

    it('should enable/disable compression', () => {
      trigger.updateOptions({ enabled: false });

      const result = trigger.shouldTrigger(130000, 10);
      expect(result.shouldTrigger).toBe(false);

      trigger.updateOptions({ enabled: true });

      const result2 = trigger.shouldTrigger(130000, 10);
      expect(result2.shouldTrigger).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero tokens', () => {
      const result = trigger.shouldTrigger(0, 10);

      expect(result.shouldTrigger).toBe(false);
    });

    it('should handle zero turns', () => {
      const result = trigger.shouldTrigger(130000, 0);

      expect(result.shouldTrigger).toBe(false);
    });

    it('should handle very large token counts', () => {
      const result = trigger.shouldTrigger(10000000, 100);

      expect(result.shouldTrigger).toBe(true);
    });

    it('should handle very large turn counts', () => {
      const result = trigger.shouldTrigger(130000, 1000);

      expect(result.shouldTrigger).toBe(true);
    });
  });

  describe('Custom Thresholds', () => {
    it('should respect custom token threshold', () => {
      const customTrigger = new CompressionTrigger({
        tokenThreshold: 50000,
        minTurns: 3,
      });

      const result = customTrigger.shouldTrigger(60000, 5);
      expect(result.shouldTrigger).toBe(true);
    });

    it('should respect custom minimum turns', () => {
      const customTrigger = new CompressionTrigger({
        tokenThreshold: 120000,
        minTurns: 10,
      });

      const result = customTrigger.shouldTrigger(130000, 8);
      expect(result.shouldTrigger).toBe(false);

      const result2 = customTrigger.shouldTrigger(130000, 12);
      expect(result2.shouldTrigger).toBe(true);
    });
  });
});
