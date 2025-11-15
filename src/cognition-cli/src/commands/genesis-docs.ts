/**
 * Genesis Documentation Ingestion Command
 *
 * Ingests Markdown documentation files into the Grounded Context Pool (PGC) to enable
 * mission-driven overlay generation. Documentation serves as the strategic foundation
 * for overlays O4 (mission_concepts) and O7 (strategic_coherence).
 *
 * WORKFLOW:
 * 1. Validate PGC initialization (.open_cognition/ exists)
 * 2. Find Markdown files (single file or directory recursion)
 * 3. For each Markdown file:
 *    a. Calculate content hash (SHA-256)
 *    b. Check if document already exists (by content hash)
 *    c. Skip if exists (unless --force flag provided)
 *    d. Execute GenesisDocTransform to:
 *       - Store document in PGC objects/
 *       - Create index entry in index/docs/
 *       - Generate overlay metadata
 *
 * CONTENT HASHING:
 * Documents are deduplicated by content hash to prevent redundant storage:
 * - SHA-256 hash calculated from raw Markdown content
 * - Index lookup by content hash to detect existing documents
 * - --force flag bypasses deduplication and re-ingests
 *
 * OVERLAY INTEGRATION:
 * Ingested documents enable downstream overlay generation:
 * - O₄ (mission_concepts): Extracts strategic concepts from documentation
 * - O₇ (strategic_coherence): Analyzes mission-code alignment
 *
 * DESIGN:
 * The genesis-docs command is idempotent:
 * - Running multiple times on the same docs is safe
 * - Only new or modified documents are ingested
 * - --force flag allows re-ingestion for debugging
 *
 * @example
 * // Ingest single Markdown file
 * cognition-cli genesis:docs docs/VISION.md
 * // → Stores VISION.md in PGC, creates index entry
 *
 * @example
 * // Ingest entire directory
 * cognition-cli genesis:docs docs/strategic/
 * // → Recursively ingests all .md files
 *
 * @example
 * // Force re-ingestion (replace existing)
 * cognition-cli genesis:docs docs/VISION.md --force
 * // → Deletes old VISION.md entry, ingests fresh copy
 */

import { intro, outro, spinner, log } from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { createHash } from 'crypto';
import { GenesisDocTransform } from '../core/transforms/genesis-doc-transform.js';

/**
 * Options for the genesis-docs command
 */
interface GenesisDocsOptions {
  /** Root directory of the project containing .open_cognition */
  projectRoot: string;
  /** Glob pattern for finding Markdown files (not currently used) */
  pattern?: string;
  /** Force re-ingestion of existing documents */
  force?: boolean;
}

/**
 * Error thrown when PGC is not initialized
 */
class PGCInitializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PGCInitializationError';
  }
}

/**
 * Validates that PGC has been initialized in the project
 *
 * Checks for the existence of .open_cognition/ directory and metadata.json file.
 * Throws PGCInitializationError if either is missing.
 *
 * @param projectRoot - Root directory of the project
 * @throws {PGCInitializationError} If PGC not initialized or metadata missing
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
}

/**
 * Ingests markdown documentation files into the PGC
 *
 * Orchestrates the complete documentation ingestion workflow including file
 * discovery, deduplication, transformation, and index management.
 *
 * WORKFLOW:
 * 1. Increase max listeners to prevent warnings during batch processing
 * 2. Validate PGC initialization
 * 3. Initialize GenesisDocTransform with workbench URL
 * 4. Find Markdown files (single file or directory)
 * 5. For each file:
 *    a. Calculate content hash
 *    b. Check for existing document
 *    c. Skip or re-ingest based on --force flag
 *    d. Execute transformation
 * 6. Report summary statistics
 * 7. Restore original max listeners
 *
 * @param pathOrPattern - Path to Markdown file or directory
 * @param options - Genesis docs command options
 *
 * @example
 * // Ingest single file
 * await genesisDocsCommand('docs/VISION.md', { projectRoot: '/path/to/project' });
 *
 * @example
 * // Force re-ingestion
 * await genesisDocsCommand('docs/VISION.md', {
 *   projectRoot: '/path/to/project',
 *   force: true
 * });
 */
