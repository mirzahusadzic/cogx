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
import { glob } from 'glob';
import { PGCManager } from '../core/pgc/manager.js';
import { StructuralMiner } from '../core/orchestrators/miners/structural.js';
import { WorkbenchClient } from '../core/executors/workbench-client.js';
import { GenesisOrchestrator } from '../core/orchestrators/genesis.js';
import { GenesisOracle } from '../core/pgc/oracles/genesis.js';
import { LineagePatternsManager } from '../core/overlays/lineage/manager.js';
import { LanceVectorStore } from '../core/overlays/vector-db/lance-store.js';
import {
  debugLog,
  debugError,
  debugTimer,
  getDebugLogPath,
} from '../utils/debug-logger.js';
import { LANGUAGE_MAP } from '../config.js';

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
  dryRun?: boolean;
  resume?: boolean;
}

/**
 * Progress tracking for genesis resume functionality
 *
 * NOTE: Resume capability relies on PGC index idempotency, not granular file tracking.
 * The GenesisOrchestrator skips files whose content hashes already exist in the index.
 * This progress file serves as a session marker to detect interrupted runs and inform
 * the user, rather than tracking individual file progress.
 */
interface GenesisProgress {
  /** Timestamp when genesis was started */
  startedAt: string;
  /** Source path being processed */
  sourcePath: string;
}

const PROGRESS_FILE = '.genesis-progress.json';

/**
 * Load existing genesis progress from file
 */
async function loadProgress(
  projectRoot: string
): Promise<GenesisProgress | null> {
  const progressPath = path.join(projectRoot, '.open_cognition', PROGRESS_FILE);
  try {
    if (await fs.pathExists(progressPath)) {
      return await fs.readJSON(progressPath);
    }
  } catch {
    // If file is corrupted, start fresh
  }
  return null;
}

/**
 * Save genesis progress to file
 */
async function saveProgress(
  projectRoot: string,
  progress: GenesisProgress
): Promise<void> {
  const progressPath = path.join(projectRoot, '.open_cognition', PROGRESS_FILE);
  await fs.writeJSON(progressPath, progress, { spaces: 2 });
}

/**
 * Remove genesis progress file (on successful completion)
 */
async function clearProgress(projectRoot: string): Promise<void> {
  const progressPath = path.join(projectRoot, '.open_cognition', PROGRESS_FILE);
  try {
    await fs.remove(progressPath);
  } catch {
    // Ignore if file doesn't exist
  }
}

/** Glob patterns to ignore during scanning */
const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/__pycache__/**',
  '**/.open_cognition/**',
  '**/dist/**',
  '**/docs/**',
  '**/build/**',
  '**/cache/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.venv*/**',
  '**/.*/**',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.test.js',
  '**/*.test.jsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/*.spec.js',
  '**/*.spec.jsx',
];

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
 * Executes dry-run mode for genesis: scans files and shows what would be processed.
 */
