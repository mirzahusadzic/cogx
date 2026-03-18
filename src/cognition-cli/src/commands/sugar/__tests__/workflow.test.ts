/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  workflowPatternsCommand,
  workflowQuestsCommand,
  workflowDepthRulesCommand,
} from '../workflow.js';
import { environmentService } from '../../../core/services/environment/EnvironmentService.js';

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

vi.mock('../../../core/services/environment/EnvironmentService.js', () => ({
  environmentService: {
    findProjectRoot: vi.fn().mockReturnValue('/test/project'),
    resolvePgcDir: vi.fn().mockReturnValue('/test/project/.open_cognition'),
  },
}));

describe('Workflow Sugar Commands', () => {
  const options = { projectRoot: '/test/project' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(environmentService.findProjectRoot).mockReturnValue(
      '/test/project'
    );
    vi.mocked(environmentService.resolvePgcDir).mockReturnValue(
      '/test/project/.open_cognition'
    );
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('workflowPatternsCommand', () => {
    it('should call query engine with O5[workflow_pattern] by default', async () => {
      const { createQueryEngine } =
        await import('../../../core/algebra/query-parser.js');
      const mockExecute = vi.fn().mockResolvedValue([]);
      vi.mocked(createQueryEngine).mockReturnValue({
        execute: mockExecute,
      } as any);

      await workflowPatternsCommand(options);

      expect(mockExecute).toHaveBeenCalledWith('O5[workflow_pattern]');
    });

    it('should call query engine with secure alignment when secure is true', async () => {
      const { createQueryEngine } =
        await import('../../../core/algebra/query-parser.js');
      const mockExecute = vi.fn().mockResolvedValue([]);
      vi.mocked(createQueryEngine).mockReturnValue({
        execute: mockExecute,
      } as any);

      await workflowPatternsCommand({ ...options, secure: true });

      expect(mockExecute).toHaveBeenCalledWith(
        'O5[workflow_pattern] ~ O2[boundary]'
      );
    });

    it('should call query engine with mission alignment when aligned is true', async () => {
      const { createQueryEngine } =
        await import('../../../core/algebra/query-parser.js');
      const mockExecute = vi.fn().mockResolvedValue([]);
      vi.mocked(createQueryEngine).mockReturnValue({
        execute: mockExecute,
      } as any);

      await workflowPatternsCommand({ ...options, aligned: true });

      expect(mockExecute).toHaveBeenCalledWith('O5[workflow_pattern] ~ O4');
    });
  });

  describe('workflowQuestsCommand', () => {
    it('should call query engine with O5[quest_structure]', async () => {
      const { createQueryEngine } =
        await import('../../../core/algebra/query-parser.js');
      const mockExecute = vi.fn().mockResolvedValue([]);
      vi.mocked(createQueryEngine).mockReturnValue({
        execute: mockExecute,
      } as any);

      await workflowQuestsCommand(options);

      expect(mockExecute).toHaveBeenCalledWith('O5[quest_structure]');
    });
  });

  describe('workflowDepthRulesCommand', () => {
    it('should call query engine with O5[depth_rule]', async () => {
      const { createQueryEngine } =
        await import('../../../core/algebra/query-parser.js');
      const mockExecute = vi.fn().mockResolvedValue([]);
      vi.mocked(createQueryEngine).mockReturnValue({
        execute: mockExecute,
      } as any);

      await workflowDepthRulesCommand(options);

      expect(mockExecute).toHaveBeenCalledWith('O5[depth_rule]');
    });
  });
});
