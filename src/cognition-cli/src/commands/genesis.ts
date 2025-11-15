/**
 * Genesis Command: Build the Verifiable Skeleton
 *
 * The genesis command constructs the foundational representation of source code by:
 * - Mining structural patterns (symbols, functions, classes, types)
 * - Extracting semantic meaning via embedding-based analysis
 * - Building the Grounded Context Pool (PGC) with complete lineage tracking
 * - Creating O1 (Structural Patterns overlay) with full architectural role assignments
 *
 * This is the first step in the cognitive architecture pipeline (Monument 1).
 *
 * WORKFLOW:
 * 1. Validate PGC initialization (.open_cognition directory structure)
 * 2. Connect to workbench (eGemma for embedding generation)
 * 3. Initialize structural miner (three-layer pipeline)
 * 4. Execute bottom-up aggregation phase
 * 5. Persist O1 overlay with vector embeddings
 *
 * @example
 * // Build the skeleton from source code
 * cognition-cli genesis --source src/
 *
 * @example
 * // Specify custom workbench URL
 * cognition-cli genesis --source src/ --workbench http://localhost:8000
 */

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

/**
 * Represents errors during PGC initialization validation.
 */
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

/**
 * Validates that PGC is properly initialized in the project root.
 *
 * @param projectRoot - Root directory of the project containing .open_cognition
 * @throws {PGCInitializationError} If .open_cognition directory or metadata.json not found
 * @example
 * await validatePgcInitialized(process.cwd());
 */
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

/**
 * Executes the genesis command to build the verifiable skeleton from source code.
 *
 * Orchestrates the full bottom-up aggregation pipeline:
 * - Validates PGC structure
 * - Initializes workbench connection for embeddings
 * - Runs structural mining (three-layer pipeline: tokenization → AST → symbol extraction)
 * - Persists O1 overlay with vector embeddings and lineage tracking
 *
 * @param options - Genesis command options (source path, workbench URL, project root)
 * @throws Error if workbench is unreachable, source code invalid, or mining fails
 * @example
 * await genesisCommand({
 *   source: 'src/',
 *   workbench: 'http://localhost:8000',
 *   projectRoot: process.cwd()
 * });
 */
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
      s = undefined; // Prevent finally block from stopping spinner again
    } catch (error) {
      if (s) {
        s.stop(
          'eGemma workbench is not running. Please start it before running the genesis command.'
        );
      }
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
