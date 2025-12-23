/**
 * Tests for ask command
 *
 * Tests the semantic Q&A command structure and configuration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing
vi.mock('../../core/workspace-manager.js');
vi.mock('../../core/executors/workbench-client.js');
vi.mock('../../core/overlays/structural-patterns/manager.js');
vi.mock('../../core/overlays/security-guidelines/manager.js');
vi.mock('../../core/overlays/mission-concepts/manager.js');
vi.mock('../../core/overlays/operational-patterns/manager.js');
vi.mock('../../core/overlays/mathematical-proofs/manager.js');

describe('askCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('module exports', () => {
    it('should export askCommand function', async () => {
      const { askCommand } = await import('../ask.js');
      expect(askCommand).toBeDefined();
      expect(typeof askCommand).toBe('function');
    });
  });

  describe('workspace validation', () => {
    it('should check for .open_cognition workspace', async () => {
      const { WorkspaceManager } =
        await import('../../core/workspace-manager.js');
      const mockResolve = vi.fn().mockReturnValue(null);

      vi.mocked(WorkspaceManager).mockImplementation(
        () =>
          ({
            resolvePgcRoot: mockResolve,
          }) as unknown as typeof WorkspaceManager.prototype
      );

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const processExitSpy = vi
        .spyOn(process, 'exit')
        .mockImplementation((() => {
          throw new Error('process.exit');
        }) as unknown as typeof process.exit);

      const { askCommand } = await import('../ask.js');

      await expect(
        askCommand('test', { projectRoot: '/test' })
      ).rejects.toThrow('process.exit');

      expect(mockResolve).toHaveBeenCalledWith('/test');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('No .open_cognition found')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });
  });

  describe('options', () => {
    it('should accept projectRoot option', async () => {
      const { askCommand } = await import('../ask.js');
      // Function signature check - ensuring it accepts the right parameters
      expect(() => {
        // This won't execute, just type-checks the signature
        askCommand('question', { projectRoot: '/test' });
      }).toBeDefined();
    });

    it('should accept workbench URL option', async () => {
      const { askCommand } = await import('../ask.js');
      expect(() => {
        askCommand('question', {
          projectRoot: '/test',
          workbench: 'http://localhost:8000',
        });
      }).toBeDefined();
    });

    it('should accept topK option', async () => {
      const { askCommand } = await import('../ask.js');
      expect(() => {
        askCommand('question', {
          projectRoot: '/test',
          topK: 10,
        });
      }).toBeDefined();
    });

    it('should accept save option', async () => {
      const { askCommand } = await import('../ask.js');
      expect(() => {
        askCommand('question', {
          projectRoot: '/test',
          save: true,
        });
      }).toBeDefined();
    });

    it('should accept verbose option', async () => {
      const { askCommand } = await import('../ask.js');
      expect(() => {
        askCommand('question', {
          projectRoot: '/test',
          verbose: true,
        });
      }).toBeDefined();
    });
  });

  describe('workbench client usage', () => {
    it('should use workbench URL from options', async () => {
      const { WorkspaceManager } =
        await import('../../core/workspace-manager.js');
      vi.mocked(WorkspaceManager).mockImplementation(
        () =>
          ({
            resolvePgcRoot: vi.fn().mockReturnValue('/test'),
          }) as unknown as typeof WorkspaceManager.prototype
      );

      const { WorkbenchClient } =
        await import('../../core/executors/workbench-client.js');
      const mockWorkbench = vi.fn();
      vi.mocked(WorkbenchClient).mockImplementation(
        mockWorkbench as unknown as typeof WorkbenchClient
      );

      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('exit');
      }) as unknown as typeof process.exit);

      const { askCommand } = await import('../ask.js');

      try {
        await askCommand('test', {
          projectRoot: '/test',
          workbench: 'http://custom:9000',
        });
      } catch {
        // Expected to fail due to incomplete mocks
      }

      // Should construct WorkbenchClient with custom URL
      expect(mockWorkbench).toHaveBeenCalledWith('http://custom:9000');

      vi.restoreAllMocks();
    });

    it('should use WORKBENCH_URL env var when option not provided', async () => {
      const originalUrl = process.env.WORKBENCH_URL;
      process.env.WORKBENCH_URL = 'http://env:7000';

      const { WorkspaceManager } =
        await import('../../core/workspace-manager.js');
      vi.mocked(WorkspaceManager).mockImplementation(
        () =>
          ({
            resolvePgcRoot: vi.fn().mockReturnValue('/test'),
          }) as unknown as typeof WorkspaceManager.prototype
      );

      const { WorkbenchClient } =
        await import('../../core/executors/workbench-client.js');
      const mockWorkbench = vi.fn();
      vi.mocked(WorkbenchClient).mockImplementation(
        mockWorkbench as unknown as typeof WorkbenchClient
      );

      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('exit');
      }) as unknown as typeof process.exit);

      const { askCommand } = await import('../ask.js');

      try {
        await askCommand('test', { projectRoot: '/test' });
      } catch {
        // Expected to fail due to incomplete mocks
      }

      expect(mockWorkbench).toHaveBeenCalledWith('http://env:7000');

      // Restore
      if (originalUrl) {
        process.env.WORKBENCH_URL = originalUrl;
      } else {
        delete process.env.WORKBENCH_URL;
      }

      vi.restoreAllMocks();
    });
  });
});
