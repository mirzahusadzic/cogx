/**
 * Utility for dynamic thinking/reasoning budgeting based on TPM (Tokens Per Minute)
 */

export interface ThinkingBudget {
  isTPMLow: boolean;
  thinkingLevel: 'LOW' | 'HIGH';
  reasoningEffort: 'low' | 'medium' | 'high';
  thinkingBudget: number;
}

/**
 * Calculate thinking budget based on remaining TPM
 */
export function getDynamicThinkingBudget(
  remainingTPM?: number
): ThinkingBudget {
  const tpm = remainingTPM ?? 1000000;
  const isTPMLow = tpm < 200000;

  return {
    isTPMLow,
    thinkingLevel: isTPMLow ? 'LOW' : 'HIGH',
    reasoningEffort: isTPMLow ? 'low' : 'medium',
    thinkingBudget: isTPMLow ? 8192 : 24576,
  };
}
