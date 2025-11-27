/**
 * Source Directory Auto-Detection
 *
 * Intelligently detects code and documentation directories in a project
 * based on common patterns and project manifests.
 *
 * SUPPORTED LANGUAGES (via egemma workbench):
 * - TypeScript (.ts, .tsx)
 * - JavaScript (.js, .jsx)
 * - Python (.py)
 *
 * Detection heuristics:
 * 1. Package manifests (package.json, pyproject.toml, setup.py)
 * 2. Common source directories (src/, lib/, app/)
 * 3. Python packages (directories with __init__.py)
 * 4. Documentation patterns (README.md, VISION.md, docs/)
 *
 * @example
 * const detected = await detectSources('/path/to/project');
 * // { code: ['src/', 'lib/'], docs: ['README.md', 'docs/'] }
 */

import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import { LANGUAGE_MAP } from '../config.js';

/** Detected directory with metadata */
export interface DetectedDirectory {
  /** Relative path from project root */
  path: string;
  /** Number of relevant files found */
  fileCount: number;
  /** Primary language detected */
  language?: string;
  /** Whether this was auto-selected */
  selected: boolean;
}

/** Detection results */
export interface DetectionResult {
  /** Detected code directories */
  code: DetectedDirectory[];
  /** Detected documentation paths */
  docs: DetectedDirectory[];
  /** Project type detected */
  projectType: 'typescript' | 'javascript' | 'python' | 'unknown';
}

/**
 * Re-export LANGUAGE_MAP as SUPPORTED_EXTENSIONS for backward compatibility
 * Source of truth is now in config.ts
 */
export const SUPPORTED_EXTENSIONS = LANGUAGE_MAP;

/** Get all supported extensions as array */
export const SUPPORTED_EXT_LIST = Object.keys(LANGUAGE_MAP);

/** File extensions grouped by language */
const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  typescript: ['.ts', '.tsx'],
  javascript: ['.js', '.jsx'],
  python: ['.py'],
};

/** Common directories to ignore */
const IGNORE_DIRS = [
  'node_modules',
  '.git',
  '.open_cognition',
  '.sigma',
  '.venv',
  '.venv_docs',
  '__pycache__',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.pytest_cache',
  '.ruff_cache',
  'coverage',
];

/**
 * Detect project type from manifest files
 */
async function detectProjectType(
  projectRoot: string
): Promise<DetectionResult['projectType']> {
  if (await fs.pathExists(path.join(projectRoot, 'package.json'))) {
    // Check if TypeScript
    if (await fs.pathExists(path.join(projectRoot, 'tsconfig.json'))) {
      return 'typescript';
    }
    return 'javascript';
  }

  if (
    (await fs.pathExists(path.join(projectRoot, 'pyproject.toml'))) ||
    (await fs.pathExists(path.join(projectRoot, 'setup.py')))
  ) {
    return 'python';
  }

  return 'unknown';
}

/**
 * Count code files in a directory (only supported extensions)
 */
async function countCodeFiles(
  dirPath: string,
  extensions: string[]
): Promise<{ count: number; language: string }> {
  const pattern = `**/*{${extensions.join(',')}}`;

  try {
    const files = await glob(pattern, {
      cwd: dirPath,
      ignore: IGNORE_DIRS.map((d) => `**/${d}/**`),
      nodir: true,
    });

    // Determine primary language
    const langCounts: Record<string, number> = {};
    for (const file of files) {
      const ext = path.extname(file);
      for (const [lang, exts] of Object.entries(LANGUAGE_EXTENSIONS)) {
        if (exts.includes(ext)) {
          langCounts[lang] = (langCounts[lang] || 0) + 1;
        }
      }
    }

    const primaryLang =
      Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      'unknown';

    return { count: files.length, language: primaryLang };
  } catch {
    return { count: 0, language: 'unknown' };
  }
}

/**
 * Find all potential code directories
 */
