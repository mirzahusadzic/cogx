/**
 * Update Command: Incremental Synchronization with Monument 3
 *
 * The update command synchronizes the PGC (Grounded Context Pool) with recent source code changes
 * through incremental re-analysis, without rebuilding the entire overlay system.
 *
 * RATIONALE:
 * After genesis (Monument 1), code changes frequently. Rather than re-running the full pipeline,
 * update performs surgical re-analysis based on dirty_state.json:
 * - Identifies changed files and symbols
 * - Re-mines affected structural patterns
 * - Regenerates embeddings only for changed items
 * - Updates coherence scores for impacted relationships
 *
 * DIRTY STATE TRACKING:
 * The system maintains dirty_state.json with:
 * - Modified file paths
 * - Timestamp of last analysis
 * - Affected symbol hashes
 * - Overlay invalidation flags
 *
 * @example
 * // Incremental sync after code changes
 * cognition-cli update
 *
 * @example
 * // Specify custom project and workbench
 * cognition-cli update --project-root /path/to/project --workbench http://localhost:8000
 */

import { Command } from 'commander';
import { intro, outro, log } from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { PGCManager } from '../core/pgc/manager.js';
import { StructuralMiner } from '../core/orchestrators/miners/structural.js';
import { WorkbenchClient } from '../core/executors/workbench-client.js';
import { UpdateOrchestrator } from '../core/orchestrators/update.js';
import { GenesisOracle } from '../core/pgc/oracles/genesis.js';
import { WorkspaceManager } from '../core/workspace-manager.js';

/**
 * Represents errors during PGC initialization validation.
 */
class PGCInitializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PGCInitializationError';
  }
}

interface UpdateOptions {
  projectRoot: string;
  workbench: string;
  dryRun?: boolean;
}

/**
 * Validates PGC is initialized and resolves project root by walking directory tree.
 *
 * @param startPath - Starting directory for PGC root search
 * @returns Resolved project root containing .open_cognition
 * @throws {PGCInitializationError} If PGC not found or metadata.json missing
 * @example
 * const projectRoot = await validatePgcInitialized(process.cwd());
 */
async function validatePgcInitialized(startPath: string): Promise<string> {
  const workspaceManager = new WorkspaceManager();
  const projectRoot = workspaceManager.resolvePgcRoot(startPath);

  if (!projectRoot) {
    throw new PGCInitializationError(
      'No .open_cognition workspace found. Please run "cognition-cli init" first.'
    );
  }

  const pgcRoot = path.join(projectRoot, '.open_cognition');
  const metadataPath = path.join(pgcRoot, 'metadata.json');

  if (!(await fs.pathExists(metadataPath))) {
    throw new PGCInitializationError(
      `PGC metadata.json not found in ${pgcRoot}. Please run 'cognition-cli init' first.`
    );
  }

  return projectRoot;
}

/**
 * Executes dry-run mode for update: shows what files would be processed.
 */
async function executeDryRun(projectRoot: string): Promise<void> {
  const dirtyStatePath = path.join(
    projectRoot,
    '.open_cognition',
    'dirty_state.json'
  );

  if (!(await fs.pathExists(dirtyStatePath))) {
    console.log('');
    console.log(chalk.cyan('Dry run - no pending changes'));
    console.log('');
    console.log(chalk.dim('No dirty_state.json found. The PGC is up to date.'));
    console.log('');
    return;
  }

  const dirtyState = await fs.readJson(dirtyStatePath);
  const changedFiles: string[] = dirtyState.changed || [];
  const newFiles: string[] = dirtyState.new || [];
  const deletedFiles: string[] = dirtyState.deleted || [];

  console.log('');
  console.log(chalk.cyan('Dry run - files that would be processed:'));
  console.log('');

  if (changedFiles.length > 0) {
    console.log(chalk.bold(`Modified (${changedFiles.length} files):`));
    for (const file of changedFiles.slice(0, 10)) {
      console.log(`  ${chalk.yellow('M')} ${file}`);
    }
    if (changedFiles.length > 10) {
      console.log(chalk.dim(`  ... and ${changedFiles.length - 10} more`));
    }
    console.log('');
  }

  if (newFiles.length > 0) {
    console.log(chalk.bold(`Added (${newFiles.length} files):`));
    for (const file of newFiles.slice(0, 10)) {
      console.log(`  ${chalk.green('A')} ${file}`);
    }
    if (newFiles.length > 10) {
      console.log(chalk.dim(`  ... and ${newFiles.length - 10} more`));
    }
    console.log('');
  }

  if (deletedFiles.length > 0) {
    console.log(chalk.bold(`Deleted (${deletedFiles.length} files):`));
    for (const file of deletedFiles.slice(0, 10)) {
      console.log(`  ${chalk.red('D')} ${file}`);
    }
    if (deletedFiles.length > 10) {
      console.log(chalk.dim(`  ... and ${deletedFiles.length - 10} more`));
    }
    console.log('');
  }

  const total = changedFiles.length + newFiles.length + deletedFiles.length;
  if (total === 0) {
    console.log(chalk.dim('No pending changes in dirty_state.json.'));
  } else {
    console.log(chalk.cyan('Summary:'));
    console.log(`  Total files: ${total}`);
    console.log(
      `  Modified: ${changedFiles.length}, Added: ${newFiles.length}, Deleted: ${deletedFiles.length}`
    );
  }
  console.log('');
  console.log(
    chalk.yellow('No changes made. Remove --dry-run to execute update.')
  );
}

