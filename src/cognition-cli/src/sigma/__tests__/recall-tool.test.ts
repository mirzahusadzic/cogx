/**
 * Recall Tool Tests
 *
 * Tests for the recall_past_conversation MCP tool that allows Claude
 * to query past conversation using semantic search.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRecallMcpServer } from '../recall-tool.js';
import type { ConversationOverlayRegistry } from '../conversation-registry.js';

// Mock the query-conversation module
vi.mock('../query-conversation.js', () => ({
  queryConversationLattice: vi.fn(),
}));

// Mock the context-reconstructor module
vi.mock('../context-reconstructor.js', () => ({
  RECAP_PREVIEW_LENGTH: 500,
}));

describe('Recall Tool', () => {
  let mockRegistry: ConversationOverlayRegistry;
  let mockToolFn: ReturnType<typeof vi.fn>;
  let mockCreateServerFn: ReturnType<typeof vi.fn>;
  let mockClaudeAgentSdk: {
    tool: ReturnType<typeof vi.fn>;
    createSdkMcpServer: ReturnType<typeof vi.fn>;
  };
  let capturedToolAction:
    | ((args: { query: string }) => Promise<unknown>)
    | null;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset captured action
    capturedToolAction = null;

    // Create mock registry
    mockRegistry = {} as ConversationOverlayRegistry;

    // Create mock tool function that captures the action
    mockToolFn = vi
      .fn()
      .mockImplementation(
        (
          _name: string,
          _description: string,
          _schema: unknown,
          action: (args: { query: string }) => Promise<unknown>
        ) => {
          capturedToolAction = action;
          return { name: 'recall_past_conversation' };
        }
      );

    // Create mock createSdkMcpServer
    mockCreateServerFn = vi.fn().mockReturnValue({
      name: 'conversation-memory',
      tools: [],
    });

    mockClaudeAgentSdk = {
      tool: mockToolFn,
      createSdkMcpServer: mockCreateServerFn,
    };
  });

  describe('createRecallMcpServer()', () => {
    it('should return undefined when claudeAgentSdk is not provided', () => {
      const server = createRecallMcpServer(mockRegistry, undefined);

      expect(server).toBeUndefined();
    });

    it('should create MCP server when SDK is provided', () => {
      const server = createRecallMcpServer(mockRegistry, mockClaudeAgentSdk);

      expect(server).toBeDefined();
      expect(mockCreateServerFn).toHaveBeenCalled();
    });

    it('should create tool with correct name', () => {
      createRecallMcpServer(mockRegistry, mockClaudeAgentSdk);

      expect(mockToolFn).toHaveBeenCalledWith(
        'recall_past_conversation',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should include description mentioning overlays and truncation', () => {
      createRecallMcpServer(mockRegistry, mockClaudeAgentSdk);

      const description = mockToolFn.mock.calls[0][1];
      expect(description).toContain('O1-O7');
      expect(description).toContain('LanceDB');
      expect(description).toContain('truncated');
    });

    it('should create server with correct name and version', () => {
      createRecallMcpServer(mockRegistry, mockClaudeAgentSdk);

      expect(mockCreateServerFn).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'conversation-memory',
          version: '1.0.0',
        })
      );
    });

    it('should include the recall tool in the server tools', () => {
      createRecallMcpServer(mockRegistry, mockClaudeAgentSdk);

      const serverConfig = mockCreateServerFn.mock.calls[0][0];
      expect(serverConfig.tools).toHaveLength(1);
      expect(serverConfig.tools[0]).toEqual({
        name: 'recall_past_conversation',
      });
    });
  });

  describe('Tool Action', () => {
    beforeEach(async () => {
      createRecallMcpServer(
        mockRegistry,
        mockClaudeAgentSdk,
        'http://localhost:3001'
      );
    });

    it('should call queryConversationLattice with correct parameters', async () => {
      const { queryConversationLattice } =
        await import('../query-conversation.js');
      (queryConversationLattice as ReturnType<typeof vi.fn>).mockResolvedValue(
        'Found context about TUI scrolling'
      );

      expect(capturedToolAction).not.toBeNull();
      await capturedToolAction!({
        query: 'What did we discuss about TUI scrolling?',
      });

      expect(queryConversationLattice).toHaveBeenCalledWith(
        'What did we discuss about TUI scrolling?',
        mockRegistry,
        expect.objectContaining({
          workbenchUrl: 'http://localhost:3001',
          topK: 10,
          verbose: false,
        })
      );
    });

    it('should return formatted success response', async () => {
      const { queryConversationLattice } =
        await import('../query-conversation.js');
      (queryConversationLattice as ReturnType<typeof vi.fn>).mockResolvedValue(
        'TUI scrolling was discussed in session 5'
      );

      expect(capturedToolAction).not.toBeNull();
      const result = await capturedToolAction!({ query: 'TUI scrolling' });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('Found relevant context'),
          },
        ],
      });
      expect(
        (result as { content: Array<{ text: string }> }).content[0].text
      ).toContain('TUI scrolling was discussed in session 5');
    });

    it('should handle errors gracefully', async () => {
      const { queryConversationLattice } =
        await import('../query-conversation.js');
      (queryConversationLattice as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database connection failed')
      );

      expect(capturedToolAction).not.toBeNull();
      const result = await capturedToolAction!({ query: 'anything' });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('Failed to recall conversation'),
          },
        ],
        isError: true,
      });
      expect(
        (result as { content: Array<{ text: string }> }).content[0].text
      ).toContain('Database connection failed');
    });

    it('should work without workbenchUrl', async () => {
      // Create server without workbenchUrl
      capturedToolAction = null;
      createRecallMcpServer(mockRegistry, mockClaudeAgentSdk);

      const { queryConversationLattice } =
        await import('../query-conversation.js');
      (queryConversationLattice as ReturnType<typeof vi.fn>).mockResolvedValue(
        'result'
      );

      expect(capturedToolAction).not.toBeNull();
      await capturedToolAction!({ query: 'test' });

      expect(queryConversationLattice).toHaveBeenCalledWith(
        'test',
        mockRegistry,
        expect.objectContaining({
          workbenchUrl: undefined,
        })
      );
    });
  });

  describe('Input Schema', () => {
    it('should define query parameter with description', () => {
      createRecallMcpServer(mockRegistry, mockClaudeAgentSdk);

      const schema = mockToolFn.mock.calls[0][2];
      expect(schema).toHaveProperty('query');
    });
  });
});