async function findCodeDirectories(
  projectRoot: string,
  projectType: DetectionResult['projectType']
): Promise<DetectedDirectory[]> {
  const results: DetectedDirectory[] = [];
  const allExtensions = Object.values(LANGUAGE_EXTENSIONS).flat();

  // Get all top-level directories
  const entries = await fs.readdir(projectRoot, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory())
    .filter((e) => !e.name.startsWith('.'))
    .filter((e) => !IGNORE_DIRS.includes(e.name))
    .map((e) => e.name);

  // Priority directories based on project type
  const priorityDirs: string[] = [];
  if (projectType === 'typescript' || projectType === 'javascript') {
    priorityDirs.push('src', 'lib', 'app');
  } else if (projectType === 'python') {
    priorityDirs.push('src');
  }

  // Check each directory
  for (const dir of dirs) {
    const dirPath = path.join(projectRoot, dir);
    const { count, language } = await countCodeFiles(dirPath, allExtensions);

    if (count > 0) {
      // Check for Python package (__init__.py)
      const isPythonPackage = await fs.pathExists(
        path.join(dirPath, '__init__.py')
      );

      // Auto-select logic:
      // 1. Priority dirs (src, lib, app)
      // 2. Python packages with 3+ files
      // 3. For Python projects: any dir with 5+ Python files (handles non-package dirs like tasks/)
      const isSignificantPythonDir =
        projectType === 'python' && language === 'python' && count >= 5;

      results.push({
        path: `${dir}/`,
        fileCount: count,
        language,
        selected:
          priorityDirs.includes(dir) ||
          (isPythonPackage && count >= 3) ||
          isSignificantPythonDir,
      });
    }
  }

  // Sort: selected first, then by file count
  results.sort((a, b) => {
    if (a.selected !== b.selected) return a.selected ? -1 : 1;
    return b.fileCount - a.fileCount;
  });

  return results;
}

/**
 * Find documentation files and directories
 */
async function findDocumentation(
  projectRoot: string
): Promise<DetectedDirectory[]> {
  const results: DetectedDirectory[] = [];

  // Check for common doc files
  const docFiles = ['README.md', 'VISION.md', 'ARCHITECTURE.md', 'DESIGN.md'];
  for (const file of docFiles) {
    if (await fs.pathExists(path.join(projectRoot, file))) {
      results.push({
        path: file,
        fileCount: 1,
        selected: file === 'README.md' || file === 'VISION.md',
      });
    }
  }

  // Check for docs directory
  const docDirs = ['docs', 'doc', 'documentation'];
  for (const dir of docDirs) {
    const dirPath = path.join(projectRoot, dir);
    if (await fs.pathExists(dirPath)) {
      const mdFiles = await glob('**/*.md', {
        cwd: dirPath,
        nodir: true,
      });
      if (mdFiles.length > 0) {
        results.push({
          path: `${dir}/`,
          fileCount: mdFiles.length,
          selected: true,
        });
      }
    }
  }

  return results;
}

/**
 * Auto-detect source code and documentation directories
 *
 * @param projectRoot - Root directory to scan
 * @returns Detection results with code dirs, doc paths, and project type
 *
 * @example
 * const result = await detectSources('/path/to/project');
 * console.log(result.code);  // [{ path: 'src/', fileCount: 42, selected: true }]
 * console.log(result.docs);  // [{ path: 'README.md', fileCount: 1, selected: true }]
 */
export async function detectSources(
  projectRoot: string
): Promise<DetectionResult> {
  const projectType = await detectProjectType(projectRoot);
  const code = await findCodeDirectories(projectRoot, projectType);
  const docs = await findDocumentation(projectRoot);

  return { code, docs, projectType };
}

/**
 * Get selected paths from detection result
 *
 * @param detected - Detection result
 * @returns Object with selected code and doc paths as string arrays
 */
export function getSelectedPaths(detected: DetectionResult): {
  code: string[];
  docs: string[];
} {
  return {
    code: detected.code.filter((d) => d.selected).map((d) => d.path),
    docs: detected.docs.filter((d) => d.selected).map((d) => d.path),
  };
}
