import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import { createUpdateCommand } from '../update.js';

describe('update command', () => {
  beforeEach(() => {
    chalk.level = 0;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create update command', () => {
    const updateCmd = createUpdateCommand();
    expect(updateCmd).toBeDefined();
    expect(updateCmd.name()).toBe('update');
  });

  it('should have description mentioning sync or update', () => {
    const updateCmd = createUpdateCommand();
    const desc = updateCmd.description();
    expect(desc.toLowerCase()).toMatch(/sync|update|incremental/);
  });

  it('should have project-root option', () => {
    const updateCmd = createUpdateCommand();
    const options = updateCmd.options;
    const projectRootOption = options.find((opt: { flags: string }) =>
      opt.flags.includes('--project-root')
    );
    expect(projectRootOption).toBeDefined();
  });

  it('should have workbench option', () => {
    const updateCmd = createUpdateCommand();
    const options = updateCmd.options;
    const workbenchOption = options.find((opt: { flags: string }) =>
      opt.flags.includes('--workbench')
    );
    expect(workbenchOption).toBeDefined();
  });
});
