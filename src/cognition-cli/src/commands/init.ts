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
 * - metadata.json - System initialization metadata with version, timestamp, and source paths
 * - .gitignore - Excludes large objects/ directory from version control
 *
 * NEW: Auto-detection of source directories
 * - Scans project for code directories (src/, lib/, Python packages)
 * - Detects documentation (README.md, VISION.md, docs/)
 * - Stores paths in metadata.json for use by genesis and overlay commands
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
 * // Initialize PGC in current directory with auto-detection
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
import {
  intro,
  outro,
  spinner,
  confirm,
  multiselect,
  text,
} from '@clack/prompts';
import chalk from 'chalk';
import { isInteractive } from '../utils/terminal-capabilities.js';
import {
  detectSources,
  getSelectedPaths,
  type DetectionResult,
} from '../utils/source-detector.js';

/** Metadata schema with source paths */
export interface PGCMetadata {
  version: string;
  initialized_at: string;
  status: 'empty' | 'mining' | 'complete' | 'updating';
  sources?: {
    code: string[];
    docs: string[];
  };
  projectType?: DetectionResult['projectType'];
}

/**
 * Display detected sources to the user
 */
function displayDetectedSources(detected: DetectionResult): void {
  console.log('');
  console.log(chalk.cyan('Detected project structure:'));
  console.log('');

  if (detected.code.length > 0) {
    console.log(chalk.bold('  Code directories:'));
    for (const dir of detected.code) {
      const marker = dir.selected ? chalk.green('●') : chalk.dim('○');
      const lang = dir.language ? chalk.dim(` (${dir.language})`) : '';
      console.log(`    ${marker} ${dir.path}${lang} - ${dir.fileCount} files`);
    }
  } else {
    console.log(chalk.yellow('  No code directories detected'));
  }

  console.log('');

  if (detected.docs.length > 0) {
    console.log(chalk.bold('  Documentation:'));
    for (const doc of detected.docs) {
      const marker = doc.selected ? chalk.green('●') : chalk.dim('○');
      console.log(`    ${marker} ${doc.path}`);
    }
  } else {
    console.log(chalk.dim('  No documentation detected'));
  }

  console.log('');
}

