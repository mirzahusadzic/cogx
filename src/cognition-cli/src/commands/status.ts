import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';

import { DirtyStateManager } from '../core/watcher/dirty-state.js';
import { Index } from '../core/pgc/index.js';
import { DirtyState } from '../core/types/watcher.js';

/**
 * Represents impact analysis data for a modified file.
 */
interface BlastRadiusInfo {
  affectedSymbols: string[];
  consumerCount: number;
  maxDepth: number;
}

/**
 * Represents a complete PGC coherence status report.
 */
interface StatusReport {
  coherent: boolean;
  dirtyState: DirtyState;
  blastRadius: Map<string, BlastRadiusInfo>;
  summary: {
    modifiedCount: number;
    untrackedCount: number;
    totalImpact: number;
  };
}

/**
 * Creates the status command for checking PGC coherence state.
 */
export function createStatusCommand(): Command {
  const cmd = new Command('status');

  cmd
    .description('Check PGC coherence state (reads dirty_state.json)')
    .option('--json', 'Output as JSON', false)
    .option('--verbose', 'Show detailed blast radius info', false)
    .action(async (options) => {
      try {
        await runStatus(options);
      } catch (error) {
        console.error(chalk.red('Error:'), error);
        process.exit(1);
      }
    });

  return cmd;
}

async function runStatus(options: {
  json?: boolean;
  verbose?: boolean;
}): Promise<void> {
  const projectRoot = process.cwd();
  const pgcRoot = path.join(projectRoot, '.open_cognition');

  const dirtyStateManager = new DirtyStateManager(pgcRoot);
  const index = new Index(pgcRoot);

  // Read dirty state
  const dirtyState = await dirtyStateManager.read();

  // Calculate blast radius for each dirty file
  const blastRadius = new Map<string, BlastRadiusInfo>();
  let totalImpact = 0;

  for (const dirtyFile of dirtyState.dirty_files) {
    const impact = await calculateBlastRadius(dirtyFile.path, index);
    blastRadius.set(dirtyFile.path, impact);
    totalImpact += impact.affectedSymbols.length;
  }

  const coherent =
    dirtyState.dirty_files.length === 0 &&
    dirtyState.untracked_files.length === 0;

  const report: StatusReport = {
    coherent,
    dirtyState,
    blastRadius,
    summary: {
      modifiedCount: dirtyState.dirty_files.length,
      untrackedCount: dirtyState.untracked_files.length,
      totalImpact,
    },
  };

  if (options.json) {
    console.log(JSON.stringify(formatAsJSON(report), null, 2));
  } else {
    console.log(formatAsHuman(report, options.verbose || false));
  }

  // Exit with code 1 if incoherent (useful for CI/CD)
  process.exit(coherent ? 0 : 1);
}

async function calculateBlastRadius(
  filePath: string,
  index: Index
): Promise<BlastRadiusInfo> {
  try {
    const indexData = await index.get(filePath);
    if (!indexData || !indexData.structuralData) {
      return {
        affectedSymbols: [],
        consumerCount: 0,
        maxDepth: 0,
      };
    }

    // Extract symbols from structural data
    const symbols: string[] = [];
    const data = indexData.structuralData;

    if (data.classes) {
      symbols.push(...data.classes.map((c) => c.name));
    }
    if (data.functions) {
      symbols.push(...data.functions.map((f) => f.name));
    }
    if (data.interfaces) {
      symbols.push(...data.interfaces.map((i) => i.name));
    }
    // Note: StructuralData doesn't have a 'types' array property
    if (data.exports) {
      symbols.push(...data.exports);
    }

    // For now, return basic impact (symbol count)
    // TODO: Enhanced blast radius calculation using pattern metadata
    // which includes reverse dependencies from structural_patterns overlay

    return {
      affectedSymbols: symbols,
      consumerCount: 0, // TODO: Calculate from pattern metadata
      maxDepth: 0, // TODO: Calculate from lineage patterns
    };
  } catch (error) {
    console.warn(`Error calculating blast radius for ${filePath}:`, error);
    return {
      affectedSymbols: [],
      consumerCount: 0,
      maxDepth: 0,
    };
  }
}

