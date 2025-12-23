import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import { analyzeSecurityBlastRadius } from '../security-blast-radius.js';

describe('security-blast-radius command', () => {
  beforeEach(() => {
    chalk.level = 0;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should export analyzeSecurityBlastRadius function', () => {
    expect(analyzeSecurityBlastRadius).toBeDefined();
    expect(typeof analyzeSecurityBlastRadius).toBe('function');
  });

  it('should accept target and options parameters', () => {
    // Check function signature
    expect(analyzeSecurityBlastRadius.length).toBeGreaterThanOrEqual(2);
  });
});
