import fs from 'fs-extra';
import path from 'path';

/**
 * Workspace Manager
 *
 * Finds PGC workspaces by walking up directory tree (git-style)
 */
export class WorkspaceManager {
  /**
   * Find .open_cognition by walking up directory tree
   * Returns null if not found
   */
  resolvePgcRoot(startDir: string = process.cwd()): string | null {
    let currentDir = path.resolve(startDir);
    const root = path.parse(currentDir).root;

    while (currentDir !== root) {
      const pgcPath = path.join(currentDir, '.open_cognition');
      if (fs.existsSync(pgcPath)) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }

    // Check root directory too
    const pgcPath = path.join(root, '.open_cognition');
    if (fs.existsSync(pgcPath)) {
      return root;
    }

    return null;
  }
}
