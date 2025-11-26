/**
 * Init Command: Initialize the Grounded Context Pool (PGC)
 *
 * The init command sets up the foundational directory structure for the cognitive architecture.
 * It creates the four pillars of the PGC:
 * 1. objects/ - Content-addressable storage of code artifacts
 * 2. transforms/ - Intermediate processing state and lineage tracking
 * 3. index/ - Indexing structures for efficient lookup
 * 4. reverse_deps/ - Reverse dependency maps for impact analysis
 *
 * Plus supporting directories:
 * - overlays/ - Analytical overlay storage (O1-O7)
 * - metadata.json - System initialization metadata with version and timestamp
 * - .gitignore - Excludes large objects/ directory from version control
 *
 * STATUS CODES:
 * - empty: Just initialized, no analysis performed yet
 * - mining: Currently running structural analysis (genesis)
 * - complete: Genesis finished, overlays generated
 * - updating: Incremental update in progress
 *
 * This must be run ONCE before genesis, overlay, or other commands.
 *
 * @example
 * // Initialize PGC in current directory
 * cognition-cli init
 *
 * @example
 * // Initialize PGC in specific directory
 * cognition-cli init --path /path/to/project
 *
 * @example
 * // Verify initialization
 * ls .open_cognition/
 * # objects/ transforms/ index/ reverse_deps/ overlays/ metadata.json .gitignore
 */

import fs from 'fs-extra';
import path from 'path';
import { intro, outro, spinner, confirm } from '@clack/prompts';
import chalk from 'chalk';
import { isInteractive } from '../utils/terminal-capabilities.js';

/**
 * Initializes the PGC directory structure at the specified path.
 *
 * Creates the complete four-pillar architecture:
 * 1. Creates .open_cognition root directory
 * 2. Sets up objects/, transforms/, index/, reverse_deps/, overlays/ subdirectories
 * 3. Initializes metadata.json with version and timestamp
 * 4. Creates .gitignore to exclude large object store
 *
 * If directory already exists, ensures all required subdirectories are present.
 *
 * @param options - Init command options (path where to create .open_cognition)
 * @param options.path - Root directory where .open_cognition will be created
 * @param options.dryRun - If true, preview what would be created without making changes
 * @param options.force - If true, skip confirmation prompts (for scripts)
 * @throws Error if filesystem permissions insufficient or write fails
 * @example
 * await initCommand({ path: process.cwd() });
 */
export async function initCommand(options: {
  path: string;
  dryRun?: boolean;
  force?: boolean;
}) {
  console.log(chalk.cyan('📦 PGC = Grounded Context Pool'));
  console.log(
    chalk.dim(
      '   Content-addressable knowledge storage with full audit trails\n'
    )
  );

  const pgcRoot = path.join(options.path, '.open_cognition');

  // Dry run mode - preview what would be created
  if (options.dryRun) {
    console.log(chalk.yellow.bold('Dry run mode - no changes will be made\n'));
    console.log('Would create the following structure:');
    console.log(`  ${chalk.cyan(pgcRoot + '/')}`);
    console.log(`    ${chalk.dim('├──')} objects/`);
    console.log(`    ${chalk.dim('├──')} transforms/`);
    console.log(`    ${chalk.dim('├──')} index/`);
    console.log(`    ${chalk.dim('├──')} reverse_deps/`);
    console.log(`    ${chalk.dim('├──')} overlays/`);
    console.log(`    ${chalk.dim('├──')} metadata.json`);
    console.log(`    ${chalk.dim('└──')} .gitignore`);
    console.log('');

    // Check if directory already exists
    if (await fs.pathExists(pgcRoot)) {
      console.log(chalk.yellow('⚠️  Warning: .open_cognition/ already exists'));
      console.log(
        chalk.dim('   Running without --dry-run will update existing structure')
      );
    }
    return;
  }

  // Check if directory already exists and prompt for confirmation
  if ((await fs.pathExists(pgcRoot)) && !options.force) {
    console.log(
      chalk.yellow('⚠️  .open_cognition/ already exists at this location')
    );
    console.log('');

    if (isInteractive()) {
      const shouldContinue = await confirm({
        message:
          'Reinitialize existing workspace? (This may affect existing data)',
        initialValue: false,
      });

      if (!shouldContinue || shouldContinue === Symbol.for('cancel')) {
        console.log(chalk.dim('Operation cancelled'));
        return;
      }
    } else {
      // Non-interactive mode without --force flag
      console.log(chalk.red('Error: .open_cognition/ already exists'));
      console.log(
        chalk.dim('Use --force to reinitialize in non-interactive mode')
      );
      process.exit(1);
    }
  }

  intro(chalk.bold('Initializing Grounded Context Pool'));

  const s = spinner();
  s.start('Creating PGC directory structure');

  try {
    // Create the four pillars
    await fs.ensureDir(path.join(pgcRoot, 'objects'));
    await fs.ensureDir(path.join(pgcRoot, 'transforms'));
    await fs.ensureDir(path.join(pgcRoot, 'index'));
    await fs.ensureDir(path.join(pgcRoot, 'reverse_deps'));
    await fs.ensureDir(path.join(pgcRoot, 'overlays'));

    // Create system metadata
    const metadata = {
      version: '0.1.0',
      initialized_at: new Date().toISOString(),
      status: 'empty',
    };
    await fs.writeJSON(path.join(pgcRoot, 'metadata.json'), metadata, {
      spaces: 2,
    });

    // Create .gitignore for PGC
    await fs.writeFile(
      path.join(pgcRoot, '.gitignore'),
      '# Ignore large object store\nobjects/\n# Ignore debug logs\ndebug-*.log\n# Keep structure\n!.gitkeep\n'
    );

    s.stop('PGC initialized successfully');

    outro(
      chalk.green(
        `✓ Created ${chalk.bold('.open_cognition/')} at ${options.path}`
      )
    );

    // Next steps guidance
    console.log('');
    console.log(chalk.cyan('Next steps:'));
    console.log(
      `  ${chalk.dim('$')} cognition genesis src/       ${chalk.dim('# Build code knowledge graph')}`
    );
    console.log(
      `  ${chalk.dim('$')} cognition genesis:docs VISION.md  ${chalk.dim('# Add mission documents')}`
    );
    console.log(
      `  ${chalk.dim('$')} cognition tui                ${chalk.dim('# Launch interactive interface')}`
    );
    console.log('');
  } catch (error) {
    s.stop('Initialization failed');
    throw error;
  }
}
