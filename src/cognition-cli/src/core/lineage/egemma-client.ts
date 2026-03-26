import { PERSONA_LINEAGE_ANALYST } from '../../config.js';
import { WorkbenchClient } from '../executors/workbench-client.js';
import { GitContext } from '../git/context-extractor.js';

export interface SynthesizedIntent {
  commit_intent: string;
  files?: Array<{
    path: string;
    intent: string;
    category: string;
  }>;
  groups?: Array<{
    pattern: string;
    intent: string;
    files: number;
  }>;
  category?: string;
  confidence: number;
}

export class EGemmaClient {
  constructor(private workbench: WorkbenchClient) {}

  /**
   * Synthesizes intent from a git diff and commit metadata using eGemma.
   *
   * @param params - Input for synthesis (diff, message, context)
   * @returns Synthesized intent with confidence scores
   */
  async synthesizeIntent(params: {
    filePath?: string;
    commitMessage: string;
    diff: string;
    gitContext?: GitContext | null;
  }): Promise<SynthesizedIntent | null> {
    const prompt = this.buildSynthesisPrompt(params);

    try {
      const response = await this.workbench.summarize({
        filename: params.filePath || 'commit_diff.patch',
        content: prompt,
        persona: PERSONA_LINEAGE_ANALYST,
        max_tokens: 500,
      });

      // The persona is instructed to return STRICT JSON in the summary field
      try {
        return JSON.parse(response.summary) as SynthesizedIntent;
      } catch (parseError) {
        console.error('Failed to parse synthesized intent JSON:', parseError);
        return null;
      }
    } catch (error) {
      console.error('eGemma synthesis failed:', error);
      return null;
    }
  }

  private buildSynthesisPrompt(params: {
    filePath?: string;
    commitMessage: string;
    diff: string;
    gitContext?: GitContext | null;
  }): string {
    const { filePath, commitMessage, diff, gitContext } = params;

    let prompt = `COMMIT MESSAGE: ${commitMessage}\n\n`;

    if (gitContext) {
      prompt += `AUTHOR: ${gitContext.author}\n`;
      prompt += `TIMESTAMP: ${gitContext.timestamp}\n\n`;
    }

    if (filePath) {
      prompt += `FILE: ${filePath}\n`;
    }

    prompt += `DIFF:\n${diff}`;

    return prompt;
  }
}
