import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OverlayOrchestrator } from '../overlay.js';

// Mock workerpool to prevent Vite worker parsing errors
vi.mock('workerpool', () => ({
  default: {
    pool: vi.fn(() => ({
      exec: vi.fn(),
      terminate: vi.fn(),
    })),
  },
  pool: vi.fn(() => ({
    exec: vi.fn(),
    terminate: vi.fn(),
  })),
}));

// Mock dependencies
vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn().mockResolvedValue(true),
    readdir: vi.fn().mockResolvedValue([]),
    stat: vi.fn().mockResolvedValue({ isDirectory: () => false, size: 1000 }),
    ensureDir: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@clack/prompts', () => ({
  spinner: () => ({
    start: vi.fn(),
    stop: vi.fn(),
  }),
  log: {
    info: vi.fn(),
    success: vi.fn(),
    step: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('proper-lockfile', () => ({
  lock: vi.fn(async () => vi.fn(async () => {})),
}));

describe('OverlayOrchestrator - Workbench Pre-flight Check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CRITICAL: should fail fast if workbench is not accessible', async () => {
    // Mock WorkbenchClient to fail health check
    const mockWorkbench = {
      getBaseUrl: () => 'http://localhost:8000',
      health: vi.fn().mockRejectedValue(new Error('Connection refused')),
    };

    // Create orchestrator with mocked workbench
    const orchestrator = await OverlayOrchestrator.create(process.cwd());

    // Replace the workbench with our mock
    (orchestrator as unknown as { workbench: typeof mockWorkbench }).workbench =
      mockWorkbench;

    // Attempt to run overlay generation
    await expect(orchestrator.run('structural_patterns')).rejects.toThrow(
      /Cannot generate overlays.*not accessible/
    );

    // Verify health check was called
    expect(mockWorkbench.health).toHaveBeenCalledTimes(1);
  });

  it('CRITICAL: should fail with clear error message about WORKBENCH_URL', async () => {
    const mockWorkbench = {
      getBaseUrl: () => 'http://localhost:9999',
      health: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    };

    const orchestrator = await OverlayOrchestrator.create(process.cwd());
    (orchestrator as unknown as { workbench: typeof mockWorkbench }).workbench =
      mockWorkbench;

    try {
      await orchestrator.run('structural_patterns');
      expect.fail('Should have thrown an error');
    } catch (error) {
      const errorMessage = (error as Error).message;

      // Verify error message contains helpful information
      expect(errorMessage).toContain('Cannot generate overlays');
      expect(errorMessage).toContain('http://localhost:9999');
      expect(errorMessage).toContain('not accessible');
      expect(errorMessage).toContain('eGemma is running');
      expect(errorMessage).toContain('WORKBENCH_URL');
    }
  });

  it('should call workbench health check before any processing', async () => {
    const mockWorkbench = {
      getBaseUrl: () => 'http://localhost:8000',
      health: vi.fn().mockResolvedValue({ status: 'ok' }),
    };

    const orchestrator = await OverlayOrchestrator.create(process.cwd());
    (orchestrator as unknown as { workbench: typeof mockWorkbench }).workbench =
      mockWorkbench;

    // Mock loadFilesFromPGCIndex to throw after health check succeeds
    // This proves health check happens first
    (
      orchestrator as unknown as {
        loadFilesFromPGCIndex: () => Promise<never>;
      }
    ).loadFilesFromPGCIndex = vi
      .fn()
      .mockRejectedValue(new Error('Test intentional failure'));

    // Attempt to run - should fail at loadFilesFromPGCIndex (after health check)
    await expect(orchestrator.run('structural_patterns')).rejects.toThrow(
      'Test intentional failure'
    );

    // Verify health check was called first (before loadFilesFromPGCIndex)
    expect(mockWorkbench.health).toHaveBeenCalledTimes(1);
  });

  it('should check workbench health for lineage_patterns as well', async () => {
    const mockWorkbench = {
      getBaseUrl: () => 'http://localhost:8000',
      health: vi.fn().mockRejectedValue(new Error('Service unavailable')),
    };

    const orchestrator = await OverlayOrchestrator.create(process.cwd());
    (orchestrator as unknown as { workbench: typeof mockWorkbench }).workbench =
      mockWorkbench;

    // Both overlay types should check workbench health
    await expect(orchestrator.run('lineage_patterns')).rejects.toThrow(
      /Cannot generate overlays/
    );

    expect(mockWorkbench.health).toHaveBeenCalledTimes(1);
  });
});
