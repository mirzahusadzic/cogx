import { z } from 'zod';

/**
 * Types for the file watcher and dirty state tracking system
 */

/**
 * Zod schema for validating file change events.
 */
export const ChangeEventSchema = z.object({
  type: z.enum(['added', 'modified', 'deleted']),
  path: z.string(),
  timestamp: z.number(),
  hash: z.string().optional(),
});

/**
 * Represents a file system change event detected by the watcher.
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
 * Represents a tracked file that has been modified or deleted.
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
 * Represents a file not yet tracked by the index.
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
 * Represents the complete dirty state of tracked and untracked files.
 */
export type DirtyState = z.infer<typeof DirtyStateSchema>;

/**
 * Configuration options for the file watcher.
 */
export interface WatcherOptions {
  /**
   * Paths to watch (defaults to all indexed files)
   */
  paths?: string[];

  /**
   * Paths to ignore
   */
  ignored?: string[];

  /**
   * Whether to watch for new files
   */
  watchUntracked?: boolean;

  /**
   * Debounce delay in ms (to batch rapid changes)
   */
  debounceMs?: number;
}

/**
 * Event handlers for file watcher lifecycle events.
 */
export interface WatcherEventHandlers {
  onChange?: (event: ChangeEvent) => void | Promise<void>;
  onError?: (error: Error) => void;
  onReady?: () => void;
}
