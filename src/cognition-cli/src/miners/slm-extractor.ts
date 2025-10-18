import type { WorkbenchClient } from '../executors/workbench-client.js';
import type {
  Language,
  SourceFile,
  StructuralData,
} from '../types/structural.js';

import { DEFAULT_SLM_MODEL_NAME } from '../config.js';

export class SLMExtractor {
  constructor(private workbench: WorkbenchClient) {}

  async extract(file: SourceFile): Promise<StructuralData> {
    const response = await this.workbench.summarize({
      content: file.content,
      filename: file.name,
      persona: 'ast_analyst',
      model_name: DEFAULT_SLM_MODEL_NAME, // Use configurable model name
      max_tokens: 2000,
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
