export interface GenesisCheckpoint {
  processedFiles: string[];
  lastProcessedFile?: string;
  timestamp: Date;
}
