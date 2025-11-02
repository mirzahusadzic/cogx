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

      // Check if this is a mouse event
      // eslint-disable-next-line no-control-regex
      const isMouse = /\x1b\[<\d+;\d+;\d+[Mm]/.test(str);

      if (isMouse) {
        // Parse and handle the mouse event
        // eslint-disable-next-line no-control-regex
        const sgrMatch = str.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/);

        if (sgrMatch) {
          const button = parseInt(sgrMatch[1], 10);
          const x = parseInt(sgrMatch[2], 10);
          const y = parseInt(sgrMatch[3], 10);
          const action = sgrMatch[4]; // 'M' = press, 'm' = release

          // Button 64 = scroll up, 65 = scroll down
          if (button === 64 && action === 'M') {
            callback({ type: 'scroll_up', x, y });
          } else if (button === 65 && action === 'M') {
            callback({ type: 'scroll_down', x, y });
          }
        }

        // DON'T emit to other listeners - consume the event
        return;
      }

      // Not a mouse event - emit to original listeners
      originalListeners.forEach((listener) => {
        (listener as (data: Buffer) => void)(data);
      });
    };

    // Add our filtering handler first
    stdin.on('data', handleData);

    return () => {
      stdin.off('data', handleData);
      // Restore original listeners
      originalListeners.forEach((listener) => {
        stdin.on('data', listener as (data: Buffer) => void);
      });
    };
  }, [callback, options.isActive, stdin]);
}
