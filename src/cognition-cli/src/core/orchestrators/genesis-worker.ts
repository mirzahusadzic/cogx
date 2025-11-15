import * as workerpool from 'workerpool';
import { ASTParserRegistry } from './miners/ast-parsers/index.js';
import {
  StructuralDataSchema,
  SourceFile,
  StructuralData,
} from '../types/structural.js';

/**
 * GenesisWorker: Worker thread for parallel AST parsing
 *
 * Runs in a separate worker thread via workerpool. Each worker:
 * - Loads the native tree-sitter AST parser once (per-worker initialization cost)
 * - Parses source files independently without sharing state
 * - Returns structured results (success/error) to main thread
 *
 * DESIGN:
 * - Minimal dependencies: Only imports parser registry and types
 * - Stateless: No side effects, no PGC mutations
 * - Defensive: Returns graceful error objects (never throws to worker pool)
 * - Deterministic: Same input always produces same output
 *
 * LIFECYCLE:
 * 1. Main thread initializes pool with desired worker count
 * 2. Each worker loads once (ASTParserRegistry initialization cost)
 * 3. Main thread submits jobs via pool.exec('parseNativeAST', [job])
 * 4. Workers process independently in parallel
 * 5. Main thread collects results and shuts down pool
 *
 * ERROR HANDLING:
 * - Catches parse errors and returns { status: 'error', error: message }
 * - Never throws (workerpool expects safe functions)
 * - Logs errors to console for debugging
 *
 * @example
 * // Main thread usage:
 * const pool = workerpool.pool(workerPath, { maxWorkers: 4 });
 * const result = await pool.exec('parseNativeAST', [{ file, contentHash }]);
 * // → result = { status: 'success', structuralData: {...} }
 * // → or { status: 'error', error: 'message' }
 * await pool.terminate();
 */

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
 *
 * Main worker function. Handles one TypeScript/JavaScript file at a time.
 *
 * ALGORITHM:
 * 1. Get the appropriate parser from registry (tree-sitter for TS/JS)
 * 2. Verify parser is native (throws if remote/fallback)
 * 3. Parse file content to AST
 * 4. Validate against StructuralDataSchema (Zod validation)
 * 5. Return result with structural metadata
 *
 * ERRORS:
 * - If parser not available: caught and returned as error result
 * - If parsing fails: caught and returned as error result
 * - If validation fails: caught and returned as error result
 * - Errors logged to console for worker debugging
 *
 * @param job - Packet containing file object and content hash
 * @returns Promise<GenesisJobResult> - Success with structuralData or error status
 *
 * @example
 * const file = { path: 'src/index.ts', language: 'typescript', content: '...' };
 * const result = await parseNativeAST({ file, contentHash: 'abc123' });
 * // → returns { status: 'success', relativePath: 'src/index.ts', structuralData: {...} }
 *
 * @private - Only called by workerpool in worker threads
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
