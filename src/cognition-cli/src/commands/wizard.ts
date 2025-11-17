/**
 * Interactive PGC Setup Wizard
 *
 * Provides a guided, interactive setup experience for initializing a complete
 * Grounded Context Pool (PGC) from scratch. The wizard orchestrates multiple
 * CLI commands in sequence to create a production-ready PGC workspace.
 *
 * WORKFLOW:
 * 1. Detect or prompt for workbench URL and API key
 * 2. Initialize PGC directory structure (.open_cognition/)
 * 3. Run genesis to build verifiable skeleton from source code
 * 4. Ingest strategic documentation (VISION.md, custom docs)
 * 5. Generate selected overlays (O1-O7)
 *
 * DESIGN:
 * The wizard implements a conversational flow that:
 * - Auto-detects existing PGC and workbench instances
 * - Validates user inputs before execution
 * - Handles both fresh initialization and incremental updates
 * - Provides clear progress feedback via spinners and logs
 * - Supports environment-based configuration (WORKBENCH_URL, WORKBENCH_API_KEY)
 *
 * OVERLAY GENERATION:
 * Generates semantic overlays in dependency order:
 * - O₁ (structural_patterns): Code structure and architectural roles
 * - O₂ (security_guidelines): Security constraints and attack vectors
 * - O₃ (lineage_patterns): Dependency chains and type lineage
 * - O₄ (mission_concepts): Strategic concepts from documentation
 * - O₅ (operational_patterns): Workflow patterns and procedures
 * - O₆ (mathematical_proofs): Formal statements and theorems
 * - O₇ (strategic_coherence): Mission-code alignment analysis
 *
 * @example
 * // Run wizard to set up a new PGC
 * await wizardCommand({ projectRoot: '/path/to/project' });
 * // → Guides user through initialization, genesis, and overlay generation
 *
 * @example
 * // Update existing PGC with new overlays
 * await wizardCommand({ projectRoot: '/path/to/project' });
 * // → Detects existing PGC, prompts to update or reinit
 */

import {
  intro,
  outro,
  text,
  confirm,
  spinner,
  log,
  select,
} from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fetch } from 'undici';
import { initCommand } from './init.js';
import { genesisCommand } from './genesis.js';
import { genesisDocsCommand } from './genesis-docs.js';
import { OverlayOrchestrator } from '../core/orchestrators/overlay.js';
import { WorkspaceManager } from '../core/workspace-manager.js';

/**
 * Options for the wizard command
 */
interface WizardOptions {
  /** Root directory where PGC will be initialized */
  projectRoot: string;
}

/**
 * Checks if a workbench URL is healthy and accessible
 *
 * Sends a GET request to the /health endpoint to verify the workbench
 * server is running and accepting connections.
 *
 * @param url - The workbench URL to check (e.g., 'http://localhost:8000')
 * @returns True if the /health endpoint responds with 200 OK, false otherwise
 *
 * @example
 * const isHealthy = await checkWorkbenchHealth('http://localhost:8000');
 * if (isHealthy) {
 *   console.log('Workbench is ready for embedding generation');
 * }
 */
