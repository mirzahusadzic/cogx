/**
 * Represents a snapshot of Genesis processing state for incremental updates.
 */
export interface GenesisCheckpoint {
  processedFiles: string[];
  lastProcessedFile?: string;
  timestamp: Date;
}
