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
import { environmentService } from '../core/services/environment/EnvironmentService.js';

/**
 * Get the appropriate .sigma directory path based on IPC_SIGMA_BUS.
 *
 * @deprecated Use environmentService.resolveSigmaDir()
 * Behavior:
 * - If IPC_SIGMA_BUS is NOT set → use project-local .sigma (${cwd}/.sigma)
 * - If IPC_SIGMA_BUS=global → use ~/.cognition/sigma-global
 * - If IPC_SIGMA_BUS=team → use ~/.cognition/sigma-team
 * - If IPC_SIGMA_BUS=<custom> → use ~/.cognition/sigma-<custom>
 *
 * @param projectRoot - The project root directory (defaults to process.cwd())
 * @returns The absolute path to the .sigma directory
 */
export function getSigmaDirectory(projectRoot?: string): string {
  return environmentService.resolveSigmaDir(projectRoot);
}

/**
 * Get the message queue directory path.
 *
 * @deprecated Use environmentService.resolveSigmaDir() + '/message_queue'
 * @param projectRoot - The project root directory (defaults to process.cwd())
 * @returns The absolute path to the message_queue directory
 */
export function getMessageQueueDirectory(projectRoot?: string): string {
  return path.join(getSigmaDirectory(projectRoot), 'message_queue');
}
