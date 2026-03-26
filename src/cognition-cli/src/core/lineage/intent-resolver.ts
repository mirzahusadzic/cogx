import { IntentAdapter, IntentRecord } from './intent-adapter.js';
import { EGemmaClient } from './egemma-client.js';
import { GitContext } from '../git/context-extractor.js';

export interface ResolvedIntent {
  intent: string;
  decision?: string;
  alternatives?: string[];
  confidence: number;
  source_method:
    | 'agent_declared'
    | 'commit_message'
    | 'egemma_synthesized'
    | 'fallback';
  source?: IntentRecord['source'];
}

export class IntentResolver {
  constructor(
    private intentAdapter: IntentAdapter,
    private egemmaClient: EGemmaClient,
    private synthesizeEnabled: boolean = false
  ) {}

  /**
   * Resolves intent for a file transformation by traversing the priority chain:
   * 1. Agent-declared intent (real-time path)
   * 2. Quality commit message (no synthesis needed)
   * 3. eGemma persona synthesis from diff (if enabled)
   * 4. Fallback — raw commit message or generic
   *
   * @param filePath - Relative path to the file
   * @param commitMessage - Git commit message
   * @param diff - Git diff content
   * @param gitContext - Git context metadata
   */
  async resolve(
    filePath: string,
    commitMessage: string | null,
    diff: string | null,
    gitContext: GitContext | null
  ): Promise<ResolvedIntent> {
    // Priority 1: Agent-declared intent (real-time path)
    const pending = await this.intentAdapter.getPendingIntents(filePath);
    if (pending.length > 0) {
      const p = pending[0];
      return {
        intent: p.intent,
        decision: p.decision,
        alternatives: p.alternatives,
        confidence: p.confidence ?? 0.95,
        source_method: 'agent_declared',
        source: p.source,
      };
    }

    // Priority 2: Quality commit message (no synthesis needed)
    if (commitMessage && this.isQualityMessage(commitMessage)) {
      return {
        intent: this.extractFirstLine(commitMessage),
        decision: this.extractBody(commitMessage),
        confidence: 0.8,
        source_method: 'commit_message',
      };
    }

    // Priority 3: eGemma persona synthesis from diff
    if (this.synthesizeEnabled && diff && commitMessage) {
      const synthesized = await this.egemmaClient.synthesizeIntent({
        filePath,
        commitMessage,
        diff,
        gitContext,
      });

      if (synthesized) {
        // Try to find file-specific intent if available
        const fileIntent = synthesized.files?.find((f) => f.path === filePath);

        return {
          intent: fileIntent?.intent || synthesized.commit_intent,
          decision: fileIntent?.category || synthesized.category,
          confidence: synthesized.confidence * 0.7, // discount: LLM-inferred
          source_method: 'egemma_synthesized',
        };
      }
    }

    // Priority 4: Fallback — raw commit message or generic
    return {
      intent:
        commitMessage?.split('\n')[0] ||
        'File change recorded (no intent available)',
      decision:
        commitMessage && commitMessage.includes('\n')
          ? commitMessage
          : undefined,
      confidence: commitMessage ? 0.3 : 0.1,
      source_method: 'fallback',
    };
  }

  private isQualityMessage(msg: string): boolean {
    if (msg.trim().length < 15) return false;
    if (/^(fix|wip|update|stuff|changes|tmp|test|asdf|refactor)/i.test(msg)) {
      // "refactor: stuff" is still low quality if short
      if (msg.split(':')[1]?.trim().length < 10) return false;
    }
    return true;
  }

  private extractFirstLine(msg: string): string {
    return msg.split('\n')[0].trim();
  }

  private extractBody(msg: string): string | undefined {
    const lines = msg.split('\n');
    if (lines.length <= 1) return undefined;
    return lines.slice(1).join('\n').trim();
  }
}
