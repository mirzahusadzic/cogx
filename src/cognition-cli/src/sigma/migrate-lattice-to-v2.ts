/**
 * Migration Script: Lattice v1 → v2
 *
 * Strips embeddings from existing lattice.json files (v1 → v2 format).
 * Embeddings remain in LanceDB, JSON files become 90% smaller.
 *
 * BEFORE:
 * - 4.7MB lattice.json with full 768D embeddings
 * - Slow compression (2-3 minutes)
 * - 550MB .sigma directory
 *
 * AFTER:
 * - 50-100KB lattice.json (metadata only)
 * - Fast compression (<10 seconds)
 * - 50MB .sigma directory
 */

import fs from 'fs-extra';
import path from 'path';
import type { ConversationLattice, ConversationNode } from './types.js';
import { systemLog, debugError } from '../utils/debug-logger.js';

export interface MigrationResult {
  totalFiles: number;
  successfulMigrations: number;
  failedMigrations: number;
  totalSizeBefore: number;
  totalSizeAfter: number;
  errors: Array<{ file: string; error: string }>;
}

/**
 * Migrate all lattice.json files from v1 to v2 format
 *
 * Strips 768D embedding arrays from lattice JSON files, moving them to LanceDB
 * for fast semantic search. This reduces lattice file size by ~90% and speeds
 * up compression from minutes to seconds.
 *
 * Before (v1):
 * - 4.7MB lattice.json with full embeddings in every node
 * - Slow compression: 2-3 minutes to write/parse JSON
 * - 550MB .sigma directory size
 *
 * After (v2):
 * - 50-100KB lattice.json (metadata only)
 * - Fast compression: <10 seconds
 * - 50MB .sigma directory (10x reduction)
 *
 * Migration process:
 * 1. Find all *.lattice.json files in .sigma directory
 * 2. For each file:
 *    a. Check if already v2 (skip if yes)
 *    b. Strip embedding arrays from nodes
 *    c. Add format_version=2 and lancedb_metadata
 *    d. Backup original (if backup=true)
 *    e. Write v2 format
 *
 * Note: Embeddings remain in LanceDB - they are NOT lost, just moved to
 * a more efficient storage format for vector search.
 *
 * @param projectRoot - Path to project root containing .sigma directory
 * @param options - Migration options
 * @param options.dryRun - If true, calculate metrics without modifying files
 * @param options.verbose - If true, log detailed progress for each file
 * @param options.backup - If true, create .backup files (default: true)
 * @returns Promise resolving to migration result with metrics
 * @throws {Error} If .sigma directory not found
 *
 * @example
 * // Migrate all lattices with backup
 * const result = await migrateLatticeToV2('/path/to/project', {
 *   verbose: true
 * });
 * console.log(`Migrated ${result.successfulMigrations} files`);
 * console.log(`Size reduction: ${formatBytes(result.totalSizeBefore - result.totalSizeAfter)}`);
 *
 * @example
 * // Dry run to preview changes
 * const result = await migrateLatticeToV2('/path/to/project', {
 *   dryRun: true,
 *   verbose: true
 * });
 */
export async function migrateLatticeToV2(
  projectRoot: string,
  options: {
    dryRun?: boolean; // If true, don't actually modify files
    verbose?: boolean; // Log progress
    backup?: boolean; // Create .backup files before migration (default: true)
  } = {}
): Promise<MigrationResult> {
  const { dryRun = false, verbose = false, backup = true } = options;

  const sigmaDir = path.join(projectRoot, '.sigma');

  if (!(await fs.pathExists(sigmaDir))) {
    throw new Error(`.sigma directory not found at ${sigmaDir}`);
  }

  // Find all lattice.json files
  const files = await fs.readdir(sigmaDir);
  const latticeFiles = files.filter((f) => f.endsWith('.lattice.json'));

  if (latticeFiles.length === 0) {
    if (verbose) {
      systemLog(
        'sigma',
        'No lattice.json files found in .sigma directory',
        {},
        'warn'
      );
    }
    return {
      totalFiles: 0,
      successfulMigrations: 0,
      failedMigrations: 0,
      totalSizeBefore: 0,
      totalSizeAfter: 0,
      errors: [],
    };
  }

  const result: MigrationResult = {
    totalFiles: latticeFiles.length,
    successfulMigrations: 0,
    failedMigrations: 0,
    totalSizeBefore: 0,
    totalSizeAfter: 0,
    errors: [],
  };

  for (const fileName of latticeFiles) {
    const filePath = path.join(sigmaDir, fileName);

    try {
      // Read file
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);
      result.totalSizeBefore += stats.size;

      const lattice = JSON.parse(fileContent) as ConversationLattice & {
        format_version?: number;
        lancedb_metadata?: unknown;
      };

      // Check if already v2
      if (lattice.format_version === 2) {
        if (verbose) {
          systemLog('sigma', `✓ ${fileName}: Already v2 format, skipping`);
        }
        result.totalSizeAfter += stats.size;
        continue;
      }

      // Extract session_id from filename (e.g., "abc-123.lattice.json" → "abc-123")
      const sessionId = fileName.replace('.lattice.json', '');

      // Strip embeddings from nodes
      const nodesWithoutEmbeddings: Partial<ConversationNode>[] =
        lattice.nodes.map((node) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { embedding, ...nodeWithoutEmbedding } = node;
          return nodeWithoutEmbedding;
        });

      // Create v2 lattice
      const v2Lattice = {
        format_version: 2,
        lancedb_metadata: {
          storage_path: '.sigma/conversations.lancedb',
          session_id: sessionId,
        },
        ...lattice,
        nodes: nodesWithoutEmbeddings,
      };

      const v2Content = JSON.stringify(v2Lattice, null, 2);
      const v2Size = Buffer.byteLength(v2Content, 'utf-8');
      result.totalSizeAfter += v2Size;

      if (dryRun) {
        if (verbose) {
          systemLog(
            'sigma',
            `[DRY RUN] ${fileName}: ${formatBytes(stats.size)} → ${formatBytes(v2Size)} (${Math.round((1 - v2Size / stats.size) * 100)}% reduction)`,
            {},
            'info'
          );
        }
      } else {
        // Backup original file
        if (backup) {
          await fs.writeFile(`${filePath}.backup`, fileContent, 'utf-8');
        }

        // Write v2 file
        await fs.writeFile(filePath, v2Content, 'utf-8');

        if (verbose) {
          systemLog(
            'sigma',
            `✓ ${fileName}: ${formatBytes(stats.size)} → ${formatBytes(v2Size)} (${Math.round((1 - v2Size / stats.size) * 100)}% reduction)`
          );
        }
      }

      result.successfulMigrations++;
    } catch (error) {
      result.failedMigrations++;
      result.errors.push({
        file: fileName,
        error: (error as Error).message,
      });

      if (verbose) {
        debugError(`✗ ${fileName}: ${(error as Error).message}`, error);
      }
    }
  }

  return result;
}

/**
 * Format bytes to human-readable string with appropriate units
 *
 * Converts byte count to B, KB, or MB with one decimal place.
 * Used for displaying file size reductions in migration results.
 *
 * @param bytes - Number of bytes to format
 * @returns Human-readable size string (e.g., "4.7MB", "50.0KB")
 * @private
 *
 * @example
 * formatBytes(4915200) // "4.7MB"
 * formatBytes(51200) // "50.0KB"
 * formatBytes(500) // "500B"
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
