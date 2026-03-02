import { describe, it, expect } from 'vitest';
import { getDynamicThinkingBudget } from '../../core/utils/thinking-utils.js';

describe('thinking-utils', () => {
  describe('getDynamicThinkingBudget', () => {
    it('should return high budget when TPM is high', () => {
      const budget = getDynamicThinkingBudget(1000000);
      expect(budget.isTPMLow).toBe(false);
      expect(budget.thinkingLevel).toBe('HIGH');
      expect(budget.reasoningEffort).toBe('medium');
      expect(budget.thinkingBudget).toBe(24576);
    });

    it('should return low budget when TPM is below 200k', () => {
      const budget = getDynamicThinkingBudget(199999);
      expect(budget.isTPMLow).toBe(true);
      expect(budget.thinkingLevel).toBe('LOW');
      expect(budget.reasoningEffort).toBe('low');
      expect(budget.thinkingBudget).toBe(8192);
    });

    it('should use default 1M TPM when remainingTPM is undefined', () => {
      const budget = getDynamicThinkingBudget(undefined);
      expect(budget.isTPMLow).toBe(false);
      expect(budget.thinkingLevel).toBe('HIGH');
      expect(budget.thinkingBudget).toBe(24576);
    });

    it('should handle zero TPM correctly as low', () => {
      const budget = getDynamicThinkingBudget(0);
      expect(budget.isTPMLow).toBe(true);
      expect(budget.thinkingLevel).toBe('LOW');
      expect(budget.thinkingBudget).toBe(8192);
    });
  });
});
