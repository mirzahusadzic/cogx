/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  securityAttacksCommand,
  securityCoverageGapsCommand,
  securityBoundariesCommand,
  securityListCommand,
  securityCVEsCommand,
  securityQueryCommand,
} from '../security.js';

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

vi.mock('../../../core/overlays/security-guidelines/manager.js', () => ({
  SecurityGuidelinesManager: vi.fn().mockImplementation(() => ({
    getAllItems: vi.fn().mockResolvedValue([]),
    getCVEs: vi.fn().mockResolvedValue([]),
    queryKnowledge: vi.fn().mockResolvedValue([]),
  })),
}));

describe('Security Sugar Commands', () => {
  const options = { projectRoot: '.', format: 'summary' as const };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'exit').mockImplementation(() => {
      // Silently throw to stop execution without process.exit(1) noise in tests
      throw new Error('process.exit');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('securityAttacksCommand', () => {
    it('should call query engine with correct lattice expression', async () => {
      const { createQueryEngine } =
        await import('../../../core/algebra/query-parser.js');
      const mockExecute = vi.fn().mockResolvedValue([]);
      vi.mocked(createQueryEngine).mockReturnValue({
        execute: mockExecute,
      } as any);

      await securityAttacksCommand(options);

      expect(mockExecute).toHaveBeenCalledWith(
        'O2[attack_vector] ~ O4[principle]'
      );
    });
  });

  describe('securityCoverageGapsCommand', () => {
    it('should call query engine with correct lattice expression', async () => {
      const { createQueryEngine } =
        await import('../../../core/algebra/query-parser.js');
      const mockExecute = vi.fn().mockResolvedValue([]);
      vi.mocked(createQueryEngine).mockReturnValue({
        execute: mockExecute,
      } as any);

      await securityCoverageGapsCommand(options);

      expect(mockExecute).toHaveBeenCalledWith('O1 - O2');
    });
  });

  describe('securityBoundariesCommand', () => {
    it('should call query engine with correct lattice expression', async () => {
      const { createQueryEngine } =
        await import('../../../core/algebra/query-parser.js');
      const mockExecute = vi.fn().mockResolvedValue([]);
      vi.mocked(createQueryEngine).mockReturnValue({
        execute: mockExecute,
      } as any);

      await securityBoundariesCommand(options);

      expect(mockExecute).toHaveBeenCalledWith('O2[boundary] | O2[constraint]');
    });
  });

  describe('securityListCommand', () => {
    it('should use SecurityGuidelinesManager to get all items', async () => {
      const { SecurityGuidelinesManager } =
        await import('../../../core/overlays/security-guidelines/manager.js');
      const mockManager = {
        getAllItems: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(SecurityGuidelinesManager).mockImplementation(
        () => mockManager as any
      );

      await securityListCommand(options);

      expect(mockManager.getAllItems).toHaveBeenCalled();
    });
  });

  describe('securityCVEsCommand', () => {
    it('should use SecurityGuidelinesManager to get CVEs', async () => {
      const { SecurityGuidelinesManager } =
        await import('../../../core/overlays/security-guidelines/manager.js');
      const mockManager = {
        getCVEs: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(SecurityGuidelinesManager).mockImplementation(
        () => mockManager as any
      );

      await securityCVEsCommand(options);

      expect(mockManager.getCVEs).toHaveBeenCalled();
    });
  });

  describe('securityQueryCommand', () => {
    it('should use SecurityGuidelinesManager to query knowledge', async () => {
      const { SecurityGuidelinesManager } =
        await import('../../../core/overlays/security-guidelines/manager.js');
      const mockManager = {
        queryKnowledge: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(SecurityGuidelinesManager).mockImplementation(
        () => mockManager as any
      );

      await securityQueryCommand('test-query', options);

      expect(mockManager.queryKnowledge).toHaveBeenCalledWith('test-query');
    });
  });
});
