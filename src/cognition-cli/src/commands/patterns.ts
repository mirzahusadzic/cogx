import { Command } from 'commander';
import { PGCManager } from '../core/pgc-manager.js';
import { LanceVectorStore } from '../lib/patterns/vector-db/lance-vector-store.js';
import { WorkbenchClient } from '../executors/workbench-client.js';
import { StructuralPatternsManager } from '../core/structural-patterns-manager.js';
import chalk from 'chalk';
import path from 'path';

export function addPatternsCommands(program: Command) {
  const patternsCommand = program
    .command('patterns')
    .description('Commands for managing and querying structural patterns.');

  patternsCommand
    .command('find-similar <symbol>')
    .option('-k, --top-k <number>', 'Number of similar patterns', '10')
    .option('--json', 'Output raw JSON')
    .action(async (symbol, options) => {
      const pgc = new PGCManager(process.cwd());
      const vectorDB = new LanceVectorStore(pgc.pgcRoot);
      await vectorDB.initialize();
      const workbench = new WorkbenchClient(process.env.WORKBENCH_URL!);

      const manager = new StructuralPatternsManager(pgc, vectorDB, workbench);
      const results = await manager.findSimilarPatterns(
        symbol,
        parseInt(options.topK)
      );

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(
          chalk.bold(`\n🔍 Patterns similar to ${chalk.cyan(symbol)}:\n`)
        );
        results.forEach((r, i) => {
          const simBar = '█'.repeat(Math.round(r.similarity * 20));
          console.log(
            `${i + 1}. ${chalk.green(r.symbol)} ` +
              `${chalk.gray(`[${r.architecturalRole}]`)}`
          );
          console.log(
            `   ${chalk.yellow(simBar)} ${(r.similarity * 100).toFixed(1)}%`
          );
          console.log(`   ${chalk.dim(r.explanation)}\n`);
        });
      }
    });

  patternsCommand
    .command('analyze')
    .description('Analyze architectural patterns across the codebase')
    .action(async () => {
      const pgc = new PGCManager(process.cwd());
      const vectorDB = new LanceVectorStore(pgc.pgcRoot);
      await vectorDB.initialize();

      const allVectors = await vectorDB.getAllVectors();

      // Group by architectural role
      const roleDistribution = allVectors.reduce(
        (acc, v) => {
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
    .description('Compare dependency lineages of two symbols')
    .action(async (symbol1, symbol2) => {
      const pgc = new PGCManager(process.cwd());

      const lineage1 = await pgc.getLineageForSymbol(symbol1, { maxDepth: 3 });
      const lineage2 = await pgc.getLineageForSymbol(symbol2, { maxDepth: 3 });

      console.log(
        chalk.bold(
          `\n🔗 Comparing ${chalk.cyan(symbol1)} vs ${chalk.green(symbol2)}:\n`
        )
      );

      // Find shared dependencies
      const deps1 = new Set(
        lineage1.dependencies.map((d) => d.path.split(' -> ').pop())
      );
      const deps2 = new Set(
        lineage2.dependencies.map((d) => d.path.split(' -> ').pop())
      );

      const shared = [...deps1].filter((d) => deps2.has(d));
      const unique1 = [...deps1].filter((d) => !deps2.has(d));
      const unique2 = [...deps2].filter((d) => !deps1.has(d));

      console.log(chalk.bold('Shared dependencies:'));
      shared.forEach((d) => console.log(`  ${chalk.yellow('●')} ${d}`));

      console.log(chalk.bold(`\nUnique to ${symbol1}:`));
      unique1
        .slice(0, 5)
        .forEach((d) => console.log(`  ${chalk.cyan('●')} ${d}`));

      console.log(chalk.bold(`\nUnique to ${symbol2}:`));
      unique2
        .slice(0, 5)
        .forEach((d) => console.log(`  ${chalk.green('●')} ${d}`));
    });
}
