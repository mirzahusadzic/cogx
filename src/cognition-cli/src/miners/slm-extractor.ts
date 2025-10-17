import type { WorkbenchClient } from '../executors/workbench-client.js';
import type {
  Language,
  SourceFile,
  StructuralData,
} from '../types/structural.js';

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
      return this.validateAndNormalize(structural, file.language);
    } catch (e) {
      throw new Error(
        `SLM returned invalid JSON for ${file.path}: ${(e as Error).message}`
      );
    }
  }

  private validateAndNormalize(
    data: Partial<StructuralData>,
    language: Language
  ): StructuralData {
    return {
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
  }
}
