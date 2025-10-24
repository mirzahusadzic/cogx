import { z } from 'zod';

/**
 * Types for the file watcher and dirty state tracking system
 */

export const ChangeEventSchema = z.object({
  type: z.enum(['added', 'modified', 'deleted']),
  path: z.string(),
  timestamp: z.number(),
  hash: z.string().optional(),
});

export type ChangeEvent = z.infer<typeof ChangeEventSchema>;

export const DirtyFileSchema = z.object({
  path: z.string(),
  tracked_hash: z.string(),
  current_hash: z.string().optional(),
  detected_at: z.string(),
  change_type: z.enum(['modified', 'deleted']),
});

export type DirtyFile = z.infer<typeof DirtyFileSchema>;

export const UntrackedFileSchema = z.object({
  path: z.string(),
  current_hash: z.string(),
  detected_at: z.string(),
});

export type UntrackedFile = z.infer<typeof UntrackedFileSchema>;

export const DirtyStateSchema = z.object({
  last_updated: z.string(),
  dirty_files: z.array(DirtyFileSchema),
  untracked_files: z.array(UntrackedFileSchema),
});

export type DirtyState = z.infer<typeof DirtyStateSchema>;

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

export interface WatcherEventHandlers {
  onChange?: (event: ChangeEvent) => void | Promise<void>;
  onError?: (error: Error) => void;
  onReady?: () => void;
}
