import { describe, it, expect, vi } from 'vitest';
import { AsyncMutex } from '../utils/AsyncMutex.js';

describe('AsyncMutex', () => {
  it('should allow a single task to execute', async () => {
    const mutex = new AsyncMutex();
    const task = vi.fn().mockResolvedValue('success');

    const result = await mutex.runLocked(task);

    expect(result).toBe('success');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('should serialize concurrent tasks', async () => {
    const mutex = new AsyncMutex();
    const executionOrder: number[] = [];

    const task1 = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      executionOrder.push(1);
    };

    const task2 = async () => {
      executionOrder.push(2);
    };

    // Start both tasks concurrently
    await Promise.all([mutex.runLocked(task1), mutex.runLocked(task2)]);

    expect(executionOrder).toEqual([1, 2]);
  });

  it('should handle errors in runLocked and still release the lock', async () => {
    const mutex = new AsyncMutex();

    await expect(
      mutex.runLocked(async () => {
        throw new Error('fail');
      })
    ).rejects.toThrow('fail');

    // Lock should be released, so next task can run
    const task2 = vi.fn().mockResolvedValue('ok');
    const result = await mutex.runLocked(task2);
    expect(result).toBe('ok');
    expect(task2).toHaveBeenCalledTimes(1);
  });

  it('should work with manual acquire/release', async () => {
    const mutex = new AsyncMutex();
    let counter = 0;

    await mutex.acquire();

    const incrementTask = (async () => {
      await mutex.runLocked(async () => {
        counter++;
      });
    })();

    expect(counter).toBe(0); // Blocked by manual acquire

    mutex.release();
    await incrementTask;

    expect(counter).toBe(1);
  });

  it('should maintain queue order (FIFO)', async () => {
    const mutex = new AsyncMutex();
    const order: number[] = [];

    const t1 = mutex.runLocked(async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push(1);
    });
    const t2 = mutex.runLocked(async () => order.push(2));
    const t3 = mutex.runLocked(async () => order.push(3));

    await Promise.all([t1, t2, t3]);
    expect(order).toEqual([1, 2, 3]);
  });
});
