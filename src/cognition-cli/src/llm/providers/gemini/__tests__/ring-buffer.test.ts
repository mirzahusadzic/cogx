import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiAgentProvider } from '../agent-provider.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  appendFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockRejectedValue(new Error('File not found')),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock @google/adk
vi.mock('@google/adk', () => {
  return {
    LlmAgent: vi.fn(),
    Runner: vi.fn(),
    InMemorySessionService: vi.fn().mockImplementation(() => ({
      getSession: vi.fn(),
      appendEvent: vi.fn(),
      sessions: {}, // Used by casting in implementation
    })),
    setLogLevel: vi.fn(),
    LogLevel: { ERROR: 0 },
    StreamingMode: { SSE: 'sse', BIDI: 'bidi' },
    GOOGLE_SEARCH: {},
    FunctionTool: vi.fn(),
  };
});

vi.mock('../../../../sigma/session-state.js', () => ({
  getActiveTaskId: vi.fn(),
}));

vi.mock('../../eviction-utils.js', () => ({
  archiveTaskLogs: vi.fn().mockResolvedValue(undefined),
}));

describe('Gemini Rolling Ring Buffer', () => {
  let provider: GeminiAgentProvider;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSessionService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GeminiAgentProvider('dummy-api-key');
    // Access the private sessionService for mocking
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSessionService = (provider as any).sessionService;
  });

  it('should prune oldest tool logs when exceeding threshold', async () => {
    const taskId = 'task-123';
    const sessionId = 'session-456';
    const tag = `<!-- sigma-task: ${taskId} -->`;
    const threshold = 5;

    // Create 10 events, all with the task tag
    const events = Array.from({ length: 10 }, (_, i) => ({
      content: {
        parts: [
          {
            functionResponse: {
              name: 'test_tool',
              response: { result: `output ${i} ${tag}` },
            },
          },
        ],
      },
    }));

    const session = { sessionId, events: [...events] };
    mockSessionService.getSession.mockResolvedValue(session);

    // Mock the internal storage structure used by the provider
    mockSessionService.sessions = {
      'cognition-cli': {
        'cognition-user': {
          [sessionId]: session,
        },
      },
    };

    // Call the private method
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (provider as any).rollingPruneTaskLogs(
      taskId,
      sessionId,
      '/root',
      threshold,
      session
    );

    // Check that oldest 5 events were pruned (tombstoned)
    const tombstone = 'evicted (Rolling Prune)';

    // First 5 should be pruned
    for (let i = 0; i < 5; i++) {
      const parts = session.events[i].content.parts;
      expect(JSON.stringify(parts)).toContain(tombstone);
    }

    // Last 5 should remain intact
    for (let i = 5; i < 10; i++) {
      const parts = session.events[i].content.parts;
      expect(JSON.stringify(parts)).not.toContain(tombstone);
      expect(JSON.stringify(parts)).toContain(`output ${i}`);
    }
  });

  it('should not prune if under threshold', async () => {
    const taskId = 'task-123';
    const sessionId = 'session-456';
    const tag = `<!-- sigma-task: ${taskId} -->`;
    const threshold = 20;

    const events = Array.from({ length: 10 }, (_, i) => ({
      content: {
        parts: [{ text: `some output ${i} ${tag}` }],
      },
    }));

    const session = { sessionId, events: [...events] };
    mockSessionService.getSession.mockResolvedValue(session);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (provider as any).rollingPruneTaskLogs(
      taskId,
      sessionId,
      '/root',
      threshold,
      session
    );

    // Verify none were pruned
    for (let i = 0; i < 10; i++) {
      expect(session.events[i].content.parts[0].text).toContain(
        `some output ${i}`
      );
    }
  });
});