function formatAsJSON(report: StatusReport): unknown {
  return {
    status: report.coherent ? 'coherent' : 'incoherent',
    summary: report.summary,
    modified_files: report.dirtyState.dirty_files.map((f) => ({
      path: f.path,
      tracked_hash: f.tracked_hash.slice(0, 12),
      current_hash: f.current_hash?.slice(0, 12),
      change_type: f.change_type,
      detected_at: f.detected_at,
      blast_radius: report.blastRadius.get(f.path),
    })),
    untracked_files: report.dirtyState.untracked_files.map((f) => ({
      path: f.path,
      current_hash: f.current_hash.slice(0, 12),
      detected_at: f.detected_at,
    })),
  };
}

function formatAsHuman(report: StatusReport, verbose: boolean): string {
  const lines: string[] = [];

  // Header
  if (report.coherent) {
    lines.push(chalk.green.bold('🔔 PGC Status: COHERENT'));
    lines.push('');
    lines.push(
      'The Echo rings clear - all tracked files resonate with the PGC.'
    );
    lines.push('');
    lines.push(chalk.gray(`Last checked: ${report.dirtyState.last_updated}`));
    return lines.join('\n');
  }

  lines.push(chalk.red.bold('🎐 PGC Status: INCOHERENT'));
  lines.push('');

  // Summary
  lines.push(chalk.bold('Summary:'));
  if (report.summary.modifiedCount > 0) {
    lines.push(
      chalk.yellow(`  Modified files: ${report.summary.modifiedCount}`)
    );
  }
  if (report.summary.untrackedCount > 0) {
    lines.push(
      chalk.cyan(`  Untracked files: ${report.summary.untrackedCount}`)
    );
  }
  if (report.summary.totalImpact > 0) {
    lines.push(
      chalk.magenta(`  Impacted symbols: ${report.summary.totalImpact}`)
    );
  }
  lines.push('');

  // Modified files
  if (report.dirtyState.dirty_files.length > 0) {
    lines.push(chalk.yellow.bold('Modified Files:'));
    for (const file of report.dirtyState.dirty_files) {
      lines.push(`  ${chalk.yellow('✗')} ${file.path}`);

      const impact = report.blastRadius.get(file.path);
      if (impact && verbose) {
        if (impact.affectedSymbols.length > 0) {
          lines.push(
            chalk.gray(
              `    Symbols: ${impact.affectedSymbols.slice(0, 3).join(', ')}${impact.affectedSymbols.length > 3 ? '...' : ''}`
            )
          );
        }
        if (impact.consumerCount > 0) {
          lines.push(
            chalk.gray(`    Consumers: ${impact.consumerCount} files`)
          );
        }
        if (impact.maxDepth > 0) {
          lines.push(chalk.gray(`    Max depth: ${impact.maxDepth} levels`));
        }
      } else if (impact) {
        lines.push(
          chalk.gray(
            `    ${impact.affectedSymbols.length} symbols, ${impact.consumerCount} consumers`
          )
        );
      }
    }
    lines.push('');
  }

  // Untracked files
  if (report.dirtyState.untracked_files.length > 0) {
    lines.push(chalk.cyan.bold('Untracked Files:'));
    const displayCount = Math.min(10, report.dirtyState.untracked_files.length);
    for (const file of report.dirtyState.untracked_files.slice(
      0,
      displayCount
    )) {
      lines.push(`  ${chalk.cyan('+')} ${file.path}`);
    }
    if (report.dirtyState.untracked_files.length > 10) {
      lines.push(
        chalk.gray(
          `  ... and ${report.dirtyState.untracked_files.length - 10} more`
        )
      );
    }
    lines.push('');
  }

  // Recommendation
  lines.push(chalk.bold('Next Steps:'));
  lines.push(
    `  Run ${chalk.cyan('cognition-cli update')} to sync PGC with changes`
  );
  if (!verbose && report.summary.modifiedCount > 0) {
    lines.push(
      `  Run ${chalk.cyan('cognition-cli status --verbose')} for detailed impact`
    );
  }

  return lines.join('\n');
}
