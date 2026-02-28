import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MinimaxAgentProvider } from '../agent-provider.js';
import { executeMinimaxTool } from '../agent-tools.js';
import { LLMConfig } from '../../../../llm/llm-config.js';

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        stream: vi.fn(),
        create: vi.fn(),
      },
    })),
  };
});

vi.mock('../agent-tools.js', () => ({
  getMinimaxTools: vi.fn(() => []),
  executeMinimaxTool: vi.fn(),
}));

describe('MinimaxAgentProvider', () => {
  let provider: MinimaxAgentProvider;
  const mockConfig: LLMConfig = {
    apiKey: 'test-api-key',
    model: 'abab6.5-chat',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new MinimaxAgentProvider(mockConfig);
  });

  it('should be initialized with the correct config', () => {
    expect(provider).toBeDefined();
    expect(provider.name).toBe('minimax');
  });

  it('should handle tool execution correctly', async () => {
    const mockOutput = 'file content';

    vi.mocked(executeMinimaxTool).mockResolvedValue(mockOutput);

    // This is a simplified test as the actual request logic involves
    // network calls. For now we just verify the provider structure.
    expect(provider.executeAgent).toBeDefined();
  });
});

describe('executeMinimaxTool', () => {
  it('should call the correct tool function', async () => {
    // We'll add more detailed tool execution tests here
    // after verifying the provider setup.
  });
});
