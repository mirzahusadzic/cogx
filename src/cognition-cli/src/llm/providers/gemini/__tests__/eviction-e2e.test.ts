import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiAgentProvider } from '../agent-provider.js';

// We mock the Runner but NOT the InMemorySessionService to test real persistence logic
vi.mock('@google/adk', async () => {
  const actual = (await vi.importActual('@google/adk')) as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    Runner: vi.fn().mockImplementation(() => ({
      runAsync: vi.fn().mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { author: 'user', content: { parts: [{ text: 'hello' }] } };
        },
      }),
    })),
  };
});

vi.mock('../../../../sigma/session-state.js', () => ({
  getActiveTaskId: vi.fn(),
}));

describe('Gemini Eviction E2E (Real Persistence)', () => {
  let provider: GeminiAgentProvider;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
    provider = new GeminiAgentProvider();
  });

  it('should persist pruned state in the real InMemorySessionService internal storage', async () => {
    const taskId = 'task-e2e-999';
    const resultSummary = 'This is a real E2E summary that must persist.';

    // 1. Initial State: Create a session with a tagged message
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionService = (provider as any).sessionService;

    // Create the session first to ensure it's properly initialized in the service
    // ADK 0.2.4 API uses a structured argument for session identification
    const sessionIdentity = {
      appName: 'cognition-cli',
      userId: 'cognition-user',
      sessionId: 'e2e-session-id',
    };

    await sessionService.createSession(sessionIdentity);

    // Fetch the session object to pass to appendEvent
    const session = await sessionService.getSession(sessionIdentity);

    // We need to simulate the multi-turn flow where ADK would have populated the session
    await sessionService.appendEvent({
      session,
      event: {
        author: 'cognition_agent',
        content: {
          parts: [
            {
              functionCall: {
                name: 'SigmaTaskUpdate',
                args: {
                  todos: [
                    {
                      id: taskId,
                      status: 'in_progress',
                      content: 'test',
                      activeForm: 'testing',
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    });

    await sessionService.appendEvent({
      session,
      event: {
        author: 'cognition_agent',
        content: {
          parts: [
            {
              functionCall: {
                name: 'bash',
                args: { command: 'ls' },
              },
            },
          ],
        },
      },
    });

    await sessionService.appendEvent({
      session,
      event: {
        author: 'user',
        content: {
          parts: [
            {
              functionResponse: {
                name: 'bash',
                response: {
                  result: `file1.txt\nfile2.txt <!-- sigma-task: ${taskId} -->`,
                  exitCode: 0,
                },
              },
            },
          ],
        },
      },
    });

    // 2. Execute Pruning
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (provider as any).pruneTaskLogs(
      taskId,
      resultSummary,
      sessionIdentity.sessionId,
      '/tmp'
    );

    // 3. Verification: Retrieve the session again using the REAL getSession
    const prunedSession = await sessionService.getSession(sessionIdentity);

    // After pruning:
    // 1. SigmaTaskUpdate (AssistantTurnInRange) -> Assistant Tombstone
    // 2. bash Call (AssistantTurnInRange) -> Assistant Tombstone (combined with 1 if they were separate turns, but here they are separate events)
    // 3. bash Response (hasTag) -> Tool Tombstone

    // Actually, pruneTaskLogs currently creates a new event for EACH evicted event that satisfies the criteria.
    expect(prunedSession.events.length).toBe(3);

    const toolResponseEvent = prunedSession.events[2];
    expect(
      toolResponseEvent.content.parts[0].functionResponse.response.result
    ).toContain(resultSummary);
    expect(
      toolResponseEvent.content.parts[0].functionResponse.response.result
    ).toContain('completed');

    // 4. Verification: Verify reference isolation (the Bug Fix)
    // If we call getSession again, we should get a NEW array reference
    const secondRetrieval = await sessionService.getSession(sessionIdentity);
    expect(secondRetrieval.events).not.toBe(prunedSession.events);
    expect(secondRetrieval.events[0].content.parts[0].text).toBe(
      prunedSession.events[0].content.parts[0].text
    );

    // 5. Verification: Simulate a new turn and ensure pruned history is what Gemini sees
    // We add a new message and then fetch again
    await sessionService.appendEvent({
      session: secondRetrieval,
      event: {
        author: 'user',
        content: { parts: [{ text: 'Next task please' }] },
      },
    });

    const finalSession = await sessionService.getSession(sessionIdentity);
    expect(finalSession.events.length).toBe(4);
    // The first 3 should still be the tombstones
    expect(
      finalSession.events[2].content.parts[0].functionResponse.response.result
    ).toContain(resultSummary);
  });
});