async function executeDryRun(
  sourcePath: string,
  projectRoot: string
): Promise<void> {
  const fullSourcePath = path.isAbsolute(sourcePath)
    ? sourcePath
    : path.join(projectRoot, sourcePath);

  const extensions = Object.keys(LANGUAGE_MAP).map((ext) => ext.slice(1));
  const pattern = `**/*.{${extensions.join(',')}}`;

  const filePaths = await glob(pattern, {
    cwd: fullSourcePath,
    absolute: true,
    ignore: IGNORE_PATTERNS,
    nodir: true,
  });

  // Group files by language
  const byLanguage: Record<string, string[]> = {};
  let totalSize = 0;

  for (const filePath of filePaths) {
    const ext = path.extname(filePath);
    const language = LANGUAGE_MAP[ext] || 'Unknown';
    const relativePath = path.relative(projectRoot, filePath);

    if (!byLanguage[language]) {
      byLanguage[language] = [];
    }
    byLanguage[language].push(relativePath);

    const stats = await fs.stat(filePath);
    totalSize += stats.size;
  }

  // Display summary
  console.log('');
  console.log(chalk.cyan('Dry run - files that would be processed:'));
  console.log('');

  const languages = Object.keys(byLanguage).sort();
  for (const language of languages) {
    const files = byLanguage[language];
    console.log(chalk.bold(`${language} (${files.length} files):`));
    for (const file of files.slice(0, 10)) {
      console.log(`  ${chalk.dim('•')} ${file}`);
    }
    if (files.length > 10) {
      console.log(chalk.dim(`  ... and ${files.length - 10} more`));
    }
    console.log('');
  }

  // Summary stats
  console.log(chalk.cyan('Summary:'));
  console.log(`  Total files: ${filePaths.length}`);
  console.log(`  Total size: ${(totalSize / 1024).toFixed(1)} KB`);
  console.log(`  Languages: ${languages.join(', ')}`);
  console.log('');
  console.log(
    chalk.yellow('No changes made. Remove --dry-run to execute genesis.')
  );
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

  const genesisTimer = debugTimer('Genesis total');
  debugLog('Genesis started', {
    source: options.source,
    projectRoot: options.projectRoot,
    workbench: options.workbench,
    dryRun: options.dryRun,
    resume: options.resume,
  });

  let s: ReturnType<typeof spinner> | undefined;
  let lineageManager: LineagePatternsManager | undefined;

  try {
    s = spinner();

    // Validate PGC initialization
    s.start('Validating PGC initialization');
    debugLog('Validating PGC initialization');
    await validatePgcInitialized(options.projectRoot);
    s.stop('PGC validated');
    debugLog('PGC validation complete');

    // Handle dry-run mode
    if (options.dryRun) {
      debugLog('Executing dry-run mode');
      await executeDryRun(options.source, options.projectRoot);
      return;
    }

    // Check for existing progress
    let existingProgress: GenesisProgress | null = null;
    const previousProgress = await loadProgress(options.projectRoot);

    if (options.resume) {
      if (previousProgress) {
        existingProgress = previousProgress;
        log.info(
          chalk.cyan(
            `Resuming from previous run (started ${previousProgress.startedAt})`
          )
        );
        log.info(
          chalk.dim(
            'Unchanged files will be skipped automatically via content hash comparison'
          )
        );
        debugLog('Resuming from progress', {
          startedAt: previousProgress.startedAt,
          sourcePath: previousProgress.sourcePath,
        });
      } else {
        log.info(chalk.dim('No previous progress found, starting fresh'));
        debugLog('No progress file found');
      }
    } else {
      // Warn if progress file exists but --resume wasn't used
      if (previousProgress) {
        log.warn(
          chalk.yellow(
            `Previous genesis was interrupted (started ${previousProgress.startedAt})`
          )
        );
        log.warn(
          chalk.yellow(
            'Use --resume to continue, or run without --resume to start fresh'
          )
        );
        debugLog('Previous progress found but not resuming', {
          startedAt: previousProgress.startedAt,
        });
      }
      // Clear any stale progress if not resuming
      await clearProgress(options.projectRoot);
    }

    // Initialize core components
    s.start('Initializing PGC and workbench connection');
    const initTimer = debugTimer('Initialize PGC and workbench');
    const pgc = new PGCManager(options.projectRoot);
    debugLog('PGCManager initialized', { pgcRoot: pgc.pgcRoot });

    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
    const workbench = new WorkbenchClient(workbenchUrl);
    debugLog('WorkbenchClient created', { url: workbenchUrl });

    // Initialize LanceVectorStore and LineagePatternsManager to set up embedding handler
    const vectorDB = new LanceVectorStore(pgc.pgcRoot);
    lineageManager = new LineagePatternsManager(pgc, vectorDB, workbench);
    // Dummy call to satisfy linter, as its constructor has side effects
    lineageManager.getEmbeddingStats();
    debugLog('LanceVectorStore and LineagePatternsManager initialized');

    try {
      debugLog('Checking workbench health');
      await workbench.health();
      s.stop();
      log.info('Connected to egemma workbench');
      debugLog('Workbench health check passed');
      s = undefined; // Prevent finally block from stopping spinner again
    } catch (error) {
      debugError('Workbench health check failed', error);
      if (s) {
        s.stop(
          'eGemma workbench is not running. Please start it before running the genesis command.'
        );
      }
      console.error(
        `Workbench health check failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }
    initTimer();

    // Initialize structural miner with three-layer pipeline
    const miner = new StructuralMiner(workbench);
    debugLog('StructuralMiner initialized');

    const genesisOracle = new GenesisOracle(pgc);
    debugLog('GenesisOracle initialized');

    // Create genesis orchestrator
    const orchestrator = new GenesisOrchestrator(
      pgc,
      miner,
      workbench,
      genesisOracle,
      options.projectRoot
    );
    debugLog('GenesisOrchestrator created');

    // Initialize or update progress tracking
    const progress: GenesisProgress = existingProgress || {
      startedAt: new Date().toISOString(),
      sourcePath: options.source,
    };

    // Save initial progress (marks genesis as "in progress")
    await saveProgress(options.projectRoot, progress);
    debugLog('Progress saved', { progress });

    // Phase I: Bottom-Up Aggregation
    log.info('Phase I: Structural Mining (Bottom-Up)');
    debugLog('Starting Phase I: Bottom-Up Aggregation', {
      source: options.source,
    });
    const miningTimer = debugTimer('Structural mining');
    await orchestrator.executeBottomUpAggregation(options.source);
    miningTimer();
    debugLog('Phase I complete');

    // Clear progress on successful completion
    await clearProgress(options.projectRoot);
    debugLog('Progress cleared (genesis complete)');

    outro(chalk.green('✓ Genesis complete - Verifiable skeleton constructed'));
    genesisTimer();

    // Show debug log path if enabled
    const debugPath = getDebugLogPath();
    if (debugPath) {
      console.log('');
      console.log(chalk.dim(`Debug log: ${debugPath}`));
    }

    // Next steps guidance
    console.log('');
    console.log(chalk.cyan('Next steps:'));
    console.log(
      `  ${chalk.dim('$')} cognition genesis:docs VISION.md  ${chalk.dim('# Add mission documents')}`
    );
    console.log(
      `  ${chalk.dim('$')} cognition overlay generate        ${chalk.dim('# Generate analysis overlays')}`
    );
    console.log(
      `  ${chalk.dim('$')} cognition status                  ${chalk.dim('# Check PGC coherence')}`
    );
    console.log(
      `  ${chalk.dim('$')} cognition tui                     ${chalk.dim('# Launch interactive interface')}`
    );
    console.log('');
  } catch (error) {
    debugError('Genesis failed', error);
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
      debugLog('Shutting down LineagePatternsManager');
      await lineageManager.shutdown();
    }
  }
}
