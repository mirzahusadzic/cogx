/**
 * LanceDB Compaction Tool
 *
 * Compacts LanceDB conversation storage to remove historical versions.
 * Fixes the version bloat issue where 241 turns created 22,820 versions (700MB).
 *
 * PROBLEM:
 * - Old code used delete+add pattern, creating 2-3 versions per turn
 * - After 3 compression cycles: 22,820 versions for 241 turns
 * - 700MB storage for ~2MB of actual data
 *
 * SOLUTION:
 * - Compact LanceDB to keep only latest version of each turn
 * - Expected: 700MB → ~2MB (99% reduction)
 */

import { connect } from '@lancedb/lancedb';
import path from 'path';
import fs from 'fs-extra';
import { systemLog } from '../utils/debug-logger.js';

export interface CompactionResult {
  before: {
    versions: number;
    dataSize: number;
  };
  after: {
    versions: number;
    dataSize: number;
  };
  reduction: {
    versions: number;
    bytes: number;
    percentage: number;
  };
}

/**
 * Compact LanceDB conversation storage by removing historical versions
 *
 * Solves the version bloat problem where LanceDB creates multiple versions
 * per turn due to delete+add pattern during compression. This function
 * deduplicates the database to keep only the latest version of each turn.
 *
 * Problem: Old code used delete+add pattern, creating 2-3 versions per turn.
 * After 3 compression cycles: 22,820 versions for 241 turns = 700MB storage.
 *
 * Solution: Read all records, deduplicate by turn ID, drop table, recreate
 * with deduplicated data. Expected: 700MB → ~2MB (99% reduction).
 *
 * Algorithm:
 * 1. Measure size and version count before compaction
 * 2. Read all records from conversation_turns table
 * 3. Deduplicate by turn ID (keep latest version)
 * 4. Drop old table and recreate with deduplicated records
 * 5. Measure size and version count after compaction
 * 6. Return reduction metrics
 *
 * @param projectRoot - Path to project root containing .sigma directory
 * @param options - Compaction options (dryRun, verbose)
 * @param options.dryRun - If true, measure impact without modifying database
 * @param options.verbose - If true, log detailed progress information
 * @returns Promise resolving to compaction result with before/after metrics
 * @throws {Error} If LanceDB path not found
 *
 * @example
 * // Compact database and get metrics
 * const result = await compactConversationLanceDB('/path/to/project', {
 *   verbose: true
 * });
 * console.log(`Reduced ${result.reduction.percentage}%`);
 * console.log(`Saved ${formatBytes(result.reduction.bytes)}`);
 *
 * @example
 * // Dry run to see impact without changes
 * const result = await compactConversationLanceDB('/path/to/project', {
 *   dryRun: true,
 *   verbose: true
 * });
 */
