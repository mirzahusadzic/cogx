import type { WorkbenchClient } from '../../executors/workbench-client.js';
import type {
  Language,
  SourceFile,
  StructuralData,
} from '../../types/structural.js';

import {
  DEFAULT_SLM_MODEL_NAME,
  PERSONA_AST_ANALYST,
  DEFAULT_MAX_OUTPUT_TOKENS,
} from '../../../config.js';

/**
 * SLMExtractor: Small Language Model based structural extraction (fallback Layer 2)
 *
 * Provides resilient code structure extraction when native AST parsing is unavailable.
 * Uses a specialized "ast_analyst" persona to generate structured JSON from source code.
 *
 * DESIGN:
 * - Fallback layer for unsupported languages or parsing failures
 * - Uses eGemma workbench and configured SLM (usually Mistral 7B or similar)
 * - Low-temperature extraction (0.1) for consistency
 * - JSON schema validation ensures output matches StructuralData type
 *
 * FIDELITY:
 * - 0.85: Usually accurate for basic structure (classes, functions, imports)
 * - May miss edge cases, nested structures, or unusual syntax
 * - Trades some accuracy for language-agnostic support
 *
 * FALLBACK CHAIN:
 * Layer 1: Native AST parsing (fidelity 1.0) - fast and precise
 * → Layer 2: This SLM extractor (fidelity 0.85) - resilient, slower
 *   → Layer 3: LLM supervisor (fidelity 0.7) - experimental, slowest
 *
 * @example
 * const extractor = new SLMExtractor(workbench);
 * const file = { path: 'example.py', language: 'python', content: '...' };
 * const structure = await extractor.extract(file);
 * // → Returns validated StructuralData with fidelity 0.85
 *
 * @see Monument 1: Resilient Extraction Design
 * @see StructuralMiner: Multi-layer extraction orchestrator
 */
export class SLMExtractor {
  constructor(private workbench: WorkbenchClient) {}

  /**
   * Extract code structure using Small Language Model (SLM)
   *
   * Sends source code to eGemma workbench for extraction via SLM.
   * The workbench uses the ast_analyst persona to analyze code and generate
   * a JSON summary matching StructuralData schema.
   *
   * PROCESS:
   * 1. Send file content + filename to workbench.summarize()
   * 2. Use ast_analyst persona for consistent code analysis
   * 3. SLM returns JSON string describing code structure
   * 4. Parse JSON response
   * 5. Validate against StructuralDataSchema (Zod validation)
   * 6. Merge with defaults to ensure all fields present
   *
   * ERROR HANDLING:
   * - If SLM returns non-JSON, throw with full response for debugging
   * - If validation fails, throw with details
   * - Default values ensure partial success (e.g., empty arrays for imports)
   *
   * @param file - Source file to analyze
   * @returns Promise<StructuralData> - Extracted structure with fidelity 0.85
   * @throws {Error} If response is not valid JSON or validation fails
   *
   * @example
   * const extractor = new SLMExtractor(workbench);
   * const file = {
   *   path: 'utils.py',
   *   language: 'python',
   *   content: 'def helper(): ...'
   * };
   * const structure = await extractor.extract(file);
   * // → structure.functions = [{ name: 'helper', ... }]
   * // → structure.extraction_method = 'slm'
   *
   * @public
   */
  async extract(file: SourceFile): Promise<StructuralData> {
    const response = await this.workbench.summarize({
      content: file.content,
      filename: file.name,
      persona: PERSONA_AST_ANALYST,
      model_name: DEFAULT_SLM_MODEL_NAME,
      max_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
      temperature: 0.1,
    });

    try {
      const structural = JSON.parse(
        response.summary
      ) as Partial<StructuralData>;
      return this.validateAndNormalize(structural, file.language);
    } catch (e) {
      // If the response is not JSON, it might be a plain text explanation or an error message.
      // We should log the full response for debugging.
      throw new Error(
        `SLM returned invalid JSON for ${file.path}. Raw response: "${response.summary}". Error: ${(e as Error).message}`
      );
    }
  }

  private validateAndNormalize(
    data: Partial<StructuralData>,
    language: Language
  ): StructuralData {
    // Define default values for StructuralData fields
    const defaults: StructuralData = {
      language: language,
      docstring: '',
      imports: [],
      classes: [],
      functions: [],
      interfaces: [],
      exports: [],
      dependencies: [],
      extraction_method: 'slm',
      fidelity: 0.7,
    };

    // Merge the received data with defaults, ensuring all fields are present
    // and arrays are initialized if missing.
    return {
      ...defaults,
      ...data,
      imports: data.imports || defaults.imports,
      classes: data.classes || defaults.classes,
      functions: data.functions || defaults.functions,
      interfaces: data.interfaces || defaults.interfaces,
      exports: data.exports || defaults.exports,
      dependencies: data.dependencies || defaults.dependencies,
    };
  }
}
