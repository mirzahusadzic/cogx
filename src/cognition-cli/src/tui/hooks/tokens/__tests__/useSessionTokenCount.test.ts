import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionTokenCount } from '../useSessionTokenCount.js';

describe('useSessionTokenCount', () => {
  it('should calculate cumulative tokens across turns', () => {
    const { result } = renderHook(() => useSessionTokenCount());

    // Turn 1
    act(() => {
      result.current.update({ input: 100, output: 50, total: 150 });
    });
    expect(result.current.count.total).toBe(150);
    expect(result.current.count.turns).toBe(1);

    // Commit Turn 1 (simulated by a manual commit or turn detection)
    // Here we simulate the manual commit at the end of execution
    act(() => {
      result.current.commit();
    });
    expect(result.current.count.total).toBe(150);
    expect(result.current.count.turns).toBe(1);

    // Turn 2
    act(() => {
      result.current.update({ input: 160, output: 40, total: 200 });
    });
    // Expected: 150 (Turn 1) + 200 (Turn 2) = 350
    expect(result.current.count.total).toBe(350);
    expect(result.current.count.turns).toBe(2);

    act(() => {
      result.current.commit();
    });
    expect(result.current.count.total).toBe(350);
    expect(result.current.count.turns).toBe(2);
  });

  it('should ignore 0-token reports to avoid data loss', () => {
    const { result } = renderHook(() => useSessionTokenCount());

    // Turn 1
    act(() => {
      result.current.update({ input: 100, output: 50, total: 150 });
    });
    expect(result.current.count.total).toBe(150);

    // Turn 2 starts with 0 (should be ignored)
    act(() => {
      result.current.update({ input: 0, output: 0, total: 0 });
    });
    expect(result.current.count.total).toBe(150);

    // Turn 2 reports context size (without triggering a commit)
    act(() => {
      result.current.update({ input: 160, output: 60, total: 220 });
    });
    expect(result.current.count.total).toBe(220);
  });

  it('should detect turn reset automatically during streaming', () => {
    const { result } = renderHook(() => useSessionTokenCount());

    // Turn 1
    act(() => {
      result.current.update({ input: 100, output: 50, total: 150 });
    });
    expect(result.current.count.total).toBe(150);

    // Turn 2 starts (input: 160, output: 0, total: 160)
    // Wait, the provider might report 160 first.
    // 160 is > 150, so it won't detect reset unless we see a drop.
    // Actually, if Turn 2's total starts LOWER than Turn 1's total, it detects it.
    // But if Turn 2 is higher (due to context), we need a manual commit or a drop.

    // Let's test the drop case (eviction)
    act(() => {
      result.current.update({ input: 50, output: 30, total: 80 });
    });
    // 80 < 150, so it commits 150.
    // Session total = 150 + 80 = 230.
    expect(result.current.count.total).toBe(230);
  });

  it('should not double count turns when overrideTurns is provided', () => {
    const { result } = renderHook(() => useSessionTokenCount());

    // Turn 1
    act(() => {
      result.current.update({ input: 100, output: 50, total: 150 }, 0, 0, 1);
    });
    expect(result.current.count.turns).toBe(1);

    // Turn 2 starts, tokens drop, triggering isNewTurn
    act(() => {
      result.current.update({ input: 80, output: 10, total: 90 }, 0, 0, 2);
    });

    // If double counted, this would be 3
    expect(result.current.count.turns).toBe(2);
  });

  it('should maintain cumulative turns across multiple queries/commits', () => {
    const { result } = renderHook(() => useSessionTokenCount());

    // Query 1, Turn 1
    act(() => {
      result.current.update({ input: 100, output: 50, total: 150 }, 0, 0, 1);
    });
    expect(result.current.count.turns).toBe(1);

    act(() => {
      result.current.commit();
    });
    expect(result.current.count.turns).toBe(1);

    // Query 2 starts, overrideTurns resets to 1
    act(() => {
      result.current.update({ input: 200, output: 20, total: 220 }, 0, 0, 1);
    });

    // BUG: This will likely be 1 because overrideTurns=1 resets accumulated.turns to 0.
    // We want it to be 2 (Turn 1 from Query 1 + Turn 1 from Query 2).
    expect(result.current.count.turns).toBe(2);
  });
});
