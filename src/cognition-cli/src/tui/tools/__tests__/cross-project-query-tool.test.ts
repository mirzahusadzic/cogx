/**
 * Tests for cross-project-query-tool.ts
 *
 * Unit tests for the MCP tool that enables cross-project semantic queries.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock agent-discovery
const mockResolveAgentId = vi.fn();

vi.mock('../../../ipc/agent-discovery.js', () => ({
  resolveAgentId: (...args: unknown[]) => mockResolveAgentId(...args),
}));

// Mock formatters
const mockFormatError = vi.fn();
const mockFormatNotInitialized = vi.fn();
const mockFormatNotFound = vi.fn();

vi.mock('../../../ipc/agent-messaging-formatters.js', () => ({
  formatError: (...args: unknown[]) => mockFormatError(...args),
  formatNotInitialized: (...args: unknown[]) =>
    mockFormatNotInitialized(...args),
  formatNotFound: (...args: unknown[]) => mockFormatNotFound(...args),
}));

// Mock crypto.randomUUID
const mockRandomUUID = vi.fn();
vi.stubGlobal('crypto', {
  randomUUID: () => mockRandomUUID(),
});

// Import after mocking
import { createCrossProjectQueryMcpServer } from '../cross-project-query-tool.js';

describe('createCrossProjectQueryMcpServer', () => {
  const projectRoot = '/test/project';
  const currentAgentId = 'current-agent-123';

  // Mock SDK
  let mockToolFn: ReturnType<typeof vi.fn>;
  let mockCreateSdkMcpServer: ReturnType<typeof vi.fn>;
  let claudeAgentSdk: {
    tool: typeof mockToolFn;
    createSdkMcpServer: typeof mockCreateSdkMcpServer;
  };
  let registeredTools: Map<
    string,
    {
      name: string;
      description: string;
      action: (args: {
        target_alias: string;
        question: string;
      }) => Promise<unknown>;
    }
  >;

  // Mock publisher and queue
  let mockPublisher: {
    sendMessage: ReturnType<typeof vi.fn>;
  };
  let mockQueue: {
    getMessages: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };

  // Mock system message callback
  let mockAddSystemMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    registeredTools = new Map();

    // Mock tool function
    mockToolFn = vi.fn(
      (
        name: string,
        description: string,
        _schema: unknown,
        action: (args: {
          target_alias: string;
          question: string;
        }) => Promise<unknown>
      ) => {
        const toolObj = { name, description, action };
        registeredTools.set(name, toolObj);
        return toolObj;
      }
    );

    mockCreateSdkMcpServer = vi.fn((config) => ({
      ...config,
      _isMcpServer: true,
    }));

    claudeAgentSdk = {
      tool: mockToolFn,
      createSdkMcpServer: mockCreateSdkMcpServer,
    };

    // Mock publisher
    mockPublisher = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    };

    // Mock queue
    mockQueue = {
      getMessages: vi.fn().mockResolvedValue([]),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };

    // Mock system message callback
    mockAddSystemMessage = vi.fn();

    // Default formatter implementations
    mockFormatError.mockReturnValue('Error occurred');
    mockFormatNotInitialized.mockReturnValue('Not initialized');
    mockFormatNotFound.mockReturnValue('Not found');

    // Default agent discovery
    mockResolveAgentId.mockReturnValue(null);

    // Default UUID
    mockRandomUUID.mockReturnValue('test-query-uuid');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should return undefined if claudeAgentSdk is undefined', () => {
      const result = createCrossProjectQueryMcpServer(
        () => mockPublisher,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        undefined
      );

      expect(result).toBeUndefined();
    });

    it('should return MCP server with correct metadata', () => {
      const result = createCrossProjectQueryMcpServer(
        () => mockPublisher,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      expect(result).toBeDefined();
      expect(mockCreateSdkMcpServer).toHaveBeenCalledWith({
        name: 'cross-project-query',
        version: '1.0.0',
        tools: expect.any(Array),
      });
    });

    it('should register query_agent tool', () => {
      createCrossProjectQueryMcpServer(
        () => mockPublisher,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      expect(registeredTools.size).toBe(1);
      expect(registeredTools.has('query_agent')).toBe(true);
    });
  });

  describe('query_agent tool', () => {
    describe('initialization errors', () => {
      it('should return error if publisher is null', async () => {
        createCrossProjectQueryMcpServer(
          () => null,
          () => mockQueue,
          projectRoot,
          currentAgentId,
          claudeAgentSdk
        );

        const tool = registeredTools.get('query_agent')!;
        const resultPromise = tool.action({
          target_alias: 'opus1',
          question: 'How does it work?',
        });

        // Advance timers to allow promise to resolve
        await vi.runAllTimersAsync();
        const result = await resultPromise;

        expect(mockFormatNotInitialized).toHaveBeenCalledWith(
          'Message publisher or queue'
        );
        expect(result).toEqual({
          content: [{ type: 'text', text: 'Not initialized' }],
          isError: true,
        });
      });

      it('should return error if queue is null', async () => {
        createCrossProjectQueryMcpServer(
          () => mockPublisher,
          () => null,
          projectRoot,
          currentAgentId,
          claudeAgentSdk
        );

        const tool = registeredTools.get('query_agent')!;
        const resultPromise = tool.action({
          target_alias: 'opus1',
          question: 'How does it work?',
        });

        await vi.runAllTimersAsync();
        const result = await resultPromise;

        expect(mockFormatNotInitialized).toHaveBeenCalledWith(
          'Message publisher or queue'
        );
        expect(result).toEqual({
          content: [{ type: 'text', text: 'Not initialized' }],
          isError: true,
        });
      });

      it('should return error if getMessageQueue is undefined', async () => {
        createCrossProjectQueryMcpServer(
          () => mockPublisher,
          undefined,
          projectRoot,
          currentAgentId,
          claudeAgentSdk
        );

        const tool = registeredTools.get('query_agent')!;
        const resultPromise = tool.action({
          target_alias: 'opus1',
          question: 'How does it work?',
        });

        await vi.runAllTimersAsync();
        const result = await resultPromise;

        expect(result).toEqual({
          content: [{ type: 'text', text: 'Not initialized' }],
          isError: true,
        });
      });
    });

    describe('agent resolution', () => {
      it('should resolve alias to agent ID', async () => {
        mockResolveAgentId.mockReturnValue('resolved-agent-id');

        createCrossProjectQueryMcpServer(
          () => mockPublisher,
          () => mockQueue,
          projectRoot,
          currentAgentId,
          claudeAgentSdk
        );

        const tool = registeredTools.get('query_agent')!;
        tool.action({
          target_alias: 'opus1',
          question: 'How does it work?',
        });

        // Let it start
        await vi.advanceTimersByTimeAsync(0);

        expect(mockResolveAgentId).toHaveBeenCalledWith(projectRoot, 'opus1');
      });

      it('should return error if agent not found', async () => {
        mockResolveAgentId.mockReturnValue(null);

        createCrossProjectQueryMcpServer(
          () => mockPublisher,
          () => mockQueue,
          projectRoot,
          currentAgentId,
          claudeAgentSdk
        );

        const tool = registeredTools.get('query_agent')!;
        const resultPromise = tool.action({
          target_alias: 'unknown',
          question: 'How does it work?',
        });

        await vi.runAllTimersAsync();
        const result = await resultPromise;

        expect(mockFormatNotFound).toHaveBeenCalledWith('agent', 'unknown');
        expect(result).toEqual({
          content: [{ type: 'text', text: 'Not found' }],
          isError: true,
        });
      });
    });

    describe('query message sending', () => {
      it('should send query request with correct format', async () => {
        mockResolveAgentId.mockReturnValue('target-agent-id');
        mockRandomUUID.mockReturnValue('unique-query-id');

        createCrossProjectQueryMcpServer(
          () => mockPublisher,
          () => mockQueue,
          projectRoot,
          currentAgentId,
          claudeAgentSdk
        );

        const tool = registeredTools.get('query_agent')!;
        tool.action({
          target_alias: 'opus1',
          question: 'How does the lattice work?',
        });

        await vi.advanceTimersByTimeAsync(0);

        expect(mockPublisher.sendMessage).toHaveBeenCalledWith(
          'target-agent-id',
          JSON.stringify({
            type: 'query_request',
            queryId: 'unique-query-id',
            question: 'How does the lattice work?',
          })
        );
      });

      it('should call addSystemMessage with query info if provided', async () => {
        mockResolveAgentId.mockReturnValue('target-agent-id');

        createCrossProjectQueryMcpServer(
          () => mockPublisher,
          () => mockQueue,
          projectRoot,
          currentAgentId,
          claudeAgentSdk,
          mockAddSystemMessage
        );

        const tool = registeredTools.get('query_agent')!;
        tool.action({
          target_alias: 'opus1',
          question: 'How does it work?',
        });

        await vi.advanceTimersByTimeAsync(0);

        expect(mockAddSystemMessage).toHaveBeenCalledWith(
          expect.stringContaining('Querying opus1')
        );
        expect(mockAddSystemMessage).toHaveBeenCalledWith(
          expect.stringContaining('How does it work?')
        );
      });
    });

    describe('response handling', () => {
      it('should find and return direct query_response', async () => {
        mockResolveAgentId.mockReturnValue('target-agent-id');
        mockRandomUUID.mockReturnValue('query-123');

        const responseMessage = {
          id: 'msg-1',
          content: {
            type: 'query_response',
            queryId: 'query-123',
            answer: 'The lattice merges concepts hierarchically.',
          },
        };
        mockQueue.getMessages.mockResolvedValue([responseMessage]);

        createCrossProjectQueryMcpServer(
          () => mockPublisher,
          () => mockQueue,
          projectRoot,
          currentAgentId,
          claudeAgentSdk,
          mockAddSystemMessage
        );

        const tool = registeredTools.get('query_agent')!;
        const resultPromise = tool.action({
          target_alias: 'opus1',
          question: 'How does it work?',
        });

        // Advance past the first poll
        await vi.advanceTimersByTimeAsync(500);

        const result = await resultPromise;

        expect(mockQueue.updateStatus).toHaveBeenCalledWith(
          'msg-1',
          'injected'
        );
        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: expect.stringContaining(
                'The lattice merges concepts hierarchically.'
              ),
            },
          ],
        });
      });

      it('should find and return JSON-encoded query_response in text message', async () => {
        mockResolveAgentId.mockReturnValue('target-agent-id');
        mockRandomUUID.mockReturnValue('query-456');

        const responseMessage = {
          id: 'msg-2',
          content: {
            type: 'text',
            message: JSON.stringify({
              type: 'query_response',
              queryId: 'query-456',
              answer: 'It uses a merge algorithm.',
            }),
          },
        };
        mockQueue.getMessages.mockResolvedValue([responseMessage]);

        createCrossProjectQueryMcpServer(
          () => mockPublisher,
          () => mockQueue,
          projectRoot,
          currentAgentId,
          claudeAgentSdk
        );

        const tool = registeredTools.get('query_agent')!;
        const resultPromise = tool.action({
          target_alias: 'opus1',
          question: 'How does it work?',
        });

        await vi.advanceTimersByTimeAsync(500);

        const result = await resultPromise;

        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: expect.stringContaining('It uses a merge algorithm.'),
            },
          ],
        });
      });

      it('should ignore messages with mismatched queryId', async () => {
        mockResolveAgentId.mockReturnValue('target-agent-id');
        mockRandomUUID.mockReturnValue('query-789');

        // First poll returns wrong queryId
        mockQueue.getMessages.mockResolvedValueOnce([
          {
            id: 'msg-wrong',
            content: {
              type: 'query_response',
              queryId: 'different-query-id',
              answer: 'Wrong answer',
            },
          },
        ]);

        // Second poll returns correct queryId
        mockQueue.getMessages.mockResolvedValueOnce([
          {
            id: 'msg-correct',
            content: {
              type: 'query_response',
              queryId: 'query-789',
              answer: 'Correct answer',
            },
          },
        ]);

        createCrossProjectQueryMcpServer(
          () => mockPublisher,
          () => mockQueue,
          projectRoot,
          currentAgentId,
          claudeAgentSdk
        );

        const tool = registeredTools.get('query_agent')!;
        const resultPromise = tool.action({
          target_alias: 'opus1',
          question: 'How does it work?',
        });

        // First poll - wrong message
        await vi.advanceTimersByTimeAsync(500);
        // Second poll - correct message
        await vi.advanceTimersByTimeAsync(500);

        const result = await resultPromise;

        expect(mockQueue.updateStatus).toHaveBeenCalledWith(
          'msg-correct',
          'injected'
        );
        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: expect.stringContaining('Correct answer'),
            },
          ],
        });
      });

      it('should handle malformed JSON gracefully', async () => {
        mockResolveAgentId.mockReturnValue('target-agent-id');
        mockRandomUUID.mockReturnValue('query-abc');

        // First poll - malformed JSON
        mockQueue.getMessages.mockResolvedValueOnce([
          {
            id: 'msg-malformed',
            content: {
              type: 'text',
              message: 'not valid json {{{',
            },
          },
        ]);

        // Second poll - valid response
        mockQueue.getMessages.mockResolvedValueOnce([
          {
            id: 'msg-valid',
            content: {
              type: 'query_response',
              queryId: 'query-abc',
              answer: 'Valid answer',
            },
          },
        ]);

        createCrossProjectQueryMcpServer(
          () => mockPublisher,
          () => mockQueue,
          projectRoot,
          currentAgentId,
          claudeAgentSdk
        );

        const tool = registeredTools.get('query_agent')!;
        const resultPromise = tool.action({
          target_alias: 'opus1',
          question: 'How does it work?',
        });

        await vi.advanceTimersByTimeAsync(500);
        await vi.advanceTimersByTimeAsync(500);

        const result = await resultPromise;

        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: expect.stringContaining('Valid answer'),
            },
          ],
        });
      });

      it('should call addSystemMessage with answer when found', async () => {
        mockResolveAgentId.mockReturnValue('target-agent-id');
        mockRandomUUID.mockReturnValue('query-def');

        mockQueue.getMessages.mockResolvedValue([
          {
            id: 'msg-1',
            content: {
              type: 'query_response',
              queryId: 'query-def',
              answer: 'Here is the answer.',
            },
          },
        ]);

        createCrossProjectQueryMcpServer(
          () => mockPublisher,
          () => mockQueue,
          projectRoot,
          currentAgentId,
          claudeAgentSdk,
          mockAddSystemMessage
        );

        const tool = registeredTools.get('query_agent')!;
        const resultPromise = tool.action({
          target_alias: 'opus1',
          question: 'How does it work?',
        });

        await vi.advanceTimersByTimeAsync(500);
        await resultPromise;

        expect(mockAddSystemMessage).toHaveBeenCalledWith(
          expect.stringContaining('Received answer from opus1')
        );
        expect(mockAddSystemMessage).toHaveBeenCalledWith(
          expect.stringContaining('Here is the answer.')
        );
      });
    });

    describe('timeout handling', () => {
      it('should timeout after 60 seconds', async () => {
        mockResolveAgentId.mockReturnValue('target-agent-id');
        mockQueue.getMessages.mockResolvedValue([]); // Never returns a response

        createCrossProjectQueryMcpServer(
          () => mockPublisher,
          () => mockQueue,
          projectRoot,
          currentAgentId,
          claudeAgentSdk,
          mockAddSystemMessage
        );

        const tool = registeredTools.get('query_agent')!;
        const resultPromise = tool.action({
          target_alias: 'opus1',
          question: 'How does it work?',
        });

        // Advance 60 seconds
        await vi.advanceTimersByTimeAsync(60000);

        const result = await resultPromise;

        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: expect.stringContaining('Timeout'),
            },
          ],
          isError: true,
        });
      });

      it('should call addSystemMessage with timeout message', async () => {
        mockResolveAgentId.mockReturnValue('target-agent-id');
        mockQueue.getMessages.mockResolvedValue([]);

        createCrossProjectQueryMcpServer(
          () => mockPublisher,
          () => mockQueue,
          projectRoot,
          currentAgentId,
          claudeAgentSdk,
          mockAddSystemMessage
        );

        const tool = registeredTools.get('query_agent')!;
        const resultPromise = tool.action({
          target_alias: 'opus1',
          question: 'How does it work?',
        });

        await vi.advanceTimersByTimeAsync(60000);
        await resultPromise;

        expect(mockAddSystemMessage).toHaveBeenCalledWith(
          expect.stringContaining('Timeout')
        );
      });

      it('should include agent alias in timeout message', async () => {
        mockResolveAgentId.mockReturnValue('target-agent-id');
        mockQueue.getMessages.mockResolvedValue([]);

        createCrossProjectQueryMcpServer(
          () => mockPublisher,
          () => mockQueue,
          projectRoot,
          currentAgentId,
          claudeAgentSdk
        );

        const tool = registeredTools.get('query_agent')!;
        const resultPromise = tool.action({
          target_alias: 'sonnet3',
          question: 'How does it work?',
        });

        await vi.advanceTimersByTimeAsync(60000);

        const result = (await resultPromise) as {
          content: { text: string }[];
        };

        expect(result.content[0].text).toContain('sonnet3');
        expect(result.content[0].text).toContain('60s');
      });
    });

    describe('error handling', () => {
      it('should catch and format errors', async () => {
        mockResolveAgentId.mockReturnValue('target-agent-id');
        mockPublisher.sendMessage.mockRejectedValue(new Error('Network error'));

        createCrossProjectQueryMcpServer(
          () => mockPublisher,
          () => mockQueue,
          projectRoot,
          currentAgentId,
          claudeAgentSdk
        );

        const tool = registeredTools.get('query_agent')!;
        const resultPromise = tool.action({
          target_alias: 'opus1',
          question: 'How does it work?',
        });

        await vi.runAllTimersAsync();
        const result = await resultPromise;

        expect(mockFormatError).toHaveBeenCalledWith(
          'query agent',
          'Network error'
        );
        expect(result).toEqual({
          content: [{ type: 'text', text: 'Error occurred' }],
          isError: true,
        });
      });

      it('should work without addSystemMessage callback', async () => {
        mockResolveAgentId.mockReturnValue('target-agent-id');
        mockRandomUUID.mockReturnValue('query-no-callback');

        mockQueue.getMessages.mockResolvedValue([
          {
            id: 'msg-1',
            content: {
              type: 'query_response',
              queryId: 'query-no-callback',
              answer: 'Answer without callback',
            },
          },
        ]);

        // Create without addSystemMessage
        createCrossProjectQueryMcpServer(
          () => mockPublisher,
          () => mockQueue,
          projectRoot,
          currentAgentId,
          claudeAgentSdk
          // No addSystemMessage
        );

        const tool = registeredTools.get('query_agent')!;
        const resultPromise = tool.action({
          target_alias: 'opus1',
          question: 'How does it work?',
        });

        await vi.advanceTimersByTimeAsync(500);

        const result = await resultPromise;

        // Should still work without throwing
        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: expect.stringContaining('Answer without callback'),
            },
          ],
        });
      });
    });

    describe('polling behavior', () => {
      it('should poll every 500ms', async () => {
        mockResolveAgentId.mockReturnValue('target-agent-id');
        mockRandomUUID.mockReturnValue('poll-test-query');

        // Return empty on first few polls, then return response
        mockQueue.getMessages
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValue([
            {
              id: 'msg-1',
              content: {
                type: 'query_response',
                queryId: 'poll-test-query',
                answer: 'Answer after polling',
              },
            },
          ]);

        createCrossProjectQueryMcpServer(
          () => mockPublisher,
          () => mockQueue,
          projectRoot,
          currentAgentId,
          claudeAgentSdk
        );

        const tool = registeredTools.get('query_agent')!;
        const resultPromise = tool.action({
          target_alias: 'opus1',
          question: 'How does it work?',
        });

        // Advance through polls
        await vi.advanceTimersByTimeAsync(500); // 1st poll
        await vi.advanceTimersByTimeAsync(500); // 2nd poll
        await vi.advanceTimersByTimeAsync(500); // 3rd poll
        await vi.advanceTimersByTimeAsync(500); // 4th poll - finds response

        const result = await resultPromise;

        expect(mockQueue.getMessages).toHaveBeenCalledTimes(4);
        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: expect.stringContaining('Answer after polling'),
            },
          ],
        });
      });
    });
  });
});
