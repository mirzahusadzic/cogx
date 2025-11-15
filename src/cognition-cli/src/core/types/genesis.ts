/**
 * Genesis Checkpoint Types
 *
 * Types for incremental indexing state management during Genesis initialization.
 *
 * DESIGN:
 * Genesis is the initial indexing process that populates the Grounded Context Pool (PGC)
 * from source code. Large codebases can take hours to fully index, so the system
 * maintains checkpoints to enable:
 * - Resume after interruption
 * - Progress tracking during long-running indexing
 * - Incremental updates (only process changed files)
 *
 * The checkpoint captures which files have been processed and when, allowing the
 * next Genesis run to skip already-indexed files if their content hasn't changed.
 *
 * @example
 * // Save checkpoint after processing batch of files
 * const checkpoint: GenesisCheckpoint = {
 *   processedFiles: [
 *     '/src/auth/handler.ts',
 *     '/src/auth/middleware.ts',
 *     '/src/database/connection.ts'
 *   ],
 *   lastProcessedFile: '/src/database/connection.ts',
 *   timestamp: new Date()
 * };
 * await saveCheckpoint(checkpoint);
 *
 * @example
 * // Resume Genesis from last checkpoint
 * const checkpoint = await loadCheckpoint();
 * const remainingFiles = allFiles.filter(
 *   file => !checkpoint.processedFiles.includes(file)
 * );
 * console.log(`Resuming from ${checkpoint.lastProcessedFile}`);
 * console.log(`${remainingFiles.length} files remaining`);
 */

/**
 * Snapshot of Genesis processing state for incremental updates.
 *
 * Checkpoints are persisted to disk and loaded on startup to enable
 * resume functionality and incremental indexing.
 *
 * The checkpoint file is typically stored in .pgc/genesis-checkpoint.json
 * and updated after each batch of files is processed.
 */
export interface GenesisCheckpoint {
  /** List of file paths that have been successfully processed */
  processedFiles: string[];
  /** The last file that was processed (for resume debugging) */
  lastProcessedFile?: string;
  /** When this checkpoint was created */
  timestamp: Date;
}
