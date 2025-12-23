import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import chalk from 'chalk';
import { addConceptsCommands } from '../concepts.js';

describe('concepts command', () => {
  let program: Command;

  beforeEach(() => {
    // Disable chalk colors for consistent test assertions
    chalk.level = 0;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Create a new program instance for each test
    program = new Command();
    addConceptsCommands(program);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('main concepts command', () => {
    it('should add concepts command to program', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      expect(conceptsCmd).toBeDefined();
    });

    it('should have correct description', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const desc = conceptsCmd?.description();
      expect(desc).toContain('mission concepts');
    });

    it('should have all subcommands', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const subcommandNames = conceptsCmd?.commands.map((cmd) => cmd.name());

      expect(subcommandNames).toContain('list');
      expect(subcommandNames).toContain('top');
      expect(subcommandNames).toContain('search');
      expect(subcommandNames).toContain('by-section');
      expect(subcommandNames).toContain('inspect');
    });
  });

  describe('list subcommand', () => {
    it('should exist with correct description', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const listCmd = conceptsCmd?.commands.find(
        (cmd) => cmd.name() === 'list'
      );
      expect(listCmd).toBeDefined();
      expect(listCmd?.description()).toContain('List');
    });

    it('should have project-root option', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const listCmd = conceptsCmd?.commands.find(
        (cmd) => cmd.name() === 'list'
      );
      const options = listCmd?.options;
      const projectRootOption = options?.find((opt) =>
        opt.flags.includes('--project-root')
      );
      expect(projectRootOption).toBeDefined();
    });

    it('should have json option', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const listCmd = conceptsCmd?.commands.find(
        (cmd) => cmd.name() === 'list'
      );
      const options = listCmd?.options;
      const jsonOption = options?.find((opt) => opt.flags.includes('--json'));
      expect(jsonOption).toBeDefined();
    });

    it('should have limit option', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const listCmd = conceptsCmd?.commands.find(
        (cmd) => cmd.name() === 'list'
      );
      const options = listCmd?.options;
      const limitOption = options?.find((opt) => opt.flags.includes('--limit'));
      expect(limitOption).toBeDefined();
      expect(limitOption?.defaultValue).toBe('100');
    });
  });

  describe('top subcommand', () => {
    it('should exist with correct description', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const topCmd = conceptsCmd?.commands.find((cmd) => cmd.name() === 'top');
      expect(topCmd).toBeDefined();
      expect(topCmd?.description()).toContain('top');
      expect(topCmd?.description()).toContain('weight');
    });

    it('should have optional count argument', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const topCmd = conceptsCmd?.commands.find((cmd) => cmd.name() === 'top');
      const usage = topCmd?.usage();
      expect(usage).toMatch(/\[count\]/);
    });

    it('should have project-root option', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const topCmd = conceptsCmd?.commands.find((cmd) => cmd.name() === 'top');
      const options = topCmd?.options;
      const projectRootOption = options?.find((opt) =>
        opt.flags.includes('--project-root')
      );
      expect(projectRootOption).toBeDefined();
    });

    it('should have json option', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const topCmd = conceptsCmd?.commands.find((cmd) => cmd.name() === 'top');
      const options = topCmd?.options;
      const jsonOption = options?.find((opt) => opt.flags.includes('--json'));
      expect(jsonOption).toBeDefined();
    });
  });

  describe('search subcommand', () => {
    it('should exist with correct description', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const searchCmd = conceptsCmd?.commands.find(
        (cmd) => cmd.name() === 'search'
      );
      expect(searchCmd).toBeDefined();
      expect(searchCmd?.description()).toContain('Find');
      expect(searchCmd?.description()).toContain('keyword');
    });

    it('should require keyword argument', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const searchCmd = conceptsCmd?.commands.find(
        (cmd) => cmd.name() === 'search'
      );
      const usage = searchCmd?.usage();
      expect(usage).toMatch(/<keyword>/);
    });

    it('should have project-root option', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const searchCmd = conceptsCmd?.commands.find(
        (cmd) => cmd.name() === 'search'
      );
      const options = searchCmd?.options;
      const projectRootOption = options?.find((opt) =>
        opt.flags.includes('--project-root')
      );
      expect(projectRootOption).toBeDefined();
    });

    it('should have json option', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const searchCmd = conceptsCmd?.commands.find(
        (cmd) => cmd.name() === 'search'
      );
      const options = searchCmd?.options;
      const jsonOption = options?.find((opt) => opt.flags.includes('--json'));
      expect(jsonOption).toBeDefined();
    });
  });

  describe('by-section subcommand', () => {
    it('should exist with correct description', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const bySectionCmd = conceptsCmd?.commands.find(
        (cmd) => cmd.name() === 'by-section'
      );
      expect(bySectionCmd).toBeDefined();
      expect(bySectionCmd?.description()).toContain('section');
    });

    it('should require section argument', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const bySectionCmd = conceptsCmd?.commands.find(
        (cmd) => cmd.name() === 'by-section'
      );
      const usage = bySectionCmd?.usage();
      expect(usage).toMatch(/<section>/);
    });

    it('should mention example sections in description', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const bySectionCmd = conceptsCmd?.commands.find(
        (cmd) => cmd.name() === 'by-section'
      );
      const desc = bySectionCmd?.description();
      // Description mentions Vision, Mission, Principles as examples
      expect(desc).toMatch(/Vision|Mission|Principles/);
    });

    it('should have project-root option', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const bySectionCmd = conceptsCmd?.commands.find(
        (cmd) => cmd.name() === 'by-section'
      );
      const options = bySectionCmd?.options;
      const projectRootOption = options?.find((opt) =>
        opt.flags.includes('--project-root')
      );
      expect(projectRootOption).toBeDefined();
    });

    it('should have json option', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const bySectionCmd = conceptsCmd?.commands.find(
        (cmd) => cmd.name() === 'by-section'
      );
      const options = bySectionCmd?.options;
      const jsonOption = options?.find((opt) => opt.flags.includes('--json'));
      expect(jsonOption).toBeDefined();
    });
  });

  describe('inspect subcommand', () => {
    it('should exist with correct description', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const inspectCmd = conceptsCmd?.commands.find(
        (cmd) => cmd.name() === 'inspect'
      );
      expect(inspectCmd).toBeDefined();
      expect(inspectCmd?.description()).toContain('detailed');
    });

    it('should require text argument', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const inspectCmd = conceptsCmd?.commands.find(
        (cmd) => cmd.name() === 'inspect'
      );
      const usage = inspectCmd?.usage();
      expect(usage).toMatch(/<text>/);
    });

    it('should have project-root option', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const inspectCmd = conceptsCmd?.commands.find(
        (cmd) => cmd.name() === 'inspect'
      );
      const options = inspectCmd?.options;
      const projectRootOption = options?.find((opt) =>
        opt.flags.includes('--project-root')
      );
      expect(projectRootOption).toBeDefined();
    });

    it('should have json option', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const inspectCmd = conceptsCmd?.commands.find(
        (cmd) => cmd.name() === 'inspect'
      );
      const options = inspectCmd?.options;
      const jsonOption = options?.find((opt) => opt.flags.includes('--json'));
      expect(jsonOption).toBeDefined();
    });
  });

  describe('common options across subcommands', () => {
    it('all subcommands should support json output', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const subcommands = conceptsCmd?.commands || [];

      for (const subcmd of subcommands) {
        const hasJsonOption = subcmd.options.some((opt) =>
          opt.flags.includes('--json')
        );
        expect(hasJsonOption).toBe(true);
      }
    });

    it('all subcommands should support project-root option', () => {
      const conceptsCmd = program.commands.find(
        (cmd) => cmd.name() === 'concepts'
      );
      const subcommands = conceptsCmd?.commands || [];

      for (const subcmd of subcommands) {
        const hasProjectRootOption = subcmd.options.some((opt) =>
          opt.flags.includes('--project-root')
        );
        expect(hasProjectRootOption).toBe(true);
      }
    });
  });
});
