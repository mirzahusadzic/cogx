/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  coherenceReportCommand,
  coherenceAlignedCommand,
  coherenceDriftedCommand,
  coherenceListCommand,
} from '../coherence.js';

// Mock dependencies
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../core/algebra/overlay-registry.js', () => ({
  OverlayRegistry: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue({
      getAllItems: vi.fn().mockResolvedValue([]),
      getItemsByCoherence: vi.fn().mockResolvedValue([]),
    }),
  })),
}));

vi.mock('../../../core/workspace-manager.js', () => ({
  WorkspaceManager: class {
    resolvePgcRoot = vi.fn().mockReturnValue('/test/project');
  },
}));

describe('Coherence Sugar Commands', () => {
  const options = { projectRoot: '/test/project' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('coherenceReportCommand', () => {
    it('should fetch all items from O7 adapter', async () => {
      const { OverlayRegistry } =
        await import('../../../core/algebra/overlay-registry.js');
      const mockAdapter = {
        getAllItems: vi
          .fn()
          .mockResolvedValue([
            { metadata: { overallCoherence: 0.8 } },
            { metadata: { overallCoherence: 0.4 } },
          ]),
      };
      vi.mocked(OverlayRegistry).mockImplementation(
        () =>
          ({
            get: vi.fn().mockResolvedValue(mockAdapter),
          }) as any
      );

      await coherenceReportCommand(options);

      expect(mockAdapter.getAllItems).toHaveBeenCalled();
    });
  });

  describe('coherenceAlignedCommand', () => {
    it('should fetch items sorted by coherence (desc)', async () => {
      const { OverlayRegistry } =
        await import('../../../core/algebra/overlay-registry.js');
      const mockAdapter = {
        getItemsByCoherence: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(OverlayRegistry).mockImplementation(
        () =>
          ({
            get: vi.fn().mockResolvedValue(mockAdapter),
          }) as any
      );

      await coherenceAlignedCommand(options);

      expect(mockAdapter.getItemsByCoherence).toHaveBeenCalledWith(true);
    });
  });

  describe('coherenceDriftedCommand', () => {
    it('should fetch items sorted by coherence (asc)', async () => {
      const { OverlayRegistry } =
        await import('../../../core/algebra/overlay-registry.js');
      const mockAdapter = {
        getItemsByCoherence: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(OverlayRegistry).mockImplementation(
        () =>
          ({
            get: vi.fn().mockResolvedValue(mockAdapter),
          }) as any
      );

      await coherenceDriftedCommand(options);

      expect(mockAdapter.getItemsByCoherence).toHaveBeenCalledWith(false);
    });
  });

  describe('coherenceListCommand', () => {
    it('should fetch all items sorted by coherence', async () => {
      const { OverlayRegistry } =
        await import('../../../core/algebra/overlay-registry.js');
      const mockAdapter = {
        getItemsByCoherence: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(OverlayRegistry).mockImplementation(
        () =>
          ({
            get: vi.fn().mockResolvedValue(mockAdapter),
          }) as any
      );

      await coherenceListCommand(options);

      expect(mockAdapter.getItemsByCoherence).toHaveBeenCalledWith(true);
    });
  });
});
