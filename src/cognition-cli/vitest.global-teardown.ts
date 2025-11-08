/**
 * Global teardown for vitest
 *
 * Ensures native resources (LanceDB connections) have time to cleanup
 * before the process exits. Without this delay, heap corruption can occur
 * when native async cleanup hasn't completed.
 */
export default async function globalTeardown() {
  // Force garbage collection if available (helps release native resources)
  if (global.gc) {
    global.gc();
  }

  // Give LanceDB native bindings time to complete async cleanup
  // Increased to 3s for CI environments which may have slower I/O
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Second GC pass after native cleanup
  if (global.gc) {
    global.gc();
  }
}