export async function compactConversationLanceDB(
  projectRoot: string,
  options: {
    dryRun?: boolean;
    verbose?: boolean;
  } = {}
): Promise<CompactionResult> {
  const { dryRun = false, verbose = false } = options;

  const sigmaDir = path.join(projectRoot, '.sigma');
  const lanceDbPath = path.join(sigmaDir, 'conversations.lancedb');

  if (!(await fs.pathExists(lanceDbPath))) {
    throw new Error(`LanceDB not found at ${lanceDbPath}`);
  }

  // Get size before compaction
  const sizeBefore = await getDirectorySize(lanceDbPath);
  const versionsBefore = await countVersionFiles(lanceDbPath);

  if (verbose) {
    systemLog('sigma', 'Before compaction:');
    systemLog('sigma', `  Size: ${formatBytes(sizeBefore)}`);
    systemLog('sigma', `  Version files: ${versionsBefore}`);
  }

  if (dryRun) {
    if (verbose) {
      systemLog('sigma', '[DRY RUN] Would compact LanceDB...', {}, 'warn');
    }
    return {
      before: { versions: versionsBefore, dataSize: sizeBefore },
      after: { versions: versionsBefore, dataSize: sizeBefore },
      reduction: { versions: 0, bytes: 0, percentage: 0 },
    };
  }

  // Connect and compact
  const db = await connect(lanceDbPath);

  try {
    const table = await db.openTable('conversation_turns');

    // Get all unique records (latest version of each turn)
    const allRecords = await table.query().toArray();

    if (verbose) {
      systemLog('sigma', `Read ${allRecords.length} records from LanceDB`);
    }

    // Deduplicate by turn ID (keep latest)
    const uniqueRecords = new Map();
    for (const record of allRecords) {
      const id = record.id as string;
      // Clean the record - convert LanceDB Vector types to plain arrays
      const cleanedRecord = { ...record };
      if (
        cleanedRecord.embedding &&
        typeof cleanedRecord.embedding === 'object'
      ) {
        cleanedRecord.embedding = Array.from(
          cleanedRecord.embedding as ArrayLike<number>
        );
      }
      uniqueRecords.set(id, cleanedRecord);
    }

    if (verbose) {
      systemLog('sigma', `Deduplicated to ${uniqueRecords.size} unique turns`);
    }

    // Drop and recreate table with deduplicated records
    await db.dropTable('conversation_turns');

    if (verbose) {
      systemLog('sigma', 'Dropped old table');
    }

    // Recreate table with same schema
    const { createConversationTurnSchema } =
      await import('./conversation-lance-store.js');
    const schema = createConversationTurnSchema();

    await db.createTable(
      'conversation_turns',
      Array.from(uniqueRecords.values()),
      {
        schema,
        mode: 'create',
      }
    );

    if (verbose) {
      systemLog('sigma', 'Table recreated with deduplicated data');
    }
  } finally {
    // LanceDB doesn't require explicit close
  }

  // Get size after compaction
  const sizeAfter = await getDirectorySize(lanceDbPath);
  const versionsAfter = await countVersionFiles(lanceDbPath);

  const reduction = {
    versions: versionsBefore - versionsAfter,
    bytes: sizeBefore - sizeAfter,
    percentage: Math.round(((sizeBefore - sizeAfter) / sizeBefore) * 100),
  };

  if (verbose) {
    systemLog('sigma', '\nAfter compaction:');
    systemLog('sigma', `  Size: ${formatBytes(sizeAfter)}`);
    systemLog('sigma', `  Version files: ${versionsAfter}`);
    systemLog('sigma', '\nReduction:');
    systemLog('sigma', `  Versions removed: ${reduction.versions}`);
    systemLog('sigma', `  Bytes saved: ${formatBytes(reduction.bytes)}`);
    systemLog('sigma', `  Total reduction: ${reduction.percentage}%`);
  }

  return {
    before: { versions: versionsBefore, dataSize: sizeBefore },
    after: { versions: versionsAfter, dataSize: sizeAfter },
    reduction,
  };
}

/**
 * Calculate total size of directory recursively
 *
 * Traverses directory tree and sums file sizes to measure total disk usage.
 * Used to measure LanceDB storage size before and after compaction.
 *
 * @param dirPath - Path to directory to measure
 * @returns Promise resolving to total size in bytes
 * @private
 *
 * @example
 * const size = await getDirectorySize('.sigma/conversations.lancedb');
 * console.log(`Database size: ${size} bytes`);
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;

  const items = await fs.readdir(dirPath, { withFileTypes: true });

  for (const item of items) {
    const itemPath = path.join(dirPath, item.name);

    if (item.isDirectory()) {
      totalSize += await getDirectorySize(itemPath);
    } else {
      const stats = await fs.stat(itemPath);
      totalSize += stats.size;
    }
  }

  return totalSize;
}

/**
 * Count version files in LanceDB _versions directory
 *
 * LanceDB stores historical versions of data in _versions directory.
 * This count indicates version bloat - high count means many unnecessary
 * historical versions consuming disk space.
 *
 * @param lanceDbPath - Path to LanceDB database directory
 * @returns Promise resolving to number of version files
 * @private
 *
 * @example
 * const count = await countVersionFiles('.sigma/conversations.lancedb');
 * console.log(`Found ${count} version files`); // e.g., "Found 22,820 version files"
 */
async function countVersionFiles(lanceDbPath: string): Promise<number> {
  const versionsPath = path.join(
    lanceDbPath,
    'conversation_turns.lance',
    '_versions'
  );

  if (!(await fs.pathExists(versionsPath))) {
    return 0;
  }

  const files = await fs.readdir(versionsPath);
  return files.length;
}

/**
 * Format bytes to human-readable string with appropriate units
 *
 * Converts byte count to B, KB, MB, or GB with one decimal place.
 * Used for displaying file sizes in compaction results.
 *
 * @param bytes - Number of bytes to format
 * @returns Human-readable size string (e.g., "2.5MB", "700.0MB")
 * @private
 *
 * @example
 * formatBytes(1024) // "1.0KB"
 * formatBytes(1048576) // "1.0MB"
 * formatBytes(734003200) // "700.0MB"
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
