/**
 * Simple async mutex for serializing concurrent async operations
 * Prevents "Too many concurrent writers" errors in LanceDB
 */
export class AsyncMutex {
  private locked = false;
  private queue: Array<() => void> = [];

  /**
   * Acquire the lock - waits if already locked
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
