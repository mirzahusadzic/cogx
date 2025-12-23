import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  queryConversationLattice,
  filterConversationByAlignment,
} from '../query-conversation.js';

const { mockWorkbench } = vi.hoisted(() => ({
  mockWorkbench: {
    summarize: vi.fn(),
  },
}));

vi.mock('../../core/executors/workbench-client.js', () => ({
  WorkbenchClient: vi.fn().mockImplementation(() => mockWorkbench),
}));

describe('QueryConversation', () => {
  const mockOverlay = () => ({
    query: vi.fn().mockResolvedValue([]),
    getAllItems: vi.fn().mockResolvedValue([]),
  });

  const mockRegistry = {
    get: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queryConversationLattice', () => {
    it('should deconstruct, search, and synthesize', async () => {
      // Step 1: Deconstruction
      mockWorkbench.summarize.mockResolvedValueOnce({
        summary:
          '```json\n{"intent": "find-tui", "entities": ["TUI"], "scope": "conversation", "refined_query": "TUI scrolling"}\n```',
      });

      // Step 2: Search
      const o1 = mockOverlay();
      o1.query.mockResolvedValue([
        {
          item: {
            id: '1',
            embedding: [],
            metadata: { text: 'Turn 1 content', role: 'user', timestamp: 100 },
          },
          similarity: 0.9,
        },
      ]);
      mockRegistry.get.mockImplementation(async (id) =>
        id === 'O1' ? o1 : mockOverlay()
      );

      // Step 3: Synthesis
      mockWorkbench.summarize.mockResolvedValueOnce({
        summary: 'The answer is X.',
      });

      const result = await queryConversationLattice(
        'What about TUI?',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock registry
        mockRegistry as any
      );

      expect(result).toBe('The answer is X.');
      expect(mockWorkbench.summarize).toHaveBeenCalledTimes(2);
      expect(o1.query).toHaveBeenCalledWith('TUI scrolling', 10);
    });

    it('should return no history message if no results found', async () => {
      mockWorkbench.summarize.mockResolvedValueOnce({
        summary:
          '{"intent": "none", "entities": [], "scope": "none", "refined_query": "nothing"}',
      });
      mockRegistry.get.mockResolvedValue(mockOverlay());

      const result = await queryConversationLattice(
        'Something?',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock registry
        mockRegistry as any
      );
      expect(result).toBe('No relevant conversation history found.');
    });
  });

  describe('filterConversationByAlignment', () => {
    it('should filter items by alignment score', async () => {
      const o1 = mockOverlay();
      o1.getAllItems.mockResolvedValue([
        { metadata: { text: 'Low score', project_alignment_score: 2 } },
        { metadata: { text: 'High score', project_alignment_score: 9 } },
      ]);
      mockRegistry.get.mockImplementation(async (id) =>
        id === 'O1' ? o1 : mockOverlay()
      );

      const result = await filterConversationByAlignment(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock registry
        mockRegistry as any,
        5
      );

      expect(result.structural).toHaveLength(1);
      expect(result.structural[0].text).toBe('High score');
    });
  });
});
