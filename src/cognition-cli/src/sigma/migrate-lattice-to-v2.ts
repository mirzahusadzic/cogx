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

export interface MigrationResult {
  totalFiles: number;
  successfulMigrations: number;
  failedMigrations: number;
  totalSizeBefore: number;
  totalSizeAfter: number;
  errors: Array<{ file: string; error: string }>;
}

/**
 * Migrate all lattice.json files in .sigma directory to v2 format.
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
      console.log('No lattice.json files found in .sigma directory');
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
          console.log(`✓ ${fileName}: Already v2 format, skipping`);
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
          console.log(
            `[DRY RUN] ${fileName}: ${formatBytes(stats.size)} → ${formatBytes(v2Size)} (${Math.round((1 - v2Size / stats.size) * 100)}% reduction)`
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
          console.log(
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
        console.error(`✗ ${fileName}: ${(error as Error).message}`);
      }
    }
  }

  return result;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
