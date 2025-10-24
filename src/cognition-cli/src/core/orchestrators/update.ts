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
      // Only track structural dependencies - content hash is just provenance
      await this.pgc.reverseDeps.add(structuralHash, transformId);

      // Propagate invalidation only if structure changed (Monument 4)
      // Old content hashes become stale naturally without explicit handling
      const oldStructuralHash = existingIndex?.structural_hash;
      if (oldStructuralHash && oldStructuralHash !== structuralHash) {
        await this.propagateInvalidation(oldStructuralHash);
      }

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
      // Only track structural dependencies - content hash is just provenance
      await this.pgc.reverseDeps.add(structuralHash, transformId);
      // No propagation needed for new files - nothing depended on them before

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
   * Monument 4: Surgical invalidation
   * When a source file changes, only invalidate transforms that depend on it.
   * This enables:
   * - Incremental overlay regeneration (only affected patterns)
   * - Surgical context updates (only changed symbols)
   * - Efficient CI/CD (skip unchanged analysis)
   */
  private async propagateInvalidation(objectHash: string): Promise<void> {
    // 1. Find all transforms that consumed this hash
    const dependentTransforms =
      await this.pgc.reverseDeps.getTransformIds(objectHash);

    if (dependentTransforms.length === 0) {
      // Leaf node - nothing depends on this, we're done
      return;
    }

    // 2. For each dependent transform
    for (const transformId of dependentTransforms) {
      const transform =
        await this.pgc.transformLog.getTransformData(transformId);

      if (!transform) {
        // Transform was deleted, skip
        continue;
      }

      // 3. Mark its outputs as Invalidated
      for (const output of transform.outputs) {
        const indexEntry = await this.pgc.index.get(output.path);

        if (indexEntry && indexEntry.structural_hash === output.hash) {
          // Output still matches transform output - invalidate it
          await this.pgc.index.set(output.path, {
            ...indexEntry,
            status: 'Invalidated',
          });

          // 4. Recursively propagate upward
          await this.propagateInvalidation(output.hash);
        }
      }
    }

    // 5. Invalidate overlays that anchor to this Genesis element
    // This will mark structural_patterns and lineage_patterns for regeneration
    await this.invalidateOverlays(objectHash);

    // 6. Monument 4.9: Invalidate reverse dependencies (O₂ propagation)
    // When file A changes, also invalidate lineage patterns of files that depend on A
    await this.invalidateReverseDependencies(objectHash);
  }

  /**
   * Invalidate overlays that depend on a Genesis structural hash
   * Implements: Overlay invalidation when anchored Genesis elements change
   *
   * When a source file's structure changes, all overlays (patterns, embeddings)
   * that anchor to the old structure must be invalidated and regenerated.
   *
   * Monument 4.9: Also invalidates lineage_patterns for O₂ layer coherence
   */
  private async invalidateOverlays(structuralHash: string): Promise<void> {
    const overlayTypes = ['structural_patterns', 'lineage_patterns'];

    for (const overlayType of overlayTypes) {
      try {
        // Get all overlay files for this type
        const overlaysDir = path.join(this.projectRoot, '.open_cognition', 'overlays', overlayType);

        if (!(await fs.pathExists(overlaysDir))) {
          continue; // No overlays of this type yet
        }

        // Recursively find all .json files except manifest.json
        const overlayFiles = await this.findOverlayFiles(overlaysDir);

        for (const overlayFile of overlayFiles) {
          try {
            const overlayData = await fs.readJSON(overlayFile);

            // Check if this overlay anchors to the invalidated structural hash
            if (overlayData.symbolStructuralDataHash === structuralHash) {
              // Delete the overlay file - it will be regenerated on next overlay generation
              await fs.remove(overlayFile);

              // Also remove from manifest
              const symbolName = overlayData.symbol;
              await this.removeFromManifest(overlayType, symbolName);
            }
          } catch (error) {
            // Overlay file might be corrupted or incomplete - skip it
            continue;
          }
        }
      } catch (error) {
        // If overlay invalidation fails, log but don't block the update
        log.warn(
          chalk.yellow(
            `Warning: Failed to invalidate ${overlayType} overlays: ${(error as Error).message}`
          )
        );
      }
    }
  }

  /**
   * Recursively find all overlay .json files except manifest.json
   */
  private async findOverlayFiles(dir: string): Promise<string[]> {
    const results: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recursively search subdirectories
        const subResults = await this.findOverlayFiles(fullPath);
        results.push(...subResults);
      } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'manifest.json') {
        results.push(fullPath);
      }
    }

    return results;
  }

  /**
   * Remove a symbol from the overlay manifest
   */
  private async removeFromManifest(overlayType: string, symbolName: string): Promise<void> {
    try {
      const manifest = await this.pgc.overlays.getManifest(overlayType);
      if (manifest[symbolName]) {
        delete manifest[symbolName];

        const manifestPath = path.join(
          this.projectRoot,
          '.open_cognition',
          'overlays',
          overlayType,
          'manifest.json'
        );
        await fs.writeJSON(manifestPath, manifest, { spaces: 2 });
      }
    } catch (error) {
      // If manifest update fails, log but don't block
      log.warn(
        chalk.yellow(
          `Warning: Failed to update ${overlayType} manifest: ${(error as Error).message}`
        )
      );
    }
  }

  /**
   * Monument 4.9: Invalidate lineage patterns of files that depend on the changed file
   *
   * This implements O₂ (cross-file) invalidation. When file A changes, we must
   * invalidate the lineage patterns of all files that import A, since their
   * dependency graphs have changed.
   *
   * Algorithm:
   * 1. Get the file path from the structural hash
   * 2. Find all lineage patterns that list this file in their dependencies
   * 3. Recursively invalidate those patterns (they'll be regenerated on next overlay run)
   */
  private async invalidateReverseDependencies(structuralHash: string): Promise<void> {
    try {
      // Get the file path for this structural hash from the Genesis manifest
      const manifestPath = path.join(this.projectRoot, '.open_cognition', 'manifest.json');

      if (!(await fs.pathExists(manifestPath))) {
        return;
      }

      const genesisManifest = await fs.readJSON(manifestPath);
      let changedFilePath: string | null = null;

      for (const [filePath, hashes] of Object.entries(genesisManifest)) {
        const hashData = hashes as { structuralHash?: string };
        if (hashData.structuralHash === structuralHash) {
          changedFilePath = filePath;
          break;
        }
      }

      if (!changedFilePath) {
        // Structural hash not found in manifest - might have been deleted
        return;
      }

      // Get all lineage patterns
      const lineagePatternsDir = path.join(
        this.projectRoot,
        '.open_cognition',
        'overlays',
        'lineage_patterns'
      );

      if (!(await fs.pathExists(lineagePatternsDir))) {
        // No lineage patterns yet
        return;
      }

      const lineageFiles = await this.findOverlayFiles(lineagePatternsDir);
      const toInvalidate: string[] = [];

      // Find all lineage patterns that depend on the changed file
      for (const lineageFile of lineageFiles) {
        try {
          const lineageData = await fs.readJSON(lineageFile);

          // Parse the lineageSignature to check if it contains the changed file
          if (lineageData.lineageSignature) {
            const lineageJson = JSON.parse(lineageData.lineageSignature);

            // Check if this lineage pattern has the changed file in its dependencies
            if (lineageJson.lineage && Array.isArray(lineageJson.lineage)) {
              const dependsOnChangedFile = lineageJson.lineage.some(
                (dep: any) => dep.type && dep.type.includes(changedFilePath)
              );

              if (dependsOnChangedFile) {
                toInvalidate.push(lineageFile);
              }
            }
          }
        } catch (error) {
          // Skip corrupted lineage files
          continue;
        }
      }

      // Invalidate all affected lineage patterns
      for (const lineageFile of toInvalidate) {
        try {
          const lineageData = await fs.readJSON(lineageFile);
          await fs.remove(lineageFile);

          // Remove from manifest
          if (lineageData.symbol) {
            await this.removeFromManifest('lineage_patterns', lineageData.symbol);
          }
        } catch (error) {
          // Continue even if individual invalidation fails
          continue;
        }
      }

      if (toInvalidate.length > 0) {
        log.info(
          chalk.blue(
            `Monument 4.9: Invalidated ${toInvalidate.length} lineage pattern(s) depending on ${changedFilePath}`
          )
        );
      }
    } catch (error) {
      // If reverse dependency invalidation fails, log but don't block the update
      log.warn(
        chalk.yellow(
          `Warning: Failed to invalidate reverse dependencies: ${(error as Error).message}`
        )
      );
    }
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
