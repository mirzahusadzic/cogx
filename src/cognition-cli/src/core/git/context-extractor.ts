import { execa } from 'execa';
import path from 'path';

export interface GitContext {
  commit_hash?: string;
  author?: string;
  message?: string;
  timestamp?: string;
}

export interface GitDiffContext {
  insertions: number;
  deletions: number;
  hunks: string[];
}

/**
 * Extracts Git context for a specific file.
 * Returns information about the last commit that affected the file.
 *
 * @param filePath - Absolute path to the file
 * @param projectRoot - Root directory of the Git repository
 */
export async function extractGitContext(
  filePath: string,
  projectRoot: string
): Promise<GitContext | null> {
  try {
    // Check if we're in a git repo
    await execa('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: projectRoot,
    });

    const relativePath = path.relative(projectRoot, filePath);

    // Get last commit info for the file
    // %H: commit hash, %an: author name, %B: message, %cI: committer date (ISO 8601)
    const { stdout } = await execa(
      'git',
      ['log', '-1', '--format=%H%n%an%n%B%n%cI', '--', relativePath],
      { cwd: projectRoot }
    );

    if (!stdout.trim()) {
      return null;
    }

    const lines = stdout.split('\n');
    if (lines.length < 4) {
      return null;
    }
    const commit_hash = lines[0];
    const author = lines[1];
    const timestamp = lines[lines.length - 1];
    const message = lines
      .slice(2, lines.length - 1)
      .join('\n')
      .trim();

    return {
      commit_hash,
      author,
      message,
      timestamp,
    };
  } catch {
    return null;
  }
}

/**
 * Extracts Git diff context (unstaged changes) for a specific file.
 *
 * @param filePath - Absolute path to the file
 * @param projectRoot - Root directory of the Git repository
 */
export async function extractGitDiffContext(
  filePath: string,
  projectRoot: string
): Promise<GitDiffContext | null> {
  try {
    const relativePath = path.relative(projectRoot, filePath);

    const { stdout: diffOutput } = await execa(
      'git',
      ['diff', 'HEAD', '--', relativePath],
      { cwd: projectRoot }
    );

    if (!diffOutput.trim()) {
      return null;
    }

    const { stdout: statOutput } = await execa(
      'git',
      ['diff', '--numstat', 'HEAD', '--', relativePath],
      { cwd: projectRoot }
    );

    const parts = statOutput.trim().split(/\s+/);
    if (parts.length < 2) {
      return null;
    }
    const insertions = parseInt(parts[0], 10) || 0;
    const deletions = parseInt(parts[1], 10) || 0;

    // Simple hunk extraction (split by '@@')
    const hunks = diffOutput
      .split('\n')
      .filter((line) => line.startsWith('@@'))
      .map((line) => line.trim());

    return {
      insertions,
      deletions,
      hunks,
    };
  } catch {
    return null;
  }
}
