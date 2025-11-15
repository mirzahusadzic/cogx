/**
 * File Watcher and Dirty State Tracking
 *
 * Types for the incremental reindexing system that tracks file changes
 * and maintains dirty state between index operations.
 *
 * DESIGN:
 * The watcher system enables incremental updates to the Grounded Context Pool (PGC):
 * - ChangeEvent: Real-time file system events (added, modified, deleted)
 * - DirtyFile: Tracked files whose content hash differs from indexed version
 * - UntrackedFile: New files discovered but not yet ingested
 * - DirtyState: Persistent snapshot of all pending changes
 *
 * This architecture supports:
 * 1. Continuous monitoring during development
 * 2. Batch reindexing of only changed files
 * 3. Verification that PGC matches source truth
 *
 * The system uses content hashing to detect changes, avoiding false positives
 * from timestamp updates alone.
 *
 * @example
 * // Configure watcher for TypeScript files only
 * const options: WatcherOptions = {
 *   paths: ['src/**\/*.ts'],
 *   ignored: ['**\/*.test.ts', 'node_modules/**'],
 *   watchUntracked: true,
 *   debounceMs: 500
 * };
 *
 * @example
 * // Handle file changes with incremental reindex
 * const handlers: WatcherEventHandlers = {
 *   onChange: async (event) => {
 *     console.log(`File ${event.type}: ${event.path}`);
 *     if (event.type === 'modified') {
 *       await reindexFile(event.path);
 *     }
 *   },
 *   onError: (error) => console.error('Watcher error:', error),
 *   onReady: () => console.log('Watching for changes...')
 * };
 *
 * @example
 * // Check dirty state before committing
 * const state = await getDirtyState();
 * if (state.dirty_files.length > 0) {
 *   console.warn(`${state.dirty_files.length} files changed since last index`);
 *   await reindexDirtyFiles(state.dirty_files);
 * }
 */

import { z } from 'zod';

/**
 * Zod schema for validating file change events.
 *
 * Enforces runtime validation when deserializing watcher events
 * from file system APIs or IPC messages.
 */
export const ChangeEventSchema = z.object({
  type: z.enum(['added', 'modified', 'deleted']),
  path: z.string(),
  timestamp: z.number(),
  hash: z.string().optional(),
});

/**
 * File system change event detected by the watcher.
 *
 * Events are debounced and batched to avoid overwhelming the indexer
 * during rapid file modifications (e.g., mass refactoring).
 *
 * @example
 * const event: ChangeEvent = {
 *   type: 'modified',
 *   path: '/src/auth/handler.ts',
 *   timestamp: Date.now(),
 *   hash: 'abc123...' // SHA-256 of new content
 * };
 */
export type ChangeEvent = z.infer<typeof ChangeEventSchema>;

/**
 * Zod schema for validating dirty file records.
 */
export const DirtyFileSchema = z.object({
  path: z.string(),
  tracked_hash: z.string(),
  current_hash: z.string().optional(),
  detected_at: z.string(),
  change_type: z.enum(['modified', 'deleted']),
});

/**
 * Tracked file that has been modified or deleted since last indexing.
 *
 * Dirty files represent a delta between the PGC and source code state.
 * The system maintains both the tracked hash (what's in PGC) and current hash
 * (what's on disk) to detect changes.
 *
 * @example
 * const dirtyFile: DirtyFile = {
 *   path: '/src/database/connection.ts',
 *   tracked_hash: 'def456...', // Hash in PGC
 *   current_hash: 'ghi789...', // Hash on disk
 *   detected_at: '2025-11-15T10:30:00Z',
 *   change_type: 'modified'
 * };
 */
export type DirtyFile = z.infer<typeof DirtyFileSchema>;

/**
 * Zod schema for validating untracked file records.
 */
export const UntrackedFileSchema = z.object({
  path: z.string(),
  current_hash: z.string(),
  detected_at: z.string(),
});

/**
 * File not yet tracked by the index.
 *
 * Untracked files are discovered through file system scanning but
 * have not been ingested into the PGC yet. This typically happens
 * when new files are added to the codebase.
 *
 * @example
 * const untrackedFile: UntrackedFile = {
 *   path: '/src/features/new-feature.ts',
 *   current_hash: 'jkl012...',
 *   detected_at: '2025-11-15T10:35:00Z'
 * };
 */
export type UntrackedFile = z.infer<typeof UntrackedFileSchema>;

/**
 * Zod schema for validating dirty state snapshots.
 */
export const DirtyStateSchema = z.object({
  last_updated: z.string(),
  dirty_files: z.array(DirtyFileSchema),
  untracked_files: z.array(UntrackedFileSchema),
});

/**
 * Complete dirty state of tracked and untracked files.
 *
 * The dirty state is persisted to disk and loaded on startup to resume
 * tracking across sessions. This enables workflows like:
 * 1. Developer makes changes
 * 2. Watcher records dirty state
 * 3. Developer runs 'cogni verify' to see what needs reindexing
 * 4. Developer runs 'cogni reindex' to update only changed files
 *
 * @example
 * const state: DirtyState = {
 *   last_updated: '2025-11-15T10:40:00Z',
 *   dirty_files: [
 *     { path: '/src/auth.ts', tracked_hash: 'abc...', current_hash: 'def...', ... }
 *   ],
 *   untracked_files: [
 *     { path: '/src/new-module.ts', current_hash: 'ghi...', ... }
 *   ]
 * };
 */
export type DirtyState = z.infer<typeof DirtyStateSchema>;

/**
 * Configuration options for the file watcher.
 *
 * Controls which files are monitored and how changes are debounced.
 * The watcher uses chokidar internally for cross-platform compatibility.
 *
 * @example
 * const options: WatcherOptions = {
 *   paths: ['src/**\/*.ts', 'docs/**\/*.md'],
 *   ignored: ['**\/*.test.ts', '**/ node_modules; /**', '**\/.pgc/**'],
 *   watchUntracked: true,
 *   debounceMs: 1000 // Wait 1s after last change before processing
 * };
 */
export interface WatcherOptions {
  /**
   * Glob patterns for paths to watch (defaults to all indexed files).
   * Uses fast-glob syntax for pattern matching.
   */
  paths?: string[];

  /**
   * Glob patterns for paths to ignore.
   * Common ignores: node_modules, .git, .pgc, test files.
   */
  ignored?: string[];

  /**
   * Whether to watch for new files (untracked files).
   * If false, only monitors files already in the index.
   */
  watchUntracked?: boolean;

  /**
   * Debounce delay in milliseconds to batch rapid changes.
   * Prevents redundant processing during mass edits.
   */
  debounceMs?: number;
}

/**
 * Event handlers for file watcher lifecycle events.
 *
 * Handlers can be sync or async. The watcher queues events and processes
 * them sequentially to maintain ordering guarantees.
 *
 * @example
 * const handlers: WatcherEventHandlers = {
 *   onChange: async (event) => {
 *     await updateDirtyState(event);
 *     if (event.type !== 'deleted') {
 *       await maybeReindex(event.path);
 *     }
 *   },
 *   onError: (error) => {
 *     logger.error('Watcher error', error);
 *   },
 *   onReady: () => {
 *     logger.info('File watcher initialized');
 *   }
 * };
 */
export interface WatcherEventHandlers {
  /** Called when a file is added, modified, or deleted */
  onChange?: (event: ChangeEvent) => void | Promise<void>;
  /** Called when the watcher encounters an error */
  onError?: (error: Error) => void;
  /** Called when the watcher has completed initialization */
  onReady?: () => void;
}
