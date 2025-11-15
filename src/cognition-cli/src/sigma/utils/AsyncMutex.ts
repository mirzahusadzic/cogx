/**
 * Simple async mutex for serializing concurrent async operations
 *
 * Prevents "Too many concurrent writers" errors in LanceDB by ensuring
 * only one write operation runs at a time. Other operations wait in a queue.
 *
 * DESIGN:
 * - Lock flag prevents concurrent execution
 * - Queue holds waiting operations
 * - acquire()/release() pattern or runLocked() helper
 *
 * @example
 * const mutex = new AsyncMutex();
 * await mutex.runLocked(async () => {
 *   await lanceStore.storeTurn(...);
 * });
 */
export class AsyncMutex {
  private locked = false;
  private queue: Array<() => void> = [];

  /**
   * Acquire the lock - waits if already locked
   *
   * Blocks until the lock becomes available. Use with try/finally
   * to ensure release() is called.
   *
   * @example
   * await mutex.acquire();
   * try {
   *   // critical section
   * } finally {
   *   mutex.release();
   * }
   */
  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }

    // Wait in queue
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  /**
   * Release the lock - allows next waiter to proceed
   *
   * Passes the lock to the next operation in the queue, or unlocks
   * if the queue is empty. Always call this in a finally block.
   */
  release(): void {
    const next = this.queue.shift();
    if (next) {
      // Pass lock to next waiter
      next();
    } else {
      // No waiters, unlock
      this.locked = false;
    }
  }

  /**
   * Execute a function with the lock held
   *
   * Automatically handles acquire/release pattern. Preferred over manual
   * acquire()/release() as it's less error-prone.
   *
   * @param fn - Async function to execute while holding the lock
   * @returns Promise resolving to the function's return value
   *
   * @example
   * const result = await mutex.runLocked(async () => {
   *   return await someAsyncOperation();
   * });
   */
  async runLocked<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}
