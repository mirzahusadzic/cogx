import path from 'path';
import { PGCManager } from '../pgc/manager.js';
import { LanceVectorStore } from '../overlays/vector-db/lance-store.js';
import { WorkbenchClient } from '../executors/workbench-client.js';
import { StructuralPatternsManager } from '../overlays/structural/patterns.js';
import { LineagePatternsManager } from '../overlays/lineage/manager.js';
import { MissionConceptsManager } from '../overlays/mission-concepts/manager.js';
import { StrategicCoherenceManager } from '../overlays/strategic-coherence/manager.js';
import { MathematicalProofsManager } from '../overlays/mathematical-proofs/manager.js';
import { ConceptExtractor } from '../analyzers/concept-extractor.js';
import { ProofExtractor } from '../analyzers/proof-extractor.js';
import { StructuralMiner } from './miners/structural.js';
import { OverlayOracle } from '../pgc/oracles/overlay.js';
import { GenesisOracle } from '../pgc/oracles/genesis.js';
import {
  ClassData,
  FunctionData,
  InterfaceData,
  StructuralData,
} from '../types/structural.js';
import chalk from 'chalk';
import fs from 'fs-extra';
import { BaseOrchestrator, type ProgressCallback } from './base.js';

import {
  getLanguageFromExtension,
  DEFAULT_MAX_FILE_SIZE,
} from '../../config.js';
import { SourceFile, Language } from '../types/structural.js';
import { DocumentObject } from '../pgc/document-object.js';

import { GenesisDocTransform } from '../transforms/genesis-doc-transform.js';

/**
 * Overlay Orchestrator: Orchestrates multi-layer semantic overlay generation
 *
 * Generates the 7 semantic overlays (O₀-O₆) that implement the CogX lattice architecture:
 * - O₁: Structural Patterns (classes, functions, interfaces, dependencies)
 * - O₂: Lineage Patterns (call graphs, import chains, dependency propagation)
 * - O₃: Mission Concepts (extracted from strategic documents via LLM)
 * - O₄: Strategic Coherence (alignment between code O₁ and mission O₃)
 * - O₅: Security Guidelines (domain-specific security constraints)
 * - O₆: Mathematical Proofs (theorems, lemmas, axioms from documentation)
 * - O₇: Operational Patterns (workflows, execution patterns)
 *
 * DESIGN PATTERNS:
 * - Symbol-based indexing: Each code symbol (class, function) gets unique overlay entries
 * - Vector database storage: All overlays vectorized for semantic search via Lance
 * - Incremental generation: Skips unchanged symbols using manifest + content hashing
 * - Manifest-driven: Maintains manifest.json to track generation status
 * - PGC anchoring: All overlays reference structural data hashes in PGC
 * - Pre-flight validation: Verifies all source hashes exist before expensive embedding
 * - Oracle verification: Validates overlay consistency and completeness
 *
 * WORKFLOW:
 * 1. Discover source files and extract structural data from PGC
 * 2. Identify symbols (classes, functions, interfaces) needing processing
 * 3. Check manifest for incremental skipping (same source hash = skip)
 * 4. Validate all structural hashes exist before embedding (pre-flight oracle)
 * 5. Generate overlays in parallel with worker threads
 * 6. Store overlays in vector DB with embeddings
 * 7. Verify overlay completeness and PGC coherence
 *
 * @example
 * const orchestrator = await OverlayOrchestrator.create('/path/to/project');
 * await orchestrator.run('structural_patterns', { force: false });
 * // → Generates O₁: Structural patterns for all code symbols
 * // → Stores in .open_cognition/overlays/structural_patterns/
 * // → Vectorizes for semantic search
 *
 * @example
 * await orchestrator.run('mission_concepts', { force: false });
 * // → Auto-discovers strategic docs (VISION.md, PRINCIPLES.md)
 * // → Performs security validation on each document
 * // → Extracts mission concepts via LLM
 * // → Stores in .open_cognition/overlays/mission_concepts/
 *
 * @example
 * await orchestrator.run('strategic_coherence', { force: false });
 * // → Computes alignment between O₁ (code) and O₃ (mission)
 * // → Identifies aligned vs drifted symbols
 * // → Stores metrics and per-symbol coherence scores
 */
export class OverlayOrchestrator extends BaseOrchestrator {
  private structuralPatternManager: StructuralPatternsManager;
  private lineagePatternManager: LineagePatternsManager;
  private missionConceptsManager: MissionConceptsManager;
  private strategicCoherenceManager: StrategicCoherenceManager;
  private mathematicalProofsManager: MathematicalProofsManager;
  private conceptExtractor: ConceptExtractor;
  private proofExtractor: ProofExtractor;
  private overlayOracle: OverlayOracle;

  private constructor(
    pgc: PGCManager,
    miner: StructuralMiner,
    workbench: WorkbenchClient,
    genesisOracle: GenesisOracle,
    projectRoot: string,
    private vectorDB: LanceVectorStore
  ) {
    super(pgc, miner, workbench, genesisOracle, projectRoot);

    const workbenchUrl = this.workbench.getBaseUrl();
    this.structuralPatternManager = new StructuralPatternsManager(
      this.pgc,
      this.vectorDB,
      this.workbench
    );
    this.lineagePatternManager = new LineagePatternsManager(
      this.pgc,
      this.vectorDB,
      this.workbench
    );
    this.missionConceptsManager = new MissionConceptsManager(
      path.join(this.projectRoot, '.open_cognition'),
      workbenchUrl
    );
    this.strategicCoherenceManager = new StrategicCoherenceManager(
      path.join(this.projectRoot, '.open_cognition'),
      workbenchUrl
    );
    this.mathematicalProofsManager = new MathematicalProofsManager(
      path.join(this.projectRoot, '.open_cognition'),
      workbenchUrl
    );
    this.conceptExtractor = new ConceptExtractor();
    this.proofExtractor = new ProofExtractor();
    this.overlayOracle = new OverlayOracle(this.pgc);
  }

