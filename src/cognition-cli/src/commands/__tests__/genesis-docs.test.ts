import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import { genesisDocsCommand } from '../genesis-docs.js';

describe('genesis-docs command', () => {
  beforeEach(() => {
    chalk.level = 0;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should export genesisDocsCommand function', () => {
    expect(genesisDocsCommand).toBeDefined();
    expect(typeof genesisDocsCommand).toBe('function');
  });

  it('should accept paths and options parameters', () => {
    // Check function signature
    expect(genesisDocsCommand.length).toBeGreaterThanOrEqual(2);
  });
});
