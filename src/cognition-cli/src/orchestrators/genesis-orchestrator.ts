import fs from 'fs-extra';
import path from 'path';
import { log, spinner } from '@clack/prompts';
import chalk from 'chalk';
import type { PGCManager } from '../core/pgc-manager.js';
import type { StructuralMiner } from '../miners/structural-miner.js';
import type { WorkbenchClient } from '../executors/workbench-client.js';
import type { SourceFile, Language } from '../types/structural.js';
import { StructuralOracle } from '../core/oracles/structural-oracle.js';

export class GenesisOrchestrator {
  constructor(
    private pgc: PGCManager,
    private miner: StructuralMiner,
    private workbench: WorkbenchClient,
    private structuralOracle: StructuralOracle,
    private projectRoot: string
  ) {}

  async executeBottomUpAggregation(sourcePath: string) {
    const s = spinner();

    s.start('Discovering source files');
    const actualSourcePath = path.join(this.projectRoot, sourcePath);
    const files = await this.discoverFiles(actualSourcePath);
    s.stop(`Found ${files.length} files`);

    let processed = 0;
    for (const file of files) {
      s.start(
        `Processing ${chalk.cyan(file.relativePath)} (${++processed}/${files.length})`
      );

      try {
        const structural = await this.miner.extractStructure(file);

        const contentHash = await this.pgc.objectStore.store(file.content);

        const structuralHash = await this.pgc.objectStore.store(
          JSON.stringify(structural, null, 2)
        );

        const transformId = await this.pgc.transformLog.record({
          goal: {
            objective: 'Extract structural metadata from source file',
            criteria: [
              'Valid syntax',
              'Complete import list',
              'All exports identified',
            ],
            phimin: 0.8,
          },
          inputs: [contentHash],
          outputs: [structuralHash],
          method: structural.extraction_method,
          fidelity: structural.fidelity,
        });

        await this.pgc.index.set(file.relativePath, {
          content_hash: contentHash,
          structural_hash: structuralHash,
          status: 'Valid',
          history: [transformId],
        });

        await this.pgc.reverseDeps.add(contentHash, transformId);
        await this.pgc.reverseDeps.add(structuralHash, transformId);

        s.stop(chalk.green(`✓ ${file.relativePath}`));
      } catch (error) {
        s.stop(
          chalk.red(`✗ ${file.relativePath}: ${(error as Error).message}`)
        );
        log.error(`Failed to process ${file.relativePath}`);
      }
    }

    await this.aggregateDirectories();

    log.info('Running structural oracle verification...');
    const verificationResult = await this.structuralOracle.verify();
    if (verificationResult.success) {
      log.success(
        chalk.green('Structural Oracle: PGC is structurally coherent.')
      );
    } else {
      log.error(
        chalk.red('Structural Oracle: PGC has structural inconsistencies:')
      );
      verificationResult.messages.forEach((msg) =>
        log.error(chalk.red(`- ${msg}`))
      );
      throw new Error('Structural Oracle verification failed.');
    }
  }

  private async discoverFiles(rootPath: string): Promise<SourceFile[]> {
    const files: SourceFile[] = [];
    const extensions = ['.ts', '.js', '.py', '.java', '.rs', '.go'];

    const walk = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

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
}
