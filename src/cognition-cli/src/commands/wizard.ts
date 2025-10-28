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

  // Step 1: Check if PGC already exists
  const pgcPath = path.join(options.projectRoot, '.open_cognition');
  const pgcExists = await fs.pathExists(pgcPath);

  if (pgcExists) {
    const shouldContinue = await confirm({
      message: 'PGC already exists. Do you want to continue anyway?',
      initialValue: false,
    });

    if (!shouldContinue) {
      outro(chalk.yellow('Wizard cancelled.'));
      return;
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
  const hasVisionDoc = await fs.pathExists(
    path.join(options.projectRoot, '../../VISION.md')
  );

  let shouldIngestDocs = false;
  let docsPath = '';

  if (hasVisionDoc) {
    shouldIngestDocs = (await confirm({
      message: 'Found VISION.md. Ingest documentation?',
      initialValue: true,
    })) as boolean;

    if (shouldIngestDocs) {
      docsPath = path.join(options.projectRoot, '../../VISION.md');
    }
  } else {
    const hasCustomDocs = (await confirm({
      message: 'Do you have strategic documentation to ingest?',
      initialValue: false,
    })) as boolean;

    if (hasCustomDocs) {
      shouldIngestDocs = true;
      docsPath = (await text({
        message: 'Path to documentation file:',
        placeholder: 'docs/VISION.md',
        validate: (value) => {
          if (!value) return 'Documentation path is required';
          const exists = fs.pathExistsSync(value);
          if (!exists) return `File "${value}" does not exist`;
          return undefined;
        },
      })) as string;
    }
  }

  // Step 7: Ask about overlays
  const overlayTypes = (await select({
    message: 'Which overlays would you like to generate?',
    options: [
      { value: 'all', label: 'All overlays (recommended)' },
      { value: 'structural', label: 'Structural patterns only' },
      { value: 'lineage', label: 'Lineage patterns only' },
      { value: 'mission', label: 'Mission concepts only (requires docs)' },
      { value: 'coherence', label: 'Strategic coherence only (requires docs)' },
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

    // Execute: genesis:docs (if applicable)
    if (shouldIngestDocs) {
      log.info(chalk.bold('\n[3/4] Ingesting documentation...'));
      await genesisDocsCommand(docsPath, { projectRoot: options.projectRoot });
    } else {
      log.info(chalk.bold('\n[3/4] Skipping documentation (none selected)'));
    }

    // Execute: overlays
    if (overlayTypes !== 'none') {
      log.info(chalk.bold('\n[4/4] Generating overlays...'));

      const overlaysToGenerate: string[] = [];

      if (overlayTypes === 'all') {
        overlaysToGenerate.push('structural_patterns', 'lineage_patterns');
        if (shouldIngestDocs) {
          overlaysToGenerate.push('mission_concepts', 'strategic_coherence');
        }
      } else if (overlayTypes === 'structural') {
        overlaysToGenerate.push('structural_patterns');
      } else if (overlayTypes === 'lineage') {
        overlaysToGenerate.push('lineage_patterns');
      } else if (overlayTypes === 'mission' && shouldIngestDocs) {
        overlaysToGenerate.push('mission_concepts');
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
            | 'lineage_patterns'
            | 'mission_concepts'
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
