import fs from 'fs-extra';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import chalk from 'chalk';
import * as workerpool from 'workerpool';
import os from 'os';
import YAML from 'yaml';
import { BaseOrchestrator, type ProgressCallback } from './base.js';

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
import { DocsOracle } from '../pgc/oracles/docs.js';

import {
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_FILE_EXTENSIONS,
  WORKBENCH_DEPENDENT_EXTRACTION_METHODS,
  getLanguageFromExtension,
} from '../../config.js';

/**
 * Genesis Orchestrator: Main entry point for structural data extraction and PGC initialization
 *
 * Implements the bottom-up aggregation phase of the Genesis process:
 * 1. Discover and parse source files (native TS/JS in parallel, remote Python sequentially)
 * 2. Extract structural metadata (classes, functions, interfaces, dependencies)
 * 3. Store in Grounded Context Pool (PGC) with content & structural hashing
 * 4. Record transformation lineage in transformLog and reverseDeps
 * 5. Run garbage collection to maintain PGC coherence
 * 6. Verify structural consistency via GenesisOracle
 *
 * DESIGN PATTERNS:
 * - Two-phase processing: Parallel native parsing → Sequential remote parsing
 * - PGC anchoring: All structural data stored as immutable objects via content hashing
 * - Lineage tracking: Every transformation recorded for audit trail and invalidation
 * - Incremental: Skips unchanged files (content hash comparison)
 * - Optimized GC: Preserves hashes referenced by overlays
 *
 * @example
 * const pgc = new PGCManager(projectRoot);
 * const orchestrator = new GenesisOrchestrator(pgc, miner, workbench, genesisOracle, projectRoot);
 * await orchestrator.executeBottomUpAggregation(['src']);
 * // → Extracts all TypeScript/JavaScript/Python files from src/
 * // → Stores in .open_cognition/index/, .open_cognition/objects/
 * // → PGC is now ready for overlay generation
 */

/**
 * Calculates optimal worker count for parallel native AST parsing
 *
 * Uses adaptive scaling based on file count and available CPU cores:
 * - Small codebases (≤10 files): 2 workers
 * - Medium codebases (≤50 files): 4 workers
 * - Large codebases (>50 files): up to 8 workers (75% of CPUs)
 *
 * @param fileCount - Number of files to parse in parallel
 * @returns Optimal number of worker threads for this codebase size
 *
 * @example
 * const workerCount = calculateOptimalWorkersForParsing(150);
 * // On 8-core machine: returns Math.min(8, Math.floor(8 * 0.75)) = 6 workers
 *
 * @private
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

/**
 * GenesisOrchestrator: Orchestrates the bottom-up structural data extraction process
 *
 * Responsibilities:
 * - Discover source files across the project
 * - Parse native TS/JS files in parallel using worker threads (speed optimization)
 * - Parse remote files (Python) sequentially via eGemma workbench
 * - Extract structural metadata: classes, functions, interfaces, dependencies, imports
 * - Store immutable objects in PGC (Grounded Context Pool) via content hashing
 * - Record all transformations in transformLog for audit trails
 * - Maintain reverse dependencies for surgical invalidation during updates
 * - Perform garbage collection to remove stale entries while preserving overlay references
 * - Verify PGC structural coherence via GenesisOracle
 */
export class GenesisOrchestrator extends BaseOrchestrator {
  private maxFileSize = DEFAULT_MAX_FILE_SIZE;
  // NOTE: Structural patterns manifest is now managed by overlay generator
  // private structuralPatternsManifest: Record<string, string> = {};
  private workerPool?: workerpool.Pool;
  private docsOracle: DocsOracle;

  constructor(
    pgc: PGCManager,
    miner: StructuralMiner,
    workbench: WorkbenchClient,
    genesisOracle: GenesisOracle,
    projectRoot: string
  ) {
    super(pgc, miner, workbench, genesisOracle, projectRoot);
    this.docsOracle = new DocsOracle(pgc);
  }

