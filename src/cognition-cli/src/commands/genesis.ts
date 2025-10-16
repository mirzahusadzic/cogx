import { intro, outro, spinner, log } from '@clack/prompts';
import chalk from 'chalk';
import { PGCManager } from '../core/pgc-manager.js';
import { StructuralMiner } from '../miners/structural-miner.js';
import { WorkbenchClient } from '../executors/workbench-client.js';
import { GenesisOrchestrator } from '../orchestrators/genesis-orchestrator.js';

interface GenesisOptions {
  source: string;
  workbench: string;
  projectRoot: string;
}

export async function genesisCommand(options: GenesisOptions) {
  intro(chalk.bold('Genesis: Building the Verifiable Skeleton'));

  const s = spinner();

  try {
    // Initialize core components
    s.start('Initializing PGC and workbench connection');
    const pgc = new PGCManager(options.projectRoot);
    const workbench = new WorkbenchClient(options.workbench);

    // Verify workbench is alive
    await workbench.health();
    s.stop('Connected to egemma workbench');

    // Initialize structural miner with three-layer pipeline
    const miner = new StructuralMiner(workbench);

    // Create genesis orchestrator
    const orchestrator = new GenesisOrchestrator(
      pgc,
      miner,
      workbench,
      options.projectRoot
    );

    // Phase I: Bottom-Up Aggregation
    log.info('Phase I: Structural Mining (Bottom-Up)');
    await orchestrator.executeBottomUpAggregation(options.source);

    outro(chalk.green('✓ Genesis complete - Verifiable skeleton constructed'));
  } catch (error) {
    s.stop('Genesis failed');
    log.error(chalk.red((error as Error).message));
    throw error;
  }
}
