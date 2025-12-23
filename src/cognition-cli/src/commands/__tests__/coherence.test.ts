import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import chalk from 'chalk';
import { addCoherenceCommands } from '../coherence.js';

describe('coherence command', () => {
  let program: Command;

  beforeEach(() => {
    chalk.level = 0;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    program = new Command();
    addCoherenceCommands(program);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('main coherence command', () => {
    it('should add coherence command to program', () => {
      const coherenceCmd = program.commands.find(
        (cmd) => cmd.name() === 'coherence'
      );
      expect(coherenceCmd).toBeDefined();
    });

    it('should have correct description mentioning coherence', () => {
      const coherenceCmd = program.commands.find(
        (cmd) => cmd.name() === 'coherence'
      );
      const desc = coherenceCmd?.description();
      expect(desc).toContain('coherence');
    });

    it('should have all subcommands', () => {
      const coherenceCmd = program.commands.find(
        (cmd) => cmd.name() === 'coherence'
      );
      const subcommandNames = coherenceCmd?.commands.map((cmd) => cmd.name());

      expect(subcommandNames).toContain('report');
      expect(subcommandNames).toContain('aligned');
      expect(subcommandNames).toContain('drifted');
      expect(subcommandNames).toContain('list');
    });
  });

  describe('report subcommand', () => {
    it('should exist with metrics in description', () => {
      const coherenceCmd = program.commands.find(
        (cmd) => cmd.name() === 'coherence'
      );
      const reportCmd = coherenceCmd?.commands.find(
        (cmd) => cmd.name() === 'report'
      );
      expect(reportCmd).toBeDefined();
      expect(reportCmd?.description()).toContain('metrics');
    });

    it('should have common options', () => {
      const coherenceCmd = program.commands.find(
        (cmd) => cmd.name() === 'coherence'
      );
      const reportCmd = coherenceCmd?.commands.find(
        (cmd) => cmd.name() === 'report'
      );
      const options = reportCmd?.options;

      const projectRootOpt = options?.find((opt) =>
        opt.flags.includes('--project-root')
      );
      const jsonOpt = options?.find((opt) => opt.flags.includes('--json'));
      const verboseOpt = options?.find((opt) =>
        opt.flags.includes('--verbose')
      );

      expect(projectRootOpt).toBeDefined();
      expect(jsonOpt).toBeDefined();
      expect(verboseOpt).toBeDefined();
    });
  });

  describe('aligned subcommand', () => {
    it('should exist', () => {
      const coherenceCmd = program.commands.find(
        (cmd) => cmd.name() === 'coherence'
      );
      const alignedCmd = coherenceCmd?.commands.find(
        (cmd) => cmd.name() === 'aligned'
      );
      expect(alignedCmd).toBeDefined();
    });
  });

  describe('drifted subcommand', () => {
    it('should exist', () => {
      const coherenceCmd = program.commands.find(
        (cmd) => cmd.name() === 'coherence'
      );
      const driftedCmd = coherenceCmd?.commands.find(
        (cmd) => cmd.name() === 'drifted'
      );
      expect(driftedCmd).toBeDefined();
    });
  });

  describe('list subcommand', () => {
    it('should exist', () => {
      const coherenceCmd = program.commands.find(
        (cmd) => cmd.name() === 'coherence'
      );
      const listCmd = coherenceCmd?.commands.find(
        (cmd) => cmd.name() === 'list'
      );
      expect(listCmd).toBeDefined();
    });
  });
});
