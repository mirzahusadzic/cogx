import { describe, it, expect } from 'vitest';
import { sigmaTaskUpdateTool } from '../../tools/definitions.js';
import { getCognitionTools as getGeminiTools } from '../gemini/adk-tools.js';
import { getOpenAITools } from '../openai/agent-tools.js';
import { getMinimaxTools } from '../minimax/agent-tools.js';

/**
 * This test ensures that tool schemas (parameters) remain synchronized across providers.
 * Differences in schemas can lead to model confusion or failures when switching providers.
 */
describe('Provider Tool Parity', () => {
  it('SigmaTaskUpdate should have synchronized status enums', () => {
    // We check the source definition as well as how it gets transformed
    const statusEnum =
      sigmaTaskUpdateTool.parameters.shape.todos.element.shape.status.options;
    expect(statusEnum).toContain('pending');
    expect(statusEnum).toContain('in_progress');
    expect(statusEnum).toContain('completed');
    expect(statusEnum).toContain('delegated');

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

    const openaiTools = getOpenAITools({
      cwd: process.cwd(),
      anchorId: 'session-1',
    });
    const openaiTaskUpdate = openaiTools.find(
      (t) => t.name === 'SigmaTaskUpdate'
    );

    const minimaxTools = getMinimaxTools({
      cwd: process.cwd(),
      agentId: 'agent-1',
    } as never);
    const minimaxTaskUpdate = minimaxTools.find(
      (t) => t.name === 'SigmaTaskUpdate'
    );

    expect(geminiTaskUpdate).toBeDefined();
    expect(openaiTaskUpdate).toBeDefined();
    expect(minimaxTaskUpdate).toBeDefined();

    // Since both use the same factory, we just need to verify they both expose valid schemas
    // ADK FunctionTools usually have a 'parameters' object that represents the JSON schema
    // if created via the factory.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const geminiParams = (geminiTaskUpdate as any).parameters;
    const openaiParams = (openaiTaskUpdate as any).parameters;
    const minimaxParams = (minimaxTaskUpdate as any).input_schema;

    const getStatusEnum = (params: any) => {
      /* eslint-enable @typescript-eslint/no-explicit-any */
      if (!params) return [];
      // Handle both raw Zod (which has .shape) and JSON Schema (which has .properties)
      if (params.shape) {
        return params.shape.todos.element.shape.status.options;
      }
      const props = params.properties || params;
      const todos = props.todos;
      const items = todos.items;
      const itemProps = items.properties || items;
      return itemProps.status.enum;
    };

    const gStatusEnum = getStatusEnum(geminiParams);
    const oStatusEnum = getStatusEnum(openaiParams);
    const mStatusEnum = getStatusEnum(minimaxParams);

    expect(gStatusEnum).toEqual(statusEnum);
    expect(oStatusEnum).toEqual(statusEnum);
    expect(mStatusEnum).toEqual(statusEnum);
  });
});
