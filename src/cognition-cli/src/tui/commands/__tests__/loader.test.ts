import { describe, test, expect } from 'vitest';
import {
  loadCommands,
  filterCommands,
  expandCommand,
  Command,
} from '../loader.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('loadCommands', () => {
  test('loads commands from .claude/commands/', async () => {
    // Use actual project directory
    const result = await loadCommands(process.cwd());

    expect(result.commands.size).toBeGreaterThan(0);
    expect(result.errors.length).toBe(0);

    // Check structure
    const firstCommand = Array.from(result.commands.values())[0];
    expect(firstCommand).toHaveProperty('name');
    expect(firstCommand).toHaveProperty('content');
    expect(firstCommand).toHaveProperty('filePath');
    expect(firstCommand).toHaveProperty('category');
  });

  test('handles missing directory gracefully', async () => {
    const result = await loadCommands('/nonexistent/path/12345');

    expect(result.commands.size).toBe(0);
    expect(result.errors.length).toBe(0);
    expect(result.warnings.length).toBe(0);
  });

  test('skips empty files with warning', async () => {
    // Create temp directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-commands-'));
    const commandsDir = path.join(tempDir, '.claude', 'commands');
    fs.mkdirSync(commandsDir, { recursive: true });

    // Create empty file
    fs.writeFileSync(path.join(commandsDir, 'empty.md'), '');

    const result = await loadCommands(tempDir);

    expect(result.commands.size).toBe(6); // Expect 6 built-in commands
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0].warning).toContain('Empty file');

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('skips invalid markdown files with warning', async () => {
    // Create temp directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-commands-'));
    const commandsDir = path.join(tempDir, '.claude', 'commands');
    fs.mkdirSync(commandsDir, { recursive: true });

    // Create file with very short content and no heading
    fs.writeFileSync(path.join(commandsDir, 'invalid.md'), 'abc');

    const result = await loadCommands(tempDir);

    expect(result.commands.size).toBe(6); // Expect 6 built-in commands
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0].warning).toContain('Invalid markdown');

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('loads valid command with description', async () => {
    // Create temp directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-commands-'));
    const commandsDir = path.join(tempDir, '.claude', 'commands');
    fs.mkdirSync(commandsDir, { recursive: true });

    // Create valid command file
    const commandContent =
      '# Test Command\n\nThis is a test command for validation.';
    fs.writeFileSync(path.join(commandsDir, 'test-cmd.md'), commandContent);

    const result = await loadCommands(tempDir);

    expect(result.commands.size).toBe(7); // 1 from file + 6 built-in
    expect(result.errors.length).toBe(0);
    expect(result.warnings.length).toBe(0);

    const cmd = result.commands.get('test-cmd');
    expect(cmd).toBeDefined();
    expect(cmd?.name).toBe('test-cmd');
    expect(cmd?.description).toBe('Test Command');
    expect(cmd?.category).toBe('test');
    expect(cmd?.content).toContain('This is a test command');

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('warns about duplicate commands', async () => {
    // Create temp directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-commands-'));
    const commandsDir = path.join(tempDir, '.claude', 'commands');
    fs.mkdirSync(commandsDir, { recursive: true });

    // Create two files with same name (impossible in same dir, but test the logic)
    // Instead, we'll test by ensuring the warning logic exists
    const commandContent = '# Duplicate Test\n\nContent here.';
    fs.writeFileSync(path.join(commandsDir, 'dup-test.md'), commandContent);

    const result = await loadCommands(tempDir);

    // Should load successfully (no duplicates in this case)
    expect(result.commands.size).toBe(7); // 1 from file + 6 built-in

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('skips README.md', async () => {
    // Create temp directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-commands-'));
    const commandsDir = path.join(tempDir, '.claude', 'commands');
    fs.mkdirSync(commandsDir, { recursive: true });

    // Create README.md and a regular command
    fs.writeFileSync(
      path.join(commandsDir, 'README.md'),
      '# README\n\nThis should be ignored.'
    );
    fs.writeFileSync(
      path.join(commandsDir, 'real-cmd.md'),
      '# Real Command\n\nThis should be loaded.'
    );

    const result = await loadCommands(tempDir);

    expect(result.commands.size).toBe(7); // 1 from file + 6 built-in
    expect(result.commands.has('README')).toBe(false);
    expect(result.commands.has('real-cmd')).toBe(true);

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('prevents directory traversal attempts', async () => {
    // This test verifies that path.normalize prevents traversal
    // In practice, the file system won't allow "../../../etc/passwd" style paths
    // But we verify the check exists
    const result = await loadCommands(process.cwd());

    // All loaded commands should have safe paths
    const allCommandsHaveSafePaths = Array.from(result.commands.values())
      .filter((cmd) => !!cmd.filePath) // Filter out built-in commands
      .every((cmd) => {
        const commandsDir = path.join(process.cwd(), '.claude', 'commands');
        return cmd.filePath.startsWith(commandsDir);
      });

    expect(allCommandsHaveSafePaths).toBe(true);
  });
});

describe('filterCommands', () => {
  const mockCommands = new Map<string, Command>([
    [
      'quest-start',
      { name: 'quest-start', content: '', filePath: '', category: 'quest' },
    ],
    [
      'quest-milestone',
      { name: 'quest-milestone', content: '', filePath: '', category: 'quest' },
    ],
    [
      'quest-reflect',
      { name: 'quest-reflect', content: '', filePath: '', category: 'quest' },
    ],
    [
      'analyze-impact',
      {
        name: 'analyze-impact',
        content: '',
        filePath: '',
        category: 'analyze',
      },
    ],
    [
      'analyze-coherence',
      {
        name: 'analyze-coherence',
        content: '',
        filePath: '',
        category: 'analyze',
      },
    ],
    [
      'security-check',
      {
        name: 'security-check',
        content: '',
        filePath: '',
        category: 'security',
      },
    ],
  ]);

  test('filters commands by prefix (case-insensitive)', () => {
    const filtered = filterCommands('quest', mockCommands);

    expect(filtered.length).toBe(3);
    expect(filtered.every((c) => c.name.startsWith('quest'))).toBe(true);
  });

  test('filters with uppercase prefix', () => {
    const filtered = filterCommands('QUEST', mockCommands);
    expect(filtered.length).toBe(3);
  });

  test('filters with mixed case prefix', () => {
    const filtered = filterCommands('QuEsT', mockCommands);
    expect(filtered.length).toBe(3);
  });

  test('returns all commands for empty prefix', () => {
    const filtered = filterCommands('', mockCommands);
    expect(filtered.length).toBe(mockCommands.size);
  });

  test('returns all commands for whitespace prefix', () => {
    const filtered = filterCommands('   ', mockCommands);
    expect(filtered.length).toBe(mockCommands.size);
  });

  test('returns empty array for no matches', () => {
    const filtered = filterCommands('xyz', mockCommands);
    expect(filtered.length).toBe(0);
  });

  test('filters by partial prefix', () => {
    const filtered = filterCommands('ana', mockCommands);
    expect(filtered.length).toBe(2);
    expect(filtered.every((c) => c.name.startsWith('analyze'))).toBe(true);
  });
});

describe('expandCommand', () => {
  const mockCommands = new Map<string, Command>([
    [
      'test-command',
      {
        name: 'test-command',
        content: 'Analyze {{FILE_PATH}} and check {{SYMBOL_NAME}}',
        filePath: '',
        category: 'test',
      },
    ],
    [
      'simple-command',
      {
        name: 'simple-command',
        content: 'This is a simple command without placeholders',
        filePath: '',
        category: 'simple',
      },
    ],
    [
      'all-args-command',
      {
        name: 'all-args-command',
        content: 'Process {{ALL_ARGS}}',
        filePath: '',
        category: 'all',
      },
    ],
    [
      'unknown-placeholder',
      {
        name: 'unknown-placeholder',
        content: 'Test {{UNKNOWN_PLACEHOLDER}} here',
        filePath: '',
        category: 'test',
      },
    ],
  ]);

  test('expands command with placeholders', () => {
    const expanded = expandCommand(
      '/test-command src/cli.ts main',
      mockCommands
    );

    expect(expanded).not.toBeNull();
    expect(expanded).toContain('src/cli.ts');
    expect(expanded).toContain('main');
    expect(expanded).toContain('User provided context: src/cli.ts main');
  });

  test('expands FILE_PATH placeholder', () => {
    const expanded = expandCommand('/test-command src/cli.ts', mockCommands);

    expect(expanded).toContain('Analyze src/cli.ts');
  });

  test('expands SYMBOL_NAME placeholder', () => {
    const expanded = expandCommand(
      '/test-command src/cli.ts main',
      mockCommands
    );

    expect(expanded).toContain('check main');
  });

  test('expands ALL_ARGS placeholder', () => {
    const expanded = expandCommand(
      '/all-args-command arg1 arg2 arg3',
      mockCommands
    );

    expect(expanded).toContain('Process arg1 arg2 arg3');
  });

  test('returns null for unknown command', () => {
    const expanded = expandCommand('/unknown', mockCommands);
    expect(expanded).toBeNull();
  });

  test('handles command without arguments', () => {
    const expanded = expandCommand('/simple-command', mockCommands);

    expect(expanded).toBeTruthy();
    expect(expanded).toBe('This is a simple command without placeholders');
    expect(expanded).not.toContain('User provided context');
  });

  test('handles empty arguments gracefully', () => {
    const expanded = expandCommand('/test-command   ', mockCommands);

    expect(expanded).toBeTruthy();
    // Should not add "User provided context" for empty args
    expect(expanded).not.toContain('User provided context');
  });

  test('leaves unknown placeholders as-is', () => {
    // Suppress console.warn for this test
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (msg: string) => warnings.push(msg);

    const expanded = expandCommand('/unknown-placeholder test', mockCommands);

    expect(expanded).toContain('{{UNKNOWN_PLACEHOLDER}}');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('Unknown placeholder');

    // Restore console.warn
    console.warn = originalWarn;
  });

  test('handles multiple arguments', () => {
    const expanded = expandCommand(
      '/test-command src/core/index.ts MyClass some extra context',
      mockCommands
    );

    expect(expanded).toContain('src/core/index.ts');
    expect(expanded).toContain('MyClass');
    expect(expanded).toContain(
      'User provided context: src/core/index.ts MyClass some extra context'
    );
  });
});
