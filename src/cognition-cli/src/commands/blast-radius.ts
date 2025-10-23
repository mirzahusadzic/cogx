/**
 * Blast radius command - show impact of changing a symbol
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { PGCManager } from '../core/pgc/manager.js';
import { GraphTraversal } from '../core/graph/traversal.js';

export const blastRadiusCommand = new Command('blast-radius')
  .description('Show the complete impact graph when a symbol changes')
  .argument('<symbol>', 'The symbol to analyze')
  .option('--max-depth <N>', 'Maximum traversal depth', '3')
  .option(
    '--direction <dir>',
    'Traversal direction: up (consumers), down (dependencies), both',
    'both'
  )
  .option('--json', 'Output as JSON')
  .option('--no-transitive', 'Only show direct dependencies/consumers')
  .action(async (symbol, options) => {
    const pgc = new PGCManager(process.cwd());
    const traversal = new GraphTraversal(pgc);

    console.log(
      chalk.bold(`\n🎯 Blast Radius Analysis: ${chalk.cyan(symbol)}\n`)
    );

    try {
      const result = await traversal.getBlastRadius(symbol, {
        maxDepth: parseInt(options.maxDepth),
        direction: options.direction,
        includeTransitive: options.transitive,
      });

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              symbol: result.symbol,
              filePath: result.filePath,
              consumers: result.consumers.map((n) => ({
                symbol: n.symbol,
                filePath: n.filePath,
                type: n.type,
                role: n.architecturalRole,
              })),
              dependencies: result.dependencies.map((n) => ({
                symbol: n.symbol,
                filePath: n.filePath,
                type: n.type,
                role: n.architecturalRole,
              })),
              metrics: result.metrics,
            },
            null,
            2
          )
        );
        return;
      }

      // ASCII output
      console.log(chalk.green(`✓ Symbol found: ${result.filePath}`));
      console.log();

      // Metrics
      console.log(chalk.bold('📊 Impact Metrics:'));
      console.log(
        `   Total impacted: ${chalk.yellow(result.metrics.totalImpacted)}`
      );
      console.log(
        `   Max consumer depth: ${chalk.yellow(result.metrics.maxConsumerDepth)}`
      );
      console.log(
        `   Max dependency depth: ${chalk.yellow(result.metrics.maxDependencyDepth)}`
      );
      console.log();

      // Consumers (upstream)
      if (options.direction === 'up' || options.direction === 'both') {
        console.log(chalk.bold(`⬆️  Consumers (${result.consumers.length}):`));
        console.log(
          chalk.dim('   Changing this symbol will affect these symbols:\n')
        );

        if (result.consumers.length === 0) {
          console.log(chalk.dim('   No consumers found'));
        } else {
          // Group by architectural role
          const byRole = groupBy(
            result.consumers,
            (n) => n.architecturalRole || 'unknown'
          );

          for (const [role, nodes] of Object.entries(byRole)) {
            console.log(chalk.cyan(`   ${role}:`));
            for (const node of nodes.slice(0, 10)) {
              console.log(
                `      • ${chalk.green(node.symbol)} ${chalk.dim(`(${node.filePath})`)}`
              );
            }
            if (nodes.length > 10) {
              console.log(chalk.dim(`      ... and ${nodes.length - 10} more`));
            }
          }
        }
        console.log();
      }

      // Dependencies (downstream)
      if (options.direction === 'down' || options.direction === 'both') {
        console.log(
          chalk.bold(`⬇️  Dependencies (${result.dependencies.length}):`)
        );
        console.log(chalk.dim('   This symbol depends on:\n'));

        if (result.dependencies.length === 0) {
          console.log(chalk.dim('   No dependencies found'));
        } else {
          // Group by architectural role
          const byRole = groupBy(
            result.dependencies,
            (n) => n.architecturalRole || 'unknown'
          );

          for (const [role, nodes] of Object.entries(byRole)) {
            console.log(chalk.cyan(`   ${role}:`));
            for (const node of nodes.slice(0, 10)) {
              console.log(
                `      • ${chalk.green(node.symbol)} ${chalk.dim(`(${node.filePath})`)}`
              );
            }
            if (nodes.length > 10) {
              console.log(chalk.dim(`      ... and ${nodes.length - 10} more`));
            }
          }
        }
        console.log();
      }

      // Critical paths
      if (result.metrics.criticalPaths.length > 0) {
        console.log(chalk.bold('🔥 Critical Paths:'));
        console.log(chalk.dim('   High-impact chains through the codebase:\n'));

        for (const path of result.metrics.criticalPaths.slice(0, 3)) {
          console.log(`   ${chalk.yellow(path.reason)} (depth ${path.depth})`);
          const pathStr = path.path.map((s) => chalk.cyan(s)).join(' → ');
          console.log(`      ${pathStr}`);
        }
        console.log();
      }

      // Usage hints
      if (result.metrics.totalImpacted > 20) {
        console.log(
          chalk.yellow(
            '⚠️  High impact detected! Changing this symbol affects many parts of the codebase.'
          )
        );
      } else if (result.metrics.totalImpacted <= 1) {
        console.log(
          chalk.green('✓ Low impact! This symbol is relatively isolated.')
        );
      }
    } catch (error) {
      if ((error as Error).message.includes('not found in graph')) {
        console.error(
          chalk.red(`\n❌ Symbol '${symbol}' not found in structural patterns.`)
        );
        console.log(
          chalk.dim(
            '\n💡 Make sure to run: cognition-cli overlay generate structural_patterns'
          )
        );
      } else {
        console.error(chalk.red('\n❌ Error analyzing blast radius:'));
        console.error((error as Error).message);
      }
      process.exit(1);
    }
  });

/**
 * Group array by key function
 */
function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const key = keyFn(item);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {} as Record<string, T[]>
  );
}
