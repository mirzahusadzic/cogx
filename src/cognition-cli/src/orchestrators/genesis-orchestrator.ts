import fs from 'fs-extra';
import path from 'path';
import { log, spinner } from '@clack/prompts';
import chalk from 'chalk';

import type { PGCManager } from '../core/pgc-manager.js';
import type { StructuralMiner } from '../miners/structural-miner.js';
import type { WorkbenchClient } from '../executors/workbench-client.js';
import type { SourceFile, Language } from '../types/structural.js';
import { StructuralOracle } from '../core/oracles/structural-oracle.js';

import { DEFAULT_MAX_FILE_SIZE, DEFAULT_FILE_EXTENSIONS } from '../config.js';

export class GenesisOrchestrator {
  private maxFileSize = DEFAULT_MAX_FILE_SIZE;

  constructor(
    private pgc: PGCManager,
    private miner: StructuralMiner,
    private workbench: WorkbenchClient,
    private structuralOracle: StructuralOracle,
    private projectRoot: string
  ) {}

  async executeBottomUpAggregation(sourcePath: string) {
    const s = spinner();

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

    let processed = 0;

    for (const file of files) {
      s.start(
        `Processing ${chalk.cyan(file.relativePath)} (${++processed}/${files.length})`
      );
      await this.processFile(file, s, isWorkbenchHealthy);
    }

    await this.aggregateDirectories();

    await this.runPGCMaintenance(files.map((f) => f.relativePath));
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
    const verificationResult = await this.structuralOracle.verify();

    if (verificationResult.success) {
      log.success(
        'Oracle: Verification complete. PGC is structurally coherent.'
      );
    } else {
      log.error(
        'Oracle: Verification failed. PGC has structural inconsistencies:'
      );
      verificationResult.messages.forEach((msg) =>
        log.error(chalk.red(`- ${msg}`))
      );
    }
  }

  private async processFile(
    file: SourceFile,
    s: ReturnType<typeof spinner>,
    isWorkbenchHealthy: boolean
  ) {
    const storedHashes: string[] = [];
    let recordedTransformId: string | undefined;

    const existingIndex = await this.pgc.index.get(file.relativePath);

    const contentHash = this.pgc.objectStore.computeHash(file.content);

    if (existingIndex && existingIndex.content_hash === contentHash) {
      s.stop(chalk.gray(`⸟ ${file.relativePath} (unchanged)`));

      return;
    }

    if (!isWorkbenchHealthy) {
      s.stop(
        chalk.yellow(`⸬ ${file.relativePath} (skipped - workbench not healthy)`)
      );

      return;
    }

    try {
      // Store the content hash in the object store
      await this.pgc.objectStore.store(file.content);
      storedHashes.push(contentHash);

      const structural = await this.miner.extractStructure(file);

      const structuralHash = await this.pgc.objectStore.store(
        JSON.stringify(structural, null, 2)
      );
      storedHashes.push(structuralHash);

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

      await this.pgc.reverseDeps.add(contentHash, recordedTransformId);
      await this.pgc.reverseDeps.add(structuralHash, recordedTransformId);

      s.stop(chalk.green(`✓ ${file.relativePath}`));
    } catch (error) {
      s.stop(chalk.red(`✗ ${file.relativePath}: ${(error as Error).message}`));
      log.error(`Failed to process ${file.relativePath}`);
      await this.rollback(storedHashes, recordedTransformId);
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
            entry.name === '.open_cognition'
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

  private async aggregateDirectories() {
    log.info('Aggregating directory summaries (bottom-up)');
  }

  private async garbageCollect(processedFiles: string[]) {
    let staleEntries = 0;
    let cleanedReverseDeps = 0;
    let cleanedTransformLogEntries = 0;

    // Phase 1: Clean up stale index entries
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
