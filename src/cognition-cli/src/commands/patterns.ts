import { Command } from 'commander';
import { PGCManager } from '../core/pgc/manager.js';
import {
  LanceVectorStore,
  VectorRecord,
} from '../core/overlays/vector-db/lance-store.js';
import { WorkbenchClient } from '../core/executors/workbench-client.js';
import { StructuralPatternsManager } from '../core/overlays/structural/patterns.js';
import { LineagePatternsManager } from '../core/overlays/lineage/manager.js';
import chalk from 'chalk';

import { PatternManager } from '../core/pgc/patterns.js';

export function addPatternsCommands(program: Command) {
  const patternsCommand = program
    .command('patterns')
    .description('Commands for managing and querying structural patterns.');

  patternsCommand
    .command('find-similar <symbol>')
    .option('-k, --top-k <number>', 'Number of similar patterns', '10')
    .option(
      '--type <type>',
      "The type of patterns to find ('structural' or 'lineage')",
      'structural'
    )
    .option('--json', 'Output raw JSON')
    .action(async (symbol, options) => {
      const pgc = new PGCManager(process.cwd());
      const vectorDB = new LanceVectorStore(pgc.pgcRoot);
      const tableName = `${options.type}_patterns`;
      await vectorDB.initialize(tableName);

      const workbench = new WorkbenchClient(process.env.WORKBENCH_URL!);

      const manager: PatternManager =
        options.type === 'structural'
          ? new StructuralPatternsManager(pgc, vectorDB, workbench)
          : new LineagePatternsManager(pgc, vectorDB, workbench);

      const results = await manager.findSimilarPatterns(
        symbol,
        parseInt(options.topK)
      );

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(
          chalk.bold(
            `\n🔍 ${
              options.type === 'structural' ? 'Structural' : 'Lineage'
            } patterns similar to ${chalk.cyan(symbol)}:\n`
          )
        );
        results.forEach(
          (
            r: {
              symbol: string;
              filePath: string;
              similarity: number;
              architecturalRole: string;
              explanation: string;
            },
            i: number
          ) => {
            const simBar = '█'.repeat(Math.round(r.similarity * 20));
            console.log(
              `${i + 1}. ${chalk.green(r.symbol)} ` +
                `${chalk.gray(`[${r.architecturalRole}]`)}`
            );
            console.log(`   ${chalk.dim('📁 ' + r.filePath)}`);
            console.log(
              `   ${chalk.yellow(simBar)} ${(r.similarity * 100).toFixed(1)}%`
            );
            console.log(`   ${chalk.dim(r.explanation)}\n`);
          }
        );
      }
    });

  patternsCommand
    .command('analyze')
    .description('Analyze architectural patterns across the codebase')
    .option(
      '--type <type>',
      "The type of patterns to analyze ('structural' or 'lineage')",
      'structural'
    )
    .action(async (options) => {
      const pgc = new PGCManager(process.cwd());
      const vectorDB = new LanceVectorStore(pgc.pgcRoot);
      const tableName = `${options.type}_patterns`;
      await vectorDB.initialize(tableName);
      const allVectors: VectorRecord[] = await vectorDB.getAllVectors();

      // Group by architectural role
      const roleDistribution = allVectors.reduce(
        (acc: Record<string, number>, v: VectorRecord) => {
          const role = v.architectural_role as string;
          acc[role] = (acc[role] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      console.log(chalk.bold('\n📊 Architectural Pattern Distribution:\n'));
      Object.entries(roleDistribution)
        .sort(([, a], [, b]) => b - a)
        .forEach(([role, count]) => {
          const bar = '▓'.repeat(count);
          console.log(`${chalk.cyan(role.padEnd(15))} ${bar} ${count}`);
        });
    });

  patternsCommand
    .command('compare <symbol1> <symbol2>')
    .description('Compare the patterns of two symbols')
    .option(
      '--type <type>',
      "The type of patterns to compare ('structural' or 'lineage')",
      'structural'
    )
    .action(async (symbol1, symbol2, options) => {
      const pgc = new PGCManager(process.cwd());
      const vectorDB = new LanceVectorStore(pgc.pgcRoot);
      const tableName = `${options.type}_patterns`;
      await vectorDB.initialize(tableName);

      const workbench = new WorkbenchClient(process.env.WORKBENCH_URL!);

      const manager: PatternManager =
        options.type === 'structural'
          ? new StructuralPatternsManager(pgc, vectorDB, workbench)
          : new LineagePatternsManager(pgc, vectorDB, workbench);

      const vector1 = await manager.getVectorForSymbol(symbol1);
      const vector2 = await manager.getVectorForSymbol(symbol2);

      if (!vector1 || !vector2) {
        console.error(chalk.red('Could not find patterns for both symbols.'));
        return;
      }

      const similarity = vectorDB.cosineSimilarity(
        vector1.embedding,
        vector2.embedding
      );

      console.log(
        chalk.bold(
          `\n⚖️  Comparing ${chalk.cyan(symbol1)} vs ${chalk.green(
            symbol2
          )} (${options.type} patterns):\n`
        )
      );

      // Show file paths
      const metadata1 = vector1.metadata as Record<string, unknown>;
      const metadata2 = vector2.metadata as Record<string, unknown>;
      console.log(
        chalk.dim(
          `📁 ${symbol1}: ${metadata1.anchor || metadata1.file_path || 'unknown'}`
        )
      );
      console.log(
        chalk.dim(
          `📁 ${symbol2}: ${metadata2.anchor || metadata2.file_path || 'unknown'}`
        )
      );

      const simBar = '█'.repeat(Math.round(similarity * 40));
      console.log(
        `\n   Similarity: ${chalk.yellow(simBar)} ${(similarity * 100).toFixed(
          1
        )}%`
      );

      const vectorData1 = vector1 as Record<string, unknown>;
      const vectorData2 = vector2 as Record<string, unknown>;

      console.log(chalk.bold(`\nSignature for ${symbol1}:`));
      console.log(
        chalk.dim(
          vectorData1.structural_signature ||
            metadata1.structural_signature ||
            metadata1.lineage_signature ||
            'N/A'
        )
      );
      console.log(chalk.bold(`\nSignature for ${symbol2}:`));
      console.log(
        chalk.dim(
          vectorData2.structural_signature ||
            metadata2.structural_signature ||
            metadata2.lineage_signature ||
            'N/A'
        )
      );
    });
}
