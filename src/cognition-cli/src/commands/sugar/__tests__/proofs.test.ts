/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  proofsTheoremsCommand,
  proofsLemmasCommand,
  proofsListCommand,
  proofsAlignedCommand,
} from '../proofs.js';

// Mock dependencies
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../core/algebra/query-parser.js', () => ({
  createQueryEngine: vi.fn(() => ({
    execute: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../../../core/workspace-manager.js', () => ({
  WorkspaceManager: class {
    resolvePgcRoot = vi.fn().mockReturnValue('/test/project');
  },
}));

vi.mock('../../../core/algebra/lattice-operations.js', () => ({
  meet: vi.fn().mockResolvedValue([]),
}));

describe('Proofs Sugar Commands', () => {
  const options = { projectRoot: '/test/project' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('proofsTheoremsCommand', () => {
    it('should call query engine with O6[theorem]', async () => {
      const { createQueryEngine } =
        await import('../../../core/algebra/query-parser.js');
      const mockExecute = vi.fn().mockResolvedValue([]);
      vi.mocked(createQueryEngine).mockReturnValue({
        execute: mockExecute,
      } as any);

      await proofsTheoremsCommand(options);

      expect(mockExecute).toHaveBeenCalledWith('O6[theorem]');
    });
  });

  describe('proofsLemmasCommand', () => {
    it('should call query engine with O6[lemma]', async () => {
      const { createQueryEngine } =
        await import('../../../core/algebra/query-parser.js');
      const mockExecute = vi.fn().mockResolvedValue([]);
      vi.mocked(createQueryEngine).mockReturnValue({
        execute: mockExecute,
      } as any);

      // Use the top-level import
      await proofsLemmasCommand(options);

      expect(mockExecute).toHaveBeenCalledWith('O6[lemma]');
    });
  });

  describe('proofsListCommand', () => {
    it('should call query engine with O6 by default', async () => {
      const { createQueryEngine } =
        await import('../../../core/algebra/query-parser.js');
      const mockExecute = vi.fn().mockResolvedValue([]);
      vi.mocked(createQueryEngine).mockReturnValue({
        execute: mockExecute,
      } as any);

      await proofsListCommand(options);

      expect(mockExecute).toHaveBeenCalledWith('O6');
    });

    it('should call query engine with O6[type] when type is provided', async () => {
      const { createQueryEngine } =
        await import('../../../core/algebra/query-parser.js');
      const mockExecute = vi.fn().mockResolvedValue([]);
      vi.mocked(createQueryEngine).mockReturnValue({
        execute: mockExecute,
      } as any);

      await proofsListCommand({ ...options, type: 'axiom' });

      expect(mockExecute).toHaveBeenCalledWith('O6[axiom]');
    });
  });

  describe('proofsAlignedCommand', () => {
    it('should perform meet operation between O6 and O4[principle]', async () => {
      const { createQueryEngine } =
        await import('../../../core/algebra/query-parser.js');
      const { meet } =
        await import('../../../core/algebra/lattice-operations.js');

      const mockExecute = vi.fn().mockImplementation((q) => {
        if (q === 'O6')
          return Promise.resolve([{ id: 'p1', embedding: [], metadata: {} }]);
        if (q === 'O4[principle]')
          return Promise.resolve([{ id: 'pr1', embedding: [], metadata: {} }]);
        return Promise.resolve([]);
      });
      vi.mocked(createQueryEngine).mockReturnValue({
        execute: mockExecute,
      } as any);

      await proofsAlignedCommand(options);

      expect(mockExecute).toHaveBeenCalledWith('O6');
      expect(mockExecute).toHaveBeenCalledWith('O4[principle]');
      expect(meet).toHaveBeenCalled();
    });
  });
});
