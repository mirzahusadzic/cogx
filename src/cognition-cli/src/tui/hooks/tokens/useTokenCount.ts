import { useState, useCallback, useRef } from 'react';

export interface TokenCount {
  input: number;
  output: number;
  total: number;
}

/**
 * Hook for managing token count with proper reset semantics.
 *
 * The key feature is the reset() function which bypasses Math.max logic
 * on the next update. This is critical for compression workflow where
 * token count needs to reset to 0 and then accept any new value.
 */
export function useTokenCount() {
  const [count, setCount] = useState<TokenCount>({
    input: 0,
    output: 0,
    total: 0,
  });
  const justReset = useRef(false);

  const reset = useCallback(() => {
    setCount({ input: 0, output: 0, total: 0 });
    justReset.current = true;
  }, []);

  const update = useCallback((newCount: TokenCount) => {
    setCount((prev) => {
      // After reset, accept any value (don't use Math.max)
      if (justReset.current) {
        justReset.current = false;
        return newCount;
      }

      // Normal updates: use Math.max to prevent drops
      // (SDK can send lower values when new query starts)
      if (newCount.total > prev.total) {
        return newCount;
      }

      return prev;
    });
  }, []);

  return {
    count,
    reset,
    update,
  };
}
