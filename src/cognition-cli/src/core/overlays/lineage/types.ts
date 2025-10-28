import { z } from 'zod';

/**
 * Zod schema for validating lineage pattern metadata.
 */
export const LineagePatternMetadataSchema = z.object({
  symbol: z.string(),
  symbolType: z.enum(['class', 'function', 'interface', 'type']),
  anchor: z.string(),
  lineageHash: z.string(),
  embeddingHash: z.string(),
  lineageSignature: z.string(),
  computed_at: z.string(),
  validation: z.object({
    sourceHash: z.string(),
    embeddingModelVersion: z.string(),
  }),
  vectorId: z.string(),
});

/**
 * Represents metadata for a lineage pattern tracking symbol dependencies.
 */
export type LineagePatternMetadata = z.infer<
  typeof LineagePatternMetadataSchema
>;

/**
 * Supported symbol types for lineage analysis.
 */
export type StructuralSymbolType = 'class' | 'function' | 'interface' | 'type';

/**
 * Configuration options for pattern generation operations.
 */
export interface PatternGenerationOptions {
  symbolTypes?: StructuralSymbolType[];
  files?: string[];
  force?: boolean;
}

/**
 * Represents a job packet for parallel lineage pattern mining.
 */
export interface PatternJobPacket {
  projectRoot: string;
  symbolName: string;
  filePath: string;
  symbolType: StructuralSymbolType;
  force: boolean;
}

/**
 * Represents the output of lineage mining for a single symbol.
 */
export interface LineageMiningResult {
  lineageJson: object;
  signature: string;
  lineageDataHash: string;
  symbolType: StructuralSymbolType;
  validationSourceHash: string;
  structuralHash: string;
}

/**
 * Represents the result of a pattern mining job execution.
 */
export interface PatternResultPacket {
  status: 'success' | 'skipped' | 'error';
  message: string;
  symbolName: string;
  filePath: string;
  // Mining results (only present if status === 'success')
  miningResult?: LineageMiningResult;
}

import { StructuralData } from '../../types/structural.js';

/**
 * Represents a dependency discovered during lineage traversal.
 */
export interface Dependency {
  path: string;
  depth: number;
  structuralData: StructuralData;
}

/**
 * Represents the result of a lineage query including dependencies and initial context.
 */
export interface LineageQueryResult {
  dependencies: Dependency[];
  initialContext: StructuralData[];
}
