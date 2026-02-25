import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTokenCount } from '../../../tokens/useTokenCount';

describe('useTokenCount', () => {
  it('initializes with zero count', () => {
    const { result } = renderHook(() => useTokenCount());

    expect(result.current.count).toEqual({
      input: 0,
      output: 0,
      total: 0,
    });
  });

  it('updates count correctly', () => {
    const { result } = renderHook(() => useTokenCount());

    act(() => {
      result.current.update({ input: 1000, output: 500, total: 1500 });
    });

    expect(result.current.count.total).toBe(1500);
    expect(result.current.count.input).toBe(1000);
    expect(result.current.count.output).toBe(500);
  });

  it('trusts provider updates (does not use Math.max)', () => {
    const { result } = renderHook(() => useTokenCount());

    // First update
    act(() => {
      result.current.update({ input: 1000, output: 500, total: 1500 });
    });

    // Update with lower value - should be accepted since we trust provider
    act(() => {
      result.current.update({ input: 500, output: 200, total: 700 });
    });

    expect(result.current.count.total).toBe(700);
  });

  it('accepts higher values after initial update', () => {
    const { result } = renderHook(() => useTokenCount());

    act(() => {
      result.current.update({ input: 1000, output: 500, total: 1500 });
    });

    act(() => {
      result.current.update({ input: 2000, output: 1000, total: 3000 });
    });

    expect(result.current.count.total).toBe(3000);
  });

  it('resets to zero', () => {
    const { result } = renderHook(() => useTokenCount());

    // Set to some value
    act(() => {
      result.current.update({ input: 1000, output: 500, total: 1500 });
    });

    expect(result.current.count.total).toBe(1500);

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.count.total).toBe(0);
    expect(result.current.count.input).toBe(0);
    expect(result.current.count.output).toBe(0);
  });

  it('accepts any value immediately after reset (does not use Math.max)', () => {
    const { result } = renderHook(() => useTokenCount());

    // Set high value
    act(() => {
      result.current.update({ input: 60000, output: 60000, total: 120000 });
    });

    expect(result.current.count.total).toBe(120000);

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.count.total).toBe(0);

    // Update with low value - should accept it (this is the key test!)
    act(() => {
      result.current.update({ input: 100, output: 50, total: 150 });
    });

    expect(result.current.count.total).toBe(150); // Accepted low value!
  });

  it('handles multiple resets in sequence', () => {
    const { result } = renderHook(() => useTokenCount());

    // Reset 1
    act(() => {
      result.current.reset();
      result.current.update({ input: 100, output: 50, total: 150 });
    });
    expect(result.current.count.total).toBe(150);

    // Build up some tokens
    act(() => {
      result.current.update({ input: 1000, output: 500, total: 1500 });
    });
    expect(result.current.count.total).toBe(1500);

    // Reset 2
    act(() => {
      result.current.reset();
      result.current.update({ input: 200, output: 100, total: 300 });
    });
    expect(result.current.count.total).toBe(300);
  });

  it('accepts any value after reset', () => {
    const { result } = renderHook(() => useTokenCount());

    // Set initial value
    act(() => {
      result.current.update({ input: 10000, output: 5000, total: 15000 });
    });

    // Reset
    act(() => {
      result.current.reset();
    });

    // First update after reset
    act(() => {
      result.current.update({ input: 100, output: 50, total: 150 });
    });
    expect(result.current.count.total).toBe(150);

    // Second update - accepts lower value too (trusts provider)
    act(() => {
      result.current.update({ input: 50, output: 25, total: 75 });
    });
    expect(result.current.count.total).toBe(75);
  });

  it('handles reset without subsequent update', () => {
    const { result } = renderHook(() => useTokenCount());

    act(() => {
      result.current.update({ input: 1000, output: 500, total: 1500 });
    });

    act(() => {
      result.current.reset();
    });

    // Just check it's at 0, don't update
    expect(result.current.count.total).toBe(0);

    // Now do another reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.count.total).toBe(0);
  });

  it('ignores zero-token updates to prevent UI flickering', () => {
    const { result } = renderHook(() => useTokenCount());

    // Set non-zero value
    act(() => {
      result.current.update({ input: 1000, output: 500, total: 1500 });
    });
    expect(result.current.count.total).toBe(1500);

    // Send zero update (simulating turn start transient state)
    act(() => {
      result.current.update({ input: 0, output: 0, total: 0 });
    });

    // Should still be 1500!
    expect(result.current.count.total).toBe(1500);
  });

  it('handles zero update values on first call', () => {
    const { result } = renderHook(() => useTokenCount());

    act(() => {
      result.current.update({ input: 0, output: 0, total: 0 });
    });

    expect(result.current.count.total).toBe(0);
  });

  it('maintains consistent total with input + output', () => {
    const { result } = renderHook(() => useTokenCount());

    act(() => {
      result.current.update({ input: 1234, output: 5678, total: 6912 });
    });

    expect(result.current.count.input + result.current.count.output).toBe(
      result.current.count.total
    );
  });
});
