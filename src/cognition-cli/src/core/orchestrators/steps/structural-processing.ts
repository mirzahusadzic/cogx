import { BaseStep } from './base.js';
import type { PipelineContext, StepResult } from '../types.js';
import fs from 'fs-extra';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import * as workerpool from 'workerpool';
import os from 'os';
import YAML from 'yaml';
import type { SourceFile, StructuralData } from '../../types/structural.js';
import type { GenesisJobResult, GenesisJobPacket } from '../genesis-worker.js';
import { WORKBENCH_DEPENDENT_EXTRACTION_METHODS } from '../../../config.js';

export interface StructuralProcessingOptions {
  parallel?: boolean;
  incremental?: boolean;
}

/**
 * Step to extract structural metadata from source files and store in PGC.
 * Handles both parallel parsing (via workers) and sequential processing.
 * Also handles invalidation propagation for incremental updates.
 */
export class StructuralProcessingStep extends BaseStep {
  name = 'StructuralProcessing';
  private workerPool?: workerpool.Pool;

  constructor(private readonly options: StructuralProcessingOptions = {}) {
    super();
  }

  async execute(context: PipelineContext): Promise<StepResult> {
    const files = context.sourceFiles || [];
    if (files.length === 0) {
      this.log('No files to process.');
      return this.success();
    }

    const isWorkbenchHealthy = !!context.isWorkbenchHealthy;
    const nativeFiles = files.filter(
      (f) => f.language === 'typescript' || f.language === 'javascript'
    );

    this.log(
      `Processing ${files.length} files (${nativeFiles.length} native, ${
        files.length - nativeFiles.length
      } remote)`
    );

    // Phase 1: Parallel parsing for native files (TS/JS)
    const nativeResults = new Map<string, StructuralData>();
    if (this.options.parallel && nativeFiles.length > 0) {
      try {
        await this.initializeWorkers(nativeFiles.length);
        const results = await this.parseNativeFilesParallel(
          nativeFiles,
          context
        );
        for (const result of results) {
          if (result.status === 'success' && result.structuralData) {
            nativeResults.set(result.relativePath, result.structuralData);
          }
        }
      } finally {
        await this.shutdownWorkers();
      }
    }

    // Phase 2: Sequential processing for all files
    let processedCount = 0;
    for (const file of files) {
      try {
        const preParsed = nativeResults.get(file.relativePath);
        const wasProcessed = await this.processSingleFile(
          file,
          context,
          isWorkbenchHealthy,
          preParsed
        );

        if (wasProcessed) {
          processedCount++;
          context.processedFiles.push(file.relativePath);
        }

        if (context.onProgress) {
          context.onProgress(
            processedCount,
            files.length,
            `Processing ${file.relativePath}`,
            file.relativePath
          );
        }
      } catch (error) {
        this.log(`Error processing ${file.relativePath}: ${error}`);
        context.failedFiles.push(file.relativePath);
        // Continue to next file
      }
    }

    return this.success(`Processed ${processedCount} files.`);
  }

  private async processSingleFile(
    file: SourceFile,
    context: PipelineContext,
    isWorkbenchHealthy: boolean,
    preParsed?: StructuralData
  ): Promise<boolean> {
    const contentHash = context.pgc.objectStore.computeHash(file.content);
    const existingIndex = await context.pgc.index.get(file.relativePath);

    // Skip if unchanged (if incremental)
    if (
      this.options.incremental &&
      existingIndex &&
      existingIndex.content_hash === contentHash
    ) {
      return false;
    }

    const storedHashes: string[] = [];
    let recordedTransformId: string | undefined;

    try {
      // Store content
      await context.pgc.objectStore.store(file.content);
      storedHashes.push(contentHash);

      // Extract structural data
      const structural =
        preParsed || (await context.miner.extractStructure(file));
      const structuralHash = await context.pgc.objectStore.store(
        JSON.stringify(structural, null, 2)
      );
      storedHashes.push(structuralHash);

      const isWorkbenchDependent =
        WORKBENCH_DEPENDENT_EXTRACTION_METHODS.includes(
          structural.extraction_method
        );

      if (!isWorkbenchHealthy && isWorkbenchDependent) {
        this.log(`⸬ ${file.relativePath} (skipped workbench processing)`);

        // Update index with partial status
        await context.pgc.index.set(file.relativePath, {
          path: file.relativePath,
          content_hash: contentHash,
          structural_hash: structuralHash,
          status: 'PartiallyProcessed',
          history: [
            ...(existingIndex?.history || []),
            'skipped_workbench_processing',
          ],
          structuralData: structural,
        });
        return true;
      }

      // Record transform
      recordedTransformId = await context.pgc.transformLog.record({
        goal: {
          objective: this.options.incremental
            ? 'Incremental update of source file'
            : 'Initial extraction of structural metadata',
          criteria: [
            'Valid syntax',
            'Complete imports',
            'All exports identified',
          ],
          phimin: 0.8,
        },
        inputs: [{ path: file.relativePath, hash: contentHash }],
        outputs: [{ path: file.relativePath, hash: structuralHash }],
        method: structural.extraction_method,
        fidelity: structural.fidelity,
      });

      // Update index
      await context.pgc.index.set(file.relativePath, {
        path: file.relativePath,
        content_hash: contentHash,
        structural_hash: structuralHash,
        status: 'Valid',
        history: [...(existingIndex?.history || []), recordedTransformId],
        structuralData: structural,
      });

      // Update reverse deps
      await context.pgc.reverseDeps.add(contentHash, recordedTransformId);
      await context.pgc.reverseDeps.add(structuralHash, recordedTransformId);

      // Handle invalidation if incremental
      if (this.options.incremental && existingIndex) {
        const oldStructuralHash = existingIndex.structural_hash;
        if (oldStructuralHash && oldStructuralHash !== structuralHash) {
          this.log(
            `Structural change detected for ${file.relativePath}. Propagating invalidation...`
          );
          await this.propagateInvalidation(oldStructuralHash, context);
        }
      }

      return true;
    } catch (error) {
      await this.rollback(context, storedHashes, recordedTransformId);
      throw error;
    }
  }