  /**
   * Required by IOrchestrator interface.
   * For Genesis, this defaults to processing 'src' if no specific options are provided.
   */
  async run(onProgress?: ProgressCallback): Promise<void> {
    await this.executeBottomUpAggregation(['src'], onProgress);
  }

  /**
   * Execute the Genesis bottom-up aggregation process
   *
   * This is the main entry point that orchestrates the entire structural extraction pipeline:
   * 1. Verify workbench (eGemma) is available for semantic analysis
   * 2. Discover all source files (TS/JS/Python/Java/Rust/Go)
   * 3. Parse native files in parallel (TS/JS with tree-sitter)
   * 4. Process files sequentially with structural extraction & storage
   * 5. Aggregate directory-level summaries (bottom-up)
   * 6. Perform garbage collection to maintain PGC coherence
   * 7. Verify structural integrity via GenesisOracle
   *
   * LINEAGE TRACKING:
   * - Stores content hash in object store for each file
   * - Stores structural data hash for extracted metadata
   * - Records transformation ID linking inputs → outputs
   * - Maintains reverse deps for invalidation during updates
   *
   * @param sourcePath - Relative path to source directory (e.g., 'src', 'lib')
   * @returns Promise<void> - Updates PGC in-place. Throws if critical verification fails.
   *
   * @throws {Error} If workbench health check fails for workbench-dependent extraction methods
   * @throws {Error} If PGC verification fails after garbage collection
   *
   * @example
   * const pgc = new PGCManager('.');
   * const miner = new StructuralMiner(workbench);
   * const orchestrator = new GenesisOrchestrator(pgc, miner, workbench, oracle, '.');
   * await orchestrator.executeBottomUpAggregation(['src', 'lib']);
   * // Processes all files in src/ and lib/, stores in .open_cognition/
   *
   * @public
   */
  async executeBottomUpAggregation(
    sourcePaths: string[],
    onProgress?: ProgressCallback
  ) {
    this.setProgressHandler(onProgress);
    const errors: { file: string; message: string }[] = [];

    const isWorkbenchHealthy = await this.checkWorkbenchHealth();
    if (!isWorkbenchHealthy) {
      this.logWarn(
        `Workbench (eGemma) is not reachable at ${this.workbench.getBaseUrl()}. ` +
          `Structural mining will be skipped. Please ensure eGemma is running.`
      );
    }

    this.startSpinner('Discovering source files');

    // Discover files from all source paths
    const allFiles: SourceFile[] = [];
    for (const sourcePath of sourcePaths) {
      const actualSourcePath = path.join(this.projectRoot, sourcePath);
      this.logInfo(`Scanning for files in: ${actualSourcePath}`);
      const files = await this.discoverFiles(actualSourcePath);
      allFiles.push(...files);
    }

    // Deduplicate files by path (in case paths overlap)
    const seenPaths = new Set<string>();
    const files = allFiles.filter((file) => {
      if (seenPaths.has(file.relativePath)) {
        return false;
      }
      seenPaths.add(file.relativePath);
      return true;
    });

    this.stopSpinner(`Found ${files.length} files`);
    this.onProgress?.(0, files.length, `Found ${files.length} files`);

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

    this.logInfo(
      chalk.cyan(
        `Processing: ${nativeFiles.length} native (TS/JS), ${remoteFiles.length} remote (Python)`
      )
    );

    // Phase 1: Parse native files in parallel with workers
    const nativeResults = new Map<string, StructuralData>();

    if (nativeFiles.length > 0) {
      try {
        await this.initializeWorkers(nativeFiles.length);
        const parsedResults = await this.parseNativeFilesParallel(nativeFiles);

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

    // Parallel change detection: Check all files for changes concurrently
    const changeChecks = await Promise.all(
      files.map(async (file) => {
        const existingIndex = await this.pgc.index.get(file.relativePath);
        const contentHash = this.pgc.objectStore.computeHash(file.content);

        return {
          file,
          existingIndex,
          contentHash,
          isChanged:
            !existingIndex || existingIndex.content_hash !== contentHash,
        };
      })
    );

    // Filter to only changed files
    const changedFileChecks = changeChecks.filter((check) => check.isChanged);
    const unchangedCount = files.length - changedFileChecks.length;

    if (unchangedCount > 0) {
      this.logInfo(chalk.dim(`Skipping ${unchangedCount} unchanged file(s)`));
    }

    // Process changed files serially (to maintain spinner state)
    let processed = 0;
    const totalToProcess = changedFileChecks.length;

    for (const { file, existingIndex, contentHash } of changedFileChecks) {
      processed++;
      this.startSpinner(
        `Processing ${chalk.cyan(file.relativePath)} (${processed}/${totalToProcess})`
      );

      // Report progress via callback
      this.onProgress?.(
        processed,
        totalToProcess,
        `Processing ${file.relativePath}`,
        file.relativePath
      );
      try {
        const preParsedStructural = nativeResults.get(file.relativePath);
        await this.processFile(
          file,
          isWorkbenchHealthy,
          preParsedStructural,
          existingIndex,
          contentHash
        );
      } catch (error) {
        // processFile already called this.stopSpinner() before throwing, don't double-stop
        errors.push({
          file: file.relativePath,
          message: (error as Error).message,
        });
      }
    }

    await this.aggregateDirectories();

    // NOTE: Structural patterns manifest is now created by overlay generator
    // Genesis no longer creates or updates the structural_patterns overlay

    await this.runPGCMaintenance(files.map((f) => f.relativePath));

    if (errors.length > 0) {
      this.logError('\n--- Errors during file processing ---');
      errors.forEach((err) => {
        this.logError(`✗ ${err.file}: ${err.message}`);
      });
      this.logError('-------------------------------------');
    }
  }

  /**
   * Initialize worker pool for parallel native AST parsing
   *
   * Creates a pool of worker threads (using Node's worker_threads) to parallelize
   * the expensive tree-sitter AST parsing for TypeScript/JavaScript files.
   * Uses adaptive worker count based on codebase size and available CPUs.
   *
   * CLEANUP:
   * - Workers are explicitly terminated in shutdownWorkers() after processing
   * - Uses thread-based workers (not child processes) for better resource cleanup
   * - Graceful timeout (5s) to prevent worker hangs
   *
   * @param fileCount - Number of files that will be parsed (determines worker count)
   * @returns Promise<void> - Resolves when pool is ready
   * @throws {Error} If worker initialization fails
   *
   * @private
   */
  private async initializeWorkers(fileCount: number): Promise<void> {
    if (this.workerPool) return;

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const workerCount = calculateOptimalWorkersForParsing(fileCount);

    this.logInfo(
      chalk.blue(
        `[Genesis] Initializing ${workerCount} workers for parallel AST parsing (${os.cpus().length} CPUs available)`
      )
    );

    this.workerPool = workerpool.pool(
      path.resolve(__dirname, '../../../dist/genesis-worker.cjs'),
      /* @vite-ignore */ {
        workerType: 'thread', // Use worker_threads instead of child processes for better cleanup
        maxWorkers: workerCount,
      }
    );
  }

  /**
   * Shutdown worker pool gracefully
   *
   * Terminates all worker threads to free system resources. Implements:
   * - Force termination with 5-second timeout
   * - Logging of warnings (not errors) to prevent startup failure on cleanup issues
   * - Cleanup guaranteed via finally block
   *
   * IMPORTANT: Even if shutdown fails, we continue (graceful degradation).
   * OS will kill any lingering threads when process exits.
   *
   * @returns Promise<void> - Completes when pool is terminated
   * @private
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
        this.logWarn(
          `[Genesis] Worker pool shutdown warning: ${(error as Error).message}`
        );
      } finally {
        this.workerPool = undefined;
      }
    }
  }

  /**
   * Parse native files in parallel using worker threads
   *
   * Distributes TypeScript/JavaScript files across worker pool for parallel AST parsing.
   * Each worker runs independently on tree-sitter parser.
   *
   * ALGORITHM:
   * 1. Create job packets with file content and content hash
   * 2. Submit jobs to worker pool (handles distribution and load balancing)
   * 3. Collect results (success/error status + structural data or error message)
   * 4. Report success/failure counts to user
   *
   * @param files - Array of SourceFile objects (all should be TS/JS)
   * @param s - Spinner for user feedback
   * @returns Promise<GenesisJobResult[]> - Array of parsing results (success or error)
   * @throws {Error} If worker pool execution fails (propagates Promise.all() rejection)
   *
   * @example
   * const files = [{ path: 'src/index.ts', language: 'typescript', content: '...' }];
   * const results = await this.parseNativeFilesParallel(files, spinner);
   * // → results[0] = { status: 'success', structuralData: {...} }
   * // → or { status: 'error', error: 'message' }
   *
   * @private
   */
  private async parseNativeFilesParallel(
    files: SourceFile[]
  ): Promise<GenesisJobResult[]> {
    if (!this.workerPool) {
      throw new Error('Worker pool not initialized');
    }

    this.startSpinner(
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

      this.stopSpinner(
        chalk.green(
          `[Genesis] Native parsing complete: ${succeeded} succeeded, ${failed} failed`
        )
      );

      return results;
    } catch (error) {
      this.stopSpinner(chalk.red('[Genesis] Worker parsing error'));
      throw error;
    }
  }

  private async runPGCMaintenance(processedFiles: string[]) {
    this.logStep('Running PGC Maintenance and Verification');

    // The Goal
    this.logInfo(
      'Goal: Achieve a structurally coherent PGC by removing stale entries.'
    );

    // The Transform
    const gcSummary = await this.garbageCollect(processedFiles);

    if (gcSummary.staleEntries > 0) {
      this.logSuccess(
        `Transform: Removed ${gcSummary.staleEntries} stale index entries.`
      );
    }
    if (gcSummary.cleanedReverseDeps > 0) {
      this.logSuccess(
        `Transform: Cleaned ${gcSummary.cleanedReverseDeps} stale reverse dependency entries.`
      );
    }
    if (gcSummary.cleanedTransformLogEntries > 0) {
      this.logSuccess(
        `Transform: Removed ${gcSummary.cleanedTransformLogEntries} stale transform log entries.`
      );
    }
    if (gcSummary.cleanedOverlayEntries > 0) {
      this.logSuccess(
        `Transform: Removed ${gcSummary.cleanedOverlayEntries} orphaned structural overlay entries.`
      );
    }
    if (
      gcSummary.staleEntries === 0 &&
      gcSummary.cleanedReverseDeps === 0 &&
      gcSummary.cleanedTransformLogEntries === 0 &&
      gcSummary.cleanedOverlayEntries === 0
    ) {
      this.logInfo('Transform: No stale entries found. PGC is clean.');
    }

    // Document GC: Remove stale document index entries
    const overlayReferencedHashes = await this.getOverlayReferencedHashes();
    const removedDocs = await this.garbageCollectDocs(overlayReferencedHashes);

    if (removedDocs > 0) {
      this.logSuccess(
        `Transform: Removed ${removedDocs} stale document index entries.`
      );
    }

    // Document GC Phase 2: Clean up orphaned document objects
    // (objects in store but not indexed - leftovers from previous GC bugs)
    const removedOrphans = await this.docsOracle.cleanupOrphanedObjects();
    if (removedOrphans > 0) {
      this.logSuccess(
        `Transform: Cleaned ${removedOrphans} orphaned document object(s).`
      );
    }

    // The Oracle
    this.logInfo(
      'Oracle: Verifying PGC structural coherence after maintenance.'
    );
    const verificationResult = await this.genesisOracle.verify();

    if (verificationResult.success) {
      this.logSuccess(
        'Oracle: Verification complete. PGC is structurally coherent.'
      );
    } else {
      this.logError(
        'Oracle: Verification failed. PGC has structural inconsistencies:'
      );
      verificationResult.messages.forEach((msg: string) =>
        this.logError(`- ${msg}`)
      );
    }
  }

  private async processFile(
    file: SourceFile,
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
        this.stopSpinner(
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

      this.stopSpinner(chalk.green(`✓ ${file.relativePath}`));
    } catch (error) {
      this.stopSpinner(
        chalk.red(`✗ ${file.relativePath}: ${(error as Error).message}`)
      );
      await this.rollback(storedHashes, recordedTransformId);
      throw error; // Re-throw the error so it can be caught by the caller
    }
  }

  private async discoverFiles(rootPath: string): Promise<SourceFile[]> {
    const files: SourceFile[] = [];
    const extensions = DEFAULT_FILE_EXTENSIONS;

    if (!(await fs.pathExists(rootPath))) {
      this.logWarn(`Source path does not exist: ${rootPath}`);
      return [];
    }

    if (!(await fs.lstat(rootPath)).isDirectory()) {
      this.logWarn(`Source path is not a directory: ${rootPath}`);
      return [];
    }

    // Build glob pattern from extensions: **/*.{ts,js,py,...}
    const extPattern = extensions.map((ext) => ext.slice(1)).join(','); // Remove leading dots
    const pattern = `**/*.{${extPattern}}`;

    // Use glob with ignore patterns for better performance
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

    // Process files (filter by size and read content)
    for (const fullPath of filePaths) {
      const stats = await fs.stat(fullPath);
      if (stats.size > this.maxFileSize) {
        const relativePath = path.relative(this.projectRoot, fullPath);
        this.logWarn(
          `Skipping large file: ${relativePath} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`
        );
        continue;
      }

      const content = await fs.readFile(fullPath, 'utf-8');
      const fileName = path.basename(fullPath);
      const ext = path.extname(fileName);

      files.push({
        path: fullPath,
        relativePath: path.relative(this.projectRoot, fullPath),
        name: fileName,
        language: this.detectLanguage(ext),
        content,
      });
    }

    return files;
  }

  private detectLanguage(ext: string): Language {
    return getLanguageFromExtension(ext);
  }

  private async aggregateDirectories() {
    this.logInfo('Aggregating directory summaries (bottom-up)');
  }

  /**
   * Collect all object hashes referenced by overlays
   * These hashes must NOT be deleted by GC even if their source files are stale
   */
  private async getOverlayReferencedHashes(): Promise<Set<string>> {
    const referencedHashes = new Set<string>();

    // Overlays that store document-based data without manifests
    // These are scanned directly for YAML files
    const directScanOverlays = [
      'security_guidelines',
      'operational_patterns',
      'mathematical_proofs',
    ];

    // Overlays that have manifests (symbol-based + some document-based)
    const manifestOverlays = [
      'structural_patterns',
      'lineage_patterns',
      'mission_concepts',
      'strategic_coherence',
    ];

    // First, scan overlays that don't have manifests
    for (const overlayType of directScanOverlays) {
      try {
        const overlayDir = path.join(this.pgc.pgcRoot, 'overlays', overlayType);

        if (await fs.pathExists(overlayDir)) {
          // Read all YAML files in the directory
          const files = await fs.readdir(overlayDir);

          for (const file of files) {
            if (!file.endsWith('.yaml')) continue;

            try {
              const overlayPath = path.join(overlayDir, file);
              const content = await fs.readFile(overlayPath, 'utf-8');
              const overlayData = YAML.parse(content);

              // Extract document_hash from the overlay
              const docHash =
                overlayData.document_hash || overlayData.documentHash;
              if (docHash) {
                referencedHashes.add(docHash);
              }
            } catch (error) {
              // If we can't read/parse an overlay, log but continue
              if (process.env.DEBUG) {
                console.warn(
                  `[GC] Could not read overlay ${overlayType}/${file}:`,
                  error
                );
              }
            }
          }
        }
      } catch (error) {
        // If overlay type doesn't exist, that's fine - just skip it
        console.warn(
          `Failed to collect references from ${overlayType}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Then scan manifest-based overlays
    for (const overlayType of manifestOverlays) {
      try {
        const manifest = await this.pgc.overlays.getManifest(overlayType);

        for (const [key, value] of Object.entries(manifest)) {
          try {
            let overlayPath: string;

            // Determine overlay path based on type
            if (overlayType === 'mission_concepts') {
              // Mission concepts uses document hashes in manifest
              const manifestEntry = value as {
                document_hash?: string;
                documentHash?: string;
              };
              const docHash =
                manifestEntry.document_hash || manifestEntry.documentHash;
              if (!docHash) continue;

              overlayPath = path.join(
                this.pgc.pgcRoot,
                'overlays',
                overlayType,
                `${docHash}.yaml`
              );

              // Also add the hash from manifest directly
              referencedHashes.add(docHash);
            } else if (overlayType === 'strategic_coherence') {
              // Strategic coherence also uses document hashes
              const manifestEntry = value as {
                document_hash?: string;
                documentHash?: string;
              };
              const docHash =
                manifestEntry.document_hash || manifestEntry.documentHash;
              if (!docHash) continue;

              overlayPath = path.join(
                this.pgc.pgcRoot,
                'overlays',
                overlayType,
                `${docHash}.yaml`
              );

              referencedHashes.add(docHash);
            } else {
              // Symbol-based overlays (structural_patterns, lineage_patterns)
              const overlayKey = `${value}#${key}`;
              overlayPath = this.pgc.overlays.getOverlayPath(
                overlayType,
                overlayKey
              );
            }

            if (await fs.pathExists(overlayPath)) {
              // Read overlay data (handle both JSON and YAML files)
              let overlayData: {
                symbolStructuralDataHash?: string;
                embeddingHash?: string;
                lineageHash?: string;
                validation?: { sourceHash?: string };
                document_hash?: string;
                documentHash?: string;
                mission_document_hash?: string;
                missionDocumentHash?: string;
              };
              if (overlayPath.endsWith('.json')) {
                overlayData = await fs.readJSON(overlayPath);
              } else if (overlayPath.endsWith('.yaml')) {
                const content = await fs.readFile(overlayPath, 'utf-8');
                overlayData = YAML.parse(content);
              } else {
                continue; // Skip unknown file types
              }

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
              // Document hashes from overlays
              const docHash =
                overlayData.document_hash || overlayData.documentHash;
              if (docHash) {
                referencedHashes.add(docHash);
              }
              const missionDocHash =
                overlayData.mission_document_hash ||
                overlayData.missionDocumentHash;
              if (missionDocHash) {
                referencedHashes.add(missionDocHash);
              }
            }
          } catch (error) {
            // If we can't read/parse an overlay, log but continue
            // We don't want to fail GC just because one overlay is malformed
            if (process.env.DEBUG) {
              console.warn(`[GC] Could not read overlay ${key}:`, error);
            }
          }
        }
      } catch (error) {
        // If overlay type doesn't exist, that's fine - just skip it
        console.warn(
          `Failed to collect references from manifest overlay ${overlayType}: ${error instanceof Error ? error.message : String(error)}`
        );
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

    // Phase 5: Clean up orphaned structural pattern overlay entries
    const cleanedOverlayEntries = await this.garbageCollectStructuralOverlays();

    return {
      staleEntries,
      cleanedReverseDeps,
      cleanedTransformLogEntries,
      cleanedOverlayEntries,
    };
  }

  /**
   * Garbage collect overlay entries with orphaned hash references across ALL 7 overlays
   * This handles the reverse direction: overlay entries pointing to non-existent file hashes
   * Checks both sourceHash and symbolStructuralDataHash
   */
  private async garbageCollectStructuralOverlays(): Promise<number> {
    let cleanedCount = 0;

    // All 7 overlay directories
    const overlayDirs = [
      'structural_patterns',
      'security_guidelines',
      'lineage_patterns',
      'mission_concepts',
      'operational_patterns',
      'mathematical_proofs',
      'strategic_coherence',
    ];

    // Recursively find all overlay JSON files in a directory
    const findOverlayFiles = async (dir: string): Promise<string[]> => {
      const files: string[] = [];
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...(await findOverlayFiles(fullPath)));
        } else if (
          entry.name.endsWith('.json') ||
          entry.name.endsWith('.yaml')
        ) {
          files.push(fullPath);
        }
      }
      return files;
    };

