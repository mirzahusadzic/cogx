import path from 'path';
import { PGCManager } from '../pgc/manager.js';
import { LanceVectorStore } from '../overlays/vector-db/lance-store.js';
import { WorkbenchClient } from '../executors/workbench-client.js';
import { StructuralPatternsManager } from '../overlays/structural/patterns.js';
import { LineagePatternsManager } from '../overlays/lineage/manager.js';
import { MissionConceptsManager } from '../overlays/mission-concepts/manager.js';
import { StrategicCoherenceManager } from '../overlays/strategic-coherence/manager.js';
import { ConceptExtractor } from '../analyzers/concept-extractor.js';
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

export class OverlayOrchestrator {
  private maxFileSize = DEFAULT_MAX_FILE_SIZE;

  private workbench: WorkbenchClient;
  private structuralPatternManager: StructuralPatternsManager;
  private lineagePatternManager: LineagePatternsManager;
  private missionConceptsManager: MissionConceptsManager;
  private strategicCoherenceManager: StrategicCoherenceManager;
  private conceptExtractor: ConceptExtractor;
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
    this.conceptExtractor = new ConceptExtractor();
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

  public async run(
    overlayType:
      | 'structural_patterns'
      | 'lineage_patterns'
      | 'mission_concepts'
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
      s.start('[Overlay] Discovering markdown documents in PGC...');
      const docIndex = await this.discoverDocuments();
      s.stop(`[Overlay] Found ${docIndex.length} document(s) in PGC.`);

      if (docIndex.length === 0) {
        log.warn(
          chalk.yellow(
            '[Overlay] No documents found. Run "genesis:docs <path>" first to ingest markdown files.'
          )
        );
        return;
      }

      console.log(
        chalk.blue(
          `[Overlay] Extracting mission concepts from ${docIndex.length} document(s)...`
        )
      );

      for (const docEntry of docIndex) {
        await this.generateMissionConcepts(docEntry, force);
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

      for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
        const batch = allFiles.slice(i, i + BATCH_SIZE);

        s.start(
          `[Overlay] Preparing batch ${
            i / BATCH_SIZE + 1
          }/${Math.ceil(allFiles.length / BATCH_SIZE)}`
        );

        for (const file of batch) {
          if (file.path.includes('.test.') || file.path.includes('.spec.')) {
            skippedCount++;
            continue;
          }

          const structuralData = await this.miner.extractStructure(file);
          const contentHash = this.pgc.objectStore.computeHash(file.content);
          const structuralHash = await this.pgc.objectStore.store(
            JSON.stringify(structuralData, null, 2)
          );

          if (!structuralData) {
            skippedCount++;
            continue;
          }

          structuralData.classes?.forEach((c) => {
            allJobs.push({
              projectRoot: this.projectRoot,
              symbolName: c.name,
              filePath: file.relativePath,
              contentHash,
              structuralHash,
              structuralData,
              force,
            });
          });

          structuralData.functions?.forEach((f) => {
            allJobs.push({
              projectRoot: this.projectRoot,
              symbolName: f.name,
              filePath: file.relativePath,
              contentHash,
              structuralHash,
              structuralData,
              force,
            });
          });

          structuralData.interfaces?.forEach((i) => {
            allJobs.push({
              projectRoot: this.projectRoot,
              symbolName: i.name,
              filePath: file.relativePath,
              contentHash,
              structuralHash,
              structuralData,
              force,
            });
          });
        }
      }

      s.stop();

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

    for (const job of jobs) {
      const exists = await this.pgc.objectStore.exists(job.structuralHash);
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
    const documents: Array<{
      filePath: string;
      contentHash: string;
      objectHash: string;
    }> = [];

    for (const indexFile of indexFiles) {
      if (!indexFile.endsWith('.json')) continue;

      const indexPath = path.join(docsIndexPath, indexFile);
      const indexData = await fs.readJSON(indexPath);

      // Support both old format (hash only) and new format (contentHash + objectHash)
      const contentHash = indexData.contentHash || indexData.hash;
      const objectHash = indexData.objectHash || indexData.hash;

      documents.push({
        filePath: indexData.filePath,
        contentHash,
        objectHash,
      });
    }

    return documents;
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

    // Extract concepts from document
    const markdownDoc = {
      filePath: parsedDoc.filePath,
      hash: parsedDoc.hash,
      sections: parsedDoc.ast.sections,
      metadata: parsedDoc.ast.metadata,
      rawContent: parsedDoc.content,
    };

    const concepts = this.conceptExtractor.extract(markdownDoc);

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

    // Create overlay and store (manager will generate embeddings)
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

    // Use the first document (typically VISION.md) as the mission document
    const missionDoc = docIndex[0];
    s.stop(
      `[StrategicCoherence] Using mission document: ${missionDoc.filePath}`
    );

    // Step 3: Initialize vector database for structural patterns
    s.start('[StrategicCoherence] Loading structural patterns...');
    await this.vectorDB.initialize('structural_patterns');
    s.stop('[StrategicCoherence] Structural patterns loaded.');

    // Step 4: Compute coherence overlay
    console.log(
      chalk.blue(
        '[StrategicCoherence] Computing alignment between code and mission...'
      )
    );

    const overlay = await this.strategicCoherenceManager.computeCoherence(
      missionDoc.contentHash,
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

  public async shutdown(): Promise<void> {
    await this.vectorDB.close();
  }
}
