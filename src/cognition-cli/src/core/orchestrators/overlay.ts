import path from 'path';
import { glob } from 'glob';
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
import {
  ClassData,
  FunctionData,
  InterfaceData,
  StructuralData,
} from '../types/structural.js';
import { log, spinner } from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs-extra';
import {
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_FILE_EXTENSIONS,
} from '../../config.js';
import { SourceFile, Language } from '../types/structural.js';
import { DocumentObject } from '../pgc/document-object.js';

import { GenesisOracle } from '../pgc/oracles/genesis.js';
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
export class OverlayOrchestrator {
  private maxFileSize = DEFAULT_MAX_FILE_SIZE;

  private workbench: WorkbenchClient;
  private structuralPatternManager: StructuralPatternsManager;
  private lineagePatternManager: LineagePatternsManager;
  private missionConceptsManager: MissionConceptsManager;
  private strategicCoherenceManager: StrategicCoherenceManager;
  private mathematicalProofsManager: MathematicalProofsManager;
  private conceptExtractor: ConceptExtractor;
  private proofExtractor: ProofExtractor;
  private overlayOracle: OverlayOracle;
  private genesisOracle: GenesisOracle;
  private miner: StructuralMiner;

  private constructor(
    private projectRoot: string,
    private vectorDB: LanceVectorStore,
    private pgc: PGCManager
  ) {
    this.pgc = pgc;
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
    this.workbench = new WorkbenchClient(workbenchUrl);
    this.miner = new StructuralMiner(this.workbench);
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
    this.genesisOracle = new GenesisOracle(this.pgc);
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
    const vectorDB = new LanceVectorStore(pgc.pgcRoot);
    return new OverlayOrchestrator(projectRoot, vectorDB, pgc);
  }

