import fs from 'fs-extra';
import path from 'path';
import { log, spinner } from '@clack/prompts';
import chalk from 'chalk';

import type { PGCManager } from '../pgc/manager.js';
import type { StructuralMiner } from './miners/structural.js';
import type { WorkbenchClient } from '../executors/workbench-client.js';
import { GenesisOracle } from '../pgc/oracles/genesis.js';
import { DirtyStateManager } from '../watcher/dirty-state.js';
import type { DirtyFile } from '../types/watcher.js';

import {
  DEFAULT_MAX_FILE_SIZE,
  WORKBENCH_DEPENDENT_EXTRACTION_METHODS,
} from '../../config.js';

/**
 * UpdateOrchestrator implements the Invalidate algorithm from CogX:
 *
 * Change(⊥) → Invalidate(⊥) → Propagate_Up(Join_edges) → Invalidate(⊤)
 *
 * Propagation Model 1: Horizontal Shockwave (Bottom-Up Change)
 * 1. File watcher detects Sraw change (dirty_state.json)
 * 2. Update re-processes file (using GenesisOrchestrator logic)
 * 3. Invalidate upward through Genesis (using reverse_deps)
 * 4. Propagate horizontally to Overlays
 *
 * This keeps the PGC coherent after source code changes.
 */
export class UpdateOrchestrator {
  private maxFileSize = DEFAULT_MAX_FILE_SIZE;

  constructor(
    private pgc: PGCManager,
    private miner: StructuralMiner,
    private workbench: WorkbenchClient,
    private genesisOracle: GenesisOracle,
    private projectRoot: string
  ) {}

  /**
   * Execute incremental update based on dirty_state.json
   */
  async executeIncrementalUpdate(): Promise<void> {
    const s = spinner();
    const pgcRoot = path.join(this.projectRoot, '.open_cognition');
    const dirtyStateManager = new DirtyStateManager(pgcRoot);

    // Check workbench health
    let isWorkbenchHealthy = false;
    try {
      await this.workbench.health();
      isWorkbenchHealthy = true;
    } catch (error) {
      log.warn(
        chalk.yellow(
          `Workbench (eGemma) is not reachable at ${this.workbench.getBaseUrl()}. ` +
            `Structural mining will be skipped. Please ensure eGemma is running.`
        )
      );
    }

    // Read dirty state
    s.start('Reading dirty state');
    const dirtyState = await dirtyStateManager.read();
    s.stop(
      `Found ${dirtyState.dirty_files.length} dirty files, ${dirtyState.untracked_files.length} untracked files`
    );

    if (
      dirtyState.dirty_files.length === 0 &&
      dirtyState.untracked_files.length === 0
    ) {
      log.info(chalk.green('✓ PGC is coherent - nothing to update'));
      return;
    }

    // Process dirty files (modified files that are already tracked)
    log.info(chalk.cyan('Updating modified files...'));
    let filesProcessed = 0;
    for (const dirtyFile of dirtyState.dirty_files) {
      const processed = await this.processDirtyFile(
        dirtyFile,
        s,
        isWorkbenchHealthy
      );
      if (processed) filesProcessed++;
    }

    // Process untracked files (new files not yet in PGC)
    if (dirtyState.untracked_files.length > 0) {
      log.info(chalk.cyan('Processing new untracked files...'));
      for (const untrackedFile of dirtyState.untracked_files) {
        await this.processUntrackedFile(
          untrackedFile.path,
          s,
          isWorkbenchHealthy
        );
        filesProcessed++;
      }
    }

    // Clear dirty state
    s.start('Clearing dirty state');
    await dirtyStateManager.clear();
    s.stop('Dirty state cleared');

    // Run PGC verification only if files were actually processed
    if (filesProcessed > 0) {
      s.start('Running PGC Maintenance and Verification');
      log.info(
        'Goal: Achieve a structurally coherent PGC after incremental update.'
      );

      const verificationResult = await this.genesisOracle.verify();

      if (verificationResult.success) {
        s.stop('Oracle: Verification complete. PGC is structurally coherent.');
      } else {
        s.stop('Oracle: Verification failed.');
        log.error(chalk.red('✗ PGC verification failed:'));
        verificationResult.messages.forEach((msg) =>
          log.error(chalk.red(`  ${msg}`))
        );
        throw new Error('PGC verification failed after update');
      }
    } else {
      // No files were actually processed - dirty_state had false positives
      log.info(
        chalk.gray(
          'No files required processing (false positives in dirty_state)'
        )
      );
    }
  }

