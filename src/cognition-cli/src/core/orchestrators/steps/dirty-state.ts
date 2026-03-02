import { BaseStep } from './base.js';
import type { PipelineContext, StepResult } from '../types.js';
import { DirtyStateManager } from '../../watcher/dirty-state.js';
import path from 'path';
import fs from 'fs-extra';
import { getLanguageFromExtension } from '../../../config.js';
import type { SourceFile } from '../../types/structural.js';

/**
 * Step to discover dirty and untracked files using the DirtyStateManager.
 */
export class DirtyStateDiscoveryStep extends BaseStep {
  name = 'DirtyStateDiscovery';

  async execute(context: PipelineContext): Promise<StepResult> {
    const pgcRoot = path.join(context.projectRoot, '.open_cognition');
    const dirtyStateManager = new DirtyStateManager(pgcRoot);

    this.log(`Reading dirty state`, context);
    const dirtyState = await dirtyStateManager.read();

    if (
      dirtyState.dirty_files.length === 0 &&
      dirtyState.untracked_files.length === 0
    ) {
      this.log('PGC is coherent - nothing to update', context);
      context.filesToProcess = [];
      context.sourceFiles = [];
      return this.success('Nothing to update');
    }

    this.log(
      `Found ${dirtyState.dirty_files.length} dirty files and ${dirtyState.untracked_files.length} untracked files`,
      context
    );

    const changedFilesCount =
      dirtyState.dirty_files.length + dirtyState.untracked_files.length;
    if (changedFilesCount > 0) {
      this.log(`Detected ${changedFilesCount} changed files:`, context);
      const allChangedPaths = [
        ...dirtyState.dirty_files.map((f) => f.path),
        ...dirtyState.untracked_files.map((f) => f.path),
      ];
      const displayLimit = 10;
      allChangedPaths
        .slice(0, displayLimit)
        .forEach((f) => this.log(`  - ${f}`, context));
      if (allChangedPaths.length > displayLimit) {
        this.log(
          `  ... and ${allChangedPaths.length - displayLimit} more.`,
          context
        );
      }
    }

    const allFiles: SourceFile[] = [];

    // Process dirty files
    for (const dirtyFile of dirtyState.dirty_files) {
      const fullPath = path.join(context.projectRoot, dirtyFile.path);
      if (await fs.pathExists(fullPath)) {
        const content = await fs.readFile(fullPath, 'utf-8');
        const language = getLanguageFromExtension(
          path.extname(fullPath).toLowerCase()
        );
        allFiles.push({
          path: fullPath,
          relativePath: dirtyFile.path,
          name: path.basename(fullPath),
          content,
          language: language as 'typescript' | 'javascript' | 'python',
        });
      }
    }

    // Process untracked files
    for (const untrackedFile of dirtyState.untracked_files) {
      const fullPath = path.join(context.projectRoot, untrackedFile.path);
      if (await fs.pathExists(fullPath)) {
        const content = await fs.readFile(fullPath, 'utf-8');
        const language = getLanguageFromExtension(
          path.extname(fullPath).toLowerCase()
        );
        allFiles.push({
          path: fullPath,
          relativePath: untrackedFile.path,
          name: path.basename(fullPath),
          content,
          language: language as 'typescript' | 'javascript' | 'python',
        });
      }
    }

    context.filesToProcess = allFiles.map((f) => f.relativePath);
    context.sourceFiles = allFiles;
    context.dirtyStateManager = dirtyStateManager; // Store for later clearing

    return this.success(`Found ${allFiles.length} files to process.`);
  }
}

/**
 * Step to clear the dirty state after successful processing.
 */
export class ClearDirtyStateStep extends BaseStep {
  name = 'ClearDirtyState';

  async execute(context: PipelineContext): Promise<StepResult> {
    const dirtyStateManager = context.dirtyStateManager as DirtyStateManager;
    if (dirtyStateManager) {
      this.log('Clearing dirty state');
      await dirtyStateManager.clear();
    }
    return this.success();
  }
}
