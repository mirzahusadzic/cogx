/**
 * Global teardown for vitest
 *
 * Ensures native resources (LanceDB connections) have time to cleanup
 * before the process exits. Without this delay, heap corruption can occur
 * when native async cleanup hasn't completed.
 */
export default async function globalTeardown() {
  // Give LanceDB native bindings time to complete async cleanup
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
