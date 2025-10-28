import { intro, outro, spinner, log } from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { GenesisDocTransform } from '../core/transforms/genesis-doc-transform.js';

/**
 * Represents options for the genesis-docs command.
 */
interface GenesisDocsOptions {
  projectRoot: string;
  pattern?: string;
}

/**
 * Represents errors during PGC initialization validation.
 */
class PGCInitializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PGCInitializationError';
  }
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
}

/**
 * Ingests markdown documentation files into the PGC.
 */
export async function genesisDocsCommand(
  pathOrPattern: string,
  options: GenesisDocsOptions
) {
  intro(chalk.bold('Genesis Docs: Ingesting Documentation into PGC'));

  let s: ReturnType<typeof spinner> | undefined;

  try {
    s = spinner();

    // Validate PGC initialization
    s.start('Validating PGC initialization');
    await validatePgcInitialized(options.projectRoot);
    s.stop('PGC validated');

    // Initialize transform
    const pgcRoot = path.join(options.projectRoot, '.open_cognition');
    const transform = new GenesisDocTransform(pgcRoot);

    // Find markdown files
    s.start('Finding markdown files');
    const files = await findMarkdownFiles(pathOrPattern);
    s.stop(`Found ${files.length} markdown file(s)`);

    if (files.length === 0) {
      log.warn('No markdown files found');
      outro(chalk.yellow('No files to process'));
      return;
    }

    // Process each file
    const results = [];
    for (const file of files) {
      s = spinner();
      s.start(`Processing ${path.basename(file)}`);

      try {
        const result = await transform.execute(file);
        s.stop(
          `✓ ${path.basename(file)} → ${result.outputHash.substring(0, 12)}...`
        );
        results.push({ file, result, success: true });
      } catch (error) {
        s.stop(`✗ ${path.basename(file)} failed`);
        log.error(chalk.red((error as Error).message));
        results.push({ file, error, success: false });
      }
    }

    // Summary
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    log.info('');
    log.info(chalk.bold('Summary:'));
    log.info(`  ${chalk.green(`✓ ${successCount} file(s) ingested`)}`);
    if (failCount > 0) {
      log.info(`  ${chalk.red(`✗ ${failCount} file(s) failed`)}`);
    }

    outro(
      chalk.green(
        `✓ Genesis docs complete - ${successCount} document(s) in PGC`
      )
    );
  } catch (error) {
    if (s) {
      s.stop('Genesis docs failed');
    }
    if (error instanceof PGCInitializationError) {
      log.error(chalk.red(error.message));
    } else {
      log.error(chalk.red((error as Error).message));
    }
    throw error;
  }
}

/**
 * Find markdown files matching the pattern
 */
async function findMarkdownFiles(pathOrPattern: string): Promise<string[]> {
  const stats = await fs.stat(pathOrPattern);

  if (stats.isFile()) {
    // Single file
    if (!pathOrPattern.endsWith('.md')) {
      throw new Error(`Not a markdown file: ${pathOrPattern}`);
    }
    return [path.resolve(pathOrPattern)];
  } else if (stats.isDirectory()) {
    // Directory - find all .md files recursively
    const files: string[] = [];
    await findMarkdownFilesRecursive(pathOrPattern, files);
    return files;
  } else {
    throw new Error(`Invalid path: ${pathOrPattern}`);
  }
}

/**
 * Recursively find markdown files in a directory
 */
async function findMarkdownFilesRecursive(
  dir: string,
  results: string[]
): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Skip node_modules and hidden directories
    if (
      entry.name === 'node_modules' ||
      entry.name === '.git' ||
      entry.name.startsWith('.')
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      await findMarkdownFilesRecursive(fullPath, results);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
}