  /**
   * Generate a specific overlay type (O₁-O₆)
   *
   * Main entry point for overlay generation. Handles specialized workflows for each overlay type:
   *
   * STRUCTURAL_PATTERNS (O₁):
   * - Discovers source files from PGC index
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
   * @param overlayType - Which semantic overlay to generate
   * @param options - Generation options
   *   - force: Ignore existing overlays, regenerate from scratch
   *   - skipGc: Skip garbage collection (useful for debugging)
   *   - sourcePath: Source directory for file discovery (default '.')
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
      | 'strategic_coherence',
    options?: {
      force?: boolean;
      skipGc?: boolean;
      sourcePath?: string;
    }
  ): Promise<void> {
    const force = options?.force || false;
    const skipGc = options?.skipGc || false;
    const sourcePath = options?.sourcePath || '.';
    const s = spinner();

    // Pre-flight check: Verify workbench is accessible
    s.start('[Overlay] Checking workbench availability...');
    try {
      await this.workbench.health();
      s.stop('[Overlay] Workbench is available.');
    } catch (error) {
      s.stop(chalk.red('[Overlay] ✗ Failed to connect to workbench.'));
      throw new Error(
        `Cannot generate overlays: Workbench at ${this.workbench.getBaseUrl()} is not accessible. ` +
          `Please ensure eGemma is running or set WORKBENCH_URL to a valid endpoint.\n` +
          `Error: ${(error as Error).message}`
      );
    }

    // Mission concepts has a different flow - no file discovery needed
    if (overlayType === 'mission_concepts') {
      // Auto-discover and ingest strategic docs (VISION.md, PATTERN_LIBRARY.md, etc.)
      s.start('[Overlay] Discovering and ingesting strategic documents...');
      const ingestedCount = await this.autoIngestStrategicDocs();
      if (ingestedCount > 0) {
        s.stop(`[Overlay] Ingested ${ingestedCount} strategic document(s)`);
      } else {
        s.stop('[Overlay] All strategic documents already ingested');
      }

      s.start('[Overlay] Discovering markdown documents in PGC...');
      const docIndex = await this.discoverDocuments();
      s.stop(`[Overlay] Found ${docIndex.length} document(s) in PGC.`);

      if (docIndex.length === 0) {
        log.warn(
          chalk.yellow(
            '[Overlay] No documents found. Add markdown files to docs/ folder or VISION.md in project root.'
          )
        );
        return;
      }

      console.log(
        chalk.blue(
          `[Overlay] Extracting mission concepts from ${docIndex.length} document(s)...`
        )
      );

      for (let i = 0; i < docIndex.length; i++) {
        const docEntry = docIndex[i];
        await this.generateMissionConcepts(docEntry, force);

        // Add delay between documents to avoid API rate limiting
        if (i < docIndex.length - 1) {
          console.log(chalk.dim('  ⏱  Waiting 5s to avoid rate limits...'));
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }

      console.log(
        chalk.green('[Overlay] Mission concepts generation complete.')
      );
      return;
    }

    // Strategic coherence has a different flow - computes from existing overlays
    if (overlayType === 'strategic_coherence') {
      await this.generateStrategicCoherence(force);
      return;
    }

    // Mathematical proofs - extract from documents
    if (overlayType === 'mathematical_proofs') {
      await this.generateMathematicalProofs(force);
      return;
    }

    const allFiles = await this.discoverFiles(
      path.join(this.projectRoot, sourcePath)
    );
    await this.runPGCMaintenance(
      allFiles.map((f) => f.relativePath),
      skipGc
    );

    if (overlayType === 'lineage_patterns') {
      s.start('[Overlay] Generating lineage patterns from manifest...');
      s.stop('[Overlay] Generating lineage patterns from manifest.');

      try {
        await this.lineagePatternManager.generate({ force });
        console.log(
          chalk.green('[Overlay] Lineage patterns generation complete.')
        );
      } finally {
        await this.lineagePatternManager.shutdown();
      }
    } else {
      s.start('[Overlay] Initializing vector database...');
      await this.vectorDB.initialize(overlayType);
      s.stop('[Overlay] Vector database initialized.');

      log.info(`[Overlay] Preparing jobs for ${allFiles.length} files...`);
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
      const manifest = await this.pgc.overlays.getManifest(overlayType);

      for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
        const batch = allFiles.slice(i, i + BATCH_SIZE);

        s.start(
          `[Overlay] Preparing batch ${
            i / BATCH_SIZE + 1
          }/${Math.ceil(allFiles.length / BATCH_SIZE)}`
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
            console.warn(`Missing hash for file: ${file.relativePath}`);
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

      s.stop();

      // Log incremental skip statistics
      if (incrementalSkipCount > 0) {
        log.info(
          chalk.green(
            `[Overlay] Incremental: Skipped ${incrementalSkipCount} unchanged symbols (${(
              (incrementalSkipCount / (allJobs.length + incrementalSkipCount)) *
              100
            ).toFixed(1)}% reduction)`
          )
        );
      }

      // Initialize workers with optimal count based on job size
      this.structuralPatternManager.initializeWorkers(allJobs.length);

      // Pre-flight validation: Check all source hashes exist before expensive embedding
      log.info(
        chalk.cyan(
          `\n[Overlay] Oracle: Pre-flight validation of ${allJobs.length} patterns...`
        )
      );
      const preflightResult = await this.validateJobHashes(allJobs);
      if (!preflightResult.success) {
        log.error(
          chalk.red('Pre-flight validation failed - missing structural hashes:')
        );
        preflightResult.messages.forEach((msg: string) => log.error(msg));
        throw new Error(
          'Cannot proceed with embedding - structural data missing from object store. ' +
            'This may be caused by aggressive garbage collection. Try running with --skip-gc flag.'
        );
      }
      log.success(
        chalk.green('[Overlay] Oracle: Pre-flight validation successful.')
      );

      log.info(
        chalk.cyan(
          `\n[Overlay] Processing ${allJobs.length} patterns with workers...`
        )
      );

      try {
        await this.structuralPatternManager.generatePatternsParallel(allJobs);
      } finally {
        await this.structuralPatternManager.shutdown();
      }

      log.success(chalk.cyan(`\n[Overlay] Processing complete.`));
      log.info(
        chalk.cyan(
          `- Processed ${allJobs.length} patterns (${skippedCount} files skipped)`
        )
      );

      // Verify the structural patterns overlay after generation
      log.info(
        chalk.cyan(
          '\n[Overlay] Oracle: Verifying structural patterns overlay...'
        )
      );
      const verificationResult =
        await this.overlayOracle.verifyStructuralPatternsOverlay();
      if (!verificationResult.success) {
        log.error(
          chalk.red('Structural patterns overlay verification failed:')
        );
        verificationResult.messages.forEach((msg: string) => log.error(msg));
        throw new Error('Structural patterns overlay is inconsistent.');
      } else {
        log.success(
          chalk.green('[Overlay] Structural Oracle verification successful.')
        );
      }

      // CRITICAL: Verify manifest completeness against vector DB
      log.info(
        chalk.cyan('\n[Overlay] Oracle: Verifying manifest completeness...')
      );
      const completenessResult =
        await this.overlayOracle.verifyManifestCompleteness();
      completenessResult.messages.forEach((msg: string) => console.log(msg));
      if (!completenessResult.success) {
        log.error(
          chalk.red(
            '[Overlay] Manifest is incomplete - pattern generation may have failed.'
          )
        );
        throw new Error('Structural patterns manifest is incomplete.');
      } else {
        log.success(
          chalk.green('[Overlay] Manifest completeness verification passed.')
        );
      }
    }
  }

  private async runPGCMaintenance(
    processedFiles: string[],
    skipGc: boolean = false
  ) {
    log.step('Running PGC Maintenance and Verification');

    if (skipGc) {
      log.info(
        'Goal: Verify PGC structural coherence (garbage collection skipped).'
      );
    } else {
      log.info(
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
      if (skipGc) {
        log.info('Transform: Garbage collection skipped (--skip-gc flag).');
      } else {
        log.info('Transform: No stale entries found. PGC is clean.');
      }
    }

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

  private async discoverFiles(rootPath: string): Promise<SourceFile[]> {
    let files: SourceFile[] = [];
    const extensions = DEFAULT_FILE_EXTENSIONS;

    if (!(await fs.pathExists(rootPath))) {
      log.warn(chalk.yellow(`Source path does not exist: ${rootPath}`));
      return [];
    }

    if (!(await fs.lstat(rootPath)).isDirectory()) {
      log.warn(chalk.yellow(`Source path is not a directory: ${rootPath}`));
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
      ],
      nodir: true,
    });

    // OPTIMIZATION: Parallel file reading for faster loading
    const fileReads = await Promise.all(
      filePaths.map(async (fullPath) => {
        const stats = await fs.stat(fullPath);
        if (stats.size > this.maxFileSize) {
          const relativePath = path.relative(this.projectRoot, fullPath);
          log.warn(
            `Skipping large file: ${relativePath} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`
          );
          return null;
        }

        const content = await fs.readFile(fullPath, 'utf-8');
        const fileName = path.basename(fullPath);
        const ext = path.extname(fileName);

        return {
          path: fullPath,
          relativePath: path.relative(this.projectRoot, fullPath),
          name: fileName,
          language: this.detectLanguage(ext),
          content,
        };
      })
    );

    // Filter out null entries (skipped large files)
    files = fileReads.filter((f) => f !== null) as SourceFile[];

    return files;
  }

  private detectLanguage(ext: string): Language {
    const map: Record<string, Language> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.rs': 'rust',
      '.go': 'go',
    };
    return map[ext] || 'unknown';
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
    force: boolean
  ): Promise<void> {
    const { filePath, contentHash, objectHash } = docEntry;

    // Check if overlay already exists (unless force=true)
    // Use contentHash for overlay storage (stable document identity)
    if (!force) {
      const existing = await this.missionConceptsManager.retrieve(contentHash);
      if (existing) {
        console.log(
          chalk.dim(
            `  [MissionConcepts] ${filePath} - skipped (already exists)`
          )
        );
        return;
      }
    }

    console.log(
      chalk.blue(`  [MissionConcepts] ${filePath} - extracting concepts...`)
    );

    // Load document object from PGC using objectHash (for retrieval)
    const docObjectBuffer = await this.pgc.objectStore.retrieve(objectHash);
    if (!docObjectBuffer) {
      console.log(
        chalk.yellow(
          `  [MissionConcepts] ${filePath} - skipped (document not found in PGC)`
        )
      );
      return;
    }

    const parsedDoc = JSON.parse(
      docObjectBuffer.toString('utf-8')
    ) as DocumentObject;

    if (parsedDoc.type !== 'markdown_document') {
      console.log(
        chalk.yellow(
          `  [MissionConcepts] ${filePath} - skipped (not a markdown document)`
        )
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
        console.log(
          chalk.yellow(
            `  [MissionConcepts] ${filePath} - skipped (no mission concepts found)`
          )
        );
        return;
      }

      console.log(
        chalk.blue(
          `  [MissionConcepts] ${filePath} - found ${concepts.length} concepts, generating embeddings...`
        )
      );
    } else {
      // Using pre-embedded concepts from security validation
      console.log(
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

    console.log(
      chalk.green(
        `  [MissionConcepts] ${filePath} - ✓ complete (${concepts.length} concepts embedded)`
      )
    );
  }

  /**
   * Generate mathematical proofs overlay (O₆)
   * Extracts theorems, lemmas, axioms, and proofs from documents
   */
  private async generateMathematicalProofs(force: boolean): Promise<void> {
    const s = spinner();

    // Discover already-ingested documents from PGC
    // Note: Does NOT ingest new documents - run mission_concepts generation first
    s.start('[MathematicalProofs] Discovering markdown documents in PGC...');
    const docIndex = await this.discoverDocuments();
    s.stop(`[MathematicalProofs] Found ${docIndex.length} document(s) in PGC.`);

    if (docIndex.length === 0) {
      log.warn(
        chalk.yellow(
          '[MathematicalProofs] No documents found in PGC.\n' +
            'Run `cognition-cli overlay generate mission_concepts` first to ingest strategic documents.'
        )
      );
      return;
    }

    console.log(
      chalk.blue(
        `[MathematicalProofs] Extracting mathematical statements from ${docIndex.length} document(s)...`
      )
    );

    for (let i = 0; i < docIndex.length; i++) {
      const docEntry = docIndex[i];
      await this.generateMathematicalProofsForDocument(docEntry, force);

      // Add delay between documents to avoid API rate limiting
      if (i < docIndex.length - 1) {
        console.log(chalk.dim('  ⏱  Waiting 5s to avoid rate limits...'));
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    console.log(
      chalk.green(
        '[MathematicalProofs] Mathematical proofs generation complete.'
      )
    );
  }

  /**
   * Generate mathematical proofs for a single document
   */
  private async generateMathematicalProofsForDocument(
    docEntry: { filePath: string; contentHash: string; objectHash: string },
    force: boolean
  ): Promise<void> {
    const { filePath, contentHash, objectHash } = docEntry;

    // Check if overlay already exists (unless force=true)
    if (!force) {
      const existing =
        await this.mathematicalProofsManager.loadOverlay(contentHash);
      if (existing) {
        console.log(
          chalk.dim(
            `  [MathematicalProofs] ${filePath} - skipped (already exists)`
          )
        );
        return;
      }
    }

    console.log(
      chalk.blue(`  [MathematicalProofs] ${filePath} - extracting proofs...`)
    );

    // Load document object from PGC using objectHash
    const docObjectBuffer = await this.pgc.objectStore.retrieve(objectHash);
    if (!docObjectBuffer) {
      console.log(
        chalk.yellow(
          `  [MathematicalProofs] ${filePath} - skipped (document not found in PGC)`
        )
      );
      return;
    }

    const parsedDoc = JSON.parse(
      docObjectBuffer.toString('utf-8')
    ) as DocumentObject;

    if (parsedDoc.type !== 'markdown_document') {
      console.log(
        chalk.yellow(
          `  [MathematicalProofs] ${filePath} - skipped (not a markdown document)`
        )
      );
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
      console.log(
        chalk.yellow(
          `  [MathematicalProofs] ${filePath} - skipped (no mathematical statements found)`
        )
      );
      return;
    }

    console.log(
      chalk.blue(
        `  [MathematicalProofs] ${filePath} - found ${statements.length} statements, generating embeddings...`
      )
    );

    // Generate overlay with embeddings
    const transformId = `mathematical_proofs:${contentHash}:${new Date().toISOString()}`;
    await this.mathematicalProofsManager.generateOverlay(
      filePath,
      contentHash,
      statements,
      transformId
    );

    console.log(
      chalk.green(
        `  [MathematicalProofs] ${filePath} - ✓ complete (${statements.length} statements embedded)`
      )
    );
  }

  /**
   * Generate strategic coherence overlay
   * Computes alignment between code symbols (O₁) and mission concepts (O₃)
   */
  private async generateStrategicCoherence(force: boolean): Promise<void> {
    const s = spinner();

    // Step 1: Check if overlay already exists
    if (!force) {
      const existing = await this.strategicCoherenceManager.retrieve();
      if (existing) {
        console.log(
          chalk.dim(
            '[StrategicCoherence] Overlay already exists. Use --force to regenerate.'
          )
        );
        return;
      }
    }

    // Step 2: Get mission document hash from mission concepts overlay
    s.start('[StrategicCoherence] Finding mission document...');
    const docIndex = await this.discoverDocuments();

    if (docIndex.length === 0) {
      s.stop(
        chalk.red('[StrategicCoherence] ✗ No mission documents found in PGC.')
      );
      log.error(
        chalk.yellow(
          'Run "cognition-cli overlay generate mission_concepts" first to extract mission concepts.'
        )
      );
      throw new Error(
        'Mission concepts overlay required for strategic coherence'
      );
    }

    // Aggregate mission concepts from ALL documents
    s.stop(`[StrategicCoherence] Found ${docIndex.length} strategic documents`);
    console.log(
      chalk.dim(`  Documents: ${docIndex.map((d) => d.filePath).join(', ')}`)
    );

    // Step 3: Initialize vector database for structural patterns
    s.start('[StrategicCoherence] Loading structural patterns...');
    await this.vectorDB.initialize('structural_patterns');
    s.stop('[StrategicCoherence] Structural patterns loaded.');

    // Step 4: Compute coherence overlay using ALL documents
    console.log(
      chalk.blue(
        '[StrategicCoherence] Computing alignment between code and mission...'
      )
    );

    const overlay =
      await this.strategicCoherenceManager.computeCoherenceFromMultipleDocs(
        docIndex.map((d) => d.contentHash),
        5, // top 5 alignments per symbol
        0.5 // alignment threshold
      );

    // Step 5: Store the overlay
    s.start('[StrategicCoherence] Storing coherence overlay...');
    await this.strategicCoherenceManager.store(overlay);
    s.stop('[StrategicCoherence] Overlay stored.');

    // Step 6: Display summary
    console.log('');
    console.log(chalk.green.bold('✓ Strategic Coherence Generation Complete'));
    console.log('');
    console.log(
      chalk.white(
        `  Analyzed ${overlay.symbol_coherence.length} code symbols against ${overlay.mission_concepts_count} mission concepts`
      )
    );
    console.log('');
    console.log(chalk.white('  Overall Metrics:'));
    console.log(
      chalk.white(
        `    Average coherence: ${overlay.overall_metrics.average_coherence.toFixed(3)}`
      )
    );
    console.log(
      chalk.green(
        `    ✓ Aligned symbols:  ${overlay.overall_metrics.aligned_symbols_count} (score ≥ ${overlay.overall_metrics.high_alignment_threshold})`
      )
    );
    console.log(
      chalk.yellow(
        `    ⚠ Drifted symbols:  ${overlay.overall_metrics.drifted_symbols_count} (score < ${overlay.overall_metrics.high_alignment_threshold})`
      )
    );
    console.log('');
    console.log(
      chalk.dim(
        '  Query results with: cognition-cli coherence aligned | drifted | report'
      )
    );
    console.log('');
  }

  /**
   * Auto-discover and ingest strategic documentation files
   * Looks for:
   * - VISION.md in project root or parent directories (searches up to repo root)
   * - docs/overlays/O4_mission/PATTERN_LIBRARY.md, docs/PRINCIPLES.md, docs/0X_*.md, etc.
   *
   * Only ingests files that haven't been processed yet (checks PGC index)
   */
  private async autoIngestStrategicDocs(): Promise<number> {
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
          if (attempt > 0) {
            console.log(
              chalk.yellow(
                `     ↻ Retry attempt ${attempt}/${maxRetries - 1} for ${docName}...`
              )
            );
          } else {
            console.log(chalk.cyan(`\n  🔒 Security Validation: ${docName}`));
            console.log(
              chalk.dim(`     └─ Model: Gemini via eGemma Workbench`)
            );
            console.log(chalk.dim(`     └─ Persona: security_validator`));
            console.log(chalk.dim(`     └─ Analyzing for threat patterns...`));
          }

          await docTransform.execute(docPath); // Full security validation (includes embedding for drift detection)
          console.log(
            chalk.green(
              `     ✓ SAFE - No threats detected, approved for ingestion\n`
            )
          );
          ingestedCount++;
          success = true;

          // Wait 10s between documents to avoid Gemini rate limits (except after last doc)
          if (i < newPaths.length - 1) {
            console.log(chalk.dim(`  ⏱  Waiting 10s to avoid rate limits...`));
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
              console.log(
                chalk.yellow(
                  `     ⚠ Rate limit hit, waiting ${waitTime / 1000}s before retry...`
                )
              );
              await new Promise((resolve) => setTimeout(resolve, waitTime));
            } else {
              console.log(
                chalk.red(`     ✗ FAILED - Max retries exceeded: ${errorMsg}\n`)
              );
            }
          } else {
            // Non-rate-limit error, don't retry
            console.log(
              chalk.red(
                `     ✗ FAILED - Security validation error: ${errorMsg}\n`
              )
            );
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