  /**
   * Process a dirty file (modified file already in PGC)
   * Implements: Change(⊥) → Invalidate(⊥) → Propagate_Up
   *
   * @returns true if file was actually processed, false if skipped
   */
  private async processDirtyFile(
    dirtyFile: DirtyFile,
    s: ReturnType<typeof spinner>,
    isWorkbenchHealthy: boolean
  ): Promise<boolean> {
    s.start(`Updating ${chalk.cyan(dirtyFile.path)}`);

    try {
      const fullPath = path.join(this.projectRoot, dirtyFile.path);

      // Check if file still exists (might have been deleted)
      if (!(await fs.pathExists(fullPath))) {
        s.stop(chalk.yellow(`⸬ ${dirtyFile.path} (file was deleted)`));
        // TODO: Handle file deletion (remove from index, propagate invalidation)
        return false;
      }

      // Read file content
      const content = await fs.readFile(fullPath, 'utf-8');
      const contentHash = this.pgc.objectStore.computeHash(content);

      // Verify it's actually different (paranoid check)
      if (contentHash === dirtyFile.tracked_hash) {
        s.stop(chalk.gray(`- ${dirtyFile.path} (no change detected)`));
        return false;
      }

      // Store new content
      await this.pgc.objectStore.store(content);

      // Extract structural data
      const language = this.detectLanguage(dirtyFile.path);
      const structural = await this.miner.extractStructure({
        path: fullPath,
        relativePath: dirtyFile.path,
        name: path.basename(dirtyFile.path),
        content,
        language,
      });

      const structuralHash = await this.pgc.objectStore.store(
        JSON.stringify(structural, null, 2)
      );

      // Check if workbench-dependent extraction is needed
      const isWorkbenchDependentExtraction =
        WORKBENCH_DEPENDENT_EXTRACTION_METHODS.includes(
          structural.extraction_method
        );

      if (!isWorkbenchHealthy && isWorkbenchDependentExtraction) {
        s.stop(
          chalk.yellow(
            `⸬ ${dirtyFile.path} (skipped workbench processing - workbench not healthy)`
          )
        );
        return false;
      }

      // Record transformation
      const existingIndex = await this.pgc.index.get(dirtyFile.path);
      const transformId = await this.pgc.transformLog.record({
        goal: {
          objective: 'Incremental update of modified source file',
          criteria: [
            'Valid syntax',
            'Complete import list',
            'All exports identified',
          ],
          phimin: 0.8,
        },
        inputs: [{ path: dirtyFile.path, hash: contentHash }],
        outputs: [{ path: dirtyFile.path, hash: structuralHash }],
        method: structural.extraction_method,
        fidelity: structural.fidelity,
      });

      // Update index with new hashes and transform
      const newHistory = existingIndex?.history
        ? [...existingIndex.history, transformId]
        : [transformId];

      await this.pgc.index.set(dirtyFile.path, {
        path: dirtyFile.path,
        content_hash: contentHash,
        structural_hash: structuralHash,
        status: 'Valid',
        history: newHistory,
        structuralData: structural,
      });

      // Update reverse_deps
      await this.pgc.reverseDeps.add(contentHash, transformId);
      await this.pgc.reverseDeps.add(structuralHash, transformId);

      // TODO: Propagate invalidation upward through reverse_deps
      // This will be implemented when overlays are fully synthesized and attached
      // For now, we just update the Genesis Layer directly
      // await this.propagateInvalidation(dirtyFile.tracked_hash);

      s.stop(chalk.green(`✓ ${dirtyFile.path}`));
      return true;
    } catch (error) {
      s.stop(chalk.red(`✗ ${dirtyFile.path}: ${(error as Error).message}`));
      throw error;
    }
  }

