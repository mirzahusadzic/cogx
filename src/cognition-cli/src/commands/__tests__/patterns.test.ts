import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import chalk from 'chalk';
import { addPatternsCommands } from '../patterns.js';

describe('patterns command', () => {
  let program: Command;

  beforeEach(() => {
    // Disable chalk colors for consistent test assertions
    chalk.level = 0;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Create a new program instance for each test
    program = new Command();
    addPatternsCommands(program);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('main patterns command', () => {
    it('should add patterns command to program', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      expect(patternsCmd).toBeDefined();
    });

    it('should have correct description', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const desc = patternsCmd?.description();
      expect(desc).toContain('patterns');
    });

    it('should have all subcommands', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const subcommandNames = patternsCmd?.commands.map((cmd) => cmd.name());

      expect(subcommandNames).toContain('find-similar');
      expect(subcommandNames).toContain('analyze');
      expect(subcommandNames).toContain('list');
      expect(subcommandNames).toContain('inspect');
      expect(subcommandNames).toContain('graph');
      expect(subcommandNames).toContain('compare');
    });
  });

  describe('find-similar subcommand', () => {
    it('should exist with correct name', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const findSimilarCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'find-similar'
      );
      expect(findSimilarCmd).toBeDefined();
    });

    it('should require symbol argument', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const findSimilarCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'find-similar'
      );
      const usage = findSimilarCmd?.usage();
      expect(usage).toMatch(/<symbol>/);
    });

    it('should have top-k option', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const findSimilarCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'find-similar'
      );
      const options = findSimilarCmd?.options;
      const topKOption = options?.find((opt) => opt.flags.includes('--top-k'));
      expect(topKOption).toBeDefined();
    });

    it('should have type option', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const findSimilarCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'find-similar'
      );
      const options = findSimilarCmd?.options;
      const typeOption = options?.find((opt) => opt.flags.includes('--type'));
      expect(typeOption).toBeDefined();
    });

    it('should have json option', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const findSimilarCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'find-similar'
      );
      const options = findSimilarCmd?.options;
      const jsonOption = options?.find((opt) => opt.flags.includes('--json'));
      expect(jsonOption).toBeDefined();
    });
  });

  describe('analyze subcommand', () => {
    it('should exist with correct description', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const analyzeCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'analyze'
      );
      expect(analyzeCmd).toBeDefined();
      expect(analyzeCmd?.description()).toContain('Analyze');
    });

    it('should have type option', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const analyzeCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'analyze'
      );
      const options = analyzeCmd?.options;
      const typeOption = options?.find((opt) => opt.flags.includes('--type'));
      expect(typeOption).toBeDefined();
    });

    it('should have verbose option', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const analyzeCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'analyze'
      );
      const options = analyzeCmd?.options;
      const verboseOption = options?.find((opt) =>
        opt.flags.includes('--verbose')
      );
      expect(verboseOption).toBeDefined();
    });
  });

  describe('list subcommand', () => {
    it('should exist with correct description', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const listCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'list'
      );
      expect(listCmd).toBeDefined();
      expect(listCmd?.description()).toContain('List');
    });

    it('should have role option', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const listCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'list'
      );
      const options = listCmd?.options;
      const roleOption = options?.find((opt) => opt.flags.includes('--role'));
      expect(roleOption).toBeDefined();
    });

    it('should have type option', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const listCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'list'
      );
      const options = listCmd?.options;
      const typeOption = options?.find((opt) => opt.flags.includes('--type'));
      expect(typeOption).toBeDefined();
    });
  });

  describe('inspect subcommand', () => {
    it('should exist with correct description', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const inspectCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'inspect'
      );
      expect(inspectCmd).toBeDefined();
      expect(inspectCmd?.description()).toContain('information');
    });

    it('should require symbol argument', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const inspectCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'inspect'
      );
      const usage = inspectCmd?.usage();
      expect(usage).toMatch(/<symbol>/);
    });
  });

  describe('graph subcommand', () => {
    it('should exist with correct description', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const graphCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'graph'
      );
      expect(graphCmd).toBeDefined();
      expect(graphCmd?.description()).toContain('dependency graph');
    });

    it('should require symbol argument', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const graphCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'graph'
      );
      const usage = graphCmd?.usage();
      expect(usage).toMatch(/<symbol>/);
    });

    it('should have json option', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const graphCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'graph'
      );
      const options = graphCmd?.options;
      const jsonOption = options?.find((opt) => opt.flags.includes('--json'));
      expect(jsonOption).toBeDefined();
    });

    it('should have max-depth option', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const graphCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'graph'
      );
      const options = graphCmd?.options;
      const maxDepthOption = options?.find((opt) =>
        opt.flags.includes('--max-depth')
      );
      expect(maxDepthOption).toBeDefined();
    });
  });

  describe('compare subcommand', () => {
    it('should exist with correct description', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const compareCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'compare'
      );
      expect(compareCmd).toBeDefined();
      expect(compareCmd?.description()).toContain('Compare');
    });

    it('should require two symbol arguments', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const compareCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'compare'
      );
      const usage = compareCmd?.usage();
      expect(usage).toMatch(/<symbol1>/);
      expect(usage).toMatch(/<symbol2>/);
    });

    it('should have type option', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const compareCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'compare'
      );
      const options = compareCmd?.options;
      const typeOption = options?.find((opt) => opt.flags.includes('--type'));
      expect(typeOption).toBeDefined();
    });
  });

  describe('pattern type validation', () => {
    it('should support structural pattern type by default', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const findSimilarCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'find-similar'
      );
      const typeOption = findSimilarCmd?.options.find((opt) =>
        opt.flags.includes('--type')
      );
      expect(typeOption?.defaultValue).toBe('structural');
    });

    it('should support lineage pattern type in find-similar', () => {
      const patternsCmd = program.commands.find(
        (cmd) => cmd.name() === 'patterns'
      );
      const findSimilarCmd = patternsCmd?.commands.find(
        (cmd) => cmd.name() === 'find-similar'
      );
      const typeOption = findSimilarCmd?.options.find((opt) =>
        opt.flags.includes('--type')
      );
      expect(typeOption).toBeDefined();
      const helpText = findSimilarCmd?.helpInformation();
      // Should mention both structural and lineage in help text
      expect(helpText).toContain('structural');
    });
  });
});