  private findPrimarySymbol(
    data: StructuralData,
    filePath: string
  ): string | null {
    const fileName = path.parse(filePath).name;
    const pascalFileName = fileName
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');

    const matchingClass = data.classes?.find(
      (c: ClassData) =>
        data.exports?.includes(c.name) && c.name === pascalFileName
    );
    if (matchingClass) return matchingClass.name;

    const firstExportedClass = data.classes?.find((c: ClassData) =>
      data.exports?.includes(c.name)
    );
    if (firstExportedClass) return firstExportedClass.name;

    const defaultExport = data.exports?.find((e: string) =>
      e.startsWith('default:')
    );
    if (defaultExport) {
      const exportedFunc = data.functions?.find((f: FunctionData) =>
        data.exports?.includes(f.name)
      );
      if (exportedFunc) return exportedFunc.name;
    }

    const firstExportedInterface = data.interfaces?.find((i: InterfaceData) =>
      data.exports?.includes(i.name)
    );
    if (firstExportedInterface) return firstExportedInterface.name;

    const firstExportedFunction = data.functions?.find((f: FunctionData) =>
      data.exports?.includes(f.name)
    );
    if (firstExportedFunction) return firstExportedFunction.name;

    if (!data.exports || data.exports.length === 0) {
      if (data.classes && data.classes.length > 0) return data.classes[0].name;
      if (data.functions && data.functions.length > 0)
        return data.functions[0].name;
      if (data.interfaces && data.interfaces.length > 0)
        return data.interfaces[0].name;
    }

    return null;
  }

  public static async create(
    projectRoot: string
  ): Promise<OverlayOrchestrator> {
    const pgc = new PGCManager(projectRoot);
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
    const workbench = new WorkbenchClient(workbenchUrl);
    const miner = new StructuralMiner(workbench);
    const genesisOracle = new GenesisOracle(pgc);
    const vectorDB = new LanceVectorStore(pgc.pgcRoot);
    return new OverlayOrchestrator(
      pgc,
      miner,
      workbench,
      genesisOracle,
      projectRoot,
      vectorDB
    );
  }

