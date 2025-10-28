import { z } from 'zod';

import { StructuralDataSchema } from './structural.js';

/**
 * Schema for file index entries in the Provenance Graph Cache.
 * Tracks source file metadata, structural analysis, and processing status.
 */
export const IndexDataSchema = z.object({
  path: z.string(),
  symbol: z.string().optional(),
  content_hash: z.string(),
  structural_hash: z.string(),
  status: z.enum(['Valid', 'Invalidated', 'PartiallyProcessed']),
  history: z.array(z.string()),
  structuralData: StructuralDataSchema.optional(),
  lineage_hash: z.string().optional(),
});

/**
 * Represents a file index entry with structural metadata and provenance information.
 */
export type IndexData = z.infer<typeof IndexDataSchema>;
