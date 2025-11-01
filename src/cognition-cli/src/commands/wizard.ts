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

interface WizardOptions {
  projectRoot: string;
}

/**
 * Checks if a workbench URL is healthy and accessible
 */
async function checkWorkbenchHealth(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Attempts to autodetect a running workbench instance
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

  // Step 2: Detect workbench
  const s = spinner();
  s.start('Detecting workbench instance...');

  const detectedWorkbench = await autodetectWorkbench();

  if (detectedWorkbench) {
    s.stop(chalk.green(`✓ Found workbench at ${detectedWorkbench}`));
  } else {
    s.stop(chalk.yellow('⚠ No workbench detected on common ports'));
  }

  // Step 3: Get workbench URL
  const workbenchUrl = (await text({
    message: 'Workbench URL:',
    placeholder: 'http://localhost:8000',
    initialValue: detectedWorkbench || 'http://localhost:8000',
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

  // Step 4: Get API key
  const apiKey = (await text({
    message: 'Workbench API Key:',
    placeholder: 'Enter your API key (or "dummy-key" for local)',
    initialValue: 'dummy-key',
    validate: (value) => {
      if (!value) return 'API key is required';
      return undefined;
    },
  })) as string;

  // Step 5: Get source path
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

  // Step 6: Ask about documentation
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

  // Step 7: Ask about overlays
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

  // Step 8: Confirm and execute
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
