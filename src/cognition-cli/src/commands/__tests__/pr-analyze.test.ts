import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import { analyzePRImpact } from '../pr-analyze.js';

describe('pr-analyze command', () => {
  beforeEach(() => {
    chalk.level = 0;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should export analyzePRImpact function', () => {
    expect(analyzePRImpact).toBeDefined();
    expect(typeof analyzePRImpact).toBe('function');
  });

  it('should accept options and PGCManager parameters', () => {
    // Check function signature
    expect(analyzePRImpact.length).toBeGreaterThanOrEqual(2);
  });
});
