import { WorkbenchClient } from '../executors/workbench-client.js';
import { ASTParserRegistry } from './ast-parsers/index.js';
import { SLMExtractor } from './slm-extractor.js';
import { LLMSupervisor } from './llm-supervisor.js';
import type { SourceFile, StructuralData } from '../types/structural.js';
import { StructuralDataSchema } from '../types/structural.js';

export class StructuralMiner {
  private astParsers: ASTParserRegistry;
  private slmExtractor: SLMExtractor;
  private llmSupervisor: LLMSupervisor;

  constructor(private workbench: WorkbenchClient) {
    this.astParsers = new ASTParserRegistry();
    this.slmExtractor = new SLMExtractor(workbench);
    this.llmSupervisor = new LLMSupervisor(workbench);
  }

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
