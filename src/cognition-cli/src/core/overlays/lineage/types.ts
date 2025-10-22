import { z } from 'zod';
import { DEFAULT_EMBEDDING_MODEL_NAME } from '../../../config.js';

/**
 * Defines the specific types of structural symbols we can target for pattern generation.
 */
export type StructuralSymbolType = 'class' | 'interface' | 'function' | 'type';

/**
 * Defines the granular options for a pattern generation run.
 */
export interface PatternGenerationOptions {
  /** Target specific types of symbols. If empty, process all. */
  symbolTypes?: StructuralSymbolType[];
  /** Process only a specific list of files. If empty, process all from manifest. */
  files?: string[];
  /** Force regeneration even if patterns already exist. */
  force?: boolean;
}

/**
 * The mission briefing sent from the Conductor to a Worker.
 * Contains everything a worker needs to perform its task autonomously.
 */
export interface PatternJobPacket {
  pgcRoot: string;
  projectRoot: string;
  symbolName: string;
  filePath: string;
  symbolType: StructuralSymbolType;
  force: boolean;
}

/**
 * The mission report sent back from a Worker to the Conductor.
 */
export interface PatternResultPacket {
  status: 'success' | 'skipped' | 'error';
  message: string;
  symbolName: string;
  filePath: string;
}

/**
 * The structure of the metadata stored for each generated lineage pattern GKe.
 * This is the "birth certificate" for the pattern.
 */
export interface LineagePatternMetadata {
  symbol: string;
  symbolType: 'class' | 'interface' | 'function' | 'type';
  anchor: string;
  lineageHash: string;
  embeddingHash: string;
  lineageSignature: string;
  computed_at: string;
  vectorId: string;
  validation: {
    sourceHash: string;
    embeddingModelVersion: typeof DEFAULT_EMBEDDING_MODEL_NAME;
  };
}

/**
 * The Zod schema for validating the LineagePatternMetadata.
 * This is the Oracle for the metadata structure.
 */
export const LineagePatternMetadataSchema = z.object({
  symbol: z.string(),
  symbolType: z.enum(['class', 'interface', 'function', 'type']),
  anchor: z.string(),
  lineageHash: z.string(),
  embeddingHash: z.string(),
  lineageSignature: z.string(),
  computed_at: z.string(),
  vectorId: z.string(),
  validation: z.object({
    sourceHash: z.string(),
    embeddingModelVersion: z.literal(DEFAULT_EMBEDDING_MODEL_NAME),
  }),
});
