/**
 * Workspace Manager
 *
 * Locates Grounded Context Pool (PGC) workspaces by traversing the
 * directory tree upward (git-style). All cognition-cli commands require
 * a PGC workspace (.open_cognition directory) to operate.
 *
 * DESIGN:
 * Similar to how git searches for .git/, this manager walks up from
 * the current directory to find the nearest .open_cognition directory.
 * This allows commands to be run from any subdirectory within a project.
 *
 * ALGORITHM:
 * 1. Start at given directory (default: process.cwd())
 * 2. Check if .open_cognition exists in current dir
 * 3. If not found, move to parent directory
 * 4. Repeat until found or filesystem root reached
 * 5. Return project root (parent of .open_cognition) or null
 *
 * @example
 * // From project root
 * const manager = new WorkspaceManager();
 * const root = manager.resolvePgcRoot();
 * // → /path/to/project
 *
 * @example
 * // From nested subdirectory
 * const manager = new WorkspaceManager();
 * const root = manager.resolvePgcRoot('/path/to/project/src/utils');
 * // → /path/to/project (walks up to find .open_cognition)
 *
 * @example
 * // No PGC workspace
 * const manager = new WorkspaceManager();
 * const root = manager.resolvePgcRoot('/tmp');
 * // → null (no .open_cognition found)
 */

import { environmentService } from './services/environment/EnvironmentService.js';

export class WorkspaceManager {
  /**
   * Find PGC root by walking up directory tree
   *
   * @deprecated Use environmentService.findProjectRoot()
   * @param startDir - Directory to start search from (default: process.cwd())
   * @returns Path to project root (containing .open_cognition) or null if not found
   */
  resolvePgcRoot(startDir: string = process.cwd()): string | null {
    return environmentService.findProjectRoot(startDir);
  }
}
