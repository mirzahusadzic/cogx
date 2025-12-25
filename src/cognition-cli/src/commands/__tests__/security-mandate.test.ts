import { describe, it, expect, vi, beforeEach } from 'vitest';
import { showMandate } from '../security/mandate.js';
import { DUAL_USE_MANDATE } from '../../core/security/dual-use-mandate.js';

describe('showMandate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display the DUAL_USE_MANDATE to console', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await showMandate();

    expect(consoleSpy).toHaveBeenCalledWith(DUAL_USE_MANDATE);
    consoleSpy.mockRestore();
  });
});
