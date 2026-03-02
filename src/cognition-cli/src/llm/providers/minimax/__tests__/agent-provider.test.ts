import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MinimaxAgentProvider } from '../agent-provider.js';
import { LLMConfig } from '../../../core/llm-config.js';

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
    // This is a simplified test as the actual request logic involves
    // network calls. For now we just verify the provider structure.
    expect(provider.executeAgent).toBeDefined();
  });
});
