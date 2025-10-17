import { intro, outro, spinner, log } from '@clack/prompts';
import chalk from 'chalk';
import { PGCManager } from '../core/pgc-manager.js';
import { StructuralMiner } from '../miners/structural-miner.js';
import { WorkbenchClient } from '../executors/workbench-client.js';
import { GenesisOrchestrator } from '../orchestrators/genesis-orchestrator.js';
import { StructuralOracle } from '../core/oracles/structural-oracle.js';

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
    const workbench = new WorkbenchClient(
      process.env.WORKBENCH_URL || 'http://localhost:8000'
    );

    try {
      await workbench.health();
      s.stop();
      log.info('Connected to egemma workbench');
    } catch (error) {
      s.stop(
        'eGemma workbench is not running. Please start it before running the genesis command.'
      );
      return;
    }

    // Initialize structural miner with three-layer pipeline
    const miner = new StructuralMiner(workbench);

    const structuralOracle = new StructuralOracle(pgc);

    // Create genesis orchestrator
    const orchestrator = new GenesisOrchestrator(
      pgc,
      miner,
      workbench,
      structuralOracle,
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
  } finally {
    s.stop();
  }
}
