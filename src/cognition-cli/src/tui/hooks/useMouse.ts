import { useEffect } from 'react';
import { useStdin } from 'ink';

interface MouseEvent {
  type: 'scroll_up' | 'scroll_down' | 'click' | 'drag';
  x: number;
  y: number;
}

/**
 * Hook to capture mouse events including scroll wheel
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
