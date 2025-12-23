/**
 * Blast Radius Command: Analyze Impact of Symbol Changes
 *
 * The blast-radius command visualizes the complete dependency graph and impact propagation
 * when a code symbol changes. It identifies all consumers (symbols that depend on it) and
 * all dependencies (symbols it depends on) across the codebase.
 *
 * IMPACT ANALYSIS:
 * - Upstream (Consumers): Which symbols will be affected if this changes
 * - Downstream (Dependencies): Which symbols this depends on
 * - Critical Paths: High-impact chains through the architecture
 * - Impact Metrics: Total impacted count, max depth, architectural distribution
 *
 * FILTERS:
 * - --direction: up (find consumers), down (find dependencies), both (default)
 * - --max-depth: Limit traversal depth (default: 3)
 * - --no-transitive: Only show direct relationships (1-hop)
 *
 * ARCHITECTURAL ROLES:
 * Results are grouped by architectural role:
 * - core: Central/fundamental components
 * - integration: Integration points with other systems
 * - utility: Reusable utility functions
 * - presentation: UI/presentation layer
 *
 * @example
 * // Analyze impact of changing a symbol
 * cognition-cli blast-radius handleUserInput
 *
 * @example
 * // Find only consumers (what breaks if we change this?)
 * cognition-cli blast-radius validateToken --direction up --max-depth 5
 *
 * @example
 * // Export impact graph as JSON for further analysis
 * cognition-cli blast-radius DatabaseConnection --json
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
    try {
      await runBlastRadius(symbol, options);
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
 * Executes the blast radius analysis for a symbol
 *
 * Traverses the structural pattern graph to identify consumers and dependencies
 * of the specified symbol, then outputs the results in human-readable or JSON format.
 *
 * @param symbol - The code symbol to analyze (class, function, etc.)
 * @param options - Analysis options (maxDepth, direction, json, transitive)
 */
export async function runBlastRadius(
  symbol: string,
  options: {
    maxDepth: string;
    direction: string;
    json?: boolean;
    transitive: boolean;
  },
  pgcManager?: PGCManager,
  graphTraversal?: GraphTraversal
): Promise<void> {
  const pgc = pgcManager || new PGCManager(process.cwd());
  const traversal = graphTraversal || new GraphTraversal(pgc);

  const result = await traversal.getBlastRadius(symbol, {
    maxDepth: options.transitive ? parseInt(options.maxDepth) : 1,
    direction: options.direction as 'both' | 'up' | 'down',
    includeTransitive: options.transitive,
  });

  if (!options.json) {
    console.log(
      chalk.bold(`\n🎯 Blast Radius Analysis: ${chalk.cyan(symbol)}\n`)
    );
  }

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
}

/**
 * Group array items by the result of a key function.
 *
 * Partitions array into a record where keys are determined by keyFn output.
 * Used for grouping impact results by architectural role.
 *
 * @param arr - Array of items to group
 * @param keyFn - Function that returns grouping key for each item
 * @returns Record mapping keys to arrays of items
 * @example
 * const byRole = groupBy(items, item => item.architecturalRole);
 * // { core: [...], utility: [...], integration: [...] }
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
