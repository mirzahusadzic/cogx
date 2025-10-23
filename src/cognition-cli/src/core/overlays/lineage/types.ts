import { z } from 'zod';

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

export type LineagePatternMetadata = z.infer<
  typeof LineagePatternMetadataSchema
>;

export type StructuralSymbolType = 'class' | 'function' | 'interface' | 'type';

export interface PatternGenerationOptions {
  symbolTypes?: StructuralSymbolType[];
  files?: string[];
  force?: boolean;
}

export interface PatternJobPacket {
  projectRoot: string;
  symbolName: string;
  filePath: string;
  symbolType: StructuralSymbolType;
  force: boolean;
}

export interface LineageMiningResult {
  lineageJson: object;
  signature: string;
  lineageDataHash: string;
  symbolType: StructuralSymbolType;
  validationSourceHash: string;
  structuralHash: string;
}

export interface PatternResultPacket {
  status: 'success' | 'skipped' | 'error';
  message: string;
  symbolName: string;
  filePath: string;
  // Mining results (only present if status === 'success')
  miningResult?: LineageMiningResult;
}

import { StructuralData } from '../../types/structural.js';

export interface Dependency {
  path: string;
  depth: number;
  structuralData: StructuralData;
}

export interface LineageQueryResult {
  dependencies: Dependency[];
  initialContext: StructuralData[];
}

export interface Dependency {
  path: string;
  depth: number;
  structuralData: StructuralData;
}

export interface LineageQueryResult {
  dependencies: Dependency[];
  initialContext: StructuralData[];
}