  /**
   * Generate a specific overlay type (O₁-O₆)
   *
   * Main entry point for overlay generation. Handles specialized workflows for each overlay type:
   *
   * STRUCTURAL_PATTERNS (O₁):
   * - Reads source files from PGC index (created by genesis)
   * - Extracts all symbols (classes, functions, interfaces)
   * - Incrementally skips unchanged symbols (manifest + content hash)
   * - Generates embeddings via SLM/LLM
   * - Verifies completeness and stores in vector DB
   *
   * MISSION_CONCEPTS (O₃):
   * - Auto-discovers strategic docs (VISION.md, PATTERN_LIBRARY.md, etc.)
   * - Performs security validation (threat detection via LLM)
   * - Extracts mission concepts from validated documents
   * - Generates embeddings and stores with document association
   * - Enables strategic coherence alignment via O₄
   *
   * STRATEGIC_COHERENCE (O₄):
   * - Loads O₁ (code symbols) from vector DB
   * - Aggregates O₃ (mission concepts) from all documents
   * - Computes alignment scores (meet operation) between code and mission
   * - Identifies aligned vs drifted symbols
   * - Stores metrics (overall coherence, per-symbol scores)
   *
   * IMPORTANT: Overlay generation reads from PGC index - no source path needed.
   * Run genesis first to index source files.
   *
   * @param overlayType - Which semantic overlay to generate
   * @param options - Generation options
   *   - force: Ignore existing overlays, regenerate from scratch
   *   - skipGc: Skip garbage collection (useful for debugging)
   * @returns Promise<void> - Updates overlays in place
   *
   * @throws {Error} If workbench is unavailable and required for overlay type
   * @throws {Error} If pre-flight validation detects missing structural hashes
   * @throws {Error} If overlay verification fails after generation
   *
   * @example
   * // Generate structural patterns (O₁)
   * await orchestrator.run('structural_patterns', { force: false });
   *
   * @example
   * // Regenerate all patterns, skip GC (for fast iteration)
   * await orchestrator.run('structural_patterns', { force: true, skipGc: true });
   *
   * @example
   * // Generate mission concepts with auto-discovery and security validation
   * await orchestrator.run('mission_concepts');
   *
   * @public
   */
  public async run(
    overlayType:
      | 'structural_patterns'
      | 'security_guidelines'
      | 'lineage_patterns'
      | 'mission_concepts'
      | 'operational_patterns'
      | 'mathematical_proofs'
      | 'strategic_coherence'
      | ProgressCallback = 'structural_patterns',
    options?: {
      force?: boolean;
      skipGc?: boolean;
      useJson?: boolean;
      onProgress?: (
        current: number,
        total: number,
        message: string,
        phase?: string
      ) => void;
    }
  ): Promise<void> {
    let actualType:
      | 'structural_patterns'
      | 'security_guidelines'
      | 'lineage_patterns'
      | 'mission_concepts'
      | 'operational_patterns'
      | 'mathematical_proofs'
      | 'strategic_coherence';
    const actualOptions = options || {};

    if (typeof overlayType === 'function') {
      actualType = 'structural_patterns';
      actualOptions.onProgress = overlayType as ProgressCallback;
    } else {
      actualType = overlayType;
    }

    const force = actualOptions.force || false;
    const skipGc = actualOptions.skipGc || false;
    const useJson = actualOptions.useJson || false;
    const onProgress = actualOptions.onProgress as ProgressCallback | undefined;

    // Initialize progress handling
    this.setProgressHandler(onProgress);
    if (useJson) this.useSpinner = false;

    // Pre-flight check: Verify workbench is accessible
    this.startSpinner('[Overlay] Checking workbench availability...');
    try {
      const isWorkbenchHealthy = await this.checkWorkbenchHealth();
      if (!isWorkbenchHealthy) {
        throw new Error('Workbench is not reachable');
      }
      this.stopSpinner('[Overlay] Workbench is available.');
    } catch (error) {
      this.stopSpinner('[Overlay] ✗ Failed to connect to workbench.');
      throw new Error(
        `Cannot generate overlays: Workbench at ${this.workbench.getBaseUrl()} is not accessible. ` +
          `Please ensure eGemma is running or set WORKBENCH_URL to a valid endpoint.\n` +
          `Error: ${(error as Error).message}`
      );
    }

    // Mission concepts has a different flow - no file discovery needed
    if (actualType === 'mission_concepts') {
      // Auto-discover and ingest strategic docs (VISION.md, PATTERN_LIBRARY.md, etc.)
      this.startSpinner(
        '[Overlay] Discovering and ingesting strategic documents...'
      );
      const ingestedCount = await this.autoIngestStrategicDocs(useJson);
      if (ingestedCount > 0) {
        this.stopSpinner(
          `[Overlay] Ingested ${ingestedCount} strategic document(s)`
        );
      } else {
        this.stopSpinner('[Overlay] All strategic documents already ingested');
      }

      this.startSpinner('[Overlay] Discovering markdown documents in PGC...');
      const docIndex = await this.discoverDocuments();
      this.stopSpinner(
        `[Overlay] Found ${docIndex.length} document(s) in PGC.`
      );
      this.onProgress?.(
        0,
        docIndex.length,
        `Found ${docIndex.length} document(s)`,
        'discovery'
      );

      if (docIndex.length === 0) {
        this.logWarn(
          '[Overlay] No documents found. Add markdown files to docs/ folder or VISION.md in project root.'
        );
        return;
      }

      this.logInfo(
        chalk.blue(
          `[Overlay] Extracting mission concepts from ${docIndex.length} document(s)...`
        )
      );

      for (let i = 0; i < docIndex.length; i++) {
        const docEntry = docIndex[i];
        this.onProgress?.(
          i + 1,
          docIndex.length,
          `Processing ${docEntry.filePath}`,
          'extraction'
        );
        await this.generateMissionConcepts(docEntry, force, useJson);

        // Add delay between documents to avoid API rate limiting
        if (i < docIndex.length - 1) {
          this.logInfo(chalk.dim('  ⏱  Waiting 5s to avoid rate limits...'));
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }

      this.logSuccess('[Overlay] Mission concepts generation complete.');
      return;
    }

    // Strategic coherence has a different flow - computes from existing overlays
    if (actualType === 'strategic_coherence') {
      await this.generateStrategicCoherence(force, skipGc, useJson, onProgress);
      return;
    }

    // Mathematical proofs - extract from documents
    if (actualType === 'mathematical_proofs') {
      await this.generateMathematicalProofs(force, useJson, onProgress);
      return;
    }

    // Read files from PGC index (created by genesis) - NOT from filesystem
    const allFiles = await this.loadFilesFromPGCIndex(useJson);

    if (allFiles.length === 0) {
      if (!useJson) {
        this.logError(
          chalk.red(
            '[Overlay] No files found in PGC index. Run genesis first to index source files.'
          )
        );
      }
      return;
    }

    // Standard structural/lineage/security patterns flow
    // 1. Run maintenance (GC) to ensure PGC is clean
    await this.runPGCMaintenance(
      allFiles.map((f) => f.relativePath),
      skipGc
    );

    // 2. Specialized flow for lineage patterns (graph-based)
    if (actualType === 'lineage_patterns') {
      try {
        this.startSpinner(
          '[Overlay] Generating lineage patterns from manifest...'
        );
        this.stopSpinner(
          '[Overlay] Generating lineage patterns from manifest.'
        );
        // LineagePatternsManager handles its own batching and progress reporting
        await this.lineagePatternManager.generate({ force, onProgress });

        // Vectorize for semantic search
        if (!skipGc) {
          this.logStep('\n[Overlay] Deduplicating vectors...');
          await this.vectorDB.initialize('lineage_patterns');
          const duplicatesRemoved =
            await this.vectorDB.removeDuplicateVectors();
          if (duplicatesRemoved > 0) {
            this.logSuccess(
              `Transform: Removed ${duplicatesRemoved} duplicate vectors.`
            );
          } else {
            this.logInfo('Transform: No duplicate vectors found.');
          }
        } else {
          this.logInfo(
            'Transform: Vector deduplication skipped (--skip-gc flag).'
          );
        }
      } finally {
        // Lineage manager uses its own worker pool
        await this.lineagePatternManager.shutdown();
      }

      return;
    }

    // 3. Vector DB initialization for other patterns
    this.startSpinner('[Overlay] Initializing vector database...');
    try {
      await this.vectorDB.initialize(actualType);
      this.stopSpinner('[Overlay] Vector database initialized.');
    } catch (error) {
      this.stopSpinner('[Overlay] ✗ Failed to initialize vector database.');
      throw error;
    }

    // 3. Specialized flow for structural patterns (symbol-based)
    if (actualType === 'structural_patterns') {
      this.logInfo(`[Overlay] Preparing jobs for ${allFiles.length} files...`);
      let skippedCount = 0;
      let incrementalSkipCount = 0; // Track how many symbols were skipped due to unchanged content
      const BATCH_SIZE = 50;

      const allJobs: Array<{
        projectRoot: string;
        symbolName: string;
        filePath: string;
        contentHash: string;
        structuralHash: string;
        structuralData: StructuralData;
        force: boolean;
      }> = [];

      // Pre-load manifest for incremental filtering
      const manifest = await this.pgc.overlays.getManifest(actualType);

      for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
        const batch = allFiles.slice(i, i + BATCH_SIZE);
        const batchNum = i / BATCH_SIZE + 1;
        const totalBatches = Math.ceil(allFiles.length / BATCH_SIZE);

        this.startSpinner(
          `[Overlay] Preparing batch ${batchNum}/${totalBatches}`
        );

        this.onProgress?.(
          i,
          allFiles.length,
          `Preparing batch ${batchNum}/${totalBatches}`,
          'preparation'
        );

        // OPTIMIZATION: Parallel file processing for 2x speedup
        const fileResults = await Promise.all(
          batch.map(async (file) => {
            if (file.path.includes('.test.') || file.path.includes('.spec.')) {
              return { file, skip: true, test: true };
            }

            const structuralData = await this.miner.extractStructure(file);
            const contentHash = this.pgc.objectStore.computeHash(file.content);

            // Store both content and structural data in object store
            await this.pgc.objectStore.store(file.content); // Store source content
            const structuralHash = await this.pgc.objectStore.store(
              JSON.stringify(structuralData, null, 2)
            ); // Store structural data

            if (!structuralData) {
              return { file, skip: true, test: false };
            }

            return {
              file,
              skip: false,
              structuralData,
              contentHash,
              structuralHash,
            };
          })
        );

        // Process results and build jobs
        for (const result of fileResults) {
          if (result.skip) {
            skippedCount++;
            continue;
          }

          const { file, structuralData, contentHash, structuralHash } = result;

          // Type assertion: after skip check, these fields are guaranteed to exist
          if (!contentHash || !structuralHash) {
            this.logWarn(`Missing hash for file: ${file.relativePath}`);
            continue;
          }

          // Helper function to check if symbol needs processing
          const needsProcessing = (symbolName: string): boolean => {
            if (force) return true;

            const manifestEntry = manifest[symbolName];
            if (!manifestEntry) return true; // New symbol

            const parsedEntry =
              this.pgc.overlays.parseManifestEntry(manifestEntry);

            // If old format or no sourceHash, needs processing
            if (parsedEntry.needsMigration || !parsedEntry.sourceHash) {
              return true;
            }

            // Check if sourceHash changed (content changed)
            if (parsedEntry.sourceHash !== contentHash) {
              return true;
            }

            // Check if file path changed (symbol moved)
            if (parsedEntry.filePath !== file.relativePath) {
              return true;
            }

            return false; // Symbol unchanged, skip processing
          };

          structuralData!.classes?.forEach((c) => {
            if (needsProcessing(c.name)) {
              allJobs.push({
                projectRoot: this.projectRoot,
                symbolName: c.name,
                filePath: file.relativePath,
                contentHash,
                structuralHash,
                structuralData: structuralData!,
                force,
              });
            } else {
              incrementalSkipCount++;
            }
          });

          structuralData!.functions?.forEach((f) => {
            if (needsProcessing(f.name)) {
              allJobs.push({
                projectRoot: this.projectRoot,
                symbolName: f.name,
                filePath: file.relativePath,
                contentHash,
                structuralHash,
                structuralData: structuralData!,
                force,
              });
            } else {
              incrementalSkipCount++;
            }
          });

          structuralData!.interfaces?.forEach((i) => {
            if (needsProcessing(i.name)) {
              allJobs.push({
                projectRoot: this.projectRoot,
                symbolName: i.name,
                filePath: file.relativePath,
                contentHash,
                structuralHash,
                structuralData: structuralData!,
                force,
              });
            } else {
              incrementalSkipCount++;
            }
          });
        }
      }

      this.stopSpinner();

      // Log incremental skip statistics
      if (incrementalSkipCount > 0) {
        this.logInfo(
          chalk.green(
            `[Overlay] Incremental: Skipped ${incrementalSkipCount} unchanged symbols (${(
              (incrementalSkipCount / (allJobs.length + incrementalSkipCount)) *
              100
            ).toFixed(1)}% reduction)`
          )
        );
      }

      if (actualType === 'structural_patterns') {
        // Initialize workers with optimal count based on job size
        this.structuralPatternManager.initializeWorkers(allJobs.length);

        // Pre-flight validation: Check all source hashes exist before expensive embedding
        this.logInfo(
          chalk.cyan(
            `\n[Overlay] Oracle: Pre-flight validation of ${allJobs.length} patterns...`
          )
        );
        const preflightResult = await this.validateJobHashes(allJobs);
        if (!preflightResult.success) {
          this.logError(
            'Pre-flight validation failed - missing structural hashes:'
          );
          preflightResult.messages.forEach((msg: string) => this.logError(msg));
          throw new Error(
            'Cannot proceed with embedding - structural data missing from object store. ' +
              'This may be caused by aggressive garbage collection. Try running with --skip-gc flag.'
          );
        }
        this.logSuccess('[Overlay] Oracle: Pre-flight validation successful.');

        this.logInfo(
          chalk.cyan(
            `\n[Overlay] Processing ${allJobs.length} patterns with workers...`
          )
        );
        this.onProgress?.(
          0,
          allJobs.length,
          `Processing ${allJobs.length} patterns...`,
          'embedding'
        );

        try {
          // Pass onProgress callback to get real-time embedding progress
          await this.structuralPatternManager.generatePatternsParallel(
            allJobs,
            onProgress
          );
        } finally {
          await this.structuralPatternManager.shutdown();
        }

        this.logSuccess(chalk.cyan(`\n[Overlay] Processing complete.`));
        this.logInfo(
          chalk.cyan(
            `- Processed ${allJobs.length} patterns (${skippedCount} files skipped)`
          )
        );

        // Deduplicate vectors (keep most recent by computed_at)
        // Only needed when --force creates duplicates, skip if --skip-gc
        if (force && !skipGc) {
          this.logStep('\n[Overlay] Deduplicating vectors...');
          const duplicatesRemoved =
            await this.vectorDB.removeDuplicateVectors();
          if (duplicatesRemoved > 0) {
            this.logSuccess(
              `Transform: Removed ${duplicatesRemoved} duplicate vectors (kept most recent).`
            );
          } else {
            this.logInfo('Transform: No duplicate vectors found.');
          }
        } else if (skipGc) {
          this.logInfo(
            'Transform: Vector deduplication skipped (--skip-gc flag).'
          );
        }

        // Verify the structural patterns overlay after generation
        this.logInfo(
          chalk.cyan(
            '\n[Overlay] Oracle: Verifying structural patterns overlay...'
          )
        );
        const verificationResult =
          await this.overlayOracle.verifyStructuralPatternsOverlay();
        if (!verificationResult.success) {
          this.logError('Structural patterns overlay verification failed:');
          verificationResult.messages.forEach((msg: string) =>
            this.logError(msg)
          );
          throw new Error('Structural patterns overlay is inconsistent.');
        } else {
          this.logSuccess(
            chalk.green('[Overlay] Structural Oracle verification successful.')
          );
        }

        // CRITICAL: Verify manifest completeness against vector DB
        this.logInfo(
          chalk.cyan('\n[Overlay] Oracle: Verifying manifest completeness...')
        );
        const completenessResult =
          await this.overlayOracle.verifyManifestCompleteness();
        completenessResult.messages.forEach((msg: string) => this.logInfo(msg));
        if (!completenessResult.success) {
          this.logError(
            '[Overlay] Manifest is incomplete - pattern generation may have failed.'
          );
          throw new Error('Structural patterns manifest is incomplete.');
        } else {
          this.logSuccess(
            chalk.green('[Overlay] Manifest completeness verification passed.')
          );
        }
      }
    }
  }
  private async runPGCMaintenance(
    processedFiles: string[],
    skipGc: boolean = false
  ) {
    this.logStep('Running PGC Maintenance and Verification');

    if (skipGc) {
      this.logInfo(
        'Goal: Verify PGC structural coherence (garbage collection skipped).'
      );
    } else {
      this.logInfo(
        'Goal: Achieve a structurally coherent PGC by removing stale entries.'
      );
    }

    const gcSummary = skipGc
      ? {
          staleEntries: 0,
          cleanedReverseDeps: 0,
          cleanedTransformLogEntries: 0,
        }
      : await this.garbageCollect(processedFiles);

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
    if (
      gcSummary.staleEntries === 0 &&
      gcSummary.cleanedReverseDeps === 0 &&
      gcSummary.cleanedTransformLogEntries === 0
    ) {
      if (skipGc) {
        this.logInfo('Transform: Garbage collection skipped (--skip-gc flag).');
      } else {
        this.logInfo('Transform: No stale entries found. PGC is clean.');
      }
    }

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

  private async garbageCollect(processedFiles: string[]) {
    let staleEntries = 0;
    let cleanedReverseDeps = 0;
    let cleanedTransformLogEntries = 0;

    const allIndexedData = await this.pgc.index.getAllData();
    const allIndexedPaths = allIndexedData.map((data) => data.path);

    const staleFilePaths = allIndexedPaths.filter(
      (indexedPath) => !processedFiles.includes(indexedPath)
    );

    for (const staleFile of staleFilePaths) {
      const indexData = await this.pgc.index.get(staleFile);
      if (indexData) {
        await this.pgc.objectStore.delete(indexData.content_hash);
        await this.pgc.objectStore.delete(indexData.structural_hash);
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

    await this.pgc.objectStore.removeEmptyShardedDirectories();
    await this.pgc.reverseDeps.removeEmptyShardedDirectories();

    return { staleEntries, cleanedReverseDeps, cleanedTransformLogEntries };
  }

  /**
   * Load files from PGC index (created by genesis) instead of scanning filesystem.
   *
   * This is the correct approach for overlay generation:
   * - Genesis indexes files and stores in PGC
   * - Overlay generation reads from that index
   * - No explicit source path needed
   *
   * @returns Array of source files with content loaded from PGC object store
   */
  private async loadFilesFromPGCIndex(
    useJson: boolean = false
  ): Promise<SourceFile[]> {
    const allIndexData = await this.pgc.index.getAllData();

    if (allIndexData.length === 0) {
      return [];
    }

    if (!useJson) {
      this.logInfo(
        chalk.cyan(
          `[Overlay] Loading ${allIndexData.length} files from PGC index...`
        )
      );
    }

    // Load file content from PGC object store in parallel
    const fileReads = await Promise.all(
      allIndexData.map(async (indexEntry) => {
        // Skip test files
        if (
          indexEntry.path.includes('.test.') ||
          indexEntry.path.includes('.spec.')
        ) {
          return null;
        }

        // Load content from object store using content_hash
        const contentBuffer = await this.pgc.objectStore.retrieve(
          indexEntry.content_hash
        );
        if (!contentBuffer) {
          if (!useJson) {
            this.logWarn(
              chalk.yellow(
                `[Overlay] Content missing for ${indexEntry.path} (hash: ${indexEntry.content_hash.slice(0, 7)}...)`
              )
            );
          }
          return null;
        }

        // Safety check: Skip files that exceed max size limit
        if (contentBuffer.length > DEFAULT_MAX_FILE_SIZE) {
          if (!useJson) {
            this.logWarn(
              chalk.yellow(
                `[Overlay] Skipping large file: ${indexEntry.path} (${(contentBuffer.length / (1024 * 1024)).toFixed(2)} MB)`
              )
            );
          }
          return null;
        }

        const content = contentBuffer.toString('utf-8');
        const fullPath = path.join(this.projectRoot, indexEntry.path);
        const fileName = path.basename(indexEntry.path);
        const ext = path.extname(fileName);

        return {
          path: fullPath,
          relativePath: indexEntry.path,
          name: fileName,
          language: this.detectLanguage(ext),
          content,
        };
      })
    );

    // Filter out null entries (skipped test files or missing content)
    return fileReads.filter((f) => f !== null) as SourceFile[];
  }

  private detectLanguage(ext: string): Language {
    return getLanguageFromExtension(ext);
  }

  /**
   * Pre-flight validation: Check that all structural hashes exist in object store
   * BEFORE starting expensive embedding operations.
   *
   * This prevents wasting time on embedding when structural data is missing
   * due to aggressive garbage collection or other issues.
   */
  private async validateJobHashes(
    jobs: Array<{
      structuralHash: string;
      filePath: string;
      symbolName: string;
    }>
  ): Promise<{ success: boolean; messages: string[] }> {
    const messages: string[] = [];
    const missingHashes = new Set<string>();

    // Parallelize existence checks for better performance
    const existenceChecks = await Promise.all(
      jobs.map(async (job) => ({
        job,
        exists: await this.pgc.objectStore.exists(job.structuralHash),
      }))
    );

    // Process results sequentially to maintain order
    for (const { job, exists } of existenceChecks) {
      if (!exists && !missingHashes.has(job.structuralHash)) {
        missingHashes.add(job.structuralHash);
        messages.push(
          `Structural hash missing for ${job.filePath}#${job.symbolName}: ${job.structuralHash.slice(0, 7)}...`
        );
      }
    }

    return {
      success: messages.length === 0,
      messages,
    };
  }

  /**
   * Discover markdown documents that have been ingested into PGC
   */
  private async discoverDocuments(): Promise<
    Array<{ filePath: string; contentHash: string; objectHash: string }>
  > {
    const docsIndexPath = path.join(this.pgc.pgcRoot, 'index', 'docs');

    if (!(await fs.pathExists(docsIndexPath))) {
      return [];
    }

    const indexFiles = await fs.readdir(docsIndexPath);

    // Parallelize file reads for better performance
    const documentReads = await Promise.all(
      indexFiles
        .filter((indexFile) => indexFile.endsWith('.json'))
        .map(async (indexFile) => {
          const indexPath = path.join(docsIndexPath, indexFile);
          const indexData = await fs.readJSON(indexPath);

          // Support both old format (hash only) and new format (contentHash + objectHash)
          const contentHash = indexData.contentHash || indexData.hash;
          const objectHash = indexData.objectHash || indexData.hash;

          return {
            filePath: indexData.filePath,
            contentHash,
            objectHash,
          };
        })
    );

    return documentReads;
  }

  /**
   * Generate mission concepts for a single document
   */
  private async generateMissionConcepts(
    docEntry: { filePath: string; contentHash: string; objectHash: string },
    force: boolean,
    useJson: boolean = false // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<void> {
    const { filePath, contentHash, objectHash } = docEntry;

    // Check if overlay already exists (unless force=true)
    // Use contentHash for overlay storage (stable document identity)
    if (!force) {
      const existing = await this.missionConceptsManager.retrieve(contentHash);
      if (existing) {
        this.logInfo(
          chalk.dim(
            `  [MissionConcepts] ${filePath} - skipped (already exists)`
          )
        );
        return;
      }
    }

    this.logInfo(
      chalk.blue(`  [MissionConcepts] ${filePath} - extracting concepts...`)
    );

    // Load document object from PGC using objectHash (for retrieval)
    const docObjectBuffer = await this.pgc.objectStore.retrieve(objectHash);
    if (!docObjectBuffer) {
      this.logWarn(
        `  [MissionConcepts] ${filePath} - skipped (document not found in PGC)`
      );
      return;
    }

    const parsedDoc = JSON.parse(
      docObjectBuffer.toString('utf-8')
    ) as DocumentObject;

    if (parsedDoc.type !== 'markdown_document') {
      this.logWarn(
        `  [MissionConcepts] ${filePath} - skipped (not a markdown document)`
      );
      return;
    }

    // Check if document has pre-embedded concepts from security validation
    let concepts = parsedDoc.embeddedConcepts;

    if (!concepts || concepts.length === 0) {
      // Fallback: Extract concepts (no pre-embedded concepts available)
      const markdownDoc = {
        filePath: parsedDoc.filePath,
        hash: parsedDoc.hash,
        sections: parsedDoc.ast.sections,
        metadata: parsedDoc.ast.metadata,
        rawContent: parsedDoc.content,
      };

      concepts = this.conceptExtractor.extract(markdownDoc);

      if (concepts.length === 0) {
        this.logWarn(
          `  [MissionConcepts] ${filePath} - skipped (no mission concepts found)`
        );
        return;
      }

      this.logInfo(
        chalk.blue(
          `  [MissionConcepts] ${filePath} - found ${concepts.length} concepts, generating embeddings...`
        )
      );
    } else {
      // Using pre-embedded concepts from security validation
      this.logInfo(
        chalk.blue(
          `  [MissionConcepts] ${filePath} - reusing ${concepts.length} concepts from security validation (no re-embedding)...`
        )
      );
    }

    // Create overlay and store (manager will generate embeddings only if needed)
    // Use contentHash as the stable document identity
    const overlay = {
      document_hash: contentHash,
      document_path: filePath,
      extracted_concepts: concepts,
      generated_at: new Date().toISOString(),
      transform_id: `mission_concepts:${contentHash}:${new Date().toISOString()}`,
    };

    await this.missionConceptsManager.store(overlay);

    this.logSuccess(
      `  [MissionConcepts] ${filePath} - ✓ complete (${concepts.length} concepts embedded)`
    );
  }

  /**
   * Generate mathematical proofs overlay (O₆)
   * Extracts theorems, lemmas, axioms, and proofs from documents
   */
  private async generateMathematicalProofs(
    force: boolean,
    useJson: boolean = false,
    onProgress?: (
      current: number,
      total: number,
      message: string,
      phase?: string
    ) => void
  ): Promise<void> {
    // Discover already-ingested documents from PGC
    // Note: Does NOT ingest new documents - run mission_concepts generation first
    this.startSpinner(
      '[MathematicalProofs] Discovering markdown documents in PGC...'
    );
    const docIndex = await this.discoverDocuments();
    this.stopSpinner(
      `[MathematicalProofs] Found ${docIndex.length} document(s) in PGC.`
    );
    if (onProgress) {
      onProgress(
        0,
        docIndex.length,
        `Found ${docIndex.length} document(s)`,
        'discovery'
      );
    }

    if (docIndex.length === 0) {
      this.logWarn(
        chalk.yellow(
          '[MathematicalProofs] No documents found in PGC.\n' +
            'Run `cognition-cli overlay generate mission_concepts` first to ingest strategic documents.'
        )
      );
      return;
    }

    this.logInfo(
      chalk.blue(
        `[MathematicalProofs] Extracting mathematical statements from ${docIndex.length} document(s)...`
      )
    );

    for (let i = 0; i < docIndex.length; i++) {
      const docEntry = docIndex[i];
      this.onProgress?.(
        i + 1,
        docIndex.length,
        `Processing ${docEntry.filePath}`,
        'extraction'
      );
      await this.generateMathematicalProofsForDocument(
        docEntry,
        force,
        useJson
      );

      // Add delay between documents to avoid API rate limiting
      if (i < docIndex.length - 1) {
        this.logInfo(chalk.dim('  ⏱  Waiting 5s to avoid rate limits...'));
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    this.logSuccess(
      '[MathematicalProofs] Mathematical proofs generation complete.'
    );
  }

  /**
   * Generate mathematical proofs for a single document
   */
  private async generateMathematicalProofsForDocument(
    docEntry: { filePath: string; contentHash: string; objectHash: string },
    force: boolean,
    useJson: boolean = false
  ): Promise<void> {
    const { filePath, contentHash, objectHash } = docEntry;

    // Check if overlay already exists (unless force=true)
    if (!force) {
      const existing =
        await this.mathematicalProofsManager.loadOverlay(contentHash);
      if (existing) {
        this.logInfo(
          chalk.dim(
            `  [MathematicalProofs] ${filePath} - skipped (already exists)`
          )
        );
        return;
      }
    }

    this.logInfo(
      chalk.blue(`  [MathematicalProofs] ${filePath} - extracting proofs...`)
    );

    // Load document object from PGC using objectHash
    const docObjectBuffer = await this.pgc.objectStore.retrieve(objectHash);
    if (!docObjectBuffer) {
      this.logWarn(
        `  [MathematicalProofs] ${filePath} - skipped (document not found in PGC)`
      );
      return;
    }

    const parsedDoc = JSON.parse(
      docObjectBuffer.toString('utf-8')
    ) as DocumentObject;

    if (parsedDoc.type !== 'markdown_document') {
      if (!useJson) {
        this.logInfo(
          chalk.yellow(
            `  [MathematicalProofs] ${filePath} - skipped (not a markdown document)`
          )
        );
      }
      return;
    }

    // Extract mathematical statements using ProofExtractor
    const markdownDoc = {
      filePath: parsedDoc.filePath,
      hash: parsedDoc.hash,
      sections: parsedDoc.ast.sections,
      metadata: parsedDoc.ast.metadata,
      rawContent: parsedDoc.content,
    };

    const statements = this.proofExtractor.extract(markdownDoc);

    if (statements.length === 0) {
      if (!useJson) {
        this.logInfo(
          chalk.yellow(
            `  [MathematicalProofs] ${filePath} - skipped (no mathematical statements found)`
          )
        );
      }
      return;
    }

    if (!useJson) {
      this.logInfo(
        chalk.blue(
          `  [MathematicalProofs] ${filePath} - found ${statements.length} statements, generating embeddings...`
        )
      );
    }

    // Generate overlay with embeddings
    const transformId = `mathematical_proofs:${contentHash}:${new Date().toISOString()}`;
    await this.mathematicalProofsManager.generateOverlay(
      filePath,
      contentHash,
      statements,
      transformId
    );

    if (!useJson) {
      this.logInfo(
        chalk.green(
          `  [MathematicalProofs] ${filePath} - ✓ complete (${statements.length} statements embedded)`
        )
      );
    }
  }

  /**
   * Generate strategic coherence overlay
   * Computes alignment between code symbols (O₁) and mission concepts (O₃)
   */
  private async generateStrategicCoherence(
    force: boolean,
    skipGc: boolean = false,
    useJson: boolean = false,
    onProgress?: (
      current: number,
      total: number,
      message: string,
      phase?: string
    ) => void
  ): Promise<void> {
    // Step 1: Check if overlay already exists
    if (!force) {
      const existing = await this.strategicCoherenceManager.retrieve();
      if (existing) {
        this.logInfo(
          chalk.dim(
            '[StrategicCoherence] Overlay already exists. Use --force to regenerate.'
          )
        );
        return;
      }
    }

    // Step 2: Get mission document hash from mission concepts overlay
    this.startSpinner('[StrategicCoherence] Finding mission document...');
    const allDocs = await this.discoverDocuments();

    // Filter to only documents that have mission concepts overlays
    const missionConceptHashes = await this.missionConceptsManager.list();
    const docIndex = allDocs.filter((doc) =>
      missionConceptHashes.includes(doc.contentHash)
    );

    if (docIndex.length === 0) {
      this.stopSpinner(
        '[StrategicCoherence] ✗ No mission documents found in PGC.'
      );
      this.logError(
        'Run "cognition-cli overlay generate mission_concepts" first to extract mission concepts.'
      );
      throw new Error(
        'Mission concepts overlay required for strategic coherence'
      );
    }

    const skippedDocs = allDocs.length - docIndex.length;
    // Aggregated mission concepts from documents that have them
    this.stopSpinner(
      `[StrategicCoherence] Found ${docIndex.length} strategic documents`
    );
    if (onProgress) {
      onProgress(
        0,
        3,
        `Found ${docIndex.length} strategic documents`,
        'discovery'
      );
    }
    if (!useJson) {
      this.logInfo(
        chalk.dim(`  Documents: ${docIndex.map((d) => d.filePath).join(', ')}`)
      );
      if (skippedDocs > 0) {
        this.logInfo(
          chalk.dim(
            `  Skipped ${skippedDocs} document(s) without mission concepts (e.g., security/threat models)`
          )
        );
      }
    }

    // Step 3: Initialize vector database for structural patterns
    this.startSpinner('[StrategicCoherence] Loading structural patterns...');
    await this.vectorDB.initialize('structural_patterns');
    this.stopSpinner('[StrategicCoherence] Structural patterns loaded.');
    if (onProgress) {
      onProgress(1, 3, 'Structural patterns loaded', 'loading');
    }

    // Step 4: Compute coherence overlay using ALL documents
    if (!useJson) {
      this.logInfo(
        chalk.blue(
          '[StrategicCoherence] Computing alignment between code and mission...'
        )
      );
    }
    if (onProgress) {
      onProgress(2, 3, 'Computing alignment...', 'computation');
    }

    const overlay =
      await this.strategicCoherenceManager.computeCoherenceFromMultipleDocs(
        docIndex.map((d) => d.contentHash),
        5, // top 5 alignments per symbol
        0.5 // alignment threshold
      );

    // Step 5: Store the overlay
    this.startSpinner('[StrategicCoherence] Storing coherence overlay...');
    await this.strategicCoherenceManager.store(overlay);
    this.stopSpinner('[StrategicCoherence] Overlay stored.');
    if (onProgress) {
      onProgress(3, 3, 'Overlay stored', 'storage');
    }

    // Step 5.5: Deduplicate temporary mission concepts vector table
    // Only needed when --force creates duplicates, skip if --skip-gc
    if (force && !skipGc) {
      if (!useJson) {
        this.logStep(
          '\n[StrategicCoherence] Deduplicating temporary mission concepts vectors...'
        );
      }
      await this.vectorDB.initialize('mission_concepts_multi_temp');
      const duplicatesRemoved = await this.vectorDB.removeDuplicateVectors();
      if (!useJson) {
        if (duplicatesRemoved > 0) {
          this.logSuccess(
            `Transform: Removed ${duplicatesRemoved} duplicate vectors (kept most recent).`
          );
        } else {
          this.logInfo('Transform: No duplicate vectors found.');
        }
      }
    } else if (skipGc && !useJson) {
      this.logInfo('Transform: Vector deduplication skipped (--skip-gc flag).');
    }

    // Step 6: Display summary
    if (!useJson) {
      this.logInfo('');
      this.logInfo(
        chalk.green.bold('✓ Strategic Coherence Generation Complete')
      );
      this.logInfo('');
      this.logInfo(
        chalk.white(
          `  Analyzed ${overlay.symbol_coherence.length} code symbols against ${overlay.mission_concepts_count} mission concepts`
        )
      );
      this.logInfo('');
      this.logInfo(chalk.white('  Overall Metrics:'));
      this.logInfo(
        chalk.white(
          `    Average coherence: ${overlay.overall_metrics.average_coherence.toFixed(3)}`
        )
      );
      this.logInfo(
        chalk.green(
          `    ✓ Aligned symbols:  ${overlay.overall_metrics.aligned_symbols_count} (score ≥ ${overlay.overall_metrics.high_alignment_threshold})`
        )
      );
      this.logInfo(
        chalk.yellow(
          `    ⚠ Drifted symbols:  ${overlay.overall_metrics.drifted_symbols_count} (score < ${overlay.overall_metrics.high_alignment_threshold})`
        )
      );
      this.logInfo('');
      this.logInfo(
        chalk.dim(
          '  Query results with: cognition-cli coherence aligned | drifted | report'
        )
      );
      this.logInfo('');
    }
  }

  /**
   * Auto-discover and ingest strategic documentation files
   * Looks for:
   * - VISION.md in project root or parent directories (searches up to repo root)
   * - docs/overlays/O4_mission/PATTERN_LIBRARY.md, docs/PRINCIPLES.md, docs/0X_*.md, etc.
   *
   * Only ingests files that haven't been processed yet (checks PGC index)
   */
  private async autoIngestStrategicDocs(
    useJson: boolean = false
  ): Promise<number> {
    const strategicPaths: string[] = [];
    const docTransform = new GenesisDocTransform(this.pgc.pgcRoot);

    // 1. Search for VISION.md in current dir and parent directories
    // Convert to absolute path first (projectRoot might be relative like '.')
    let searchDir = path.resolve(this.projectRoot);

    // Search up to 3 levels (current, parent, grandparent)
    for (let i = 0; i < 3; i++) {
      const visionPath = path.join(searchDir, 'VISION.md');

      if (await fs.pathExists(visionPath)) {
        strategicPaths.push(visionPath);
        break;
      }

      const parentDir = path.dirname(searchDir);
      if (parentDir === searchDir) break; // Reached filesystem root
      searchDir = parentDir;
    }

    // 2. Discover specific strategic docs in docs/ folder
    const docsFolder = path.join(this.projectRoot, 'docs');
    if (await fs.pathExists(docsFolder)) {
      // Check for specific strategic document names
      const strategicFileNames = [
        'PATTERN_LIBRARY.md',
        'PRINCIPLES.md',
        'STRATEGY.md',
      ];

      for (const fileName of strategicFileNames) {
        const filePath = path.join(docsFolder, fileName);
        if (await fs.pathExists(filePath)) {
          strategicPaths.push(filePath);
        }
      }

      // Find specific strategic numbered docs only (not all technical docs)
      const strategicNumberedDocs = [
        '09_Mission_Concept_Extraction.md', // Strategic - how we extract mission concepts
        // Skip 00-08 (technical implementation docs)
      ];

      for (const fileName of strategicNumberedDocs) {
        const filePath = path.join(docsFolder, fileName);
        if (await fs.pathExists(filePath)) {
          strategicPaths.push(filePath);
        }
      }
    }

    // Remove duplicates
    const uniquePaths = [...new Set(strategicPaths)];

    // Get already indexed documents
    const existingDocs = await this.discoverDocuments();

    // Normalize paths for comparison (convert to relative paths from projectRoot)
    const normalizedExistingPaths = new Set(
      existingDocs.map((d) => path.resolve(this.projectRoot, d.filePath))
    );

    // Filter to only new documents (by comparing absolute paths)
    const newPaths = uniquePaths.filter((p) => !normalizedExistingPaths.has(p));

    if (newPaths.length === 0) {
      return 0;
    }

    // Ingest each new strategic document with FULL security validation
    // Each document goes through:
    // 1. Content pattern validation (malicious instruction detection)
    // 2. Semantic drift detection (compares embeddings vs previous version)
    // 3. Structural integrity (markdown validation)
    // 4. Version recording (stores baseline for future drift detection)
    // 5. Overlay generation (extracts mission concepts with embeddings)
    //
    // Yes, this means concepts are embedded twice:
    // - Once during ingestion for security validation (drift detection + version recording)
    // - Once during overlay generation for mission concepts
    // This is intentional - security validation is worth the embedding cost.
    let ingestedCount = 0;
    for (let i = 0; i < newPaths.length; i++) {
      const docPath = newPaths[i];
      const docName = path.basename(docPath);
      const maxRetries = 3;
      let attempt = 0;
      let success = false;

      while (attempt < maxRetries && !success) {
        try {
          if (!useJson) {
            if (attempt > 0) {
              this.logInfo(
                chalk.yellow(
                  `     ↻ Retry attempt ${attempt}/${maxRetries - 1} for ${docName}...`
                )
              );
            } else {
              this.logInfo(
                chalk.cyan(`\n  🔒 Security Validation: ${docName}`)
              );
              this.logInfo(
                chalk.dim(`     └─ Model: Gemini via eGemma Workbench`)
              );
              this.logInfo(chalk.dim(`     └─ Persona: security_validator`));
              this.logInfo(
                chalk.dim(`     └─ Analyzing for threat patterns...`)
              );
            }
          }

          await docTransform.execute(docPath); // Full security validation (includes embedding for drift detection)
          if (!useJson) {
            this.logInfo(
              chalk.green(
                `     ✓ SAFE - No threats detected, approved for ingestion\n`
              )
            );
          }
          ingestedCount++;
          success = true;

          // Wait 10s between documents to avoid Gemini rate limits (except after last doc)
          if (i < newPaths.length - 1) {
            if (!useJson) {
              this.logInfo(
                chalk.dim(`  ⏱  Waiting 10s to avoid rate limits...`)
              );
            }
            await new Promise((resolve) => setTimeout(resolve, 10000));
          }
        } catch (error) {
          const errorMsg = (error as Error).message;

          // Check if it's a rate limit error (429)
          if (errorMsg.includes('429') || errorMsg.includes('Rate limit')) {
            attempt++;
            if (attempt < maxRetries) {
              // Exponential backoff: 15s, 30s, 60s
              const waitTime = 15000 * Math.pow(2, attempt - 1);
              if (!useJson) {
                this.logInfo(
                  chalk.yellow(
                    `     ⚠ Rate limit hit, waiting ${waitTime / 1000}s before retry...`
                  )
                );
              }
              await new Promise((resolve) => setTimeout(resolve, waitTime));
            } else {
              if (!useJson) {
                this.logInfo(
                  chalk.red(
                    `     ✗ FAILED - Max retries exceeded: ${errorMsg}\n`
                  )
                );
              }
            }
          } else {
            // Non-rate-limit error, don't retry
            if (!useJson) {
              this.logInfo(
                chalk.red(
                  `     ✗ FAILED - Security validation error: ${errorMsg}\n`
                )
              );
            }
            break;
          }
        }
      }
    }

    return ingestedCount;
  }

  public async shutdown(): Promise<void> {
    await this.vectorDB.close();
  }
}
