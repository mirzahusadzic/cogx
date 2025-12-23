import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import { wizardCommand } from '../wizard.js';

describe('wizard command', () => {
  beforeEach(() => {
    chalk.level = 0;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should export wizardCommand function', () => {
    expect(wizardCommand).toBeDefined();
    expect(typeof wizardCommand).toBe('function');
  });

  it('should accept options parameter', () => {
    // Check function signature
    expect(wizardCommand.length).toBeGreaterThanOrEqual(1);
  });
});
