import { z } from 'zod';

export interface LineagePatternMetadata {
  symbol: string;
  anchor: string; // File path of the symbol
  lineageSignature: string; // JSON string from formatAsLineageJSON
  lineageEmbeddingHash: string;
  computedAt: string;
  vectorId: string;
  validation: {
    sourceHash: string;
    embeddingModelVersion: string;
  };
}

export const LineagePatternMetadataSchema = z.object({
  symbol: z.string(),
  anchor: z.string(),
  lineageSignature: z.string(),
  lineageEmbeddingHash: z.string(),
  computedAt: z.string(),
  vectorId: z.string(),
  validation: z.object({
    sourceHash: z.string(),
    embeddingModelVersion: z.string(),
  }),
});
