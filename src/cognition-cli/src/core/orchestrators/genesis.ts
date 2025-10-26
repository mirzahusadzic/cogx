import fs from 'fs-extra';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { log, spinner } from '@clack/prompts';
import chalk from 'chalk';
import * as workerpool from 'workerpool';
import os from 'os';

import type { PGCManager } from '../pgc/manager.js';
import type { StructuralMiner } from './miners/structural.js';
import type { WorkbenchClient } from '../executors/workbench-client.js';
import type {
  SourceFile,
  Language,
  StructuralData,
} from '../types/structural.js';
import type { GenesisJobResult } from './genesis-worker.js';
import { GenesisOracle } from '../pgc/oracles/genesis.js';

import {
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_FILE_EXTENSIONS,
  WORKBENCH_DEPENDENT_EXTRACTION_METHODS,
} from '../../config.js';

/**
 * Calculate optimal worker count for native AST parsing
 */
function calculateOptimalWorkersForParsing(fileCount: number): number {
  const cpuCount = os.cpus().length;

  if (fileCount <= 10) {
    return Math.min(2, cpuCount);
  }

  if (fileCount <= 50) {
    return Math.min(4, cpuCount);
  }

  // Large codebases: use up to 8 workers
  return Math.min(8, Math.floor(cpuCount * 0.75));
}

export class GenesisOrchestrator {
  private maxFileSize = DEFAULT_MAX_FILE_SIZE;
  // NOTE: Structural patterns manifest is now managed by overlay generator
  // private structuralPatternsManifest: Record<string, string> = {};
  private workerPool?: workerpool.Pool;

  constructor(
    private pgc: PGCManager,
    private miner: StructuralMiner,
    private workbench: WorkbenchClient,
    private genesisOracle: GenesisOracle,
    private projectRoot: string
  ) {}

  async executeBottomUpAggregation(sourcePath: string) {
    const s = spinner();
    const errors: { file: string; message: string }[] = [];

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

    s.start('Discovering source files');
    const actualSourcePath = path.join(this.projectRoot, sourcePath);
    log.info(`Scanning for files in: ${actualSourcePath}`);

    const files = await this.discoverFiles(actualSourcePath);

    s.stop(`Found ${files.length} files`);

    // Separate files into native (TS/JS) and remote (Python) for optimal processing
    const nativeFiles: SourceFile[] = [];
    const remoteFiles: SourceFile[] = [];

    for (const file of files) {
      if (file.language === 'typescript' || file.language === 'javascript') {
        nativeFiles.push(file);
      } else {
        remoteFiles.push(file);
      }
    }

    log.info(
      chalk.cyan(
        `Processing: ${nativeFiles.length} native (TS/JS), ${remoteFiles.length} remote (Python)`
      )
    );

    // Phase 1: Parse native files in parallel with workers
    const nativeResults = new Map<string, StructuralData>();

    if (nativeFiles.length > 0) {
      try {
        await this.initializeWorkers(nativeFiles.length);
        const parsedResults = await this.parseNativeFilesParallel(
          nativeFiles,
          s
        );

        for (const result of parsedResults) {
          if (result.status === 'success' && result.structuralData) {
            nativeResults.set(result.relativePath, result.structuralData);
          } else if (result.status === 'error') {
            errors.push({
              file: result.relativePath,
              message: result.error || 'Unknown error',
            });
          }
        }
      } finally {
        await this.shutdownWorkers();
      }
    }

    // Phase 2: Process all files (use parsed results for native, parse remote sequentially)
    let processed = 0;

    for (const file of files) {
      // Check if file is unchanged BEFORE starting spinner to avoid empty spinner stops
      const existingIndex = await this.pgc.index.get(file.relativePath);
      const contentHash = this.pgc.objectStore.computeHash(file.content);

      if (existingIndex && existingIndex.content_hash === contentHash) {
        // Skip unchanged files silently - don't even start the spinner
        processed++;
        continue;
      }

      s.start(
        `Processing ${chalk.cyan(file.relativePath)} (${++processed}/${files.length})`
      );
      try {
        const preParsedStructural = nativeResults.get(file.relativePath);
        await this.processFile(
          file,
          s,
          isWorkbenchHealthy,
          preParsedStructural,
          existingIndex,
          contentHash
        );
      } catch (error) {
        // processFile already called s.stop() before throwing, don't double-stop
        errors.push({
          file: file.relativePath,
          message: (error as Error).message,
        });
      }
    }

    // s.stop(`Found ${files.length} files`); // This stop is for the initial discovery, keep it.

    await this.aggregateDirectories();

    // NOTE: Structural patterns manifest is now created by overlay generator
    // Genesis no longer creates or updates the structural_patterns overlay

    await this.runPGCMaintenance(files.map((f) => f.relativePath));

    if (errors.length > 0) {
      log.error(chalk.red('\n--- Errors during file processing ---'));
      errors.forEach((err) => {
        log.error(chalk.red(`✗ ${err.file}: ${err.message}`));
      });
      log.error(chalk.red('-------------------------------------'));
    }
  }

