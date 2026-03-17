import { describe, it, expect, beforeEach } from 'vitest';
import { GeminiAgentProvider } from '../agent-provider';

// Define types to avoid 'any'
interface MockPart {
  text?: string;
  thoughtSignature?: string;
  thought?: boolean;
}

interface MockEvent {
  author: string;
  content: {
    parts: MockPart[];
  };
}

interface MockSession {
  sessionId: string;
  events: MockEvent[];
}

// Mock InMemorySessionService
class MockSessionService {
  sessions: Record<string, Record<string, Record<string, MockSession>>> = {
    'cognition-cli': {
      'cognition-user': {},
    },
  };

  appendEvent = async (args: {
    session: { sessionId: string };
    event: MockEvent;
  }) => {
    // This is the implementation that originalAppendEvent will bind to.
    const { session, event } = args;
    const sessId = session.sessionId;
    if (!this.sessions['cognition-cli']['cognition-user'][sessId]) {
      this.sessions['cognition-cli']['cognition-user'][sessId] = {
        sessionId: sessId,
        events: [],
      };
    }
    const storedSession =
      this.sessions['cognition-cli']['cognition-user'][sessId];
    storedSession.events.push(event);
  };

  async getSession(args: { sessionId: string }) {
    return this.sessions['cognition-cli']['cognition-user'][args.sessionId];
  }
}

describe('GeminiAgentProvider Thought Signature Logic', () => {
  let provider: GeminiAgentProvider;
  let mockSessionService: MockSessionService;

  beforeEach(() => {
    mockSessionService = new MockSessionService();

    provider = new GeminiAgentProvider({
      apiKey: 'test-key',
      sessionService: mockSessionService as unknown,
    });
  });

  describe('appendEvent Monkey-patch', () => {
    it('should link thoughtSignature from one part to others in the same event', async () => {
      const sessionId = 'test-session';
      const event: MockEvent = {
        author: 'cognition_agent',
        content: {
          parts: [
            { thoughtSignature: 'sig-123', thought: true, text: 'Thinking...' },
            { text: 'Doing something...' },
          ],
        },
      };

      // USE THE MONKEY-PATCHED VERSION from the service instance
      // The provider constructor should have replaced mockSessionService.appendEvent
      await mockSessionService.appendEvent({
        session: { sessionId },
        event,
      });

      expect(event.content.parts[1]).toHaveProperty(
        'thoughtSignature',
        'sig-123'
      );

      const session = await mockSessionService.getSession({ sessionId });
      expect(session.events).toHaveLength(1);
    });

    it('should use last known signature for events without one', async () => {
      const sessionId = 'test-session';

      // First event sets the signature
      await mockSessionService.appendEvent({
        session: { sessionId },
        event: {
          author: 'cognition_agent',
          content: { parts: [{ thoughtSignature: 'sig-456' }] },
        },
      });

      // Second event should get it
      const event2: MockEvent = {
        author: 'cognition_agent',
        content: { parts: [{ text: 'Follow up' }] },
      };
      await mockSessionService.appendEvent({
        session: { sessionId },
        event: event2,
      });

      expect(event2.content.parts[0]).toHaveProperty(
        'thoughtSignature',
        'sig-456'
      );
    });
  });

  describe('Pruning Preservation', () => {
    it('should preserve thoughtSignature in rollingPruneTaskLogs', async () => {
      const sessionId = 'test-session';
      const taskId = 'task-1';
      const tag = `<!-- sigma-task: ${taskId} -->`;

      const session: MockSession = {
        sessionId,
        events: [
          {
            author: 'cognition_agent',
            content: {
              parts: [
                { text: `Log with ${tag}`, thoughtSignature: 'sig-prune' },
              ],
            },
          },
        ],
      };

      mockSessionService.sessions['cognition-cli']['cognition-user'][
        sessionId
      ] = session;

      // Call rollingPruneTaskLogs with correct positional arguments
      // taskId, sessionId, projectRoot, threshold, activeSession
      const providerWithPruning = provider as unknown as {
        rollingPruneTaskLogs: (
          taskId: string,
          sessionId: string,
          projectRoot: string,
          threshold: number,
          activeSession: unknown
        ) => Promise<void>;
      };

      await providerWithPruning.rollingPruneTaskLogs(
        taskId,
        sessionId,
        '/tmp',
        0, // threshold 0 forces pruning
        session as unknown
      );

      const prunedPart = session.events[0].content.parts[0];
      expect(prunedPart.text).toContain('evicted');
      expect(prunedPart).toHaveProperty('thoughtSignature', 'sig-prune');
    });
  });
});