  private async propagateInvalidation(
    oldStructuralHash: string,
    context: PipelineContext
  ) {
    // 1. Invalidate Overlays
    await this.invalidateOverlays(oldStructuralHash, context);

    // 2. Invalidate Reverse Dependencies
    const transformIds =
      await context.pgc.reverseDeps.getTransformIds(oldStructuralHash);
    for (const transformId of transformIds) {
      const transform =
        await context.pgc.transformLog.getTransformation(transformId);
      if (transform) {
        for (const output of transform.outputs) {
          if (output.path) {
            this.log(`Invalidating dependent: ${output.path}`);
            await context.pgc.index.remove(output.path);
            await this.propagateInvalidation(output.hash, context);
          }
        }
      }
      await context.pgc.transformLog.delete(transformId);
      await context.pgc.reverseDeps.delete(oldStructuralHash, transformId);
    }
  }

  private async invalidateOverlays(
    oldStructuralHash: string,
    context: PipelineContext
  ) {
    const overlayTypes = [
      'structural_patterns',
      'security_guidelines',
      'lineage_patterns',
      'mission_concepts',
      'operational_patterns',
      'mathematical_proofs',
      'strategic_coherence',
    ];

    for (const overlayType of overlayTypes) {
      const overlayDir = path.join(
        context.pgc.pgcRoot,
        'overlays',
        overlayType
      );
      if (!(await fs.pathExists(overlayDir))) continue;

      const files = await this.findOverlayFiles(overlayDir);
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          const overlayData = file.endsWith('.json')
            ? JSON.parse(content)
            : YAML.parse(content);

          const sourceHash =
            overlayData.validation?.sourceHash ||
            overlayData.symbolStructuralDataHash;
          if (sourceHash === oldStructuralHash) {
            this.log(
              `Removing invalidated overlay: ${path.relative(context.pgc.pgcRoot, file)}`
            );
            await fs.remove(file);

            const relativePath = path.relative(context.projectRoot, file);
            await context.pgc.overlays.deleteManifestEntry(
              overlayType,
              relativePath
            );
          }
        } catch {
          /* ignore */
        }
      }
    }
  }

  private async findOverlayFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    if (!(await fs.pathExists(dir))) return files;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.findOverlayFiles(fullPath)));
      } else if (entry.name.endsWith('.json') || entry.name.endsWith('.yaml')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  private async rollback(
    context: PipelineContext,
    hashes: string[],
    transformId?: string
  ) {
    this.log('Rollback: Cleaning up partial PGC mutations');
    for (const hash of hashes) {
      await context.pgc.objectStore.delete(hash);
    }
    if (transformId) {
      await context.pgc.transformLog.delete(transformId);
    }
  }

  private async initializeWorkers(fileCount: number) {
    const workerCount = this.calculateOptimalWorkers(fileCount);
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const workerPath = path.join(__dirname, '../genesis-worker.js');

    this.workerPool = workerpool.pool(workerPath, {
      minWorkers: workerCount,
      maxWorkers: workerCount,
      workerType: 'thread',
    });
  }

  private async shutdownWorkers() {
    if (this.workerPool) {
      await this.workerPool.terminate();
      this.workerPool = undefined;
    }
  }

  private calculateOptimalWorkers(fileCount: number): number {
    const cpuCount = os.cpus().length;
    if (fileCount <= 10) return Math.min(2, cpuCount);
    if (fileCount <= 50) return Math.min(4, cpuCount);
    return Math.min(8, Math.floor(cpuCount * 0.75));
  }

  private async parseNativeFilesParallel(
    files: SourceFile[],
    context: PipelineContext
  ): Promise<GenesisJobResult[]> {
    if (!this.workerPool) throw new Error('Worker pool not initialized');

    const jobs: GenesisJobPacket[] = files.map((file) => ({
      file,
      contentHash: context.pgc.objectStore.computeHash(file.content),
    }));

    const promises = jobs.map((job) =>
      this.workerPool!.exec('parseNativeAST', [job], {})
    );

    return (await Promise.all(promises)) as GenesisJobResult[];
  }
}
