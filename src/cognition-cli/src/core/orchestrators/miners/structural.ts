import { WorkbenchClient } from '../../executors/workbench-client.js';
import { ASTParserRegistry } from './ast-parsers/index.js';
import { SLMExtractor } from './slm-extractor.js';
import { LLMSupervisor } from './llm-supervisor.js';
import type { SourceFile, StructuralData } from '../../types/structural.js';
import { StructuralDataSchema } from '../../types/structural.js';

/**
 * Structural Miner: Extracts code structure metadata using a resilient fallback strategy
 *
 * Responsible for analyzing source code and extracting structural information:
 * - Classes, interfaces, functions with signatures
 * - Imports and dependencies
 * - Exports and module structure
 * - Line numbers and metadata
 *
 * MULTI-LAYER EXTRACTION STRATEGY (Monument 1 - Resilient Extraction):
 *
 * Layer 1: Native AST Parsing (Highest Fidelity)
 * - Uses tree-sitter for TypeScript/JavaScript
 * - Deterministic, 100% accurate, fastest
 * - Fidelity: 1.0
 *
 * Layer 1b: Remote AST Parsing (For remote languages)
 * - Python, Java, Rust, Go via eGemma workbench
 * - Also deterministic via server-side tree-sitter
 * - Fidelity: 1.0
 *
 * Layer 2: Small Language Model (SLM) Extraction
 * - Falls back when native parsing fails
 * - Uses "ast_analyst" persona to generate JSON
 * - Handles edge cases and unusual syntax
 * - Fidelity: 0.85 (good for most code, may miss edge cases)
 *
 * Layer 3: Large Language Model (LLM) Supervised
 * - Last-resort fallback for unsupported languages
 * - Generates custom tree-sitter queries via LLM
 * - Experimental and slower
 * - Fidelity: 0.7 (covers basics, may miss nuances)
 *
 * DESIGN PATTERNS:
 * - Graceful degradation: Tries best method first, falls back automatically
 * - Fidelity tracking: Records extraction method & fidelity score with output
 * - Error resilience: Catches and logs errors, continues to next layer
 * - Caching: ASTParserRegistry reuses parsers per-instance
 *
 * @example
 * const miner = new StructuralMiner(workbench);
 * const file = { path: 'src/app.ts', language: 'typescript', content: '...' };
 * const structure = await miner.extractStructure(file);
 * // → structure.extraction_method = 'ast_native'
 * // → structure.fidelity = 1.0
 * // → structure.classes, functions, imports, exports populated
 *
 * @example
 * // If native parsing fails, automatically tries SLM:
 * const structure = await miner.extractStructure(complexFile);
 * // → structure.extraction_method = 'slm'
 * // → structure.fidelity = 0.85
 *
 * @see Monument 1: Resilient Extraction Design
 */
export class StructuralMiner {
  private astParsers: ASTParserRegistry;
  private slmExtractor: SLMExtractor;
  private llmSupervisor: LLMSupervisor;

  constructor(private workbench: WorkbenchClient) {
    this.astParsers = new ASTParserRegistry();
    this.slmExtractor = new SLMExtractor(workbench);
    this.llmSupervisor = new LLMSupervisor(workbench);
  }

  /**
   * Extract structural metadata from a source file
   *
   * Tries multiple extraction methods in order of fidelity, automatically falling back
   * on errors. Records which method was used and the fidelity score in the result.
   *
   * EXTRACTION LAYERS:
   * 1. Try native parser (tree-sitter for TS/JS) - fidelity 1.0
   * 2. Try remote parser (eGemma workbench for Python etc) - fidelity 1.0
   * 3. Fall back to SLM (ast_analyst persona) - fidelity 0.85
   * 4. Last resort: LLM supervisor (generates custom parser) - fidelity 0.7
   *
   * Each layer catches its own errors and logs a warning, then tries next layer.
   * If all layers fail, throws with a detailed error message.
   *
   * FIDELITY SCORES:
   * - 1.0: Deterministic AST parsing (native or remote)
   * - 0.85: SLM extraction (usually accurate, may miss edge cases)
   * - 0.7: LLM supervised (covers basics, experimental)
   *
   * @param file - SourceFile object with content and language
   * @returns Promise<StructuralData> - Extracted structure with extraction_method and fidelity
   * @throws {Error} If all extraction layers fail
   *
   * @example
   * const file = {
   *   path: 'src/Component.tsx',
   *   language: 'typescript',
   *   content: 'export class Component { ... }'
   * };
   * const data = await miner.extractStructure(file);
   * // → data.classes = [{ name: 'Component', ... }]
   * // → data.exports = ['Component']
   * // → data.extraction_method = 'ast_native'
   * // → data.fidelity = 1.0
   *
   * @public
   */
  async extractStructure(file: SourceFile): Promise<StructuralData> {
    // Layer 1: Try deterministic AST parser first (native)
    const parser = this.astParsers.get(file.language);
    if (parser && parser.isNative) {
      try {
        const result = await parser.parse(file.content);
        return StructuralDataSchema.parse({
          ...result,
          extraction_method: 'ast_native',
          fidelity: 1.0,
        });
      } catch (e) {
        console.warn(
          `Native AST parsing failed for ${file.path}: ${(e as Error).message}`
        );
      }
    }

    // Layer 1b: Try remote AST parser (for Python via egemma)
    if (parser && !parser.isNative) {
      try {
        const result = await this.workbench.parseAST({
          content: file.content,
          language: file.language,
          filename: file.name,
        });
        return StructuralDataSchema.parse({
          ...result,
          extraction_method: 'ast_remote',
          fidelity: 1.0,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        console.warn(`Remote AST parsing failed for ${file.path}:`);
        if (e.data) {
          console.warn('Validation Error:', JSON.stringify(e.data, null, 2));
        } else if (e instanceof Error) {
          console.warn('Error message:', e.message);
          console.warn('Error stack:', e.stack);
        } else {
          console.warn('Full Error Object:', e);
        }
      }
    }

    // Layer 2: Fallback to specialized SLM
    try {
      const result = await this.slmExtractor.extract(file);
      return StructuralDataSchema.parse({
        ...result,
        extraction_method: 'slm',
        fidelity: 0.85,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      console.warn(`SLM extraction failed for ${file.path}:`);
      if (e.data) {
        console.warn('Validation Error:', JSON.stringify(e.data, null, 2));
      } else {
        console.warn('Full Error Object:', e);
      }
    }

    // Layer 3: LLM supervisor generates parser and executes
    console.log(`Escalating ${file.path} to LLM supervisor`);
    const result = await this.llmSupervisor.generateAndExecuteParser(file);
    return StructuralDataSchema.parse({
      ...result,
      extraction_method: 'llm_supervised',
      fidelity: 0.7,
    });
  }
}
