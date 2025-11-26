/**
 * Tests for config command
 *
 * Coverage:
 * - [x] createConfigCommand structure
 * - [x] Setting validation (editable keys, valid values)
 * - [x] JSON output mode
 * - [x] Get/Set operations
 * - [x] Reset preserves acknowledgment
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

// Mock the security-bootstrap module before importing config
const mockSettingsPath = path.join(os.tmpdir(), 'config-test-settings.json');
let mockSettings: Record<string, unknown> = { version: '1.0' };

vi.mock('../../core/security/security-bootstrap.js', () => ({
  loadSettings: vi.fn(() => mockSettings),
  saveSettings: vi.fn((settings) => {
    mockSettings = settings;
    fs.writeFileSync(mockSettingsPath, JSON.stringify(settings, null, 2));
  }),
  getSettingsPath: vi.fn(() => mockSettingsPath),
  Settings: {},
}));

import { createConfigCommand } from '../config.js';

describe('config command', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset mock settings
    mockSettings = { version: '1.0' };

    // Spy on console
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock process.exit to throw instead of exiting
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    // Clear env vars
    delete process.env.COGNITION_FORMAT;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();

    // Cleanup test file
    try {
      fs.unlinkSync(mockSettingsPath);
    } catch {
      // Ignore if doesn't exist
    }
  });

  describe('Command Structure', () => {
    it('should create a config command with correct name', () => {
      const cmd = createConfigCommand();
      expect(cmd.name()).toBe('config');
    });

    it('should have subcommands: list, get, set, path, reset', () => {
      const cmd = createConfigCommand();
      const subcommands = cmd.commands.map((c) => c.name());

      expect(subcommands).toContain('list');
      expect(subcommands).toContain('get');
      expect(subcommands).toContain('set');
      expect(subcommands).toContain('path');
      expect(subcommands).toContain('reset');
    });

    it('should have description', () => {
      const cmd = createConfigCommand();
      expect(cmd.description()).toContain('settings');
    });
  });

  describe('List Settings', () => {
    it('should display settings with version', async () => {
      const cmd = createConfigCommand();

      await cmd.parseAsync(['node', 'config', 'list']);

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.flat().join('\n');
      expect(output).toContain('version');
    });

    it('should output JSON when COGNITION_FORMAT=json', async () => {
      process.env.COGNITION_FORMAT = 'json';
      mockSettings = { version: '1.0', defaultProvider: 'claude' };

      const cmd = createConfigCommand();

      await cmd.parseAsync(['node', 'config', 'list']);

      const output = consoleLogSpy.mock.calls.flat().join('');
      expect(() => JSON.parse(output)).not.toThrow();
    });
  });

  describe('Get Setting', () => {
    it('should get defaultProvider value', async () => {
      mockSettings = { version: '1.0', defaultProvider: 'gemini' };

      const cmd = createConfigCommand();

      await cmd.parseAsync(['node', 'config', 'get', 'defaultProvider']);

      const output = consoleLogSpy.mock.calls.flat().join('\n');
      expect(output).toContain('gemini');
    });

    it('should show error for unknown setting', async () => {
      const cmd = createConfigCommand();

      await expect(
        cmd.parseAsync(['node', 'config', 'get', 'unknownKey'])
      ).rejects.toThrow('process.exit(1)');

      const output = consoleLogSpy.mock.calls.flat().join('\n');
      expect(output).toContain('not set');
    });

    it('should output JSON when COGNITION_FORMAT=json', async () => {
      process.env.COGNITION_FORMAT = 'json';
      mockSettings = { version: '1.0', defaultProvider: 'claude' };

      const cmd = createConfigCommand();

      await cmd.parseAsync(['node', 'config', 'get', 'defaultProvider']);

      const output = consoleLogSpy.mock.calls.flat().join('');
      const parsed = JSON.parse(output);
      expect(parsed.defaultProvider).toBe('claude');
    });
  });

  describe('Set Setting', () => {
    it('should set defaultProvider to valid value', async () => {
      const cmd = createConfigCommand();

      // Parse from the parent command with subcommand
      await cmd.parseAsync([
        'node',
        'config',
        'set',
        'defaultProvider',
        'gemini',
      ]);

      expect(mockSettings.defaultProvider).toBe('gemini');
    });

    it('should reject invalid key', async () => {
      const cmd = createConfigCommand();

      await expect(
        cmd.parseAsync(['node', 'config', 'set', 'invalidKey', 'value'])
      ).rejects.toThrow('process.exit(1)');

      const errorOutput = consoleErrorSpy.mock.calls.flat().join('\n');
      expect(errorOutput).toContain('not an editable setting');
    });

    it('should reject invalid value for defaultProvider', async () => {
      const cmd = createConfigCommand();

      await expect(
        cmd.parseAsync(['node', 'config', 'set', 'defaultProvider', 'invalid'])
      ).rejects.toThrow('process.exit(1)');

      const errorOutput = consoleErrorSpy.mock.calls.flat().join('\n');
      expect(errorOutput).toContain('not a valid value');
    });

    it('should accept claude as valid provider', async () => {
      const cmd = createConfigCommand();

      await cmd.parseAsync([
        'node',
        'config',
        'set',
        'defaultProvider',
        'claude',
      ]);

      expect(mockSettings.defaultProvider).toBe('claude');
    });
  });

  describe('Path Command', () => {
    it('should output settings path', async () => {
      const cmd = createConfigCommand();

      await cmd.parseAsync(['node', 'config', 'path']);

      const output = consoleLogSpy.mock.calls.flat().join('\n');
      expect(output).toContain(mockSettingsPath);
    });
  });

  describe('Reset Command', () => {
    it('should reset settings to defaults', async () => {
      mockSettings = {
        version: '1.0',
        defaultProvider: 'gemini',
        dual_use_acknowledgment: {
          timestamp: '2025-01-01T00:00:00.000Z',
          user: 'test',
          hostname: 'test-host',
        },
      };

      const cmd = createConfigCommand();

      await cmd.parseAsync(['node', 'config', 'reset']);

      expect(mockSettings.version).toBe('1.0');
      expect(mockSettings.defaultProvider).toBeUndefined();
    });

    it('should preserve dual_use_acknowledgment on reset', async () => {
      const acknowledgment = {
        timestamp: '2025-01-01T00:00:00.000Z',
        user: 'test',
        hostname: 'test-host',
      };
      mockSettings = {
        version: '1.0',
        defaultProvider: 'gemini',
        dual_use_acknowledgment: acknowledgment,
      };

      const cmd = createConfigCommand();

      await cmd.parseAsync(['node', 'config', 'reset']);

      expect(mockSettings.dual_use_acknowledgment).toEqual(acknowledgment);
    });
  });
});
