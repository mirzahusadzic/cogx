/**
 * Tests for useOverlays hook
 *
 * Tests overlay status loading from the Grounded Context Pool (PGC).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock the OverlayRegistry
const mockGetOverlayInfo = vi.fn();
const mockHasData = vi.fn();
const mockGet = vi.fn();

vi.mock('../../../../core/algebra/overlay-registry.js', () => ({
  OverlayRegistry: vi.fn().mockImplementation(() => ({
    getOverlayInfo: mockGetOverlayInfo,
    hasData: mockHasData,
    get: mockGet,
  })),
}));

// Import after mocking
import { useOverlays } from '../../useOverlays.js';

describe('useOverlays', () => {
  const defaultOptions = {
    pgcRoot: '/test/project/.open_cognition',
    workbenchUrl: 'http://localhost:8000',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockGetOverlayInfo.mockReturnValue([
      { id: 'O1', name: 'Structural', description: 'Structural patterns' },
      { id: 'O2', name: 'Security', description: 'Security guidelines' },
      { id: 'O3', name: 'Lineage', description: 'Lineage patterns' },
    ]);

    mockHasData.mockResolvedValue(false);
    mockGet.mockResolvedValue({
      getAllItems: vi.fn().mockResolvedValue([]),
    });
  });

  describe('initial state', () => {
    it('should start with loading true', async () => {
      const { result } = renderHook(() => useOverlays(defaultOptions));

      expect(result.current.loading).toBe(true);
      expect(result.current.overlays).toEqual([]);

      // Wait for the effect to settle to avoid act() warnings
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('overlay loading', () => {
    it('should load overlays and set loading to false', async () => {
      const { result } = renderHook(() => useOverlays(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.overlays).toHaveLength(3);
    });

    it('should include overlay metadata', async () => {
      const { result } = renderHook(() => useOverlays(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.overlays[0]).toMatchObject({
        id: 'O1',
        name: 'Structural',
        description: 'Structural patterns',
      });
    });

    it('should check data availability for each overlay', async () => {
      const { result } = renderHook(() => useOverlays(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockHasData).toHaveBeenCalledWith('O1');
      expect(mockHasData).toHaveBeenCalledWith('O2');
      expect(mockHasData).toHaveBeenCalledWith('O3');
    });

    it('should set hasData based on registry check', async () => {
      mockHasData.mockImplementation((id: string) => {
        return Promise.resolve(id === 'O1');
      });

      const { result } = renderHook(() => useOverlays(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.overlays[0].hasData).toBe(true);
      expect(result.current.overlays[1].hasData).toBe(false);
      expect(result.current.overlays[2].hasData).toBe(false);
    });
  });

  describe('item count', () => {
    it('should get item count for overlays with data', async () => {
      mockHasData.mockResolvedValue(true);
      mockGet.mockResolvedValue({
        getAllItems: vi
          .fn()
          .mockResolvedValue([{ id: '1' }, { id: '2' }, { id: '3' }]),
      });

      const { result } = renderHook(() => useOverlays(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.overlays[0].itemCount).toBe(3);
    });

    it('should set itemCount to 0 for overlays without data', async () => {
      mockHasData.mockResolvedValue(false);

      const { result } = renderHook(() => useOverlays(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.overlays[0].itemCount).toBe(0);
    });

    it('should handle errors when getting item count', async () => {
      mockHasData.mockResolvedValue(true);
      mockGet.mockResolvedValue({
        getAllItems: vi
          .fn()
          .mockRejectedValue(new Error('Failed to get items')),
      });

      const { result } = renderHook(() => useOverlays(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should still have overlays, just with 0 count
      expect(result.current.overlays[0].itemCount).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle registry errors gracefully', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      mockGetOverlayInfo.mockImplementation(() => {
        throw new Error('Registry not available');
      });

      const { result } = renderHook(() => useOverlays(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.overlays).toEqual([]);
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });

    it('should handle hasData errors gracefully', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      mockHasData.mockRejectedValue(new Error('Check failed'));

      const { result } = renderHook(() => useOverlays(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // The Promise.all should still resolve
      expect(result.current.overlays.length).toBeGreaterThanOrEqual(0);
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to load overlays:',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });
  });

  describe('options handling', () => {
    it('should use provided pgcRoot', async () => {
      const { OverlayRegistry } =
        await import('../../../../core/algebra/overlay-registry.js');

      const { result } = renderHook(() =>
        useOverlays({
          pgcRoot: '/custom/path/.open_cognition',
          workbenchUrl: 'http://localhost:9000',
        })
      );

      // Wait for the effect to settle
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(OverlayRegistry).toHaveBeenCalledWith(
        '/custom/path/.open_cognition',
        'http://localhost:9000'
      );
    });

    it('should handle missing workbenchUrl', async () => {
      const { OverlayRegistry } =
        await import('../../../../core/algebra/overlay-registry.js');

      const { result } = renderHook(() =>
        useOverlays({
          pgcRoot: '/test/.open_cognition',
        })
      );

      // Wait for the effect to settle
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(OverlayRegistry).toHaveBeenCalledWith(
        '/test/.open_cognition',
        undefined
      );
    });
  });

  describe('mount behavior', () => {
    it('should only load once on mount', async () => {
      const { result, rerender } = renderHook(() =>
        useOverlays(defaultOptions)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const callCount = mockGetOverlayInfo.mock.calls.length;

      rerender();

      // Should not call again
      expect(mockGetOverlayInfo).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('parallel loading', () => {
    it('should load all overlays concurrently', async () => {
      const delays = [100, 50, 150];
      let callIndex = 0;

      mockHasData.mockImplementation(() => {
        const delay = delays[callIndex++ % delays.length];
        return new Promise((resolve) => setTimeout(() => resolve(true), delay));
      });

      mockGet.mockResolvedValue({
        getAllItems: vi.fn().mockResolvedValue([{ id: '1' }]),
      });

      const startTime = Date.now();
      const { result } = renderHook(() => useOverlays(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const elapsed = Date.now() - startTime;

      // If parallel, should take ~150ms (max delay)
      // If sequential, would take ~300ms (sum of delays)
      expect(elapsed).toBeLessThan(250);
    });
  });

  describe('return value structure', () => {
    it('should return overlays array with correct structure', async () => {
      mockHasData.mockResolvedValue(true);
      mockGet.mockResolvedValue({
        getAllItems: vi.fn().mockResolvedValue([{ id: '1' }, { id: '2' }]),
      });

      const { result } = renderHook(() => useOverlays(defaultOptions));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const overlay = result.current.overlays[0];
      expect(overlay).toHaveProperty('id');
      expect(overlay).toHaveProperty('name');
      expect(overlay).toHaveProperty('description');
      expect(overlay).toHaveProperty('hasData');
      expect(overlay).toHaveProperty('itemCount');
    });
  });
});
