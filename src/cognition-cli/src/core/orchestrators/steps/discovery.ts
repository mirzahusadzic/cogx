import { BaseStep } from './base.js';
import type { PipelineContext, StepResult } from '../types.js';
import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import {
  DEFAULT_FILE_EXTENSIONS,
  DEFAULT_MAX_FILE_SIZE,
  getLanguageFromExtension,
} from '../../../config.js';
import type { SourceFile } from '../../types/structural.js';

/**
 * Step to discover source files in the project.
 * Uses glob with common exclusion patterns.
 */
export class DiscoveryStep extends BaseStep {
  name = 'Discovery';

  constructor(private readonly sourcePaths: string[]) {
    super();
  }

  async execute(context: PipelineContext): Promise<StepResult> {
    const allFiles: SourceFile[] = [];
    const seenPaths = new Set<string>();

    for (const sourcePath of this.sourcePaths) {
      const actualSourcePath = path.isAbsolute(sourcePath)
        ? sourcePath
        : path.join(context.projectRoot, sourcePath);

      if (!(await fs.pathExists(actualSourcePath))) {
        this.log(`Source path does not exist: ${actualSourcePath}`, context);
        continue;
      }

      this.log(`Scanning for files in: ${actualSourcePath}`, context);
      const files = await this.discoverInPath(
        actualSourcePath,
        context.projectRoot
      );
      for (const file of files) {
        if (!seenPaths.has(file.relativePath)) {
          seenPaths.add(file.relativePath);
          allFiles.push(file);
        }
      }
    }

    context.filesToProcess = allFiles.map((f) => f.relativePath);
    context.sourceFiles = allFiles;

    // Identify changed files by comparing with index
    const changedFiles: string[] = [];
    for (const file of allFiles) {
      const existing = await context.pgc.index.get(file.relativePath);
      const currentHash = context.pgc.objectStore.computeHash(file.content);
      if (!existing || existing.content_hash !== currentHash) {
        changedFiles.push(file.relativePath);
      }
    }

    this.log(`Discovered ${allFiles.length} files.`, context);
    if (changedFiles.length > 0) {
      this.log(`Detected ${changedFiles.length} changed files:`, context);
      const displayLimit = 10;
      changedFiles
        .slice(0, displayLimit)
        .forEach((f) => this.log(`  - ${f}`, context));
      if (changedFiles.length > displayLimit) {
        this.log(
          `  ... and ${changedFiles.length - displayLimit} more.`,
          context
        );
      }
    } else {
      this.log('No changed files detected.', context);
    }

    if (context.onProgress) {
      context.onProgress(0, allFiles.length, `Found ${allFiles.length} files`);
    }

    return this.success(`Discovered ${allFiles.length} files.`);
  }

  private async discoverInPath(
    rootPath: string,
    projectRoot: string
  ): Promise<SourceFile[]> {
    const extensions = DEFAULT_FILE_EXTENSIONS;
    const extPattern = extensions.map((ext) => ext.slice(1)).join(',');
    const pattern = `**/*.{${extPattern}}`;

    const filePaths = await glob(pattern, {
      cwd: rootPath,
      absolute: true,
      ignore: [
        '**/node_modules/**',
        '**/.git/**',
        '**/__pycache__/**',
        '**/.open_cognition/**',
        '**/dist/**',
        '**/docs/**',
        '**/build/**',
        '**/cache/**',
        '**/.next/**',
        '**/.nuxt/**',
        '**/.venv*/**',
        '**/.*/**', // All hidden directories
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.test.js',
        '**/*.test.jsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/*.spec.js',
        '**/*.spec.jsx',
      ],
      nodir: true,
    });

    const results: SourceFile[] = [];
    for (const fullPath of filePaths) {
      try {
        const stats = await fs.stat(fullPath);
        if (stats.size > DEFAULT_MAX_FILE_SIZE) {
          continue;
        }

        const relativePath = path.relative(projectRoot, fullPath);
        const content = await fs.readFile(fullPath, 'utf-8');
        const ext = path.extname(fullPath).toLowerCase();
        const language = getLanguageFromExtension(ext);

        results.push({
          path: fullPath,
          relativePath,
          name: path.basename(fullPath),
          content,
          language: language as 'typescript' | 'javascript' | 'python',
        });
      } catch (error) {
        this.log(`Error reading file ${fullPath}: ${error}`);
      }
    }
    return results;
  }
}