  /**
   * Process an untracked file (new file not yet in PGC)
   */
  private async processUntrackedFile(
    relativePath: string,
    s: ReturnType<typeof spinner>,
    isWorkbenchHealthy: boolean
  ): Promise<void> {
    s.start(`Processing new file ${chalk.cyan(relativePath)}`);

    try {
      const fullPath = path.join(this.projectRoot, relativePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const contentHash = this.pgc.objectStore.computeHash(content);

      // Store content
      await this.pgc.objectStore.store(content);

      // Extract structural data
      const language = this.detectLanguage(relativePath);
      const structural = await this.miner.extractStructure({
        path: fullPath,
        relativePath,
        name: path.basename(relativePath),
        content,
        language,
      });

      const structuralHash = await this.pgc.objectStore.store(
        JSON.stringify(structural, null, 2)
      );

      // Check if workbench-dependent
      const isWorkbenchDependentExtraction =
        WORKBENCH_DEPENDENT_EXTRACTION_METHODS.includes(
          structural.extraction_method
        );

      if (!isWorkbenchHealthy && isWorkbenchDependentExtraction) {
        s.stop(
          chalk.yellow(
            `⸬ ${relativePath} (skipped workbench processing - workbench not healthy)`
          )
        );
        return;
      }

      // Record transformation
      const transformId = await this.pgc.transformLog.record({
        goal: {
          objective: 'Add new untracked file to PGC',
          criteria: [
            'Valid syntax',
            'Complete import list',
            'All exports identified',
          ],
          phimin: 0.8,
        },
        inputs: [{ path: relativePath, hash: contentHash }],
        outputs: [{ path: relativePath, hash: structuralHash }],
        method: structural.extraction_method,
        fidelity: structural.fidelity,
      });

      // Create new index entry
      await this.pgc.index.set(relativePath, {
        path: relativePath,
        content_hash: contentHash,
        structural_hash: structuralHash,
        status: 'Valid',
        history: [transformId],
        structuralData: structural,
      });

      // Update reverse_deps
      await this.pgc.reverseDeps.add(contentHash, transformId);
      await this.pgc.reverseDeps.add(structuralHash, transformId);

      s.stop(chalk.green(`✓ ${relativePath} (new)`));
    } catch (error) {
      s.stop(chalk.red(`✗ ${relativePath}: ${(error as Error).message}`));
      throw error;
    }
  }

  /**
   * Propagate invalidation upward through the lattice
   * Implements: Invalidate(⊥) → Propagate_Up(Join_edges)
   *
   * This is the recursive algorithm from CogX:
   * 1. Find all transforms that depend on this hash (via reverse_deps)
   * 2. Mark their outputs as Invalidated
   * 3. Recursively propagate upward
   *
   * NOTE: Currently a stub. This will be fully implemented when:
   * - Overlays are fully synthesized and attached to Genesis Layer
   * - Directory summaries create Join operations that need invalidation
   * - Multi-agent coordination requires Delta calculation
   *
   * For Monument 3, we focus on the core: re-process dirty files and clear state.
   * The propagation infrastructure (reverse_deps) is already in place for future use.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async propagateInvalidation(_objectHash: string): Promise<void> {
    // Future implementation will use reverse_deps to traverse upward:
    //
    // 1. const dependentTransforms = await this.pgc.reverseDeps.get(objectHash)
    // 2. For each transform:
    //    - Read manifest to get output hashes
    //    - Mark those in index as status='Invalidated'
    //    - Recursively call propagateInvalidation on those hashes
    // 3. Propagate to overlays that anchor to this Genesis element
    //
    // This will enable the full Horizontal Shockwave propagation model.
  }

  /**
   * Detect language from file extension
   */
  private detectLanguage(
    filePath: string
  ): 'typescript' | 'javascript' | 'python' {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.ts' || ext === '.tsx') return 'typescript';
    if (ext === '.js' || ext === '.jsx') return 'javascript';
    if (ext === '.py') return 'python';
    return 'typescript'; // Default
  }
}
