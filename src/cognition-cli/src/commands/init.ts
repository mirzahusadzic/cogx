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
import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';

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
 * @throws Error if filesystem permissions insufficient or write fails
 * @example
 * await initCommand({ path: process.cwd() });
 */
export async function initCommand(options: { path: string }) {
  console.log(chalk.cyan('📦 PGC = Grounded Context Pool'));
  console.log(
    chalk.dim(
      '   Content-addressable knowledge storage with full audit trails\n'
    )
  );

  intro(chalk.bold('Initializing Grounded Context Pool'));

  const s = spinner();
  s.start('Creating PGC directory structure');

  const pgcRoot = path.join(options.path, '.open_cognition');

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
      '# Ignore large object store\nobjects/\n# Keep structure\n!.gitkeep\n'
    );

    s.stop('PGC initialized successfully');

    outro(
      chalk.green(
        `✓ Created ${chalk.bold('.open_cognition/')} at ${options.path}`
      )
    );
  } catch (error) {
    s.stop('Initialization failed');
    throw error;
  }
}