export async function genesisDocsCommand(
  pathOrPattern: string,
  options: GenesisDocsOptions
) {
  intro(chalk.bold('Genesis Docs: Ingesting Documentation into PGC'));

  // Increase max listeners to avoid warnings during batch document processing
  // (Each GenesisDocTransform creates multiple overlay managers that may register signal handlers)
  const originalMaxListeners = process.getMaxListeners();
  process.setMaxListeners(50);

  let s: ReturnType<typeof spinner> | undefined;

  try {
    s = spinner();

    // Validate PGC initialization
    s.start('Validating PGC initialization');
    await validatePgcInitialized(options.projectRoot);
    s.stop('PGC validated');

    // Initialize transform with workbench URL for overlay generation
    const pgcRoot = path.join(options.projectRoot, '.open_cognition');
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
    const transform = new GenesisDocTransform(pgcRoot, workbenchUrl);

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
        // Check if document already exists by content hash
        const content = await fs.readFile(file, 'utf-8');
        const contentHash = createHash('sha256').update(content).digest('hex');

        const existingHash = await findExistingDocumentHash(
          pgcRoot,
          contentHash
        );

        // Debug logging
        if (process.env.DEBUG) {
          console.log(
            `[DEBUG] ${path.basename(file)}: contentHash=${contentHash.substring(0, 12)}, existingHash=${existingHash?.substring(0, 12) || 'null'}, force=${options.force}`
          );
        }

        if (existingHash) {
          if (options.force) {
            // Force re-ingestion: delete existing document first
            await deleteExistingDocument(pgcRoot, contentHash, existingHash);
            s.message(
              `Removed existing ${path.basename(file)} → ${contentHash.substring(0, 12)}...`
            );
          } else {
            // Skip if already exists and not forcing
            s.stop(
              chalk.dim(
                `⊘ ${path.basename(file)} → ${contentHash.substring(0, 12)}... (already exists, skipped)`
              )
            );
            results.push({ file, skipped: true, success: true });
            continue;
          }
        }

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
    const successCount = results.filter((r) => r.success && !r.skipped).length;
    const skippedCount = results.filter((r) => r.skipped).length;
    const failCount = results.filter((r) => !r.success).length;

    log.info('');
    log.info(chalk.bold('Summary:'));
    log.info(`  ${chalk.green(`✓ ${successCount} file(s) ingested`)}`);
    if (skippedCount > 0) {
      log.info(
        `  ${chalk.dim(`⊘ ${skippedCount} file(s) skipped (already exist)`)}`
      );
    }
    if (failCount > 0) {
      log.info(`  ${chalk.red(`✗ ${failCount} file(s) failed`)}`);
    }

    outro(
      chalk.green(
        `✓ Genesis docs complete - ${successCount} new, ${skippedCount} skipped, ${results.length - failCount} total in PGC`
      )
    );

    // Restore original max listeners
    process.setMaxListeners(originalMaxListeners);
  } catch (error) {
    // Restore original max listeners on error too
    process.setMaxListeners(originalMaxListeners);
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
 *
 * Determines if the path is a file or directory and returns appropriate
 * Markdown file list. For directories, recursively finds all .md files.
 *
 * @param pathOrPattern - Path to file or directory
 * @returns Array of absolute paths to Markdown files
 * @throws {Error} If path is not a file or directory, or file is not .md
 *
 * @example
 * const files = await findMarkdownFiles('docs/VISION.md');
 * // → ['/absolute/path/to/docs/VISION.md']
 *
 * @example
 * const files = await findMarkdownFiles('docs/');
 * // → ['/absolute/path/to/docs/VISION.md', '/absolute/path/to/docs/MISSION.md', ...]
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
 *
 * Traverses directory tree and collects all .md files. Skips node_modules,
 * .git, and hidden directories for performance.
 *
 * @param dir - Directory to search
 * @param results - Array to accumulate file paths (mutated in-place)
 *
 * @example
 * const results: string[] = [];
 * await findMarkdownFilesRecursive('docs/', results);
 * // results → ['/abs/path/docs/VISION.md', '/abs/path/docs/guide/setup.md', ...]
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

/**
 * Check if a document with this content hash already exists in the PGC
 *
 * Searches the index/docs/ directory for an index entry matching the given
 * content hash. This enables deduplication of documents.
 *
 * @param pgcRoot - Path to .open_cognition directory
 * @param contentHash - SHA-256 hash of document content
 * @returns Object hash if document exists, null otherwise
 *
 * @example
 * const existingHash = await findExistingDocumentHash(pgcRoot, contentHash);
 * if (existingHash) {
 *   console.log('Document already ingested');
 * }
 */
async function findExistingDocumentHash(
  pgcRoot: string,
  contentHash: string
): Promise<string | null> {
  const indexDir = path.join(pgcRoot, 'index', 'docs');

  if (!(await fs.pathExists(indexDir))) {
    return null;
  }

  const indexFiles = await fs.readdir(indexDir);

  for (const indexFile of indexFiles) {
    if (!indexFile.endsWith('.json')) {
      continue;
    }

    const indexPath = path.join(indexDir, indexFile);
    try {
      const indexEntry = await fs.readJSON(indexPath);
      if (indexEntry.contentHash === contentHash) {
        return indexEntry.objectHash;
      }
    } catch (error) {
      // Skip invalid index files
      continue;
    }
  }

  return null;
}

/**
 * Delete an existing document from the PGC
 *
 * Removes all traces of a document including:
 * - Index entry (index/docs/HASH.json)
 * - Overlay YAML files (overlays/OVERLAY/OBJECT_HASH.yaml pattern)
 * - LanceDB embeddings (lance/documents.lancedb)
 *
 * This enables --force re-ingestion by cleaning up the old document first.
 *
 * @param pgcRoot - Path to .open_cognition directory
 * @param contentHash - SHA-256 hash of document content
 * @param objectHash - Object hash (used in overlay filenames)
 *
 * @example
 * await deleteExistingDocument(pgcRoot, contentHash, objectHash);
 * // → Removes all traces of document from PGC
 */
async function deleteExistingDocument(
  pgcRoot: string,
  contentHash: string,
  objectHash: string
): Promise<void> {
  const indexDir = path.join(pgcRoot, 'index', 'docs');
  const overlaysDir = path.join(pgcRoot, 'overlays');

  // Delete index entry
  const indexFiles = await fs.readdir(indexDir);
  for (const indexFile of indexFiles) {
    if (!indexFile.endsWith('.json')) {
      continue;
    }

    const indexPath = path.join(indexDir, indexFile);
    try {
      const indexEntry = await fs.readJSON(indexPath);
      if (indexEntry.contentHash === contentHash) {
        await fs.remove(indexPath);
        break;
      }
    } catch (error) {
      // Skip invalid index files
      continue;
    }
  }

  // Delete overlay entries with matching document_hash
  if (await fs.pathExists(overlaysDir)) {
    const overlayTypes = await fs.readdir(overlaysDir);

    for (const overlayType of overlayTypes) {
      const overlayDir = path.join(overlaysDir, overlayType);
      const stat = await fs.stat(overlayDir);

      if (!stat.isDirectory()) {
        continue;
      }

      const overlayFiles = await fs.readdir(overlayDir);

      for (const overlayFile of overlayFiles) {
        if (!overlayFile.endsWith('.yaml')) {
          continue;
        }

        const overlayPath = path.join(overlayDir, overlayFile);

        // Check if this overlay file is for our document
        // The objectHash is the document hash used in overlays
        if (overlayFile.startsWith(objectHash)) {
          await fs.remove(overlayPath);
        }
      }
    }
  }

  // Delete LanceDB embeddings with matching document_hash
  try {
    const { DocumentLanceStore } = await import(
      '../core/pgc/document-lance-store.js'
    );
    const lanceStore = new DocumentLanceStore(pgcRoot);
    await lanceStore.initialize();

    // Delete concepts for all overlay types that might have this document
    const overlayTypes = ['O2', 'O4', 'O5', 'O6'];
    for (const overlayType of overlayTypes) {
      await lanceStore.deleteDocumentConcepts(overlayType, objectHash);
    }

    await lanceStore.close();
  } catch (error) {
    // LanceDB might not be initialized yet, skip silently
    console.warn(
      `Warning: Could not delete LanceDB embeddings for ${objectHash}:`,
      (error as Error).message
    );
  }
}