/**
 * Executes the incremental update of the PGC.
 *
 * Reads dirty_state.json and performs surgical re-analysis:
 * 1. Validate PGC structure and find workspace root
 * 2. Initialize core components (PGC, workbench, miner)
 * 3. Create update orchestrator with genesis oracle
 * 4. Execute incremental update based on dirty state
 * 5. Regenerate affected overlays and coherence scores
 *
 * @param options - Update command options (project root, workbench URL)
 * @throws Error if dirty_state.json invalid, workbench unreachable, or update fails
 * @example
 * await runUpdate({
 *   projectRoot: process.cwd(),
 *   workbench: 'http://localhost:8000'
 * });
 */
async function runUpdate(options: UpdateOptions) {
  intro(chalk.bold('🔄 Update: Syncing PGC with Changes'));

  try {
    // Validate PGC initialization and resolve workspace
    const projectRoot = await validatePgcInitialized(options.projectRoot);

    // Handle dry-run mode
    if (options.dryRun) {
      await executeDryRun(projectRoot);
      return;
    }

    // Initialize core components
    const pgc = new PGCManager(projectRoot);
    const workbench = new WorkbenchClient(
      options.workbench || process.env.WORKBENCH_URL || 'http://localhost:8000'
    );

    // Initialize structural miner
    const miner = new StructuralMiner(workbench);

    // Initialize oracle
    const genesisOracle = new GenesisOracle(pgc);

    // Create update orchestrator
    const orchestrator = new UpdateOrchestrator(
      pgc,
      miner,
      workbench,
      genesisOracle,
      options.projectRoot
    );

    // Execute incremental update
    log.info('Executing incremental update based on dirty_state.json...');
    await orchestrator.executeIncrementalUpdate();

    outro(chalk.green('✓ Update complete - PGC is coherent'));
  } catch (error) {
    if (error instanceof PGCInitializationError) {
      log.error(chalk.red(error.message));
    } else {
      log.error(chalk.red((error as Error).message));
    }
    throw error;
  }
}

/**
 * Creates the update command for incremental PGC synchronization.
 *
 * Configures CLI options:
 * - --project-root: Directory to search for .open_cognition (walks up tree)
 * - --workbench: URL of eGemma workbench for embedding generation
 *
 * @returns Commander command instance for 'update'
 * @example
 * const cmd = createUpdateCommand();
 * program.addCommand(cmd);
 */
export function createUpdateCommand(): Command {
  const cmd = new Command('update');

  cmd
    .description('Incremental PGC sync based on dirty_state.json (Monument 3)')
    .option(
      '-p, --project-root <path>',
      'Root directory of the project',
      process.cwd()
    )
    .option(
      '-w, --workbench <url>',
      'URL of the egemma workbench',
      'http://localhost:8000'
    )
    .option('-n, --dry-run', 'Preview pending changes without processing')
    .action(async (options) => {
      try {
        await runUpdate(options);
      } catch (error) {
        console.error(chalk.red('Error:'), error);
        process.exit(1);
      }
    });

  return cmd;
}
