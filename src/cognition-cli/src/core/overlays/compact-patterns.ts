/**
 * Patterns LanceDB Compaction Tool
 *
 * Compacts patterns.lancedb to remove duplicate embeddings.
 * Fixes the bloat issue where 2,061 duplicate embeddings created 275MB+ storage.
 *
 * PROBLEM:
 * - Re-ingesting overlays with --force creates duplicate embeddings
 * - storeVector checks for duplicates by ID, but deletes create new versions
 * - Result: 2,061 files for ~50-100 unique patterns
 *
 * SOLUTION:
 * - Drop and recreate each table with only unique patterns (by symbol)
 * - Keep the most recent version of each pattern
 */

import { connect } from '@lancedb/lancedb';
import path from 'path';
import fs from 'fs-extra';

export interface PatternCompactionResult {
  tableName: string;
  before: {
    records: number;
    dataSize: number;
  };
  after: {
    records: number;
    dataSize: number;
  };
  reduction: {
    records: number;
    bytes: number;
    percentage: number;
  };
}

/**
 * Compact a single patterns table (e.g., structural_patterns, security_guidelines)
 */
export async function compactPatternsTable(
  pgcRoot: string,
  tableName: string,
  options: {
    dryRun?: boolean;
    verbose?: boolean;
  } = {}
): Promise<PatternCompactionResult> {
  const { dryRun = false, verbose = false } = options;

  const patternsDbPath = path.join(pgcRoot, 'patterns.lancedb');

  if (!(await fs.pathExists(patternsDbPath))) {
    throw new Error(`Patterns LanceDB not found at ${patternsDbPath}`);
  }

  // Get size before compaction
  const tablePath = path.join(patternsDbPath, `${tableName}.lance`);
  const sizeBefore = (await fs.pathExists(tablePath))
    ? await getDirectorySize(tablePath)
    : 0;

  if (verbose) {
    console.log(`\n[${tableName}]`);
    console.log(`  Before: ${formatBytes(sizeBefore)}`);
  }

  if (dryRun) {
    return {
      tableName,
      before: { records: 0, dataSize: sizeBefore },
      after: { records: 0, dataSize: sizeBefore },
      reduction: { records: 0, bytes: 0, percentage: 0 },
    };
  }

  // Connect and compact
  const db = await connect(patternsDbPath);

  try {
    // Check if table exists
    const tableNames = await db.tableNames();
    if (!tableNames.includes(tableName)) {
      if (verbose) {
        console.log(`  Table does not exist, skipping`);
      }
      return {
        tableName,
        before: { records: 0, dataSize: 0 },
        after: { records: 0, dataSize: 0 },
        reduction: { records: 0, bytes: 0, percentage: 0 },
      };
    }

    const table = await db.openTable(tableName);

    // Get all records
    const allRecords = await table.query().toArray();
    const recordsBefore = allRecords.length;

    if (verbose) {
      console.log(`  Records: ${recordsBefore}`);
    }

    // Deduplicate by symbol (keep the most recent by computed_at)
    const uniqueRecords = new Map();
    for (const record of allRecords) {
      const symbol = record.symbol as string;

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

      if (!uniqueRecords.has(symbol)) {
        uniqueRecords.set(symbol, cleanedRecord);
      } else {
        // Keep the most recent version
        const existing = uniqueRecords.get(symbol);
        const existingTime = new Date(existing.computed_at as string).getTime();
        const currentTime = new Date(record.computed_at as string).getTime();

        if (currentTime > existingTime) {
          uniqueRecords.set(symbol, cleanedRecord);
        }
      }
    }

    const recordsAfter = uniqueRecords.size;

    if (verbose) {
      console.log(`  Unique patterns: ${recordsAfter}`);
      console.log(`  Duplicates removed: ${recordsBefore - recordsAfter}`);
    }

    // Drop and recreate table
    await db.dropTable(tableName);

    if (uniqueRecords.size > 0) {
      // Import the appropriate schema
      const { LanceVectorStore } = await import('./vector-db/lance-store.js');
      const store = new LanceVectorStore(pgcRoot);
      await store.initialize(tableName);
      await store.close();

      // The table is now created with the schema, add the unique records
      const newTable = await db.openTable(tableName);
      const recordsArray = Array.from(uniqueRecords.values());

      // Add records in batches to avoid memory issues
      const batchSize = 100;
      for (let i = 0; i < recordsArray.length; i += batchSize) {
        const batch = recordsArray.slice(i, i + batchSize);
        await newTable.add(batch);
      }
    }

    // Get size after compaction
    const sizeAfter = (await fs.pathExists(tablePath))
      ? await getDirectorySize(tablePath)
      : 0;

    const reduction = {
      records: recordsBefore - recordsAfter,
      bytes: sizeBefore - sizeAfter,
      percentage:
        sizeBefore > 0
          ? Math.round(((sizeBefore - sizeAfter) / sizeBefore) * 100)
          : 0,
    };

    if (verbose) {
      console.log(`  After: ${formatBytes(sizeAfter)}`);
      console.log(`  Reduction: ${reduction.percentage}%`);
    }

    return {
      tableName,
      before: { records: recordsBefore, dataSize: sizeBefore },
      after: { records: recordsAfter, dataSize: sizeAfter },
      reduction,
    };
  } finally {
    await db.close();
  }
}

/**
 * Compact all patterns tables
 */
export async function compactAllPatternsTables(
  pgcRoot: string,
  options: {
    dryRun?: boolean;
    verbose?: boolean;
  } = {}
): Promise<PatternCompactionResult[]> {
  const { verbose = false } = options;

  const patternsDbPath = path.join(pgcRoot, 'patterns.lancedb');

  if (!(await fs.pathExists(patternsDbPath))) {
    throw new Error(`Patterns LanceDB not found at ${patternsDbPath}`);
  }

  // Get all table names
  const db = await connect(patternsDbPath);
  const tableNames = await db.tableNames();
  await db.close();

  if (verbose) {
    console.log(`Found ${tableNames.length} pattern tables`);
  }

  const results: PatternCompactionResult[] = [];

  for (const tableName of tableNames) {
    const result = await compactPatternsTable(pgcRoot, tableName, options);
    results.push(result);
  }

  return results;
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
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
