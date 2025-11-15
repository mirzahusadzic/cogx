/**
 * Terminal Mouse Event Handler
 *
 * React hook for capturing and processing mouse events in terminal-based UIs.
 * Intercepts ANSI escape sequences for mouse tracking while preserving native
 * terminal features (text selection, context menu, paste).
 *
 * DESIGN:
 * The terminal emits mouse events as ANSI escape sequences in SGR 1006 format:
 *   ESC[<button;x;y;M/m
 *
 * This hook intercepts these sequences to enable:
 * - Scroll wheel navigation (buttons 64/65 or 4/5)
 * - Pass-through for click/drag events (preserves native terminal behavior)
 *
 * The key design decision is selective interception:
 * - CAPTURE: Scroll events (for custom scroll handling)
 * - PASS THROUGH: Click/drag events (for native selection/copy/paste)
 *
 * This allows users to select text, right-click for context menu, and middle-click
 * to paste while still enabling scroll wheel navigation in the TUI.
 *
 * @example
 * // Capture scroll events for custom scrolling
 * const [scrollOffset, setScrollOffset] = useState(0);
 *
 * useMouse((event) => {
 *   if (event.type === 'scroll_up') {
 *     setScrollOffset(prev => Math.max(0, prev - 1));
 *   } else if (event.type === 'scroll_down') {
 *     setScrollOffset(prev => prev + 1);
 *   }
 * }, { isActive: true });
 *
 * @example
 * // Conditionally enable mouse tracking
 * const [panelFocused, setPanelFocused] = useState(false);
 *
 * useMouse((event) => {
 *   // Only scroll when panel is focused
 *   handleScroll(event);
 * }, { isActive: panelFocused });
 */

import { useEffect } from 'react';
import { useStdin } from 'ink';

/**
 * Mouse event types supported by terminal
 */
interface MouseEvent {
  /** Type of mouse event */
  type: 'scroll_up' | 'scroll_down' | 'click' | 'drag';

  /** Column position (1-indexed) */
  x: number;

  /** Row position (1-indexed) */
  y: number;
}

/**
 * Captures mouse events from terminal stdin and dispatches to callback.
 *
 * ALGORITHM:
 * 1. Store original stdin 'data' listeners
 * 2. Remove existing listeners to intercept mouse events
 * 3. Parse ANSI SGR 1006 sequences: ESC[<button;x;y;M/m
 * 4. Identify scroll events (buttons 64/65 or 4/5)
 * 5. Pass scroll events to callback, pass-through all other events
 * 6. Restore original listeners on cleanup
 *
 * The hook prepends its listener to intercept data before Ink processes it,
 * allowing selective filtering of mouse events.
 *
 * @param callback - Function called when scroll events occur
 * @param options - Configuration for hook behavior
 * @param options.isActive - Whether to actively capture events (default: true)
 *
 * @example
 * // Simple scroll handler
 * useMouse((event) => {
 *   console.log(`${event.type} at (${event.x}, ${event.y})`);
 * });
 *
 * @example
 * // Toggle-able mouse tracking
 * const [enabled, setEnabled] = useState(true);
 * useMouse(handleMouseEvent, { isActive: enabled });
 */
export function useMouse(
  callback: (event: MouseEvent) => void,
  options: { isActive: boolean } = { isActive: true }
) {
  const { stdin } = useStdin();

  useEffect(() => {
    if (!options.isActive || !stdin) return;

    // Store original listeners
    const originalListeners = stdin.listeners('data');

    // Remove all existing data listeners
    stdin.removeAllListeners('data');

    const handleData = (data: Buffer) => {
      const str = data.toString();

      // Check if this contains ANY mouse event sequences (with or without ESC prefix)
      const isMouse =
        // eslint-disable-next-line no-control-regex
        /\x1b\[<\d+;\d+;\d+[Mm]|<\d+;\d+;\d+[Mm]|\[<\d+;\d+;\d+[Mm]/.test(str);

      if (isMouse) {
        // Parse and handle the mouse event (flexible regex to catch all variations)
        // eslint-disable-next-line no-control-regex
        const sgrMatch = str.match(/(?:\x1b)?\[?<(\d+);(\d+);(\d+)([Mm])/);

        if (sgrMatch) {
          const button = parseInt(sgrMatch[1], 10);
          const x = parseInt(sgrMatch[2], 10);
          const y = parseInt(sgrMatch[3], 10);
          const action = sgrMatch[4]; // 'M' = press, 'm' = release

          // ONLY handle scroll events - let ALL clicks pass through
          // Button 64 = scroll up, 65 = scroll down (standard)
          // Button 4 = scroll up, 5 = scroll down (alternate mode 1007)
          if ((button === 64 || button === 4) && action === 'M') {
            callback({ type: 'scroll_up', x, y });
            return; // Consume ONLY scroll events
          } else if ((button === 65 || button === 5) && action === 'M') {
            callback({ type: 'scroll_down', x, y });
            return; // Consume ONLY scroll events
          }

          // For ALL other mouse events (left/right/middle click, drags, releases),
          // pass through to terminal so native features work:
          // - Left-click drag for text selection
          // - Right-click for context menu / copy
          // - Middle-click for paste
        }

        // Pass through to original listeners (for native terminal mouse handling)
        originalListeners.forEach((listener) => {
          (listener as (data: Buffer) => void)(data);
        });
        return;
      }

      // Not a mouse event - emit to original listeners
      originalListeners.forEach((listener) => {
        (listener as (data: Buffer) => void)(data);
      });
    };

    // Prepend our handler so it's FIRST in the listener queue
    stdin.prependListener('data', handleData);

    return () => {
      stdin.off('data', handleData);
      // Restore original listeners
      originalListeners.forEach((listener) => {
        stdin.on('data', listener as (data: Buffer) => void);
      });
    };
  }, [callback, options.isActive, stdin]);
}
