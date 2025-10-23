import { intro, outro, spinner, log } from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { PGCManager } from '../core/pgc/manager.js';
import { StructuralMiner } from '../core/orchestrators/miners/structural.js';
import { WorkbenchClient } from '../core/executors/workbench-client.js';
import { GenesisOrchestrator } from '../core/orchestrators/genesis.js';
import { GenesisOracle } from '../core/pgc/oracles/genesis.js';
import { LineagePatternsManager } from '../core/overlays/lineage/manager.js';
import { LanceVectorStore } from '../core/overlays/vector-db/lance-store.js';

class PGCInitializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PGCInitializationError';
  }
}

interface GenesisOptions {
  source: string;
  workbench: string;
  projectRoot: string;
}

async function validatePgcInitialized(projectRoot: string): Promise<void> {
  const pgcRoot = path.join(projectRoot, '.open_cognition');
  const metadataPath = path.join(pgcRoot, 'metadata.json');

  if (!(await fs.pathExists(pgcRoot))) {
    throw new PGCInitializationError(
      `PGC not initialized in ${projectRoot}. Please run 'cognition-cli init' first.`
    );
  }

  if (!(await fs.pathExists(metadataPath))) {
    throw new PGCInitializationError(
      `PGC metadata.json not found in ${pgcRoot}. Please run 'cognition-cli init' first.`
    );
  }

  // Optionally, add more checks for other essential directories if needed
}

export async function genesisCommand(options: GenesisOptions) {
  intro(chalk.bold('Genesis: Building the Verifiable Skeleton'));

  let s: ReturnType<typeof spinner> | undefined;
  let lineageManager: LineagePatternsManager | undefined;

  try {
    s = spinner();

    // Validate PGC initialization
    s.start('Validating PGC initialization');
    await validatePgcInitialized(options.projectRoot);
    s.stop('PGC validated');

    // Initialize core components
    s.start('Initializing PGC and workbench connection');
    const pgc = new PGCManager(options.projectRoot);
    const workbench = new WorkbenchClient(
      process.env.WORKBENCH_URL || 'http://localhost:8000'
    );

    // Initialize LanceVectorStore and LineagePatternsManager to set up embedding handler
    const vectorDB = new LanceVectorStore(pgc.pgcRoot);
    lineageManager = new LineagePatternsManager(pgc, vectorDB, workbench);
    // Dummy call to satisfy linter, as its constructor has side effects
    lineageManager.getEmbeddingStats();

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

    const genesisOracle = new GenesisOracle(pgc);

    // Create genesis orchestrator
    const orchestrator = new GenesisOrchestrator(
      pgc,
      miner,
      workbench,
      genesisOracle,
      options.projectRoot
    );

    // Phase I: Bottom-Up Aggregation
    log.info('Phase I: Structural Mining (Bottom-Up)');
    await orchestrator.executeBottomUpAggregation(options.source);

    outro(chalk.green('✓ Genesis complete - Verifiable skeleton constructed'));
  } catch (error) {
    if (s) {
      s.stop('Genesis failed');
    }
    if (error instanceof PGCInitializationError) {
      log.error(chalk.red(error.message));
    } else {
      log.error(chalk.red((error as Error).message));
    }
    throw error;
  } finally {
    if (s) {
      s.stop();
    }
    // Ensure lineageManager is shut down
    if (lineageManager) {
      await lineageManager.shutdown();
    }
  }
}
