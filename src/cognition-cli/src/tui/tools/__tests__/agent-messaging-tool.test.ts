/**
 * Tests for agent-messaging-tool.ts
 *
 * Unit tests for the MCP tool that enables agent-to-agent messaging.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock agent-discovery
const mockGetActiveAgents = vi.fn();
const mockResolveAgentId = vi.fn();

vi.mock('../../../ipc/agent-discovery.js', () => ({
  getActiveAgents: (...args: unknown[]) => mockGetActiveAgents(...args),
  resolveAgentId: (...args: unknown[]) => mockResolveAgentId(...args),
}));

// Mock formatters
const mockFormatListAgents = vi.fn();
const mockFormatMessageSent = vi.fn();
const mockFormatBroadcastSent = vi.fn();
const mockFormatPendingMessages = vi.fn();
const mockFormatMessageMarked = vi.fn();
const mockFormatMessageContent = vi.fn();
const mockFormatError = vi.fn();
const mockFormatNotInitialized = vi.fn();
const mockFormatNotFound = vi.fn();

vi.mock('../../../ipc/agent-messaging-formatters.js', () => ({
  formatListAgents: (...args: unknown[]) => mockFormatListAgents(...args),
  formatMessageSent: (...args: unknown[]) => mockFormatMessageSent(...args),
  formatBroadcastSent: (...args: unknown[]) => mockFormatBroadcastSent(...args),
  formatPendingMessages: (...args: unknown[]) =>
    mockFormatPendingMessages(...args),
  formatMessageMarked: (...args: unknown[]) => mockFormatMessageMarked(...args),
  formatMessageContent: (...args: unknown[]) =>
    mockFormatMessageContent(...args),
  formatError: (...args: unknown[]) => mockFormatError(...args),
  formatNotInitialized: (...args: unknown[]) =>
    mockFormatNotInitialized(...args),
  formatNotFound: (...args: unknown[]) => mockFormatNotFound(...args),
}));

// Import after mocking
import { createAgentMessagingMcpServer } from '../agent-messaging-tool.js';

describe('createAgentMessagingMcpServer', () => {
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
      action: (...args: unknown[]) => unknown;
    }
  >;

  // Mock publisher and queue
  let mockPublisher: {
    sendMessage: ReturnType<typeof vi.fn>;
    broadcast: ReturnType<typeof vi.fn>;
  };
  let mockQueue: {
    getMessages: ReturnType<typeof vi.fn>;
    getMessage: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    registeredTools = new Map();

    // Mock tool function that captures registrations
    mockToolFn = vi.fn(
      (
        name: string,
        description: string,
        _schema: unknown,
        action: (...args: unknown[]) => unknown
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
      broadcast: vi.fn().mockResolvedValue(undefined),
    };

    // Mock queue
    mockQueue = {
      getMessages: vi.fn().mockResolvedValue([]),
      getMessage: vi.fn().mockResolvedValue(null),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };

    // Default formatter implementations
    mockFormatListAgents.mockReturnValue('Formatted agent list');
    mockFormatMessageSent.mockReturnValue('Message sent');
    mockFormatBroadcastSent.mockReturnValue('Broadcast sent');
    mockFormatPendingMessages.mockReturnValue('Pending messages');
    mockFormatMessageMarked.mockReturnValue('Message marked');
    mockFormatMessageContent.mockReturnValue('Message content');
    mockFormatError.mockReturnValue('Error occurred');
    mockFormatNotInitialized.mockReturnValue('Not initialized');
    mockFormatNotFound.mockReturnValue('Not found');

    // Default agent discovery
    mockGetActiveAgents.mockReturnValue([]);
    mockResolveAgentId.mockReturnValue(null);
  });

  describe('initialization', () => {
    it('should return undefined if claudeAgentSdk is undefined', () => {
      const result = createAgentMessagingMcpServer(
        () => mockPublisher,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        undefined
      );

      expect(result).toBeUndefined();
    });

    it('should return MCP server with correct metadata', () => {
      const result = createAgentMessagingMcpServer(
        () => mockPublisher,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      expect(result).toBeDefined();
      expect(mockCreateSdkMcpServer).toHaveBeenCalledWith({
        name: 'agent-messaging',
        version: '1.0.0',
        tools: expect.any(Array),
      });
    });

    it('should register all 5 tools', () => {
      createAgentMessagingMcpServer(
        () => mockPublisher,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      expect(registeredTools.size).toBe(5);
      expect(registeredTools.has('list_agents')).toBe(true);
      expect(registeredTools.has('send_agent_message')).toBe(true);
      expect(registeredTools.has('broadcast_agent_message')).toBe(true);
      expect(registeredTools.has('list_pending_messages')).toBe(true);
      expect(registeredTools.has('mark_message_read')).toBe(true);
    });
  });

  describe('list_agents tool', () => {
    it('should return formatted list of active agents', async () => {
      const agents = [
        { agentId: 'agent-1', alias: 'opus1', model: 'claude-opus' },
        { agentId: 'agent-2', alias: 'sonnet2', model: 'claude-sonnet' },
      ];
      mockGetActiveAgents.mockReturnValue(agents);

      createAgentMessagingMcpServer(
        () => mockPublisher,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      const tool = registeredTools.get('list_agents')!;
      const result = await tool.action();

      expect(mockGetActiveAgents).toHaveBeenCalledWith(
        projectRoot,
        currentAgentId
      );
      expect(mockFormatListAgents).toHaveBeenCalledWith(agents);
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Formatted agent list' }],
      });
    });

    it('should return error if discovery fails', async () => {
      mockGetActiveAgents.mockImplementation(() => {
        throw new Error('Discovery failed');
      });

      createAgentMessagingMcpServer(
        () => mockPublisher,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      const tool = registeredTools.get('list_agents')!;
      const result = await tool.action();

      expect(mockFormatError).toHaveBeenCalledWith(
        'list agents',
        'Discovery failed'
      );
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error occurred' }],
        isError: true,
      });
    });
  });

  describe('send_agent_message tool', () => {
    it('should return error if publisher is null', async () => {
      createAgentMessagingMcpServer(
        () => null,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      const tool = registeredTools.get('send_agent_message')!;
      const result = await tool.action({ to: 'opus1', message: 'Hello' });

      expect(mockFormatNotInitialized).toHaveBeenCalledWith(
        'Message publisher'
      );
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Not initialized' }],
        isError: true,
      });
    });

    it('should resolve alias to agent ID', async () => {
      mockResolveAgentId.mockReturnValue('resolved-agent-id');

      createAgentMessagingMcpServer(
        () => mockPublisher,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      const tool = registeredTools.get('send_agent_message')!;
      await tool.action({ to: 'opus1', message: 'Hello' });

      expect(mockResolveAgentId).toHaveBeenCalledWith(projectRoot, 'opus1');
    });

    it('should return error if agent not found', async () => {
      mockResolveAgentId.mockReturnValue(null);

      createAgentMessagingMcpServer(
        () => mockPublisher,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      const tool = registeredTools.get('send_agent_message')!;
      const result = await tool.action({ to: 'unknown', message: 'Hello' });

      expect(mockFormatNotFound).toHaveBeenCalledWith('agent', 'unknown');
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Not found' }],
        isError: true,
      });
    });

    it('should send message and return success', async () => {
      mockResolveAgentId.mockReturnValue('resolved-agent-id');

      createAgentMessagingMcpServer(
        () => mockPublisher,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      const tool = registeredTools.get('send_agent_message')!;
      const result = await tool.action({ to: 'opus1', message: 'Hello there' });

      expect(mockPublisher.sendMessage).toHaveBeenCalledWith(
        'resolved-agent-id',
        'Hello there'
      );
      expect(mockFormatMessageSent).toHaveBeenCalledWith(
        'opus1',
        'resolved-agent-id',
        'Hello there'
      );
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Message sent' }],
      });
    });

    it('should handle send error', async () => {
      mockResolveAgentId.mockReturnValue('resolved-agent-id');
      mockPublisher.sendMessage.mockRejectedValue(new Error('Network error'));

      createAgentMessagingMcpServer(
        () => mockPublisher,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      const tool = registeredTools.get('send_agent_message')!;
      const result = await tool.action({ to: 'opus1', message: 'Hello' });

      expect(mockFormatError).toHaveBeenCalledWith(
        'send message',
        'Network error'
      );
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error occurred' }],
        isError: true,
      });
    });
  });

  describe('broadcast_agent_message tool', () => {
    it('should return error if publisher is null', async () => {
      createAgentMessagingMcpServer(
        () => null,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      const tool = registeredTools.get('broadcast_agent_message')!;
      const result = await tool.action({ message: 'Hello everyone' });

      expect(mockFormatNotInitialized).toHaveBeenCalledWith(
        'Message publisher'
      );
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Not initialized' }],
        isError: true,
      });
    });

    it('should broadcast message and return success', async () => {
      const agents = [
        { agentId: 'agent-1', alias: 'opus1' },
        { agentId: 'agent-2', alias: 'sonnet2' },
      ];
      mockGetActiveAgents.mockReturnValue(agents);

      createAgentMessagingMcpServer(
        () => mockPublisher,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      const tool = registeredTools.get('broadcast_agent_message')!;
      const result = await tool.action({ message: 'Hello everyone' });

      expect(mockPublisher.broadcast).toHaveBeenCalledWith('agent.message', {
        type: 'text',
        message: 'Hello everyone',
      });
      expect(mockFormatBroadcastSent).toHaveBeenCalledWith(2, 'Hello everyone');
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Broadcast sent' }],
      });
    });

    it('should handle broadcast error', async () => {
      mockPublisher.broadcast.mockRejectedValue(new Error('Broadcast failed'));

      createAgentMessagingMcpServer(
        () => mockPublisher,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      const tool = registeredTools.get('broadcast_agent_message')!;
      const result = await tool.action({ message: 'Hello' });

      expect(mockFormatError).toHaveBeenCalledWith(
        'broadcast message',
        'Broadcast failed'
      );
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error occurred' }],
        isError: true,
      });
    });
  });

  describe('list_pending_messages tool', () => {
    it('should return error if queue is null', async () => {
      createAgentMessagingMcpServer(
        () => mockPublisher,
        () => null,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      const tool = registeredTools.get('list_pending_messages')!;
      const result = await tool.action();

      expect(mockFormatNotInitialized).toHaveBeenCalledWith('Message queue');
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Not initialized' }],
        isError: true,
      });
    });

    it('should return error if getMessageQueue is undefined', async () => {
      createAgentMessagingMcpServer(
        () => mockPublisher,
        undefined,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      const tool = registeredTools.get('list_pending_messages')!;
      const result = await tool.action();

      expect(mockFormatNotInitialized).toHaveBeenCalledWith('Message queue');
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Not initialized' }],
        isError: true,
      });
    });

    it('should return formatted pending messages', async () => {
      const messages = [
        { id: 'msg-1', from: 'agent-1', content: 'Hello' },
        { id: 'msg-2', from: 'agent-2', content: 'World' },
      ];
      mockQueue.getMessages.mockResolvedValue(messages);

      createAgentMessagingMcpServer(
        () => mockPublisher,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      const tool = registeredTools.get('list_pending_messages')!;
      const result = await tool.action();

      expect(mockQueue.getMessages).toHaveBeenCalledWith('pending');
      expect(mockFormatPendingMessages).toHaveBeenCalledWith(messages);
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Pending messages' }],
      });
    });

    it('should handle queue error', async () => {
      mockQueue.getMessages.mockRejectedValue(new Error('Queue read error'));

      createAgentMessagingMcpServer(
        () => mockPublisher,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      const tool = registeredTools.get('list_pending_messages')!;
      const result = await tool.action();

      expect(mockFormatError).toHaveBeenCalledWith(
        'list pending messages',
        'Queue read error'
      );
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error occurred' }],
        isError: true,
      });
    });
  });

  describe('mark_message_read tool', () => {
    it('should return error if queue is null', async () => {
      createAgentMessagingMcpServer(
        () => mockPublisher,
        () => null,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      const tool = registeredTools.get('mark_message_read')!;
      const result = await tool.action({ messageId: 'msg-1' });

      expect(mockFormatNotInitialized).toHaveBeenCalledWith('Message queue');
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Not initialized' }],
        isError: true,
      });
    });

    it('should return error if message not found', async () => {
      mockQueue.getMessage.mockResolvedValue(null);

      createAgentMessagingMcpServer(
        () => mockPublisher,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      const tool = registeredTools.get('mark_message_read')!;
      const result = await tool.action({ messageId: 'nonexistent' });

      expect(mockQueue.getMessage).toHaveBeenCalledWith('nonexistent');
      expect(mockFormatNotFound).toHaveBeenCalledWith('Message', 'nonexistent');
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Not found' }],
        isError: true,
      });
    });

    it('should default status to injected', async () => {
      const message = { id: 'msg-1', from: 'agent-1', content: 'Hello' };
      mockQueue.getMessage.mockResolvedValue(message);

      createAgentMessagingMcpServer(
        () => mockPublisher,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      const tool = registeredTools.get('mark_message_read')!;
      await tool.action({ messageId: 'msg-1' });

      expect(mockQueue.updateStatus).toHaveBeenCalledWith('msg-1', 'injected');
    });

    it('should use provided status', async () => {
      const message = { id: 'msg-1', from: 'agent-1', content: 'Hello' };
      mockQueue.getMessage.mockResolvedValue(message);

      createAgentMessagingMcpServer(
        () => mockPublisher,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      const tool = registeredTools.get('mark_message_read')!;
      await tool.action({ messageId: 'msg-1', status: 'dismissed' });

      expect(mockQueue.updateStatus).toHaveBeenCalledWith('msg-1', 'dismissed');
    });

    it('should return formatted success message', async () => {
      const message = {
        id: 'msg-1',
        from: 'agent-1',
        content: { type: 'text', message: 'Hello' },
      };
      mockQueue.getMessage.mockResolvedValue(message);
      mockFormatMessageContent.mockReturnValue('Hello');

      createAgentMessagingMcpServer(
        () => mockPublisher,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      const tool = registeredTools.get('mark_message_read')!;
      const result = await tool.action({ messageId: 'msg-1', status: 'read' });

      expect(mockFormatMessageMarked).toHaveBeenCalledWith(
        'msg-1',
        'read',
        'agent-1',
        'Hello'
      );
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Message marked' }],
      });
    });

    it('should handle update error', async () => {
      const message = { id: 'msg-1', from: 'agent-1', content: 'Hello' };
      mockQueue.getMessage.mockResolvedValue(message);
      mockQueue.updateStatus.mockRejectedValue(new Error('Update failed'));

      createAgentMessagingMcpServer(
        () => mockPublisher,
        () => mockQueue,
        projectRoot,
        currentAgentId,
        claudeAgentSdk
      );

      const tool = registeredTools.get('mark_message_read')!;
      const result = await tool.action({ messageId: 'msg-1' });

      expect(mockFormatError).toHaveBeenCalledWith(
        'mark message',
        'Update failed'
      );
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error occurred' }],
        isError: true,
      });
    });
  });
});