async function checkWorkbenchHealth(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch (error) {
    console.warn(
      `Workbench health check failed at ${url}: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

/**
 * Attempts to autodetect a running workbench instance
 *
 * Probes common local development ports to find a running workbench server.
 * This reduces friction for developers by eliminating manual URL entry when
 * the workbench is running on a standard port.
 *
 * ALGORITHM:
 * - Checks ports 8000 and 8080 on localhost and 127.0.0.1
 * - Tests each URL's /health endpoint sequentially
 * - Returns the first healthy URL found, or null if none are healthy
 *
 * @returns The URL of the first healthy workbench found, or null if none detected
 *
 * @example
 * const detected = await autodetectWorkbench();
 * if (detected) {
 *   console.log(`Found workbench at ${detected}`);
 * } else {
 *   console.log('No workbench detected, please enter URL manually');
 * }
 */
async function autodetectWorkbench(): Promise<string | null> {
  const commonUrls = [
    'http://localhost:8000',
    'http://localhost:8080',
    'http://127.0.0.1:8000',
    'http://127.0.0.1:8080',
  ];

  for (const url of commonUrls) {
    if (await checkWorkbenchHealth(url)) {
      return url;
    }
  }

  return null;
}

/**
 * Interactive wizard for setting up a complete PGC from scratch
 *
 * Orchestrates the complete PGC initialization workflow through an interactive
 * conversational interface. Handles both fresh setup and updates to existing
 * PGC workspaces.
 *
 * WORKFLOW PHASES:
 * 1. **Detection**: Check for existing PGC, detect workbench
 * 2. **Configuration**: Collect workbench URL, API key, source path, docs path
 * 3. **Initialization**: Run init command if needed
 * 4. **Genesis**: Build verifiable skeleton from source code
 * 5. **Documentation**: Ingest VISION.md and custom strategic docs
 * 6. **Overlays**: Generate selected semantic overlays (O1-O7)
 *
 * ENVIRONMENT VARIABLES:
 * - WORKBENCH_URL: Pre-configured workbench URL (overrides detection)
 * - WORKBENCH_API_KEY: API key for workbench authentication
 *
 * EXIT BEHAVIOR:
 * - Calls process.exit(0) on success (to terminate worker pools)
 * - Calls process.exit(1) on failure
 *
 * @param options - Wizard configuration options
 *
 * @example
 * // Fresh PGC setup with all overlays
 * await wizardCommand({ projectRoot: '/path/to/project' });
 * // → User selects "All 7 overlays (recommended)"
 * // → Generates O1-O7 and exits successfully
 *
 * @example
 * // Update existing PGC with new overlays
 * // (PGC already exists at /path/to/project/.open_cognition)
 * await wizardCommand({ projectRoot: '/path/to/project' });
 * // → User selects "Update Existing Overlays"
 * // → Re-generates selected overlays without wiping data
 */
export async function wizardCommand(options: WizardOptions) {
  intro(chalk.bold.cyan('🧙 PGC Setup Wizard'));

  log.info(
    'This wizard will guide you through setting up a complete Grounded Context Pool (PGC).'
  );

  log.info(chalk.dim('\n⚡ The symmetric machine provides perfect traversal.'));
  log.info(chalk.dim('🎨 The asymmetric human provides creative projection.'));
  log.info(chalk.dim('🤝 This is the symbiosis.\n'));

  // Step 1: Check if PGC already exists using walk-up
  const workspaceManager = new WorkspaceManager();
  let projectRoot = workspaceManager.resolvePgcRoot(options.projectRoot);

  // If no workspace found, use the provided projectRoot for initialization
  if (!projectRoot) {
    projectRoot = options.projectRoot;
  }

  const pgcRoot = path.join(projectRoot, '.open_cognition');
  const coreDirectories = [
    'objects',
    'transforms',
    'index',
    'reverse_deps',
    'overlays',
  ];
  const pgcExists = (
    await Promise.all(
      coreDirectories.map((dir) => fs.pathExists(path.join(pgcRoot, dir)))
    )
  ).every((exists) => exists);

  if (pgcExists) {
    const action = (await select({
      message: 'PGC already exists. What do you want to do?',
      options: [
        {
          value: 'update',
          label: 'Update Existing Overlays',
        },
        { value: 'init', label: 'Init PGC (wipe and start fresh)' },
        { value: 'cancel', label: 'Cancel' },
      ],
      initialValue: 'update',
    })) as string;

    if (action === 'cancel') {
      outro(chalk.yellow('Wizard cancelled.'));
      return;
    }

    if (action === 'init') {
      log.warn(chalk.yellow('\n⚠️  Init PGC will DELETE all existing data.'));
      const confirmInit = (await confirm({
        message: 'Are you sure you want to wipe the PGC?',
        initialValue: false,
      })) as boolean;

      if (!confirmInit) {
        outro(chalk.yellow('Wizard cancelled.'));
        return;
      }

      // Wipe the entire PGC
      log.info(chalk.bold('\n🗑️  Removing existing PGC...'));
      await fs.remove(pgcRoot);
      log.info(chalk.green('✓ PGC removed'));
    }
  }

  // Step 2: Check for WORKBENCH_URL environment variable first
  const envWorkbenchUrl = process.env.WORKBENCH_URL;

  // Step 3: Detect workbench if not set in environment
  const s = spinner();

  let detectedWorkbench: string | null = null;
  if (!envWorkbenchUrl) {
    s.start('Detecting workbench instance...');
    detectedWorkbench = await autodetectWorkbench();

    if (detectedWorkbench) {
      s.stop(chalk.green(`✓ Found workbench at ${detectedWorkbench}`));
    } else {
      s.stop(chalk.yellow('⚠ No workbench detected on common ports'));
    }
  } else {
    log.info(
      chalk.green(`✓ Using WORKBENCH_URL from environment: ${envWorkbenchUrl}`)
    );
  }

  // Step 4: Get workbench URL (prioritize env var, then detected, then default)
  const defaultUrl =
    envWorkbenchUrl || detectedWorkbench || 'http://localhost:8000';
  const workbenchUrl = (await text({
    message: 'Workbench URL:',
    placeholder: 'http://localhost:8000',
    initialValue: defaultUrl,
    validate: (value) => {
      if (!value) return 'Workbench URL is required';
      if (!value.startsWith('http://') && !value.startsWith('https://')) {
        return 'URL must start with http:// or https://';
      }
      return undefined;
    },
  })) as string;

  // Verify the workbench is accessible
  s.start('Verifying workbench connection...');
  const isHealthy = await checkWorkbenchHealth(workbenchUrl);

  if (!isHealthy) {
    s.stop(chalk.red('✗ Cannot connect to workbench'));
    log.error(`Please ensure the workbench is running at ${workbenchUrl}`);
    outro(chalk.red('Wizard failed. Please check your workbench setup.'));
    return;
  }

  s.stop(chalk.green('✓ Workbench connection verified'));

  // Step 5: Get API key
  const apiKey = (await text({
    message: 'Workbench API Key:',
    placeholder: 'Enter your API key (or "dummy-key" for local)',
    initialValue: 'dummy-key',
    validate: (value) => {
      if (!value) return 'API key is required';
      return undefined;
    },
  })) as string;

  // Step 6: Get source path
  const sourcePath = (await text({
    message: 'Source path to analyze:',
    placeholder: 'src',
    initialValue: 'src',
    validate: (value) => {
      if (!value) return 'Source path is required';
      const fullPath = path.join(options.projectRoot, value);
      const exists = fs.pathExistsSync(fullPath);
      if (!exists) return `Path "${value}" does not exist`;
      return undefined;
    },
  })) as string;

  // Step 7: Ask about documentation
  const hasCustomDocs = (await confirm({
    message: 'Do you have additional strategic documentation to ingest?',
    initialValue: false,
  })) as boolean;

  let shouldIngestDocs = false;
  let docsPath = '';

  if (hasCustomDocs) {
    shouldIngestDocs = true;
    docsPath = (await text({
      message: 'Path to documentation file or directory:',
      placeholder: 'docs/custom',
      validate: (value) => {
        if (!value) return 'Documentation path is required';
        const fullPath = path.join(options.projectRoot, value);
        const exists = fs.pathExistsSync(fullPath);
        if (!exists) return `Path "${value}" does not exist`;
        return undefined;
      },
    })) as string;
  }

  // Step 8: Ask about overlays
  const overlayTypes = (await select({
    message: 'Which overlays would you like to generate?',
    options: [
      { value: 'all', label: 'All 7 overlays (recommended)' },
      { value: 'structural', label: 'Structural patterns only (O₁)' },
      { value: 'security', label: 'Security guidelines only (O₂)' },
      { value: 'lineage', label: 'Lineage patterns only (O₃)' },
      { value: 'mission', label: 'Mission concepts only (O₄, requires docs)' },
      { value: 'operational', label: 'Operational patterns only (O₅)' },
      { value: 'mathematical', label: 'Mathematical proofs only (O₆)' },
      {
        value: 'coherence',
        label: 'Strategic coherence only (O₇, requires docs)',
      },
      { value: 'none', label: 'Skip overlays for now' },
    ],
    initialValue: 'all',
  })) as string;

  // Validate overlay selection
  if (
    (overlayTypes === 'mission' ||
      overlayTypes === 'coherence' ||
      overlayTypes === 'all') &&
    !shouldIngestDocs
  ) {
    log.warn(
      'Mission concepts and strategic coherence overlays require documentation. Adjusting selection...'
    );
  }

  // Step 9: Confirm and execute
  log.step(chalk.bold('\nSetup Summary:'));
  log.info(`  Project Root: ${chalk.cyan(options.projectRoot)}`);
  log.info(`  Workbench URL: ${chalk.cyan(workbenchUrl)}`);
  log.info(`  Source Path: ${chalk.cyan(sourcePath)}`);
  if (shouldIngestDocs) {
    log.info(`  Documentation: ${chalk.cyan(docsPath)}`);
  }
  log.info(`  Overlays: ${chalk.cyan(overlayTypes)}`);

  const shouldProceed = (await confirm({
    message: '\nProceed with setup?',
    initialValue: true,
  })) as boolean;

  if (!shouldProceed) {
    outro(chalk.yellow('Setup cancelled.'));
    return;
  }

  // Set environment variables for commands
  process.env.WORKBENCH_URL = workbenchUrl;
  process.env.WORKBENCH_API_KEY = apiKey;

  log.step(chalk.bold('\n🚀 Starting PGC construction...'));

  try {
    // Execute: init
    if (!pgcExists) {
      log.info(chalk.bold('\n[1/4] Initializing PGC...'));
      await initCommand({ path: options.projectRoot });
    } else {
      log.info(chalk.bold('\n[1/4] Using existing PGC...'));
    }

    // Execute: genesis
    log.info(
      chalk.bold('\n[2/4] Running genesis (building verifiable skeleton)...')
    );
    await genesisCommand({
      source: sourcePath,
      workbench: workbenchUrl,
      projectRoot: options.projectRoot,
    });

    // Ingest template docs from docs/overlays/ (always includes VISION.md)
    log.info(chalk.bold('\n[3/4] Ingesting documentation...'));
    const overlayTemplatesPath = path.join(
      options.projectRoot,
      'docs',
      'overlays'
    );
    if (await fs.pathExists(overlayTemplatesPath)) {
      // Pass directory path to recursively ingest all markdown files
      await genesisDocsCommand(overlayTemplatesPath, {
        projectRoot: options.projectRoot,
      });
    }

    // Ingest additional custom docs if specified
    if (shouldIngestDocs) {
      log.info(chalk.bold('\nIngesting additional documentation...'));
      const fullDocsPath = path.join(options.projectRoot, docsPath);
      await genesisDocsCommand(fullDocsPath, {
        projectRoot: options.projectRoot,
      });
    }

    // Execute: overlays
    if (overlayTypes !== 'none') {
      log.info(chalk.bold('\n[4/4] Generating overlays...'));

      const overlaysToGenerate: string[] = [];

      if (overlayTypes === 'all') {
        // Generate all 7 overlays
        overlaysToGenerate.push(
          'structural_patterns', // O₁
          'security_guidelines', // O₂
          'lineage_patterns', // O₃
          'operational_patterns', // O₅
          'mathematical_proofs' // O₆
        );
        if (shouldIngestDocs) {
          overlaysToGenerate.push(
            'mission_concepts', // O₄
            'strategic_coherence' // O₇
          );
        }
      } else if (overlayTypes === 'structural') {
        overlaysToGenerate.push('structural_patterns');
      } else if (overlayTypes === 'security') {
        overlaysToGenerate.push('security_guidelines');
      } else if (overlayTypes === 'lineage') {
        overlaysToGenerate.push('lineage_patterns');
      } else if (overlayTypes === 'mission' && shouldIngestDocs) {
        overlaysToGenerate.push('mission_concepts');
      } else if (overlayTypes === 'operational') {
        overlaysToGenerate.push('operational_patterns');
      } else if (overlayTypes === 'mathematical') {
        overlaysToGenerate.push('mathematical_proofs');
      } else if (overlayTypes === 'coherence' && shouldIngestDocs) {
        overlaysToGenerate.push('strategic_coherence');
      }

      for (const overlayType of overlaysToGenerate) {
        const overlaySpinner = spinner();
        overlaySpinner.start(`Generating ${overlayType}...`);

        const orchestrator = await OverlayOrchestrator.create(
          options.projectRoot
        );
        await orchestrator.run(
          overlayType as
            | 'structural_patterns'
            | 'security_guidelines'
            | 'lineage_patterns'
            | 'mission_concepts'
            | 'operational_patterns'
            | 'mathematical_proofs'
            | 'strategic_coherence',
          {
            force: false,
            skipGc: false,
            sourcePath,
          }
        );
        await orchestrator.shutdown();

        overlaySpinner.stop(chalk.green(`✓ ${overlayType} generated`));
      }
    } else {
      log.info(chalk.bold('\n[4/4] Skipping overlays (none selected)'));
    }

    // Success!
    outro(
      chalk.bold.green(
        '\n✨ PGC setup complete! Your Grounded Context Pool is ready to use.'
      )
    );

    log.info(chalk.bold('\nNext steps:'));
    log.info(
      '  • Run queries: ' + chalk.cyan('cognition-cli query "your question"')
    );
    log.info('  • Watch for changes: ' + chalk.cyan('cognition-cli watch'));
    log.info('  • Check status: ' + chalk.cyan('cognition-cli status'));
    log.info('  • View guides: ' + chalk.cyan('cognition-cli guide'));

    // Force exit to prevent hanging (worker pools may keep event loop alive)
    process.exit(0);
  } catch (error) {
    log.error(chalk.red('\n✗ Setup failed'));
    if (error instanceof Error) {
      log.error(error.message);
    }
    outro(chalk.red('PGC setup incomplete. Please check the errors above.'));

    // Force exit on error too
    process.exit(1);
  }
}