/**
 * Initializes the PGC directory structure at the specified path.
 *
 * Creates the complete four-pillar architecture:
 * 1. Creates .open_cognition root directory
 * 2. Sets up objects/, transforms/, index/, reverse_deps/, overlays/ subdirectories
 * 3. Initializes metadata.json with version, timestamp, and detected source paths
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
  console.log(chalk.cyan('PGC = Grounded Context Pool'));
  console.log(
    chalk.dim(
      '   Content-addressable knowledge storage with full audit trails\n'
    )
  );

  const pgcRoot = path.join(options.path, '.open_cognition');

  // Auto-detect sources
  const s = spinner();
  s.start('Detecting project structure...');
  const detected = await detectSources(options.path);
  s.stop('Detection complete');

  // Display what was found
  displayDetectedSources(detected);

  // Get initial selected paths
  const selectedPaths = getSelectedPaths(detected);

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

    if (selectedPaths.code.length > 0 || selectedPaths.docs.length > 0) {
      console.log('Would store in metadata.json:');
      console.log(`  sources.code: ${JSON.stringify(selectedPaths.code)}`);
      console.log(`  sources.docs: ${JSON.stringify(selectedPaths.docs)}`);
      console.log('');
    }

    // Check if directory already exists
    if (await fs.pathExists(pgcRoot)) {
      console.log(chalk.yellow('Warning: .open_cognition/ already exists'));
      console.log(
        chalk.dim('   Running without --dry-run will update existing structure')
      );
    }
    return;
  }

  // Interactive mode - allow user to confirm or edit selections
  if (isInteractive() && !options.force) {
    // Check if there are detected sources to confirm
    if (detected.code.length > 0 || detected.docs.length > 0) {
      const action = await confirm({
        message: 'Use detected paths? (No to edit)',
        initialValue: true,
      });

      if (action === Symbol.for('cancel')) {
        console.log(chalk.dim('Operation cancelled'));
        return;
      }

      // User wants to edit
      if (!action && detected.code.length > 0) {
        const codeSelection = await multiselect({
          message: 'Select code directories to analyze:',
          options: detected.code.map((d) => ({
            value: d.path,
            label: `${d.path} (${d.fileCount} ${d.language || ''} files)`,
            hint: d.selected ? 'recommended' : undefined,
          })),
          initialValues: detected.code
            .filter((d) => d.selected)
            .map((d) => d.path),
        });

        if (Array.isArray(codeSelection)) {
          selectedPaths.code = codeSelection;
        }
      }

      if (!action && detected.docs.length > 0) {
        const docsSelection = await multiselect({
          message: 'Select documentation to include (optional):',
          options: detected.docs.map((d) => ({
            value: d.path,
            label: d.path,
            hint: d.selected ? 'recommended' : undefined,
          })),
          initialValues: detected.docs
            .filter((d) => d.selected)
            .map((d) => d.path),
          required: false, // Allow skipping docs for new repos without strategic docs
        });

        if (Array.isArray(docsSelection)) {
          selectedPaths.docs = docsSelection;
        }
      }
    } else {
      // Nothing detected - prompt for manual entry
      console.log(chalk.yellow('No source directories auto-detected.'));
      console.log(
        chalk.dim(
          'Supported: TypeScript (.ts, .tsx), JavaScript (.js, .jsx), Python (.py)\n'
        )
      );

      const manualCode = await text({
        message: 'Enter code directories (comma-separated, or leave empty):',
        placeholder: 'src/, lib/',
      });

      if (typeof manualCode === 'string' && manualCode.trim()) {
        selectedPaths.code = manualCode
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }

      const manualDocs = await text({
        message: 'Enter documentation paths (comma-separated, or leave empty):',
        placeholder: 'README.md, docs/',
      });

      if (typeof manualDocs === 'string' && manualDocs.trim()) {
        selectedPaths.docs = manualDocs
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
  }

  // Check if directory already exists and prompt for confirmation
  if ((await fs.pathExists(pgcRoot)) && !options.force) {
    console.log(
      chalk.yellow('Warning: .open_cognition/ already exists at this location')
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

  const initSpinner = spinner();
  initSpinner.start('Creating PGC directory structure');

  try {
    // Create the four pillars
    await fs.ensureDir(path.join(pgcRoot, 'objects'));
    await fs.ensureDir(path.join(pgcRoot, 'transforms'));
    await fs.ensureDir(path.join(pgcRoot, 'index'));
    await fs.ensureDir(path.join(pgcRoot, 'reverse_deps'));
    await fs.ensureDir(path.join(pgcRoot, 'overlays'));

    // Create system metadata with source paths
    const metadata: PGCMetadata = {
      version: '0.1.0',
      initialized_at: new Date().toISOString(),
      status: 'empty',
      sources: {
        code: selectedPaths.code,
        docs: selectedPaths.docs,
      },
      projectType: detected.projectType,
    };
    await fs.writeJSON(path.join(pgcRoot, 'metadata.json'), metadata, {
      spaces: 2,
    });

    // Create .gitignore for PGC
    await fs.writeFile(
      path.join(pgcRoot, '.gitignore'),
      '# Ignore large object store\nobjects/\n# Ignore debug logs\ndebug-*.log\n# Keep structure\n!.gitkeep\n'
    );

    initSpinner.stop('PGC initialized successfully');

    outro(
      chalk.green(
        `Created ${chalk.bold('.open_cognition/')} at ${options.path}`
      )
    );

    // Show stored configuration
    if (selectedPaths.code.length > 0 || selectedPaths.docs.length > 0) {
      console.log('');
      console.log(chalk.dim('Stored in metadata.json:'));
      if (selectedPaths.code.length > 0) {
        console.log(chalk.dim(`  Code: ${selectedPaths.code.join(', ')}`));
      }
      if (selectedPaths.docs.length > 0) {
        console.log(chalk.dim(`  Docs: ${selectedPaths.docs.join(', ')}`));
      }
    }

    // Next steps guidance
    console.log('');
    console.log(chalk.cyan('Next steps:'));
    console.log(
      `  ${chalk.dim('$')} cognition genesis          ${chalk.dim('# Build code knowledge graph')}`
    );
    console.log(
      `  ${chalk.dim('$')} cognition genesis:docs     ${chalk.dim('# Add mission documents')}`
    );
    console.log(
      `  ${chalk.dim('$')} cognition tui              ${chalk.dim('# Launch interactive interface')}`
    );
    console.log('');
  } catch (error) {
    initSpinner.stop('Initialization failed');
    throw error;
  }
}

/**
 * Programmatic init for TUI wizard
 *
 * Creates .open_cognition directory structure without interactive prompts.
 * Used by TUI onboarding wizard which handles source selection separately.
 *
 * @param projectRoot - Root directory of the project
 * @param sourceDirs - Selected source directories to include
 * @returns Promise resolving to success boolean
 */
export async function initWorkspaceProgrammatic(
  projectRoot: string,
  sourceDirs: string[]
): Promise<{ success: boolean; error?: string }> {
  const pgcRoot = path.join(projectRoot, '.open_cognition');

  try {
    // Create the four pillars
    await fs.ensureDir(path.join(pgcRoot, 'objects'));
    await fs.ensureDir(path.join(pgcRoot, 'transforms'));
    await fs.ensureDir(path.join(pgcRoot, 'index'));
    await fs.ensureDir(path.join(pgcRoot, 'reverse_deps'));
    await fs.ensureDir(path.join(pgcRoot, 'overlays'));

    // Create system metadata with source paths (no docs - will be added via /onboard-project)
    const metadata: PGCMetadata = {
      version: '0.1.0',
      initialized_at: new Date().toISOString(),
      status: 'empty',
      sources: {
        code: sourceDirs,
        docs: [], // Docs will be generated via LLM co-creation, not auto-detected
      },
    };
    await fs.writeJSON(path.join(pgcRoot, 'metadata.json'), metadata, {
      spaces: 2,
    });

    // Create .gitignore for PGC
    await fs.writeFile(
      path.join(pgcRoot, '.gitignore'),
      '# Ignore large object store\nobjects/\n# Ignore debug logs\ndebug-*.log\n# Keep structure\n!.gitkeep\n'
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
