import fs from 'fs-extra';
import path from 'path';
import { log, spinner } from '@clack/prompts';
import chalk from 'chalk';
import type { PGCManager } from '../core/pgc-manager.js';
import type { StructuralMiner } from '../miners/structural-miner.js';
import type { WorkbenchClient } from '../executors/workbench-client.js';
import type { SourceFile } from '../types/structural.js';

export class GenesisOrchestrator {
  constructor(
    private pgc: PGCManager,
    private miner: StructuralMiner,
    private workbench: WorkbenchClient
  ) {}

  async executeBottomUpAggregation(sourcePath: string) {
    const s = spinner();

    s.start('Discovering source files');
    const files = await this.discoverFiles(sourcePath);
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
          timestamp: new Date(),
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

    await this.aggregateDirectories(sourcePath);
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
              relativePath: path.relative(process.cwd(), fullPath),
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

  private detectLanguage(ext: string): string {
    const map: Record<string, string> = {
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
