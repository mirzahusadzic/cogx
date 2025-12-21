/**
 * Sigma Directory Resolution
 *
 * Provides utilities for determining the correct .sigma directory path
 * based on the IPC_SIGMA_BUS environment variable.
 *
 * When IPC_SIGMA_BUS is set, agents in different project directories
 * share the same .sigma directory, enabling cross-project collaboration.
 */

import * as path from 'path';
import * as os from 'os';

/**
 * Get the appropriate .sigma directory path based on IPC_SIGMA_BUS.
 *
 * Behavior:
 * - If IPC_SIGMA_BUS is NOT set → use project-local .sigma (${cwd}/.sigma)
 * - If IPC_SIGMA_BUS=global → use ~/.cognition/sigma-global
 * - If IPC_SIGMA_BUS=team → use ~/.cognition/sigma-team
 * - If IPC_SIGMA_BUS=<custom> → use ~/.cognition/sigma-<custom>
 *
 * This ensures agents on the same bus can discover each other and
 * share message queues, regardless of their working directory.
 *
 * @param projectRoot - The project root directory (defaults to process.cwd())
 * @returns The absolute path to the .sigma directory
 *
 * @example
 * // No IPC_SIGMA_BUS set
 * getSigmaDirectory('/Users/dev/project-a')
 * // → '/Users/dev/project-a/.sigma'
 *
 * @example
 * // IPC_SIGMA_BUS=global
 * getSigmaDirectory('/Users/dev/project-a')
 * // → '/Users/dev/.cognition/sigma-global'
 *
 * @example
 * // IPC_SIGMA_BUS=frontend
 * getSigmaDirectory('/Users/dev/project-a')
 * // → '/Users/dev/.cognition/sigma-frontend'
 */
export function getSigmaDirectory(projectRoot?: string): string {
  const busName = process.env.IPC_SIGMA_BUS;

  if (busName) {
    // Shared .sigma directory in user's home
    return path.join(os.homedir(), '.cognition', `sigma-${busName}`);
  } else {
    // Project-local .sigma directory
    return path.join(projectRoot || process.cwd(), '.sigma');
  }
}

/**
 * Get the message queue directory path.
 *
 * @param projectRoot - The project root directory (defaults to process.cwd())
 * @returns The absolute path to the message_queue directory
 *
 * @example
 * // No IPC_SIGMA_BUS set
 * getMessageQueueDirectory('/Users/dev/project-a')
 * // → '/Users/dev/project-a/.sigma/message_queue'
 *
 * @example
 * // IPC_SIGMA_BUS=global
 * getMessageQueueDirectory('/Users/dev/project-a')
 * // → '/Users/dev/.cognition/sigma-global/message_queue'
 */
export function getMessageQueueDirectory(projectRoot?: string): string {
  return path.join(getSigmaDirectory(projectRoot), 'message_queue');
}