  /**
   * Initialize worker pool for parallel native AST parsing
   */
  private async initializeWorkers(fileCount: number): Promise<void> {
    if (this.workerPool) return;

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const workerCount = calculateOptimalWorkersForParsing(fileCount);

    log.info(
      chalk.blue(
        `[Genesis] Initializing ${workerCount} workers for parallel AST parsing (${os.cpus().length} CPUs available)`
      )
    );

    this.workerPool = workerpool.pool(
      path.resolve(__dirname, '../../../dist/genesis-worker.cjs'),
      {
        workerType: 'thread', // Use worker_threads instead of child processes for better cleanup
        maxWorkers: workerCount,
      }
    );
  }

  /**
   * Shutdown worker pool
   */
  private async shutdownWorkers(): Promise<void> {
    if (this.workerPool) {
      try {
        // Force terminate with timeout to ensure workers don't hang
        await Promise.race([
          this.workerPool.terminate(true),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Worker shutdown timeout')), 5000)
          ),
        ]);
      } catch (error) {
        // Log but don't fail - workers will be killed by OS anyway
        log.warn(
          chalk.yellow(
            `[Genesis] Worker pool shutdown warning: ${(error as Error).message}`
          )
        );
      } finally {
        this.workerPool = undefined;
      }
    }
  }

  /**
   * Parse native files in parallel using workers
   */
  private async parseNativeFilesParallel(
    files: SourceFile[],
    s: ReturnType<typeof spinner>
  ): Promise<GenesisJobResult[]> {
    if (!this.workerPool) {
      throw new Error('Worker pool not initialized');
    }

    s.start(
      chalk.blue(
        `[Genesis] Parsing ${files.length} native files in parallel...`
      )
    );

    const jobs = files.map((file) => ({
      file,
      contentHash: this.pgc.objectStore.computeHash(file.content),
    }));

    try {
      const promises = jobs.map((job) =>
        this.workerPool!.exec('parseNativeAST', [job])
      );

      const results = (await Promise.all(promises)) as GenesisJobResult[];

      const succeeded = results.filter((r) => r.status === 'success').length;
      const failed = results.filter((r) => r.status === 'error').length;

      s.stop(
        chalk.green(
          `[Genesis] Native parsing complete: ${succeeded} succeeded, ${failed} failed`
        )
      );

      return results;
    } catch (error) {
      s.stop(chalk.red('[Genesis] Worker parsing error'));
      throw error;
    }
  }

  private async runPGCMaintenance(processedFiles: string[]) {
    log.step('Running PGC Maintenance and Verification');

    // The Goal
    log.info(
      'Goal: Achieve a structurally coherent PGC by removing stale entries.'
    );

    // The Transform
    const gcSummary = await this.garbageCollect(processedFiles);

    if (gcSummary.staleEntries > 0) {
      log.success(
        `Transform: Removed ${gcSummary.staleEntries} stale index entries.`
      );
    }
    if (gcSummary.cleanedReverseDeps > 0) {
      log.success(
        `Transform: Cleaned ${gcSummary.cleanedReverseDeps} stale reverse dependency entries.`
      );
    }
    if (gcSummary.cleanedTransformLogEntries > 0) {
      log.success(
        `Transform: Removed ${gcSummary.cleanedTransformLogEntries} stale transform log entries.`
      );
    }
    if (
      gcSummary.staleEntries === 0 &&
      gcSummary.cleanedReverseDeps === 0 &&
      gcSummary.cleanedTransformLogEntries === 0
    ) {
      log.info('Transform: No stale entries found. PGC is clean.');
    }

    // The Oracle
    log.info('Oracle: Verifying PGC structural coherence after maintenance.');
    const verificationResult = await this.genesisOracle.verify();

    if (verificationResult.success) {
      log.success(
        'Oracle: Verification complete. PGC is structurally coherent.'
      );
    } else {
      log.error(
        'Oracle: Verification failed. PGC has structural inconsistencies:'
      );
      verificationResult.messages.forEach((msg: string) =>
        log.error(chalk.red(`- ${msg}`))
      );
    }
  }

  private async processFile(
    file: SourceFile,
    s: ReturnType<typeof spinner>,
    isWorkbenchHealthy: boolean,
    preParsedStructural: StructuralData | undefined,
    existingIndex: Awaited<ReturnType<PGCManager['index']['get']>> | undefined,
    contentHash: string
  ) {
    const storedHashes: string[] = [];
    let recordedTransformId: string | undefined;

    try {
      // Store the content hash in the object store
      await this.pgc.objectStore.store(file.content);
      storedHashes.push(contentHash);

      // Use pre-parsed structural data if available (from parallel workers)
      // Otherwise, extract using miner (for remote parsing like Python)
      const structural =
        preParsedStructural || (await this.miner.extractStructure(file));

      const structuralHash = await this.pgc.objectStore.store(
        JSON.stringify(structural, null, 2)
      );

      storedHashes.push(structuralHash);

      const isWorkbenchDependentExtraction =
        WORKBENCH_DEPENDENT_EXTRACTION_METHODS.includes(
          structural.extraction_method
        );

      if (!isWorkbenchHealthy && isWorkbenchDependentExtraction) {
        s.stop(
          chalk.yellow(
            `⸬ ${file.relativePath} (skipped workbench processing - workbench not healthy)`
          )
        );

        // Still update the index with structural data, but mark as partially processed

        const newHistory = existingIndex?.history
          ? [...existingIndex.history, 'skipped_workbench_processing']
          : ['skipped_workbench_processing'];

        await this.pgc.index.set(file.relativePath, {
          path: file.relativePath,
          content_hash: contentHash,
          structural_hash: structuralHash,
          status: 'PartiallyProcessed',
          history: newHistory,
          structuralData: structural,
        });

        return;
      }

      recordedTransformId = await this.pgc.transformLog.record({
        goal: {
          objective: 'Extract structural metadata from source file',
          criteria: [
            'Valid syntax',
            'Complete import list',
            'All exports identified',
          ],
          phimin: 0.8,
        },

        inputs: [{ path: file.relativePath, hash: contentHash }],
        outputs: [{ path: file.relativePath, hash: structuralHash }],
        method: structural.extraction_method,
        fidelity: structural.fidelity,
      });

      const newHistory = existingIndex?.history
        ? [...existingIndex.history, recordedTransformId]
        : [recordedTransformId];

      await this.pgc.index.set(file.relativePath, {
        path: file.relativePath,
        content_hash: contentHash,
        structural_hash: structuralHash,
        status: 'Valid',
        history: newHistory,
        structuralData: structural,
      });

      // NOTE: Structural pattern overlay metadata is created by overlay generator, not genesis
      // Genesis only maintains PGC index with structural data
      // The overlay generator will read structural data from PGC and create embeddings + metadata

      await this.pgc.reverseDeps.add(contentHash, recordedTransformId);
      await this.pgc.reverseDeps.add(structuralHash, recordedTransformId);

      s.stop(chalk.green(`✓ ${file.relativePath}`));
    } catch (error) {
      s.stop(chalk.red(`✗ ${file.relativePath}: ${(error as Error).message}`));
      await this.rollback(storedHashes, recordedTransformId);
      throw error; // Re-throw the error so it can be caught by the caller
    }
  }

  private async discoverFiles(rootPath: string): Promise<SourceFile[]> {
    const files: SourceFile[] = [];
    const extensions = DEFAULT_FILE_EXTENSIONS;

    if (!(await fs.pathExists(rootPath))) {
      log.warn(chalk.yellow(`Source path does not exist: ${rootPath}`));
      return [];
    }

    if (!(await fs.lstat(rootPath)).isDirectory()) {
      log.warn(chalk.yellow(`Source path is not a directory: ${rootPath}`));
      return [];
    }

    const walk = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.resolve(dir, entry.name);

        if (entry.isDirectory()) {
          if (
            entry.name === 'node_modules' ||
            entry.name === '.git' ||
            entry.name === '__pycache__' ||
            entry.name === '.open_cognition' ||
            entry.name === 'dist' ||
            entry.name === 'docs' ||
            entry.name === 'build' ||
            entry.name === 'cache' ||
            entry.name === '.next' ||
            entry.name === '.nuxt' ||
            entry.name.startsWith('.venv') || // Python virtual environments
            entry.name.startsWith('.') // All other hidden directories (e.g., .vitepress)
          ) {
            continue;
          }
          await walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);

          // Skip test files
          if (
            entry.name.endsWith('.test.ts') ||
            entry.name.endsWith('.test.js') ||
            entry.name.endsWith('.spec.ts') ||
            entry.name.endsWith('.spec.js')
          ) {
            continue;
          }

          if (extensions.includes(ext)) {
            const stats = await fs.stat(fullPath);
            if (stats.size > this.maxFileSize) {
              const relativePath = path.relative(this.projectRoot, fullPath);
              log.warn(
                `Skipping large file: ${relativePath} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`
              );
              return;
            }
            const content = await fs.readFile(fullPath, 'utf-8');
            files.push({
              path: fullPath,
              relativePath: path.relative(this.projectRoot, fullPath),
              name: entry.name,
              language: this.detectLanguage(ext),
              content,
            });
          }
        }
      }
    };

    await walk(rootPath);
    return files;
  }

  private detectLanguage(ext: string): Language {
    const map: Record<string, Language> = {
      '.ts': 'typescript',
      '.js': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.rs': 'rust',
      '.go': 'go',
    };
    return map[ext] || 'unknown';
  }

  private async aggregateDirectories() {
    log.info('Aggregating directory summaries (bottom-up)');
  }

  /**
   * Collect all object hashes referenced by overlays
   * These hashes must NOT be deleted by GC even if their source files are stale
   */
  private async getOverlayReferencedHashes(): Promise<Set<string>> {
    const referencedHashes = new Set<string>();
    const allOverlays = ['structural_patterns', 'lineage_patterns'];

    for (const overlayType of allOverlays) {
      try {
        const manifest = await this.pgc.overlays.getManifest(overlayType);
        for (const [symbolName, overlayFilePath] of Object.entries(manifest)) {
          const overlayKey = `${overlayFilePath}#${symbolName}`;

          // Try to get overlay data - it might have different schemas for different overlay types
          // We use a permissive approach to extract hashes
          try {
            const overlayPath = this.pgc.overlays.getOverlayPath(
              overlayType,
              overlayKey
            );
            if (await fs.pathExists(overlayPath)) {
              const overlayData = await fs.readJSON(overlayPath);

              // Collect all hash fields that might exist
              if (overlayData.symbolStructuralDataHash) {
                referencedHashes.add(overlayData.symbolStructuralDataHash);
              }
              if (overlayData.embeddingHash) {
                referencedHashes.add(overlayData.embeddingHash);
              }
              if (overlayData.lineageHash) {
                referencedHashes.add(overlayData.lineageHash);
              }
              if (overlayData.validation?.sourceHash) {
                referencedHashes.add(overlayData.validation.sourceHash);
              }
            }
          } catch (error) {
            // If we can't read/parse an overlay, log but continue
            // We don't want to fail GC just because one overlay is malformed
            console.warn(`[GC] Could not read overlay ${overlayKey}:`, error);
          }
        }
      } catch (error) {
        // If overlay type doesn't exist, that's fine - just skip it
      }
    }

    return referencedHashes;
  }

  private async garbageCollect(processedFiles: string[]) {
    let staleEntries = 0;
    let cleanedReverseDeps = 0;
    let cleanedTransformLogEntries = 0;

    // Collect hashes that are referenced by overlays and must be preserved
    const overlayReferencedHashes = await this.getOverlayReferencedHashes();

    // Phase 1: Clean up stale index entries
    const allIndexedData = await this.pgc.index.getAllData();
    const allIndexedPaths = allIndexedData.map((data) => data.path);

    const staleFilePaths = allIndexedPaths.filter(
      (indexedPath) => !processedFiles.includes(indexedPath)
    );

    for (const staleFile of staleFilePaths) {
      const indexData = await this.pgc.index.get(staleFile);
      if (indexData) {
        // CRITICAL: Only delete hashes that are NOT referenced by overlays
        if (!overlayReferencedHashes.has(indexData.content_hash)) {
          await this.pgc.objectStore.delete(indexData.content_hash);
        }
        if (!overlayReferencedHashes.has(indexData.structural_hash)) {
          await this.pgc.objectStore.delete(indexData.structural_hash);
        }

        // Clean up transform history
        for (const transformId of indexData.history) {
          await this.pgc.transformLog.delete(transformId);
          await this.pgc.reverseDeps.delete(
            indexData.content_hash,
            transformId
          );
          await this.pgc.reverseDeps.delete(
            indexData.structural_hash,
            transformId
          );
        }
      }
      await this.pgc.index.remove(staleFile);
      staleEntries++;
    }

    // Phase 2: Clean up stale ReverseDeps entries
    const allReverseDepHashes =
      await this.pgc.reverseDeps.getAllReverseDepHashes();

    for (const objectHash of allReverseDepHashes) {
      if (!(await this.pgc.objectStore.exists(objectHash))) {
        await this.pgc.reverseDeps.deleteReverseDepFile(objectHash);
        cleanedReverseDeps++;
        continue;
      }

      const transformIdsInReverseDep =
        await this.pgc.reverseDeps.getTransformIds(objectHash);
      for (const transformId of transformIdsInReverseDep) {
        if (!(await this.pgc.transformLog.exists(transformId))) {
          await this.pgc.reverseDeps.delete(objectHash, transformId);
          cleanedReverseDeps++;
        }
      }
    }

    // Phase 3: Validate TransformLog entries
    const allTransformIds = await this.pgc.transformLog.getAllTransformIds();

    for (const transformId of allTransformIds) {
      const transformData =
        await this.pgc.transformLog.getTransformData(transformId);
      if (!transformData) {
        await this.pgc.transformLog.delete(transformId);
        cleanedTransformLogEntries++;
        continue;
      }

      let isValid = true;
      for (const inputHash of transformData.inputs) {
        if (!(await this.pgc.objectStore.exists(inputHash.hash))) {
          isValid = false;
          break;
        }
      }

      if (isValid) {
        for (const outputHash of transformData.outputs) {
          if (!(await this.pgc.objectStore.exists(outputHash.hash))) {
            isValid = false;
            break;
          }
        }
      }

      if (!isValid) {
        await this.pgc.transformLog.delete(transformId);
        cleanedTransformLogEntries++;
      }
    }

    // Phase 4: Clean up empty sharded directories
    await this.pgc.objectStore.removeEmptyShardedDirectories();
    await this.pgc.reverseDeps.removeEmptyShardedDirectories();

    return { staleEntries, cleanedReverseDeps, cleanedTransformLogEntries };
  }

  private async rollback(
    hashes: string[],
    transformId?: string
  ): Promise<void> {
    for (const hash of hashes) {
      await this.pgc.objectStore.delete(hash);
    }
    if (transformId) {
      await this.pgc.transformLog.delete(transformId);
    }
    // Note: Reverting index and reverseDeps is more complex and might require
    // re-processing or a more sophisticated transaction system. For now,
    // we focus on cleaning up objectStore and transformLog.
  }
}
