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

  it('should cap cached tokens by the current turn input context', () => {
    const { result } = renderHook(() => useSessionTokenCount());

    // 1. Initial update with cached tokens
    act(() => {
      result.current.update({
        input: 15000,
        output: 5000,
        total: 20000,
        cached: 10000,
      });
    });
    expect(result.current.count.cached).toBe(10000);
    expect(result.current.count.input).toBe(15000);

    // 2. Context shrinks within same turn (e.g. forced trim or manual drop)
    // and cached is not provided in update.
    // Total is now 8000, output is 3000 -> input is 5000.
    // Cached (10000) should be capped by input (5000).
    // Note: This triggers isNewTurn since current.total < last.total (8000 < 20000).
    // isNewTurn commits 20000 to accumulated, and starts new turn with 8000.
    // We want to test that effectiveTurnCached is capped by currentTurn.input.
    act(() => {
      result.current.update({ input: 5000, output: 3000, total: 8000 });
    });

    // Turn 1 committed: cached=10k, input=15k, output=5k, total=20k
    // Turn 2 started: cached=Math.min(0, 5000)=0 (since isNewTurn=true), input=5k, output=3k, total=8k
    // Session total: cached=10k, input=20k, output=8k, total=28k
    expect(result.current.count.cached).toBe(10000);

    // To really test the capping of effectiveTurnCached, we need a case where it's NOT a new turn
    // but cached tokens are reported as larger than input.
    // This could happen if a provider sends a chunk with cached > input.
    act(() => {
      result.current.update({
        input: 2000,
        output: 1000,
        total: 3000,
        cached: 5000,
      });
    });
    // Turn 1 committed: 10k cached
    // Turn 2: isNewTurn (3k < 8k), commits Turn 2 (last seen values).
    // Turn 2 last seen: input=5k, output=3k, total=8k, cached=0.
    // Turn 3 started: input=2k, output=1k, total=3k, cached=Math.min(5000, 2000)=2000.
    // Session: Turn 1 (10k) + Turn 2 (0) + Turn 3 (2k) = 12k.
    expect(result.current.count.cached).toBe(12000);
  });
});
