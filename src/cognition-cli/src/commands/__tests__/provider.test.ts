import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import { createProviderCommand } from '../provider.js';

describe('provider command', () => {
  beforeEach(() => {
    chalk.level = 0;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('main provider command', () => {
    it('should create provider command', () => {
      const providerCmd = createProviderCommand();
      expect(providerCmd).toBeDefined();
      expect(providerCmd.name()).toBe('provider');
    });

    it('should have correct description', () => {
      const providerCmd = createProviderCommand();
      const desc = providerCmd.description();
      expect(desc).toContain('LLM');
    });

    it('should have all subcommands', () => {
      const providerCmd = createProviderCommand();
      const subcommandNames = providerCmd.commands.map((cmd) => cmd.name());

      expect(subcommandNames).toContain('list');
      expect(subcommandNames).toContain('test');
      expect(subcommandNames).toContain('set-default');
      expect(subcommandNames).toContain('config');
    });
  });

  describe('list subcommand', () => {
    it('should exist with correct description', () => {
      const providerCmd = createProviderCommand();
      const listCmd = providerCmd.commands.find((cmd) => cmd.name() === 'list');
      expect(listCmd).toBeDefined();
      expect(listCmd?.description()).toContain('provider');
    });
  });

  describe('test subcommand', () => {
    it('should exist and require provider argument', () => {
      const providerCmd = createProviderCommand();
      const testCmd = providerCmd.commands.find((cmd) => cmd.name() === 'test');
      expect(testCmd).toBeDefined();
      const usage = testCmd?.usage();
      expect(usage).toMatch(/<provider>/);
    });
  });

  describe('set-default subcommand', () => {
    it('should exist and require provider argument', () => {
      const providerCmd = createProviderCommand();
      const setDefaultCmd = providerCmd.commands.find(
        (cmd) => cmd.name() === 'set-default'
      );
      expect(setDefaultCmd).toBeDefined();
      const usage = setDefaultCmd?.usage();
      expect(usage).toMatch(/<provider>/);
    });
  });

  describe('config subcommand', () => {
    it('should exist with correct description', () => {
      const providerCmd = createProviderCommand();
      const configCmd = providerCmd.commands.find(
        (cmd) => cmd.name() === 'config'
      );
      expect(configCmd).toBeDefined();
      expect(configCmd?.description()).toContain('config');
    });
  });
});
