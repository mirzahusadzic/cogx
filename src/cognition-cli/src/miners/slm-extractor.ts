import type { WorkbenchClient } from '../executors/workbench-client.js';
import type { SourceFile, StructuralData } from '../types/structural.js';

export class SLMExtractor {
  constructor(private workbench: WorkbenchClient) {}

  async extract(file: SourceFile): Promise<StructuralData> {
    const response = await this.workbench.summarize({
      content: file.content,
      filename: file.name,
      persona: 'structure_extractor',
      model_name: 'gemini-2.0-flash-exp',
      max_tokens: 2000,
      temperature: 0.1,
    });

    try {
      const structural = JSON.parse(
        response.summary
      ) as Partial<StructuralData>;
      return this.validateAndNormalize(structural, file.language as string);
    } catch (e) {
      throw new Error(
        `SLM returned invalid JSON for ${file.path}: ${(e as Error).message}`
      );
    }
  }

  private validateAndNormalize(
    data: Partial<StructuralData>,
    language: string
  ): StructuralData {
    return {
      language,
      imports: Array.isArray(data.imports) ? data.imports : [],
      classes: Array.isArray(data.classes) ? data.classes : [],
      functions: Array.isArray(data.functions) ? data.functions : [],
      exports: Array.isArray(data.exports) ? data.exports : [],
      dependencies: Array.isArray(data.dependencies)
        ? data.dependencies
        : Array.isArray(data.imports)
          ? data.imports
          : [],
    };
  }
}
