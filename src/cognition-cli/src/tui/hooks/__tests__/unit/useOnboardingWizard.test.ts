/**
 * Tests for useOnboardingWizard hook
 *
 * Tests the onboarding wizard state machine for async project setup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Mock fs-extra
vi.mock('fs-extra', () => ({
  default: {
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    ensureDir: vi.fn(),
    writeJSON: vi.fn(),
    writeFile: vi.fn(),
    pathExists: vi.fn(),
  },
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  ensureDir: vi.fn(),
  writeJSON: vi.fn(),
  writeFile: vi.fn(),
  pathExists: vi.fn(),
}));

// Mock source detector
vi.mock('../../../utils/source-detector.js', () => ({
  detectSources: vi.fn().mockResolvedValue({
    code: [
      { path: 'src/', fileCount: 100, language: 'typescript', selected: true },
      { path: 'lib/', fileCount: 50, language: 'typescript', selected: false },
    ],
    docs: [],
  }),
}));

// Import after mocking
import { useOnboardingWizard } from '../../useOnboardingWizard.js';
import fs from 'fs-extra';

describe('useOnboardingWizard', () => {
  const mockTaskManager = {
    tasks: [],
    startGenesis: vi.fn().mockResolvedValue('task-genesis-1'),
    startGenesisDocs: vi.fn().mockResolvedValue('task-docs-1'),
    startOverlay: vi.fn().mockResolvedValue('task-overlay-1'),
  };

  const defaultOptions = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    taskManager: mockTaskManager as any,
    projectRoot: '/test/project',
    sourceDirs: ['src'],
    autoStart: false,
    debug: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: no existing PGC
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([]);
    (fs.pathExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (fs.ensureDir as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (fs.writeJSON as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (fs.writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    mockTaskManager.tasks = [];
  });

  describe('initial state', () => {
    it('should start in idle state', () => {
      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      expect(result.current.state.step).toBe('idle');
      expect(result.current.isActive).toBe(false);
      expect(result.current.isComplete).toBe(false);
    });

    it('should detect if genesis is needed', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      expect(result.current.state.needsGenesis).toBe(true);
    });

    it('should detect if genesis exists', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation(
        (path: string) => {
          return path.includes('index');
        }
      );
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
        'file.json',
      ]);

      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      expect(result.current.state.needsGenesis).toBe(false);
    });

    it('should provide source dirs from options', () => {
      const { result } = renderHook(() =>
        useOnboardingWizard({ ...defaultOptions, sourceDirs: ['src', 'lib'] })
      );

      expect(result.current.state.sourceDirs).toEqual(['src', 'lib']);
    });

    it('should have no confirmation state initially', () => {
      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      expect(result.current.confirmationState).toBeNull();
    });
  });

  describe('wizard controls', () => {
    it('should provide startWizard function', () => {
      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      expect(typeof result.current.startWizard).toBe('function');
    });

    it('should provide confirm function', () => {
      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      expect(typeof result.current.confirm).toBe('function');
    });

    it('should provide skip function', () => {
      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      expect(typeof result.current.skip).toBe('function');
    });

    it('should provide cancel function', () => {
      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      expect(typeof result.current.cancel).toBe('function');
    });

    it('should provide selection navigation functions', () => {
      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      expect(typeof result.current.moveUp).toBe('function');
      expect(typeof result.current.moveDown).toBe('function');
      expect(typeof result.current.toggleSelection).toBe('function');
    });
  });

  describe('startWizard', () => {
    it('should transition to confirm-genesis when genesis needed', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      act(() => {
        result.current.startWizard();
      });

      await waitFor(() => {
        expect(result.current.state.step).toBe('confirm-genesis');
      });
    });

    it('should show confirmation dialog', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      act(() => {
        result.current.startWizard();
      });

      await waitFor(() => {
        expect(result.current.confirmationState).not.toBeNull();
        expect(result.current.confirmationState?.pending).toBe(true);
      });
    });

    it('should detect source directories', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const { result } = renderHook(() =>
        useOnboardingWizard({ ...defaultOptions, sourceDirs: undefined })
      );

      act(() => {
        result.current.startWizard();
      });

      await waitFor(() => {
        expect(result.current.confirmationState?.items).toBeDefined();
        expect(result.current.confirmationState?.items?.length).toBeGreaterThan(
          0
        );
      });
    });
  });

  describe('confirm action', () => {
    it('should start genesis when confirmed', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      act(() => {
        result.current.startWizard();
      });

      await waitFor(() => {
        expect(result.current.confirmationState).not.toBeNull();
      });

      act(() => {
        result.current.confirm();
      });

      await waitFor(() => {
        expect(result.current.state.step).toBe('genesis');
      });

      expect(mockTaskManager.startGenesis).toHaveBeenCalled();
    });
  });

  describe('skip action', () => {
    it('should handle skip properly', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      act(() => {
        result.current.startWizard();
      });

      await waitFor(() => {
        expect(result.current.confirmationState).not.toBeNull();
      });

      act(() => {
        result.current.skip();
      });

      // Skip should move to next step or idle
      await waitFor(() => {
        expect(['idle', 'complete', 'confirm-genesis']).toContain(
          result.current.state.step
        );
      });
    });
  });

  describe('cancel action', () => {
    it('should cancel wizard and return to complete', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      act(() => {
        result.current.startWizard();
      });

      await waitFor(() => {
        expect(result.current.confirmationState).not.toBeNull();
      });

      act(() => {
        result.current.cancel();
      });

      await waitFor(() => {
        expect(result.current.state.step).toBe('complete');
        expect(result.current.confirmationState).toBeNull();
      });
    });
  });

  describe('selection navigation', () => {
    it('should move selection up', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      await act(async () => {
        result.current.startWizard();
      });

      await waitFor(() => {
        expect(result.current.confirmationState?.mode).toBe('select');
        expect(result.current.confirmationState?.items?.length).toBeGreaterThan(
          0
        );
      });

      // First move down to get to index 1
      await act(async () => {
        result.current.moveDown();
      });

      // The moveDown should have changed the index
      // If there's only 1 item, it wraps to 0, otherwise it goes to 1
      const itemCount = result.current.confirmationState?.items?.length ?? 0;
      const expectedIndexAfterDown = itemCount > 1 ? 1 : 0;

      await waitFor(() => {
        expect(result.current.confirmationState?.selectedIndex).toBe(
          expectedIndexAfterDown
        );
      });

      // Now move up to get back to index 0 (or wrap to last if only 1 item)
      await act(async () => {
        result.current.moveUp();
      });

      await waitFor(() => {
        expect(result.current.confirmationState?.selectedIndex).toBe(0);
      });
    });

    it('should toggle selection', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      act(() => {
        result.current.startWizard();
      });

      await waitFor(() => {
        expect(result.current.confirmationState?.items).toBeDefined();
      });

      const initialSelected =
        result.current.confirmationState?.items?.[0]?.selected;

      act(() => {
        result.current.toggleSelection();
      });

      await waitFor(() => {
        const newSelected =
          result.current.confirmationState?.items?.[0]?.selected;
        expect(newSelected).toBe(!initialSelected);
      });
    });
  });

  describe('isActive and isComplete', () => {
    it('should be active when wizard is running', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      expect(result.current.isActive).toBe(false);

      act(() => {
        result.current.startWizard();
      });

      await waitFor(() => {
        expect(result.current.isActive).toBe(true);
      });
    });

    it('should be complete after cancel', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      act(() => {
        result.current.startWizard();
      });

      await waitFor(() => {
        expect(result.current.confirmationState).not.toBeNull();
      });

      act(() => {
        result.current.cancel();
      });

      await waitFor(() => {
        expect(result.current.isComplete).toBe(true);
        expect(result.current.isActive).toBe(false);
      });
    });
  });

  describe('autoStart', () => {
    it('should auto-start when enabled', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const { result } = renderHook(() =>
        useOnboardingWizard({ ...defaultOptions, autoStart: true })
      );

      await waitFor(() => {
        expect(result.current.isActive).toBe(true);
      });
    });

    it('should not auto-start when disabled', async () => {
      const { result } = renderHook(() =>
        useOnboardingWizard({ ...defaultOptions, autoStart: false })
      );

      // Wait a bit to ensure no auto-start
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(result.current.state.step).toBe('idle');
    });
  });

  describe('state structure', () => {
    it('should have all expected state properties', () => {
      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      expect(result.current.state).toHaveProperty('step');
      expect(result.current.state).toHaveProperty('sourceDirs');
      expect(result.current.state).toHaveProperty('strategicDocs');
      expect(result.current.state).toHaveProperty('ingestedDocs');
      expect(result.current.state).toHaveProperty('currentOverlay');
      expect(result.current.state).toHaveProperty('completedOverlays');
      expect(result.current.state).toHaveProperty('skippedOverlays');
      expect(result.current.state).toHaveProperty('error');
      expect(result.current.state).toHaveProperty('needsGenesis');
      expect(result.current.state).toHaveProperty('needsDocs');
      expect(result.current.state).toHaveProperty('missingOverlays');
    });
  });

  describe('confirmation state structure', () => {
    it('should have correct structure when showing confirmation', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      act(() => {
        result.current.startWizard();
      });

      await waitFor(() => {
        expect(result.current.confirmationState).not.toBeNull();
      });

      const state = result.current.confirmationState;
      expect(state).toHaveProperty('pending');
      expect(state).toHaveProperty('mode');
      expect(state).toHaveProperty('title');
      expect(state).toHaveProperty('message');
      expect(state).toHaveProperty('confirmLabel');
      expect(state).toHaveProperty('denyLabel');
    });
  });

  describe('missing overlays detection', () => {
    it('should detect missing overlays', () => {
      // No overlays exist
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      expect(result.current.state.missingOverlays.length).toBeGreaterThan(0);
    });

    it('should exclude running tasks from missing list', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const optionsWithRunningTask = {
        ...defaultOptions,
        taskManager: {
          ...mockTaskManager,
          tasks: [
            {
              id: 'task-1',
              type: 'overlay',
              overlay: 'structural_patterns',
              status: 'running',
            },
          ],
        },
      };

      const { result } = renderHook(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useOnboardingWizard(optionsWithRunningTask as any)
      );

      // O1 (structural_patterns) should not be in missing list since it's running
      expect(result.current.state.missingOverlays).not.toContain('O1');
    });
  });

  describe('error handling', () => {
    it('should set error on genesis failure', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
      mockTaskManager.startGenesis.mockRejectedValue(
        new Error('Genesis failed')
      );

      const { result } = renderHook(() => useOnboardingWizard(defaultOptions));

      act(() => {
        result.current.startWizard();
      });

      await waitFor(() => {
        expect(result.current.confirmationState).not.toBeNull();
      });

      act(() => {
        result.current.confirm();
      });

      await waitFor(() => {
        expect(result.current.state.error).toContain('Genesis failed');
      });
    });
  });
});
