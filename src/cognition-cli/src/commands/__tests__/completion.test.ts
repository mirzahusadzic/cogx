import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import { createCompletionCommand } from '../completion.js';

describe('completion command', () => {
  beforeEach(() => {
    chalk.level = 0;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('main completion command', () => {
    it('should create completion command', () => {
      const completionCmd = createCompletionCommand();
      expect(completionCmd).toBeDefined();
      expect(completionCmd.name()).toBe('completion');
    });

    it('should have correct description', () => {
      const completionCmd = createCompletionCommand();
      const desc = completionCmd.description();
      expect(desc).toContain('completion');
    });

    it('should have install and uninstall subcommands', () => {
      const completionCmd = createCompletionCommand();
      const subcommandNames = completionCmd.commands.map((cmd) => cmd.name());

      expect(subcommandNames).toContain('install');
      expect(subcommandNames).toContain('uninstall');
    });
  });

  describe('install subcommand', () => {
    it('should exist with correct description', () => {
      const completionCmd = createCompletionCommand();
      const installCmd = completionCmd.commands.find(
        (cmd) => cmd.name() === 'install'
      );
      expect(installCmd).toBeDefined();
      expect(installCmd?.description()).toContain('Install');
    });

    it('should have shell option', () => {
      const completionCmd = createCompletionCommand();
      const installCmd = completionCmd.commands.find(
        (cmd) => cmd.name() === 'install'
      );
      const options = installCmd?.options;
      const shellOption = options?.find((opt) => opt.flags.includes('--shell'));
      expect(shellOption).toBeDefined();
    });
  });

  describe('uninstall subcommand', () => {
    it('should exist with correct description', () => {
      const completionCmd = createCompletionCommand();
      const uninstallCmd = completionCmd.commands.find(
        (cmd) => cmd.name() === 'uninstall'
      );
      expect(uninstallCmd).toBeDefined();
      expect(uninstallCmd?.description()).toContain('Uninstall');
    });

    it('should have shell option', () => {
      const completionCmd = createCompletionCommand();
      const uninstallCmd = completionCmd.commands.find(
        (cmd) => cmd.name() === 'uninstall'
      );
      const options = uninstallCmd?.options;
      const shellOption = options?.find((opt) => opt.flags.includes('--shell'));
      expect(shellOption).toBeDefined();
    });
  });

  describe('shell support', () => {
    it('should support bash, zsh, and fish shells', () => {
      const completionCmd = createCompletionCommand();
      const helpText = completionCmd.helpInformation();
      expect(helpText).toContain('bash');
      expect(helpText).toContain('zsh');
      expect(helpText).toContain('fish');
    });
  });
});
