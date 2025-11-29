/**
 * Interactive PGC Setup Wizard
 *
 * Provides a guided, interactive setup experience for initializing a complete
 * Grounded Context Pool (PGC) from scratch. The wizard orchestrates multiple
 * CLI commands in sequence to create a production-ready PGC workspace.
 *
 * WORKFLOW (new project):
 * 1. Check for existing PGC
 * 2. Detect or prompt for workbench URL and API key
 * 3. Run init INTERACTIVELY - user picks source directories and docs
 * 4. Ask about overlays (user now knows what sources/docs exist)
 * 5. Run genesis with selected sources
 * 6. Run genesis:docs with selected documentation
 * 7. Generate selected overlays (O1-O7)
 *
 * WORKFLOW (existing PGC):
 * 1. Read sources from metadata.json
 * 2. Ask about workbench, overlays
 * 3. Run genesis, genesis:docs, overlay generation
 *
 * DESIGN:
 * The wizard implements a conversational flow that:
 * - Runs init FIRST so user can pick sources before overlay selection
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
import { initCommand } from './init.js';
import { genesisCommand } from './genesis.js';
import { genesisDocsCommand } from './genesis-docs.js';
import { OverlayOrchestrator } from '../core/orchestrators/overlay.js';
import { WorkspaceManager } from '../core/workspace-manager.js';
import {
  checkWorkbenchHealth,
  autodetectWorkbench,
} from '../utils/workbench-detect.js';

/**
 * Options for the wizard command
 */
interface WizardOptions {
  /** Root directory where PGC will be initialized */
  projectRoot: string;
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
  const pgcExistsOnDisk = (
    await Promise.all(
      coreDirectories.map((dir) => fs.pathExists(path.join(pgcRoot, dir)))
    )
  ).every((exists) => exists);

  // Track whether we need to run init (new or after wipe)
  let needsInit = !pgcExistsOnDisk;

