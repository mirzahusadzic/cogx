/**
 * PGC Coherence Status Command
 *
 * Provides lightning-fast (< 10ms) coherence state reporting for the Grounded
 * Context Pool (PGC). The status command reads the dirty_state.json file to
 * determine if the PGC is synchronized with the current codebase.
 *
 * COHERENCE DETECTION:
 * A PGC is "coherent" when:
 * - All tracked files match their indexed hashes
 * - No untracked files exist (or untracked files are ignored)
 * - dirty_state.json shows zero dirty files
 *
 * A PGC is "incoherent" when:
 * - One or more tracked files have been modified
 * - New untracked files have been added
 * - Changes detected by the watcher are not yet synced
 *
 * BLAST RADIUS ANALYSIS:
 * For each modified file, the status command calculates:
 * - Affected symbols (functions, classes, interfaces exported by the file)
 * - Consumer count (files that import from this file) [TODO]
 * - Max dependency depth (longest chain of reverse dependencies) [TODO]
 *
 * DESIGN:
 * The status command is designed for speed:
 * - Reads dirty_state.json (in-memory, no git operations)
 * - Performs blast radius calculation only for dirty files
 * - Returns exit code 0 for coherent, 1 for incoherent (CI/CD friendly)
 *
 * INTEGRATION:
 * - Works with `watch` command for real-time dirty state tracking
 * - Works with `update` command to restore coherence
 * - Used by pre-commit hooks to prevent commits when PGC is incoherent
 *
 * @example
 * // Check if PGC is coherent
 * cognition-cli status
 * // Exit code 0: coherent, 1: incoherent
 *
 * @example
 * // Get detailed blast radius for modified files
 * cognition-cli status --verbose
 * // → Shows affected symbols, consumers, depth for each dirty file
 *
 * @example
 * // Get JSON output for CI/CD integration
 * cognition-cli status --json
 * // → Outputs structured JSON with coherence state
 */

import { Command } from 'commander';
import { getVerboseState } from '../utils/verbose.js';
import chalk from 'chalk';
import path from 'path';

import { DirtyStateManager } from '../core/watcher/dirty-state.js';
import { Index } from '../core/pgc/index.js';
import { DirtyState } from '../core/types/watcher.js';
import { WorkspaceManager } from '../core/workspace-manager.js';
import { addExamples, combineHelpSections } from '../utils/help-formatter.js';

/**
 * Impact analysis data for a modified file
 *
 * Represents the "blast radius" of changing a file - which symbols are affected
 * and how many downstream consumers will need to be re-analyzed.
 */
interface BlastRadiusInfo {
  /** Symbols (functions, classes, etc.) exported by the modified file */
  affectedSymbols: string[];
  /** Number of files that import from this file [TODO: calculate from reverse deps] */
  consumerCount: number;
  /** Longest chain of reverse dependencies [TODO: calculate from lineage patterns] */
  maxDepth: number;
}

/**
 * Complete PGC coherence status report
 *
 * Aggregates dirty state, blast radius analysis, and summary statistics
 * for human-readable or JSON output.
 */
interface StatusReport {
  /** True if PGC is coherent (no dirty or untracked files) */
  coherent: boolean;
  /** Raw dirty state from dirty_state.json */
  dirtyState: DirtyState;
  /** Blast radius analysis for each dirty file */
  blastRadius: Map<string, BlastRadiusInfo>;
  /** Summary statistics */
  summary: {
    /** Number of modified tracked files */
    modifiedCount: number;
    /** Number of untracked files */
    untrackedCount: number;
    /** Total symbols affected by modifications */
    totalImpact: number;
  };
}

/**
 * Creates the status command for checking PGC coherence state
 *
 * @returns Commander command instance configured with status options
 */
export function createStatusCommand(): Command {
  const cmd = new Command('status');

  cmd
    .description('Check PGC coherence state (reads dirty_state.json)')
    .option('--json', 'Output as JSON', false)
    .option('-v, --verbose', 'Show detailed blast radius info', false)
    .addHelpText(
      'after',
      combineHelpSections(
        addExamples([
          { cmd: 'cognition status', desc: 'Quick coherence check' },
          {
            cmd: 'cognition status --verbose',
            desc: 'Show detailed blast radius per file',
          },
          {
            cmd: 'cognition status --json',
            desc: 'JSON output for CI/CD pipelines',
          },
          {
            cmd: 'cognition status && echo "PGC is coherent"',
            desc: 'Use exit code in scripts (0=coherent, 1=incoherent)',
          },
        ])
      )
    )
    .action(async (options) => {
      try {
        const isVerbose = getVerboseState(options);
        await statusCommand({ ...options, verbose: isVerbose });
      } catch (error) {
        console.error(chalk.red('Error:'), error);
        process.exit(1);
      }
    });

  return cmd;
}

