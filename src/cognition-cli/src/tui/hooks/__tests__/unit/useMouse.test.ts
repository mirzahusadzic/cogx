/**
 * Tests for useMouse hook
 *
 * Tests terminal mouse event handling including scroll events and pass-through.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { EventEmitter } from 'events';

// Mock stdin
type EventHandler = (...args: unknown[]) => void;
const mockStdin = new EventEmitter() as EventEmitter & {
  listeners: (event: string) => EventHandler[];
  removeAllListeners: (event: string) => void;
  prependListener: (event: string, handler: EventHandler) => void;
  off: (event: string, handler: EventHandler) => void;
  on: (event: string, handler: EventHandler) => void;
};
mockStdin.listeners = vi.fn(() => []);
mockStdin.removeAllListeners = vi.fn();
mockStdin.prependListener = vi.fn((event: string, handler: EventHandler) => {
  mockStdin.on(event, handler);
});
mockStdin.off = vi.fn();

// Mock ink's useStdin
vi.mock('ink', () => ({
  useStdin: () => ({
    stdin: mockStdin,
  }),
}));

// Import after mocking
import { useMouse } from '../../useMouse.js';

describe('useMouse', () => {
  let dataHandler: ((data: Buffer) => void) | null = null;
  let originalListeners: EventHandler[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    dataHandler = null;
    originalListeners = [];

    // Capture the data handler when prependListener is called
    (mockStdin.prependListener as ReturnType<typeof vi.fn>).mockImplementation(
      (event: string, handler: EventHandler) => {
        if (event === 'data') {
          dataHandler = handler as (data: Buffer) => void;
        }
      }
    );

    // Return original listeners for restoration
    (mockStdin.listeners as ReturnType<typeof vi.fn>).mockImplementation(() => {
      return originalListeners;
    });
  });

  afterEach(() => {
    dataHandler = null;
    originalListeners = [];
  });

  describe('initialization', () => {
    it('should set up data listener when active', () => {
      const callback = vi.fn();
      renderHook(() => useMouse(callback, { isActive: true }));

      expect(mockStdin.removeAllListeners).toHaveBeenCalledWith('data');
      expect(mockStdin.prependListener).toHaveBeenCalledWith(
        'data',
        expect.any(Function)
      );
    });

    it('should not set up listener when inactive', () => {
      const callback = vi.fn();
      renderHook(() => useMouse(callback, { isActive: false }));

      expect(mockStdin.prependListener).not.toHaveBeenCalled();
    });

    it('should default to active', () => {
      const callback = vi.fn();
      renderHook(() => useMouse(callback));

      expect(mockStdin.prependListener).toHaveBeenCalled();
    });
  });

  describe('scroll events', () => {
    it('should detect scroll up (button 64)', () => {
      const callback = vi.fn();
      renderHook(() => useMouse(callback, { isActive: true }));

      expect(dataHandler).not.toBeNull();

      // SGR 1006 format: ESC[<button;x;y;M
      const scrollUpSequence = Buffer.from('\x1b[<64;10;20M');
      act(() => {
        dataHandler!(scrollUpSequence);
      });

      expect(callback).toHaveBeenCalledWith({
        type: 'scroll_up',
        x: 10,
        y: 20,
      });
    });

    it('should detect scroll down (button 65)', () => {
      const callback = vi.fn();
      renderHook(() => useMouse(callback, { isActive: true }));

      const scrollDownSequence = Buffer.from('\x1b[<65;15;25M');
      act(() => {
        dataHandler!(scrollDownSequence);
      });

      expect(callback).toHaveBeenCalledWith({
        type: 'scroll_down',
        x: 15,
        y: 25,
      });
    });

    it('should detect scroll up (alternate button 4)', () => {
      const callback = vi.fn();
      renderHook(() => useMouse(callback, { isActive: true }));

      const scrollUpSequence = Buffer.from('\x1b[<4;5;10M');
      act(() => {
        dataHandler!(scrollUpSequence);
      });

      expect(callback).toHaveBeenCalledWith({
        type: 'scroll_up',
        x: 5,
        y: 10,
      });
    });

    it('should detect scroll down (alternate button 5)', () => {
      const callback = vi.fn();
      renderHook(() => useMouse(callback, { isActive: true }));

      const scrollDownSequence = Buffer.from('\x1b[<5;30;40M');
      act(() => {
        dataHandler!(scrollDownSequence);
      });

      expect(callback).toHaveBeenCalledWith({
        type: 'scroll_down',
        x: 30,
        y: 40,
      });
    });

    it('should consume scroll events (not pass to original listeners)', () => {
      const callback = vi.fn();
      const originalListener = vi.fn();
      originalListeners = [originalListener];

      renderHook(() => useMouse(callback, { isActive: true }));

      const scrollSequence = Buffer.from('\x1b[<64;10;20M');
      act(() => {
        dataHandler!(scrollSequence);
      });

      expect(callback).toHaveBeenCalled();
      expect(originalListener).not.toHaveBeenCalled();
    });
  });

  describe('click events (pass-through)', () => {
    it('should pass through left click events', () => {
      const callback = vi.fn();
      const originalListener = vi.fn();
      originalListeners = [originalListener];

      renderHook(() => useMouse(callback, { isActive: true }));

      // Button 0 = left click
      const leftClickSequence = Buffer.from('\x1b[<0;10;20M');
      act(() => {
        dataHandler!(leftClickSequence);
      });

      // Callback should not be called for clicks
      expect(callback).not.toHaveBeenCalled();
      // Original listener should receive the event
      expect(originalListener).toHaveBeenCalled();
    });

    it('should pass through right click events', () => {
      const callback = vi.fn();
      const originalListener = vi.fn();
      originalListeners = [originalListener];

      renderHook(() => useMouse(callback, { isActive: true }));

      // Button 2 = right click
      const rightClickSequence = Buffer.from('\x1b[<2;10;20M');
      act(() => {
        dataHandler!(rightClickSequence);
      });

      expect(callback).not.toHaveBeenCalled();
      expect(originalListener).toHaveBeenCalled();
    });

    it('should pass through mouse release events', () => {
      const callback = vi.fn();
      const originalListener = vi.fn();
      originalListeners = [originalListener];

      renderHook(() => useMouse(callback, { isActive: true }));

      // 'm' suffix = release
      const releaseSequence = Buffer.from('\x1b[<0;10;20m');
      act(() => {
        dataHandler!(releaseSequence);
      });

      expect(callback).not.toHaveBeenCalled();
      expect(originalListener).toHaveBeenCalled();
    });
  });

  describe('non-mouse events', () => {
    it('should pass through keyboard input', () => {
      const callback = vi.fn();
      const originalListener = vi.fn();
      originalListeners = [originalListener];

      renderHook(() => useMouse(callback, { isActive: true }));

      const keyboardInput = Buffer.from('hello');
      act(() => {
        dataHandler!(keyboardInput);
      });

      expect(callback).not.toHaveBeenCalled();
      expect(originalListener).toHaveBeenCalledWith(keyboardInput);
    });

    it('should pass through arrow key sequences', () => {
      const callback = vi.fn();
      const originalListener = vi.fn();
      originalListeners = [originalListener];

      renderHook(() => useMouse(callback, { isActive: true }));

      // Up arrow
      const arrowUp = Buffer.from('\x1b[A');
      act(() => {
        dataHandler!(arrowUp);
      });

      expect(callback).not.toHaveBeenCalled();
      expect(originalListener).toHaveBeenCalled();
    });
  });

  describe('newline filtering', () => {
    it('should filter standalone newlines', () => {
      const callback = vi.fn();
      const originalListener = vi.fn();
      originalListeners = [originalListener];

      renderHook(() => useMouse(callback, { isActive: true }));

      // Standalone newline should be consumed
      act(() => {
        dataHandler!(Buffer.from('\n'));
      });

      expect(originalListener).not.toHaveBeenCalled();
    });

    it('should filter standalone carriage return', () => {
      const callback = vi.fn();
      const originalListener = vi.fn();
      originalListeners = [originalListener];

      renderHook(() => useMouse(callback, { isActive: true }));

      act(() => {
        dataHandler!(Buffer.from('\r'));
      });

      expect(originalListener).not.toHaveBeenCalled();
    });

    it('should filter CRLF', () => {
      const callback = vi.fn();
      const originalListener = vi.fn();
      originalListeners = [originalListener];

      renderHook(() => useMouse(callback, { isActive: true }));

      act(() => {
        dataHandler!(Buffer.from('\r\n'));
      });

      expect(originalListener).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should restore original listeners on unmount', () => {
      const callback = vi.fn();
      const originalListener = vi.fn();
      originalListeners = [originalListener];

      const { unmount } = renderHook(() =>
        useMouse(callback, { isActive: true })
      );

      unmount();

      expect(mockStdin.off).toHaveBeenCalledWith('data', expect.any(Function));
    });

    it('should clean up when becoming inactive', () => {
      const callback = vi.fn();
      const { rerender } = renderHook(
        ({ isActive }) => useMouse(callback, { isActive }),
        { initialProps: { isActive: true } }
      );

      expect(mockStdin.prependListener).toHaveBeenCalled();

      rerender({ isActive: false });

      expect(mockStdin.off).toHaveBeenCalled();
    });
  });

  describe('activation toggle', () => {
    it('should activate when isActive changes to true', () => {
      const callback = vi.fn();
      const { rerender } = renderHook(
        ({ isActive }) => useMouse(callback, { isActive }),
        { initialProps: { isActive: false } }
      );

      expect(mockStdin.prependListener).not.toHaveBeenCalled();

      rerender({ isActive: true });

      expect(mockStdin.prependListener).toHaveBeenCalled();
    });
  });

  describe('callback updates', () => {
    it('should use latest callback', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const { rerender } = renderHook(
        ({ callback }) => useMouse(callback, { isActive: true }),
        { initialProps: { callback: callback1 } }
      );

      rerender({ callback: callback2 });

      // Trigger scroll event with new callback
      const scrollSequence = Buffer.from('\x1b[<64;10;20M');
      act(() => {
        dataHandler!(scrollSequence);
      });

      // Both might be called due to how effects work, but the key is callback2 should be called
      expect(callback2).toHaveBeenCalled();
    });
  });
});
