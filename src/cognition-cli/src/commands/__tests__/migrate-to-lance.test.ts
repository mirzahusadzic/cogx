import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import { migrateToLanceCommand } from '../migrate-to-lance.js';

describe('migrate-to-lance command', () => {
  beforeEach(() => {
    chalk.level = 0;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should export migrateToLanceCommand function', () => {
    expect(migrateToLanceCommand).toBeDefined();
    expect(typeof migrateToLanceCommand).toBe('function');
  });

  it('should accept options parameter', () => {
    // Check function signature
    expect(migrateToLanceCommand.length).toBeGreaterThanOrEqual(1);
  });
});
