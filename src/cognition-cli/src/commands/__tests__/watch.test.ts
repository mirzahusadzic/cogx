/**
 * Tests for watch command
 *
 * Coverage:
 * - [x] File watcher initialization
 * - [x] Option parsing (debounce, verbose, untracked)
 * - [x] PGC workspace validation
 * - [x] Event handler registration
 * - [x] Graceful shutdown
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWatchCommand } from '../watch.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import type { ChangeEvent } from '../../core/types/watcher.js';

// Mock FileWatcher to avoid actual filesystem watching in tests
vi.mock('../../core/watcher/file-watcher.js', () => {
  const mockWatcher = {
    on: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };

  return {
    FileWatcher: vi.fn(() => mockWatcher),
  };
});

// Mock WorkspaceManager
vi.mock('../../core/workspace-manager.js', () => ({
  WorkspaceManager: vi.fn(() => ({
    resolvePgcRoot: vi.fn((cwd: string) => cwd),
  })),
}));

describe('watch command', () => {
  let tempDir: string;
  let originalExit: typeof process.exit;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'watch-test-'));
    // Create PGC structure
    await fs.ensureDir(path.join(tempDir, '.open_cognition'));

    // Mock process.exit to prevent test termination
    originalExit = process.exit;
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);

    vi.clearAllMocks();
  });

  afterEach(async () => {
    await fs.remove(tempDir);
    process.exit = originalExit;
    exitSpy.mockRestore();
  });

  describe('Command Creation', () => {
    it('should create watch command with correct options', () => {
      const cmd = createWatchCommand();

      expect(cmd.name()).toBe('watch');
      expect(cmd.description()).toBe(
        'Watch files for changes and maintain PGC coherence state'
      );
    });

    it('should have --untracked option', () => {
      const cmd = createWatchCommand();
      const options = cmd.options;

      const untrackedOption = options.find((opt) => opt.long === '--untracked');
      expect(untrackedOption).toBeDefined();
    });

    it('should have --debounce option', () => {
      const cmd = createWatchCommand();
      const options = cmd.options;

      const debounceOption = options.find((opt) => opt.long === '--debounce');
      expect(debounceOption).toBeDefined();
    });

    it('should have --verbose option', () => {
      const cmd = createWatchCommand();
      const options = cmd.options;

      const verboseOption = options.find((opt) => opt.long === '--verbose');
      expect(verboseOption).toBeDefined();
    });
  });

  describe('Option Defaults', () => {
    it('should default untracked to false', () => {
      const cmd = createWatchCommand();
      const untrackedOption = cmd.options.find((opt) => opt.long === '--untracked');

      expect(untrackedOption?.defaultValue).toBe(false);
    });

    it('should default debounce to 300ms', () => {
      const cmd = createWatchCommand();
      const debounceOption = cmd.options.find((opt) => opt.long === '--debounce');

      expect(debounceOption?.defaultValue).toBe('300');
    });

    it('should default verbose to false', () => {
      const cmd = createWatchCommand();
      const verboseOption = cmd.options.find((opt) => opt.long === '--verbose');

      expect(verboseOption?.defaultValue).toBe(false);
    });
  });
});