/**
 * Executes the status command to check PGC coherence
 *
 * Reads dirty_state.json, calculates blast radius for modified files,
 * generates a status report, and outputs in either human-readable or JSON format.
 *
 * EXIT BEHAVIOR:
 * - Exits with code 0 if PGC is coherent
 * - Exits with code 1 if PGC is incoherent
 *
 * @param options - Status command options
 * @param options.json - Output as JSON instead of human-readable (default: false)
 * @param options.verbose - Show detailed blast radius info (default: false)
 *
 * @example
 * // Check coherence and exit
 * await runStatus({});
 * // → Coherent: exit 0, Incoherent: exit 1
 *
 * @example
 * // Get JSON for CI/CD
 * await statusCommand({ json: true });
 * // → { "status": "incoherent", "summary": {...}, ... }
 */
export async function statusCommand(options: {
  json?: boolean;
  verbose?: boolean;
}): Promise<void> {
  if (!options.json) {
    console.log(chalk.cyan('📦 PGC = Grounded Context Pool'));
    console.log(
      chalk.dim(
        '   Content-addressable knowledge storage with full audit trails\n'
      )
    );
  }

  const workspaceManager = new WorkspaceManager();
  const projectRoot = workspaceManager.resolvePgcRoot(process.cwd());

  if (!projectRoot) {
    if (!options.json) {
      console.error(
        chalk.red(
          '\n✗ No .open_cognition workspace found. Run "cognition-cli init" to create one.\n'
        )
      );
    }
    process.exit(1);
    return; // Prevent further execution
  }

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

/**
 * Calculates the blast radius of a modified file
 *
 * Determines which symbols (functions, classes, interfaces) are affected by
 * the file modification. Future enhancements will include consumer count and
 * dependency depth analysis using reverse deps and lineage patterns.
 *
 * ALGORITHM:
 * 1. Retrieve index data for the file path
 * 2. Extract symbols from structural data (classes, functions, interfaces, exports)
 * 3. Return affected symbols list
 * 4. TODO: Calculate consumer count from reverse dependencies
 * 5. TODO: Calculate max depth from lineage patterns (O₃)
 *
 * @param filePath - Path to the modified file
 * @param index - PGC index instance for retrieving structural data
 * @returns Blast radius analysis with affected symbols
 *
 * @example
 * const impact = await calculateBlastRadius('src/utils/helpers.ts', index);
 * // → { affectedSymbols: ['formatDate', 'parseQuery'], consumerCount: 0, maxDepth: 0 }
 */
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

/**
 * Formats status report as JSON for programmatic consumption
 *
 * Serializes the status report into a structured JSON object suitable for
 * CI/CD pipelines, monitoring tools, or external scripts.
 *
 * OUTPUT STRUCTURE:
 * ```json
 * {
 *   "status": "coherent" | "incoherent",
 *   "summary": { modifiedCount, untrackedCount, totalImpact },
 *   "modified_files": [...],
 *   "untracked_files": [...]
 * }
 * ```
 *
 * @param report - Complete status report to serialize
 * @returns JSON-serializable object
 *
 * @example
 * const json = formatAsJSON(report);
 * console.log(JSON.stringify(json, null, 2));
 * // → { "status": "incoherent", "summary": {...}, ... }
 */
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

/**
 * Formats status report as human-readable text with color coding
 *
 * Generates a visually appealing terminal output using chalk colors and
 * emojis to communicate coherence state and blast radius analysis.
 *
 * COLOR CODING:
 * - Green (✓): Coherent state, healthy
 * - Yellow (✗): Modified files, needs sync
 * - Cyan (+): Untracked files, new additions
 * - Magenta: Impact metrics
 *
 * VERBOSE MODE:
 * When verbose is true, shows detailed blast radius for each modified file:
 * - Affected symbols list (up to 3 symbols)
 * - Consumer count (number of files importing from this file)
 * - Max dependency depth (longest chain of reverse dependencies)
 *
 * @param report - Complete status report to format
 * @param verbose - Show detailed blast radius information
 * @returns Formatted string ready for console output
 *
 * @example
 * const output = formatAsHuman(report, false);
 * console.log(output);
 * // → "🔔 PGC Status: COHERENT\nThe Echo rings clear - all tracked files..."
 *
 * @example
 * const output = formatAsHuman(report, true);
 * console.log(output);
 * // → "🎐 PGC Status: INCOHERENT\n\nModified Files:\n  ✗ src/utils.ts\n    Symbols: formatDate, parseQuery, ..."
 */
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
      `  Run ${chalk.cyan('cognition-cli status -v')} for detailed impact`
    );
  }

  return lines.join('\n');
}
