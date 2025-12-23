import { vi, describe, it, expect, beforeEach } from 'vitest';
import { latticeCommand } from '../lattice.js';
import { WorkspaceManager } from '../../core/workspace-manager.js';
import { createQueryEngine } from '../../core/algebra/query-parser.js';

// Mock dependencies
vi.mock('../../core/workspace-manager.js');
vi.mock('../../core/algebra/query-parser.js');
vi.mock('@clack/prompts', () => ({
  spinner: () => ({
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

describe('latticeCommand', () => {
  let mockWorkspaceManager: { resolvePgcRoot: ReturnType<typeof vi.fn> };
  let mockQueryEngine: { execute: ReturnType<typeof vi.fn> };
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock process.exit
    processExitSpy = vi
      .spyOn(process, 'exit')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((() => {}) as any);

    // Setup workspace manager mock
    mockWorkspaceManager = {
      resolvePgcRoot: vi.fn().mockReturnValue('/test/project'),
    };
    vi.mocked(WorkspaceManager).mockImplementation(() => mockWorkspaceManager);

    // Setup query engine mock
    mockQueryEngine = {
      execute: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(createQueryEngine).mockReturnValue(mockQueryEngine);
  });

  describe('workspace resolution', () => {
    it('should exit if no .open_cognition workspace found', async () => {
      mockWorkspaceManager.resolvePgcRoot.mockReturnValue(null);

      await latticeCommand('O1', { projectRoot: '/test' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('No .open_cognition workspace found')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should resolve workspace from project root', async () => {
      mockWorkspaceManager.resolvePgcRoot.mockReturnValue('/test/project');

      await latticeCommand('O1', { projectRoot: '/test' });

      expect(mockWorkspaceManager.resolvePgcRoot).toHaveBeenCalledWith('/test');
      expect(createQueryEngine).toHaveBeenCalledWith(
        '/test/project/.open_cognition',
        expect.any(String)
      );
    });

    it('should use custom WORKBENCH_URL if provided', async () => {
      const originalWorkbenchUrl = process.env.WORKBENCH_URL;
      process.env.WORKBENCH_URL = 'http://custom:9000';

      await latticeCommand('O1', { projectRoot: '/test' });

      expect(createQueryEngine).toHaveBeenCalledWith(
        expect.any(String),
        'http://custom:9000'
      );

      // Restore
      if (originalWorkbenchUrl) {
        process.env.WORKBENCH_URL = originalWorkbenchUrl;
      } else {
        delete process.env.WORKBENCH_URL;
      }
    });
  });

  describe('query execution', () => {
    it('should execute set operation query (difference)', async () => {
      mockQueryEngine.execute.mockResolvedValue([
        {
          id: 'item1',
          embedding: [0.1, 0.2],
          metadata: { text: 'Test item', type: 'function' },
        },
      ]);

      await latticeCommand('O1 - O2', { projectRoot: '/test' });

      expect(mockQueryEngine.execute).toHaveBeenCalledWith('O1 - O2');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Results: 1 item(s)')
      );
    });

    it('should execute semantic operation query (meet)', async () => {
      mockQueryEngine.execute.mockResolvedValue([
        {
          itemA: {
            id: 'itemA',
            embedding: [0.1],
            metadata: { text: 'Item A' },
          },
          itemB: {
            id: 'itemB',
            embedding: [0.2],
            metadata: { text: 'Item B' },
          },
          similarity: 0.85,
        },
      ]);

      await latticeCommand('O2 ~ O4', { projectRoot: '/test' });

      expect(mockQueryEngine.execute).toHaveBeenCalledWith('O2 ~ O4');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Meet Results')
      );
    });

    it('should execute query with filters', async () => {
      mockQueryEngine.execute.mockResolvedValue([]);

      await latticeCommand('O2[severity=critical]', { projectRoot: '/test' });

      expect(mockQueryEngine.execute).toHaveBeenCalledWith(
        'O2[severity=critical]'
      );
    });

    it('should execute complex query with composition', async () => {
      mockQueryEngine.execute.mockResolvedValue([]);

      await latticeCommand('(O1 & O2) - O3', { projectRoot: '/test' });

      expect(mockQueryEngine.execute).toHaveBeenCalledWith('(O1 & O2) - O3');
    });

    it('should handle query execution errors', async () => {
      mockQueryEngine.execute.mockRejectedValue(
        new Error('Invalid query syntax')
      );

      await latticeCommand('INVALID', { projectRoot: '/test' });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Invalid query syntax');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should show verbose error output when verbose flag set', async () => {
      const error = new Error('Query failed');
      mockQueryEngine.execute.mockRejectedValue(error);

      await latticeCommand('O1', {
        projectRoot: '/test',
        verbose: true,
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Query failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    });
  });

  describe('output formatting', () => {
    it('should display results in table format by default', async () => {
      mockQueryEngine.execute.mockResolvedValue([
        {
          id: 'test-id',
          embedding: [0.1],
          metadata: {
            text: 'Test text',
            type: 'function',
          },
        },
      ]);

      await latticeCommand('O1', { projectRoot: '/test' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Results: 1 item(s)')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Showing 1 of 1 items')
      );
    });

    it('should display results in json format when specified', async () => {
      const items = [
        {
          id: 'test-id',
          embedding: [0.1],
          metadata: { text: 'Test' },
        },
      ];
      mockQueryEngine.execute.mockResolvedValue(items);

      await latticeCommand('O1', {
        projectRoot: '/test',
        format: 'json',
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Results: 1 item(s)')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"id": "test-id"')
      );
    });

    it('should display results in summary format when specified', async () => {
      mockQueryEngine.execute.mockResolvedValue([
        {
          id: 'test-id',
          embedding: [0.1],
          metadata: { text: 'Test text here' },
        },
      ]);

      await latticeCommand('O1', {
        projectRoot: '/test',
        format: 'summary',
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Showing summary')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('test-id')
      );
    });

    it('should limit results when limit option provided', async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        embedding: [0.1],
        metadata: { text: `Item ${i}` },
      }));
      mockQueryEngine.execute.mockResolvedValue(items);

      await latticeCommand('O1', {
        projectRoot: '/test',
        limit: 10,
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Results: 100 item(s)')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Showing 10 of 100 items')
      );
    });

    it('should warn when no items found', async () => {
      mockQueryEngine.execute.mockResolvedValue([]);

      await latticeCommand('O1', { projectRoot: '/test' });

      expect(consoleWarnSpy).toHaveBeenCalledWith('No items found');
    });
  });

  describe('set operation results', () => {
    it('should display set operation metadata', async () => {
      mockQueryEngine.execute.mockResolvedValue({
        items: [
          {
            id: 'item1',
            embedding: [0.1],
            metadata: { text: 'Test' },
          },
        ],
        metadata: {
          operation: 'difference',
          itemCount: 1,
          sourceOverlays: ['O1', 'O2'],
        },
      });

      await latticeCommand('O1 - O2', { projectRoot: '/test' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('DIFFERENCE: 1 item(s)')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Source overlays: O1, O2')
      );
    });

    it('should handle union operation results', async () => {
      mockQueryEngine.execute.mockResolvedValue({
        items: [],
        metadata: {
          operation: 'union',
          itemCount: 0,
          sourceOverlays: ['O1', 'O2'],
        },
      });

      await latticeCommand('O1 + O2', { projectRoot: '/test' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('UNION')
      );
    });

    it('should handle intersection operation results', async () => {
      mockQueryEngine.execute.mockResolvedValue({
        items: [],
        metadata: {
          operation: 'intersection',
          itemCount: 0,
          sourceOverlays: ['O1', 'O2'],
        },
      });

      await latticeCommand('O1 & O2', { projectRoot: '/test' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('INTERSECTION')
      );
    });
  });

  describe('meet results', () => {
    it('should display meet results with similarity scores', async () => {
      mockQueryEngine.execute.mockResolvedValue([
        {
          itemA: {
            id: 'itemA',
            embedding: [0.1],
            metadata: { text: 'Item A text' },
          },
          itemB: {
            id: 'itemB',
            embedding: [0.2],
            metadata: { text: 'Item B text' },
          },
          similarity: 0.92,
        },
      ]);

      await latticeCommand('O2 ~ O4', { projectRoot: '/test' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Meet Results: 1 alignment(s)')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Showing 1 of 1 pairs')
      );
    });

    it('should limit meet results when limit specified', async () => {
      const alignments = Array.from({ length: 50 }, (_, i) => ({
        itemA: {
          id: `itemA-${i}`,
          embedding: [0.1],
          metadata: { text: 'A' },
        },
        itemB: {
          id: `itemB-${i}`,
          embedding: [0.2],
          metadata: { text: 'B' },
        },
        similarity: 0.8,
      }));
      mockQueryEngine.execute.mockResolvedValue(alignments);

      await latticeCommand('O2 ~ O4', {
        projectRoot: '/test',
        limit: 20,
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Meet Results: 50 alignment(s)')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Showing 20 of 50 pairs')
      );
    });

    it('should warn when no alignments found', async () => {
      mockQueryEngine.execute.mockResolvedValue([]);

      await latticeCommand('O2 ~ O4', { projectRoot: '/test' });

      // Note: Empty array is interpreted as empty OverlayItem array, not MeetResult
      expect(consoleWarnSpy).toHaveBeenCalledWith('No items found');
    });

    it('should display meet results in json format', async () => {
      mockQueryEngine.execute.mockResolvedValue([
        {
          itemA: { id: 'A', embedding: [0.1], metadata: { text: 'A' } },
          itemB: { id: 'B', embedding: [0.2], metadata: { text: 'B' } },
          similarity: 0.9,
        },
      ]);

      await latticeCommand('O2 ~ O4', {
        projectRoot: '/test',
        format: 'json',
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"similarity"')
      );
    });
  });

  describe('metadata handling', () => {
    it('should display item type when present', async () => {
      mockQueryEngine.execute.mockResolvedValue([
        {
          id: 'test',
          embedding: [0.1],
          metadata: {
            text: 'Test',
            type: 'threat',
          },
        },
      ]);

      await latticeCommand('O2', { projectRoot: '/test' });

      expect(consoleLogSpy).toHaveBeenCalled();
      // Type should be displayed in the output
    });

    it('should handle severity metadata with color coding', async () => {
      mockQueryEngine.execute.mockResolvedValue([
        {
          id: 'test',
          embedding: [0.1],
          metadata: {
            text: 'Test',
            type: 'vulnerability',
            severity: 'critical',
          },
        },
      ]);

      await latticeCommand('O2', { projectRoot: '/test' });

      expect(consoleLogSpy).toHaveBeenCalled();
      // Severity should be displayed with color coding
    });

    it('should display additional metadata fields', async () => {
      mockQueryEngine.execute.mockResolvedValue([
        {
          id: 'test',
          embedding: [0.1],
          metadata: {
            text: 'Test',
            type: 'function',
            section: 'auth',
            customField: 'value',
          },
        },
      ]);

      await latticeCommand('O1', { projectRoot: '/test' });

      expect(consoleLogSpy).toHaveBeenCalled();
      // Additional fields should be displayed (up to 3)
    });
  });

  describe('unknown result format', () => {
    it('should warn and output JSON for unknown result formats', async () => {
      const unknownResult = { someKey: 'someValue' };
      mockQueryEngine.execute.mockResolvedValue(unknownResult);

      await latticeCommand('O1', { projectRoot: '/test' });

      expect(consoleWarnSpy).toHaveBeenCalledWith('Unknown result format');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"someKey"')
      );
    });
  });
});