    // Process each overlay directory
    for (const overlayDir of overlayDirs) {
      const overlayRoot = path.join(this.pgc.pgcRoot, 'overlays', overlayDir);

      if (!(await fs.pathExists(overlayRoot))) {
        continue;
      }

      const overlayFiles = await findOverlayFiles(overlayRoot);

      for (const overlayFile of overlayFiles) {
        try {
          // Read file based on extension
          let overlayData: {
            validation?: { sourceHash?: string };
            symbolStructuralDataHash?: string;
          };
          if (overlayFile.endsWith('.json')) {
            overlayData = await fs.readJSON(overlayFile);
          } else if (overlayFile.endsWith('.yaml')) {
            const content = await fs.readFile(overlayFile, 'utf-8');
            overlayData = YAML.parse(content);
          } else {
            continue; // Skip unknown file types
          }

          // Check both hash types that might reference the object store
          const sourceHashOrphaned =
            overlayData.validation?.sourceHash &&
            !(await this.pgc.objectStore.exists(
              overlayData.validation.sourceHash
            ));

          const symbolHashOrphaned =
            overlayData.symbolStructuralDataHash &&
            !(await this.pgc.objectStore.exists(
              overlayData.symbolStructuralDataHash
            ));

          // Delete if either hash is orphaned
          if (sourceHashOrphaned || symbolHashOrphaned) {
            await fs.remove(overlayFile);
            cleanedCount++;
          }
        } catch (error) {
          // Skip malformed overlay files (only log in debug mode to avoid spam)
          if (process.env.DEBUG) {
            console.warn(
              `[GC] Could not process overlay ${overlayFile}:`,
              error
            );
          }
        }
      }
    }

    return cleanedCount;
  }

  /**
   * Garbage collect document index entries
   * Removes stale document entries whose object hashes are not referenced by overlays
   */
  private async garbageCollectDocs(
    overlayReferencedHashes: Set<string>
  ): Promise<number> {
    const staleHashes = new Set<string>();

    // Get all documents from the index
    const docs = await this.docsOracle.listDocuments();

    // Check which document object hashes are stale (not in object store or not referenced by overlays)
    for (const doc of docs) {
      const objectExists = await this.pgc.objectStore.exists(doc.objectHash);

      // Check if either contentHash or objectHash is referenced by overlays
      // Overlays may store document_hash (contentHash) OR reference the objectHash
      const isReferenced =
        overlayReferencedHashes.has(doc.objectHash) ||
        overlayReferencedHashes.has(doc.contentHash);

      // Mark as stale if:
      // 1. Object doesn't exist in object store, OR
      // 2. Object exists but is not referenced by any overlay (neither hash)
      if (!objectExists || !isReferenced) {
        staleHashes.add(doc.objectHash);
      }
    }

    // Remove stale document index entries
    const removedCount = await this.docsOracle.removeStaleEntries(staleHashes);

    return removedCount;
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
