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

    // Commit Turn 1 (simulated by a manual commit or turn detection)
    // Here we simulate the manual commit at the end of execution
    act(() => {
      result.current.commit();
    });
    expect(result.current.count.total).toBe(150);

    // Turn 2
    act(() => {
      result.current.update({ input: 160, output: 40, total: 200 });
    });
    // Expected: 150 (Turn 1) + 200 (Turn 2) = 350
    expect(result.current.count.total).toBe(350);

    act(() => {
      result.current.commit();
    });
    expect(result.current.count.total).toBe(350);
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
});
