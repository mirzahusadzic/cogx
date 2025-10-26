import { Command } from 'commander';
import path from 'path';
import chalk from 'chalk';
import { StrategicCoherenceManager } from '../core/overlays/strategic-coherence/manager.js';

export function addCoherenceCommands(program: Command) {
  const coherenceCommand = program
    .command('coherence')
    .description(
      'Commands for querying strategic coherence between code and mission.'
    );

  /**
   * coherence report
   * Display overall strategic coherence metrics dashboard
   */
  coherenceCommand
    .command('report')
    .description('Show overall strategic coherence metrics')
    .option('-p, --project-root <path>', 'The root of the project.', '.')
    .option('--json', 'Output raw JSON')
    .action(async (options) => {
      const pgcRoot = path.join(options.projectRoot, '.open_cognition');
      const manager = new StrategicCoherenceManager(pgcRoot);

      const overlay = await manager.retrieve();

      if (!overlay) {
        console.error(
          chalk.red(
            '\n✗ No strategic coherence overlay found. Run "cognition-cli overlay generate strategic_coherence" first.\n'
          )
        );
        process.exit(1);
      }

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              generated_at: overlay.generated_at,
              mission_document_hash: overlay.mission_document_hash,
              symbol_count: overlay.symbol_coherence.length,
              mission_concepts_count: overlay.mission_concepts_count,
              overall_metrics: overlay.overall_metrics,
            },
            null,
            2
          )
        );
        return;
      }

      // Display formatted report
      console.log('');
      console.log(chalk.bold.cyan('📊 Strategic Coherence Report'));
      console.log(chalk.gray('━'.repeat(60)));
      console.log('');

      console.log(
        chalk.white(
          `  Generated: ${chalk.dim(new Date(overlay.generated_at).toLocaleString())}`
        )
      );
      console.log(
        chalk.white(
          `  Mission document: ${chalk.dim(overlay.mission_document_hash.slice(0, 8))}...`
        )
      );
      console.log('');

      console.log(chalk.bold.white('  Analysis Scope:'));
      console.log(
        chalk.white(
          `    Code symbols analyzed:   ${chalk.cyan(overlay.symbol_coherence.length)}`
        )
      );
      console.log(
        chalk.white(
          `    Mission concepts:        ${chalk.cyan(overlay.mission_concepts_count)}`
        )
      );
      console.log('');

      const metrics = overlay.overall_metrics;
      console.log(chalk.bold.white('  Coherence Metrics:'));
      console.log(
        chalk.white(
          `    Average coherence:       ${chalk.cyan(metrics.average_coherence.toFixed(3))}`
        )
      );
      console.log(
        chalk.white(
          `    Alignment threshold:     ${chalk.dim('≥')} ${chalk.cyan(metrics.high_alignment_threshold)}`
        )
      );
      console.log('');

      const alignedPercent =
        overlay.symbol_coherence.length > 0
          ? (
              (metrics.aligned_symbols_count / overlay.symbol_coherence.length) *
              100
            ).toFixed(1)
          : '0.0';
      const driftedPercent =
        overlay.symbol_coherence.length > 0
          ? (
              (metrics.drifted_symbols_count / overlay.symbol_coherence.length) *
              100
            ).toFixed(1)
          : '0.0';

      console.log(chalk.bold.white('  Symbol Distribution:'));
      console.log(
        chalk.green(
          `    ✓ Aligned:               ${metrics.aligned_symbols_count} (${alignedPercent}%)`
        )
      );
      console.log(
        chalk.yellow(
          `    ⚠ Drifted:               ${metrics.drifted_symbols_count} (${driftedPercent}%)`
        )
      );
      console.log('');

      console.log(chalk.gray('  View details with:'));
      console.log(
        chalk.dim('    cognition-cli coherence aligned     # High-aligned symbols')
      );
      console.log(
        chalk.dim('    cognition-cli coherence drifted     # Low-aligned symbols')
      );
      console.log(
        chalk.dim(
          '    cognition-cli coherence for-symbol <name>   # Symbol details'
        )
      );
      console.log('');
    });

  /**
   * coherence aligned
   * Show symbols aligned with mission (score >= threshold)
   */
  coherenceCommand
    .command('aligned')
    .description('Show symbols aligned with mission')
    .option('-p, --project-root <path>', 'The root of the project.', '.')
    .option(
      '--min-score <score>',
      'Minimum coherence score (default: 0.7)',
      '0.7'
    )
    .option('--json', 'Output raw JSON')
    .action(async (options) => {
      const pgcRoot = path.join(options.projectRoot, '.open_cognition');
      const manager = new StrategicCoherenceManager(pgcRoot);
      const minScore = parseFloat(options.minScore);

      const alignedSymbols = await manager.getAlignedSymbols(minScore);

      if (options.json) {
        console.log(JSON.stringify(alignedSymbols, null, 2));
        return;
      }

      if (alignedSymbols.length === 0) {
        console.log('');
        console.log(
          chalk.yellow(
            `⚠ No symbols found with coherence score ≥ ${minScore.toFixed(2)}`
          )
        );
        console.log('');
        console.log(
          chalk.dim(
            '  Try lowering the threshold with --min-score <value> or view all symbols with "coherence drifted --max-score 1.0"'
          )
        );
        console.log('');
        return;
      }

      console.log('');
      console.log(
        chalk.bold.green(
          `✓ Symbols Aligned with Mission (score ≥ ${minScore.toFixed(2)})`
        )
      );
      console.log(chalk.gray('━'.repeat(60)));
      console.log('');

      alignedSymbols.forEach((symbol, i) => {
        const scoreBar = '█'.repeat(Math.round(symbol.overallCoherence * 20));
        console.log(
          `${i + 1}. ${chalk.cyan.bold(symbol.symbolName)} ${chalk.dim(`[${symbol.filePath}]`)}`
        );
        console.log(
          `   ${chalk.green(scoreBar)} ${(symbol.overallCoherence * 100).toFixed(1)}%`
        );

        if (symbol.topAlignments.length > 0) {
          console.log(chalk.dim('   Top mission alignments:'));
          symbol.topAlignments.slice(0, 3).forEach((alignment) => {
            console.log(
              chalk.dim(
                `     • ${alignment.conceptText.slice(0, 80)}... (${(alignment.alignmentScore * 100).toFixed(1)}%)`
              )
            );
          });
        }
        console.log('');
      });

      console.log(
        chalk.dim(
          `  Found ${alignedSymbols.length} aligned symbol(s). Use "coherence for-symbol <name>" for details.`
        )
      );
      console.log('');
    });

  /**
   * coherence drifted
   * Show symbols that drifted from mission (score < threshold)
   */
  coherenceCommand
    .command('drifted')
    .description('Show symbols that drifted from mission')
    .option('-p, --project-root <path>', 'The root of the project.', '.')
    .option(
      '--max-score <score>',
      'Maximum coherence score (default: 0.7)',
      '0.7'
    )
    .option('--json', 'Output raw JSON')
    .action(async (options) => {
      const pgcRoot = path.join(options.projectRoot, '.open_cognition');
      const manager = new StrategicCoherenceManager(pgcRoot);
      const maxScore = parseFloat(options.maxScore);

      const driftedSymbols = await manager.getDriftedSymbols(maxScore);

      if (options.json) {
        console.log(JSON.stringify(driftedSymbols, null, 2));
        return;
      }

      if (driftedSymbols.length === 0) {
        console.log('');
        console.log(
          chalk.green(
            `✓ All symbols have coherence score ≥ ${maxScore.toFixed(2)}`
          )
        );
        console.log('');
        return;
      }

      console.log('');
      console.log(
        chalk.bold.yellow(
          `⚠ Symbols Drifted from Mission (score < ${maxScore.toFixed(2)})`
        )
      );
      console.log(chalk.gray('━'.repeat(60)));
      console.log('');

      driftedSymbols.forEach((symbol, i) => {
        const scoreBar = '█'.repeat(Math.round(symbol.overallCoherence * 20));
        console.log(
          `${i + 1}. ${chalk.yellow.bold(symbol.symbolName)} ${chalk.dim(`[${symbol.filePath}]`)}`
        );
        console.log(
          `   ${chalk.yellow(scoreBar)} ${(symbol.overallCoherence * 100).toFixed(1)}%`
        );

        if (symbol.topAlignments.length > 0) {
          console.log(chalk.dim('   Best mission alignments:'));
          symbol.topAlignments.slice(0, 3).forEach((alignment) => {
            console.log(
              chalk.dim(
                `     • ${alignment.conceptText.slice(0, 80)}... (${(alignment.alignmentScore * 100).toFixed(1)}%)`
              )
            );
          });
        }
        console.log('');
      });

      console.log(
        chalk.dim(
          `  Found ${driftedSymbols.length} drifted symbol(s). Use "coherence for-symbol <name>" for details.`
        )
      );
      console.log('');
    });

  /**
   * coherence for-symbol <name>
   * Show detailed mission alignment for a specific symbol
   */
  coherenceCommand
    .command('for-symbol <symbolName>')
    .description('Show mission alignment for a specific symbol')
    .option('-p, --project-root <path>', 'The root of the project.', '.')
    .option('--json', 'Output raw JSON')
    .action(async (symbolName, options) => {
      const pgcRoot = path.join(options.projectRoot, '.open_cognition');
      const manager = new StrategicCoherenceManager(pgcRoot);

      const overlay = await manager.retrieve();

      if (!overlay) {
        console.error(
          chalk.red(
            '\n✗ No strategic coherence overlay found. Run "cognition-cli overlay generate strategic_coherence" first.\n'
          )
        );
        process.exit(1);
      }

      const symbol = overlay.symbol_coherence.find(
        (s) => s.symbolName === symbolName
      );

      if (!symbol) {
        console.error(
          chalk.red(`\n✗ Symbol "${symbolName}" not found in coherence overlay.\n`)
        );
        console.log(
          chalk.dim(
            '  Run "cognition-cli coherence aligned" or "coherence drifted" to see available symbols.'
          )
        );
        console.log('');
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(symbol, null, 2));
        return;
      }

      // Display formatted symbol details
      console.log('');
      console.log(
        chalk.bold.cyan(`🎯 Strategic Coherence: ${chalk.white(symbolName)}`)
      );
      console.log(chalk.gray('━'.repeat(60)));
      console.log('');

      console.log(chalk.white(`  File: ${chalk.dim(symbol.filePath)}`));
      console.log(
        chalk.white(
          `  Hash: ${chalk.dim(symbol.symbolHash.slice(0, 16))}...`
        )
      );
      console.log('');

      const scoreBar = '█'.repeat(Math.round(symbol.overallCoherence * 20));
      const scoreColor =
        symbol.overallCoherence >= 0.7
          ? chalk.green
          : symbol.overallCoherence >= 0.5
            ? chalk.yellow
            : chalk.red;

      console.log(chalk.bold.white('  Overall Coherence:'));
      console.log(
        `   ${scoreColor(scoreBar)} ${scoreColor((symbol.overallCoherence * 100).toFixed(1) + '%')}`
      );
      console.log('');

      console.log(
        chalk.bold.white(
          `  Top ${symbol.topAlignments.length} Mission Alignments:`
        )
      );
      console.log('');

      symbol.topAlignments.forEach((alignment, i) => {
        const alignScore = (alignment.alignmentScore * 100).toFixed(1);
        const alignBar = '█'.repeat(
          Math.round(alignment.alignmentScore * 20)
        );
        const alignColor =
          alignment.alignmentScore >= 0.7
            ? chalk.green
            : alignment.alignmentScore >= 0.5
              ? chalk.yellow
              : chalk.dim;

        console.log(
          chalk.white(
            `  ${i + 1}. ${alignColor(alignBar)} ${alignColor(alignScore + '%')}`
          )
        );
        console.log(
          chalk.dim(
            `     Section: ${chalk.cyan(alignment.conceptSection)}`
          )
        );
        console.log(chalk.white(`     "${alignment.conceptText}"`));
        console.log('');
      });

      console.log(
        chalk.dim('  Use "coherence compare <s1> <s2>" to compare with other symbols.')
      );
      console.log('');
    });

  /**
   * coherence compare <symbol1> <symbol2>
   * Compare mission alignment of two symbols
   */
  coherenceCommand
    .command('compare <symbol1> <symbol2>')
    .description('Compare mission alignment of two symbols')
    .option('-p, --project-root <path>', 'The root of the project.', '.')
    .option('--json', 'Output raw JSON')
    .action(async (symbol1Name, symbol2Name, options) => {
      const pgcRoot = path.join(options.projectRoot, '.open_cognition');
      const manager = new StrategicCoherenceManager(pgcRoot);

      const overlay = await manager.retrieve();

      if (!overlay) {
        console.error(
          chalk.red(
            '\n✗ No strategic coherence overlay found. Run "cognition-cli overlay generate strategic_coherence" first.\n'
          )
        );
        process.exit(1);
      }

      const symbol1 = overlay.symbol_coherence.find(
        (s) => s.symbolName === symbol1Name
      );
      const symbol2 = overlay.symbol_coherence.find(
        (s) => s.symbolName === symbol2Name
      );

      if (!symbol1) {
        console.error(
          chalk.red(`\n✗ Symbol "${symbol1Name}" not found in coherence overlay.\n`)
        );
        process.exit(1);
      }

      if (!symbol2) {
        console.error(
          chalk.red(`\n✗ Symbol "${symbol2Name}" not found in coherence overlay.\n`)
        );
        process.exit(1);
      }

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              symbol1: symbol1,
              symbol2: symbol2,
              comparison: {
                coherence_diff: symbol1.overallCoherence - symbol2.overallCoherence,
                more_aligned: symbol1.overallCoherence > symbol2.overallCoherence ? symbol1Name : symbol2Name,
              },
            },
            null,
            2
          )
        );
        return;
      }

      // Display formatted comparison
      console.log('');
      console.log(
        chalk.bold.cyan(
          `⚖️  Coherence Comparison: ${chalk.white(symbol1Name)} vs ${chalk.white(symbol2Name)}`
        )
      );
      console.log(chalk.gray('━'.repeat(60)));
      console.log('');

      const renderSymbol = (symbol: typeof symbol1, name: string) => {
        const scoreBar = '█'.repeat(Math.round(symbol.overallCoherence * 20));
        const scoreColor =
          symbol.overallCoherence >= 0.7
            ? chalk.green
            : symbol.overallCoherence >= 0.5
              ? chalk.yellow
              : chalk.red;

        console.log(chalk.bold.white(`  ${name}`));
        console.log(chalk.dim(`    ${symbol.filePath}`));
        console.log(
          `    ${scoreColor(scoreBar)} ${scoreColor((symbol.overallCoherence * 100).toFixed(1) + '%')}`
        );

        if (symbol.topAlignments.length > 0) {
          console.log(chalk.dim('    Top alignments:'));
          symbol.topAlignments.slice(0, 2).forEach((alignment) => {
            console.log(
              chalk.dim(
                `      • ${alignment.conceptText.slice(0, 60)}... (${(alignment.alignmentScore * 100).toFixed(1)}%)`
              )
            );
          });
        }
        console.log('');
      };

      renderSymbol(symbol1, symbol1Name);
      renderSymbol(symbol2, symbol2Name);

      const diff = symbol1.overallCoherence - symbol2.overallCoherence;
      const winner = diff > 0 ? symbol1Name : symbol2Name;
      const diffPercent = Math.abs(diff * 100).toFixed(1);

      if (Math.abs(diff) < 0.01) {
        console.log(
          chalk.cyan(
            `  Both symbols have similar mission alignment (~${(symbol1.overallCoherence * 100).toFixed(1)}%)`
          )
        );
      } else {
        const diffColor = Math.abs(diff) > 0.2 ? chalk.bold : chalk;
        console.log(
          diffColor.white(
            `  ${chalk.cyan(winner)} is more aligned with mission by ${diffPercent}%`
          )
        );
      }
      console.log('');
    });
}
