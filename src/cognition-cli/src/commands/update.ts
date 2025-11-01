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
}

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

async function runUpdate(options: UpdateOptions) {
  intro(chalk.bold('🔄 Update: Syncing PGC with Changes'));

  try {
    // Validate PGC initialization and resolve workspace
    const projectRoot = await validatePgcInitialized(options.projectRoot);

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
