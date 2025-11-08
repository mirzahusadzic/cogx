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

import { connect, Connection } from '@lancedb/lancedb';
import path from 'path';
import fs from 'fs-extra';

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
 * Compact LanceDB conversation storage.
 * Removes historical versions, keeping only the latest.
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
    console.log(`Before compaction:`);
    console.log(`  Size: ${formatBytes(sizeBefore)}`);
    console.log(`  Version files: ${versionsBefore}`);
  }

  if (dryRun) {
    if (verbose) {
      console.log('\n[DRY RUN] Would compact LanceDB...');
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
      console.log(`\nRead ${allRecords.length} records from LanceDB`);
    }

    // Deduplicate by turn ID (keep latest)
    const uniqueRecords = new Map();
    for (const record of allRecords) {
      const id = record.id as string;
      uniqueRecords.set(id, record);
    }

    if (verbose) {
      console.log(`Deduplicated to ${uniqueRecords.size} unique turns`);
    }

    // Drop and recreate table with deduplicated records
    await db.dropTable('conversation_turns');

    if (verbose) {
      console.log('Dropped old table');
    }

    // Recreate table with same schema
    const { createConversationTurnSchema } = await import(
      './conversation-lance-store.js'
    );
    const schema = createConversationTurnSchema();

    await db.createTable('conversation_turns', Array.from(uniqueRecords.values()), {
      schema,
      mode: 'create',
    });

    if (verbose) {
      console.log('✓ Table recreated with deduplicated data');
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
    console.log(`\nAfter compaction:`);
    console.log(`  Size: ${formatBytes(sizeAfter)}`);
    console.log(`  Version files: ${versionsAfter}`);
    console.log(`\nReduction:`);
    console.log(`  Versions removed: ${reduction.versions}`);
    console.log(`  Bytes saved: ${formatBytes(reduction.bytes)}`);
    console.log(`  Total reduction: ${reduction.percentage}%`);
  }

  return {
    before: { versions: versionsBefore, dataSize: sizeBefore },
    after: { versions: versionsAfter, dataSize: sizeAfter },
    reduction,
  };
}

/**
 * Get total size of directory recursively
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
 * Count version files in LanceDB
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
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
