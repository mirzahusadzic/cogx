import * as workerpool from 'workerpool';
import { ASTParserRegistry } from './miners/ast-parsers/index.js';
import {
  StructuralDataSchema,
  SourceFile,
  StructuralData,
} from '../types/structural.js';

export interface GenesisJobPacket {
  file: SourceFile;
  contentHash: string;
}

export interface GenesisJobResult {
  status: 'success' | 'error';
  relativePath: string;
  contentHash: string;
  structuralData?: StructuralData;
  error?: string;
}

/**
 * Parse file using native AST parser (tree-sitter)
 * Only called for TypeScript/JavaScript files
 */
async function parseNativeAST(
  job: GenesisJobPacket
): Promise<GenesisJobResult> {
  const { file, contentHash } = job;

  try {
    const astParsers = new ASTParserRegistry();
    const parser = astParsers.get(file.language);

    if (!parser || !parser.isNative) {
      throw new Error(`No native parser available for ${file.language}`);
    }

    const result = await parser.parse(file.content);
    const structuralData = StructuralDataSchema.parse({
      ...result,
      extraction_method: 'ast_native',
      fidelity: 1.0,
    });

    return {
      status: 'success',
      relativePath: file.relativePath,
      contentHash,
      structuralData,
    };
  } catch (error: unknown) {
    const errorMsg = `Native AST parsing failed: ${(error as Error).message}`;
    console.error(`[GenesisWorker] ${file.relativePath}: ${errorMsg}`);
    return {
      status: 'error',
      relativePath: file.relativePath,
      contentHash,
      error: errorMsg,
    };
  }
}

workerpool.worker({
  parseNativeAST,
});