  if (pgcExistsOnDisk) {
    const action = (await select({
      message: 'PGC already exists. What do you want to do?',
      options: [
        {
          value: 'update',
          label: 'Update Existing Overlays',
        },
        { value: 'init', label: 'Re-initialize PGC (wipe and start fresh)' },
        { value: 'cancel', label: 'Cancel' },
      ],
      initialValue: 'update',
    })) as string;

    if (action === 'cancel') {
      outro(chalk.yellow('Wizard cancelled.'));
      return;
    }

    if (action === 'init') {
      log.warn(
        chalk.yellow('\n⚠️  Re-init will DELETE all existing PGC data.')
      );
      const confirmInit = (await confirm({
        message: 'Are you sure you want to wipe and re-initialize?',
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
      needsInit = true; // After wipe, we need to run init
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

  // Step 6: Run init FIRST if PGC doesn't exist
  // This way user picks sources BEFORE we ask about overlays
  let sourcePaths: string[] = [];
  let docsPaths: string[] = [];
  let shouldIngestDocs = false;

  if (needsInit) {
    log.step(chalk.bold('\nStep 1: Initialize PGC'));
    log.info(
      chalk.dim('Select which source directories and docs to include.\n')
    );

    await initCommand({ path: options.projectRoot });

    // Read what user selected
    const metadataPath = path.join(pgcRoot, 'metadata.json');
    if (await fs.pathExists(metadataPath)) {
      try {
        const metadata = await fs.readJSON(metadataPath);
        if (metadata.sources?.code?.length > 0) {
          sourcePaths = metadata.sources.code;
        }
        if (metadata.sources?.docs?.length > 0) {
          docsPaths = metadata.sources.docs;
          shouldIngestDocs = true;
        }
      } catch {
        // Metadata read failed
      }
    }

    if (sourcePaths.length === 0) {
      log.error(chalk.red('No source directories selected. Cannot continue.'));
      outro(chalk.red('Wizard cancelled.'));
      return;
    }

    log.info('');
    log.info(chalk.green(`✓ PGC initialized`));
    log.info(chalk.dim(`  Code: ${sourcePaths.join(', ')}`));
    if (shouldIngestDocs) {
      log.info(chalk.dim(`  Docs: ${docsPaths.join(', ')}`));
    }
  } else {
    // PGC exists and user chose to update - read from existing metadata
    const metadataPath = path.join(pgcRoot, 'metadata.json');
    if (await fs.pathExists(metadataPath)) {
      try {
        const metadata = await fs.readJSON(metadataPath);
        if (metadata.sources?.code?.length > 0) {
          sourcePaths = metadata.sources.code;
          log.info(
            chalk.green(`✓ Using code paths: ${sourcePaths.join(', ')}`)
          );
        }
        if (metadata.sources?.docs?.length > 0) {
          docsPaths = metadata.sources.docs;
          shouldIngestDocs = true;
          log.info(chalk.green(`✓ Using docs: ${docsPaths.join(', ')}`));
        }
      } catch {
        // Metadata invalid
      }
    }
  }

  // Step 7: NOW ask about overlays (user knows what sources/docs exist)
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

  // Validate overlay selection - warn if no docs available
  if (
    !shouldIngestDocs &&
    (overlayTypes === 'mission' ||
      overlayTypes === 'coherence' ||
      overlayTypes === 'all')
  ) {
    log.warn(
      chalk.yellow(
        '\n⚠️  No documentation selected. O₄ and O₇ will be skipped.'
      )
    );
    log.warn(
      chalk.dim('   Run `cognition init` to add documentation paths.\n')
    );
  }

  // Step 8: Confirm and execute
  log.step(chalk.bold('\nSetup Summary:'));
  log.info(`  Project Root: ${chalk.cyan(options.projectRoot)}`);
  log.info(`  Workbench URL: ${chalk.cyan(workbenchUrl)}`);
  log.info(`  Source Paths: ${chalk.cyan(sourcePaths.join(', '))}`);
  if (shouldIngestDocs) {
    log.info(`  Documentation: ${chalk.cyan(docsPaths.join(', '))}`);
  } else {
    log.info(`  Documentation: ${chalk.dim('(none)')}`);
  }

  // Show overlay selection
  if (overlayTypes === 'all') {
    if (!shouldIngestDocs) {
      log.info(
        `  Overlays: ${chalk.cyan('5 of 7')} ${chalk.dim('(no docs for O₄/O₇)')}`
      );
    } else {
      log.info(`  Overlays: ${chalk.cyan('all 7')}`);
    }
  } else {
    log.info(`  Overlays: ${chalk.cyan(overlayTypes)}`);
  }

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
    // Init already ran above (if needed), just confirm
    log.info(chalk.bold('\n[1/3] PGC ready ✓'));

    // Execute: genesis for all source paths in a single run
    log.info(chalk.bold('\n[2/3] Running genesis...'));
    // Use detected paths or fallback to 'src'
    const effectiveSourcePaths = sourcePaths.length > 0 ? sourcePaths : ['src'];
    log.info(chalk.dim(`  Processing: ${effectiveSourcePaths.join(', ')}`));
    await genesisCommand({
      sources: effectiveSourcePaths,
      workbench: workbenchUrl,
      projectRoot: options.projectRoot,
    });

    // Ingest documentation and generate overlays
    log.info(chalk.bold('\n[3/3] Building overlays...'));
    if (shouldIngestDocs && docsPaths.length > 0) {
      // Use paths from metadata array
      const absoluteDocPaths = docsPaths.map((p) => {
        // If already absolute, use as-is; otherwise join with project root
        return path.isAbsolute(p) ? p : path.join(options.projectRoot, p);
      });
      await genesisDocsCommand(absoluteDocPaths, {
        projectRoot: options.projectRoot,
      });
    } else {
      // Fallback: check for docs/overlays or VISION.md
      const overlayTemplatesPath = path.join(
        options.projectRoot,
        'docs',
        'overlays'
      );
      const visionPath = path.join(options.projectRoot, 'VISION.md');

      if (await fs.pathExists(overlayTemplatesPath)) {
        await genesisDocsCommand([overlayTemplatesPath], {
          projectRoot: options.projectRoot,
        });
        shouldIngestDocs = true;
      } else if (await fs.pathExists(visionPath)) {
        await genesisDocsCommand([visionPath], {
          projectRoot: options.projectRoot,
        });
        shouldIngestDocs = true;
      } else {
        log.warn(chalk.yellow('  No documentation found to ingest'));
      }
    }

    // Execute: overlays
    if (overlayTypes !== 'none') {
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
        // Overlay generation reads from PGC index (created by genesis) - no path needed
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
          }
        );
        await orchestrator.shutdown();

        overlaySpinner.stop(chalk.green(`✓ ${overlayType} generated`));
      }

      // Show what was skipped if user selected "all" but didn't ingest docs
      if (overlayTypes === 'all' && !shouldIngestDocs) {
        log.info('');
        log.warn(
          chalk.yellow(
            '⚠️  Skipped: Mission Concepts (O₄) and Strategic Coherence (O₇)'
          )
        );
        log.info(
          chalk.dim(
            '   To generate these, run: cognition-cli overlay generate mission_concepts'
          )
        );
        log.info(chalk.dim('   (Requires docs to be ingested first)'));
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
