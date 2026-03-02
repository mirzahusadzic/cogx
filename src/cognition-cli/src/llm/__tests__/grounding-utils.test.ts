import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getGroundingContext } from '../core/utils/grounding-utils.js';
import type { AgentRequest } from '../core/interfaces/agent-provider.js';

// Mock dependencies
vi.mock('../../core/workspace-manager.js', () => ({
  WorkspaceManager: vi.fn().mockImplementation(() => ({
    resolvePgcRoot: vi.fn().mockReturnValue('/fake/project'),
  })),
}));

vi.mock('../../commands/ask.js', () => ({
  askCommand: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../sigma/cross-session-query.js', () => ({
  findSimilarConversations: vi.fn().mockResolvedValue([]),
}));

describe('getGroundingContext', () => {
  let mockLog: typeof console.log;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLog = console.log;
    console.log = vi.fn() as unknown as typeof console.log;
  });

  afterEach(() => {
    console.log = mockLog;
  });

  it('should return an empty string if grounding is not provided', async () => {
    const request: AgentRequest = {
      prompt: 'test prompt',
    };
    const context = await getGroundingContext(request);
    expect(context).toBe('');
  });

  it('should return an empty string if grounding strategy is "none"', async () => {
    const request: AgentRequest = {
      prompt: 'test prompt',
      grounding: {
        strategy: 'none',
      },
    };
    const context = await getGroundingContext(request);
    expect(context).toBe('');
  });

  it('should call askCommand for each query_hint when strategy is pgc_first', async () => {
    const { askCommand } = await import('../../commands/ask.js');
    const request: AgentRequest = {
      prompt: 'test prompt',
      grounding: {
        strategy: 'pgc_first',
        query_hints: ['hint1', 'hint2'],
      },
    };

    (askCommand as vi.Mock).mockImplementation((hint) => {
      return Promise.resolve({ answer: `Answer for ${hint}`, sources: [] });
    });

    const context = await getGroundingContext(request);

    expect(askCommand).toHaveBeenCalledTimes(2);
    expect(askCommand).toHaveBeenCalledWith('hint1', expect.any(Object));
    expect(askCommand).toHaveBeenCalledWith('hint2', expect.any(Object));
    expect(context).toContain('Answer for hint1');
    expect(context).toContain('Answer for hint2');
  });

  it('should call findSimilarConversations when overlay_hints includes O7', async () => {
    const { findSimilarConversations } =
      await import('../../sigma/cross-session-query.js');
    const request: AgentRequest = {
      prompt: 'test prompt',
      grounding: {
        strategy: 'pgc_first',
        query_hints: ['hint1'],
        overlay_hints: ['O7'],
      },
    };

    (findSimilarConversations as vi.Mock).mockResolvedValue([
      { session_id: 'session1', content: 'content1' },
    ]);

    const context = await getGroundingContext(request);

    expect(findSimilarConversations).toHaveBeenCalledTimes(1);
    expect(findSimilarConversations).toHaveBeenCalledWith(
      'hint1',
      expect.any(String),
      expect.any(Object)
    );
    expect(context).toContain('Cross-Session Sigma Context');
    expect(context).toContain('[Session: session1] content1');
  });

  it('should handle errors from askCommand gracefully', async () => {
    const { askCommand } = await import('../../commands/ask.js');
    const request: AgentRequest = {
      prompt: 'test prompt',
      grounding: {
        strategy: 'pgc_first',
        query_hints: ['hint1'],
      },
    };
    (askCommand as vi.Mock).mockRejectedValue(new Error('ask error'));

    const context = await getGroundingContext(request);
    expect(context).toContain(
      '(Failed to gather grounding evidence: ask error)'
    );
  });

  it('should handle errors from findSimilarConversations gracefully', async () => {
    const { findSimilarConversations } =
      await import('../../sigma/cross-session-query.js');
    const request: AgentRequest = {
      prompt: 'test prompt',
      grounding: {
        strategy: 'pgc_first',
        query_hints: ['hint1'],
        overlay_hints: ['O7'],
      },
    };
    (findSimilarConversations as vi.Mock).mockRejectedValue(
      new Error('sigma error')
    );

    const context = await getGroundingContext(request);
    expect(context).toContain('(Sigma grounding skipped: sigma error)');
  });
});
