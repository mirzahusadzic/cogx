import { z } from 'zod';

import { StructuralDataSchema } from './structural.js';

export const IndexDataSchema = z.object({
  path: z.string(),
  content_hash: z.string(),
  structural_hash: z.string(),
  status: z.enum(['Valid', 'Invalidated']),
  history: z.array(z.string()),
  structuralData: StructuralDataSchema.optional(),
});

export type IndexData = z.infer<typeof IndexDataSchema>;
