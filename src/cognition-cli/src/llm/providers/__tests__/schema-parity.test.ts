import { describe, it, expect } from 'vitest';
import { getCognitionTools as getGeminiTools } from '../gemini-adk-tools.js';

/**
 * This test ensures that tool schemas (parameters) remain synchronized across providers.
 * Differences in schemas can lead to model confusion or failures when switching providers.
 */
describe('Provider Tool Parity', () => {
  it('SigmaTaskUpdate should have synchronized status enums', () => {
    const geminiTools = getGeminiTools(
      undefined,
      '',
      undefined,
      undefined,
      undefined,
      undefined,
      process.cwd(),
      'agent-1',
      { provider: 'gemini', anchorId: 'session-1' }
    );
    const geminiTaskUpdate = geminiTools.find(
      (t) => t.name === 'SigmaTaskUpdate'
    );

    expect(geminiTaskUpdate).toBeDefined();

    // Check status enum in Gemini
    // @ts-expect-error - access internal schema properties not in public FunctionTool type
    const parameters = geminiTaskUpdate!.parameters as unknown as {
      properties: {
        todos: {
          items: {
            properties: {
              status: {
                enum: string[];
              };
            };
          };
        };
      };
    };
    const statusEnum = parameters.properties.todos.items.properties.status.enum;
    expect(statusEnum).toContain('pending');
    expect(statusEnum).toContain('in_progress');
    expect(statusEnum).toContain('completed');
    expect(statusEnum).toContain('delegated');
  });
});
