import React from 'react';
import { render } from 'ink-testing-library';
import { ToolConfirmationModal } from '../ToolConfirmationModal.js';
import type { ToolConfirmationState } from '../../hooks/useToolConfirmation.js';
import { ToolRiskLevel } from '../../utils/tool-safety.js';

describe('ToolConfirmationModal', () => {
  describe('bash tool confirmation', () => {
    it('displays bash command for confirmation', () => {
      const state: ToolConfirmationState = {
        pending: true,
        toolName: 'Bash',
        input: { command: 'npm install' },
        riskLevel: ToolRiskLevel.SAFE,
        reason: 'Install dependencies',
      };
      const { lastFrame } = render(<ToolConfirmationModal state={state} />);
      const output = lastFrame() ?? '';
      expect(output).toContain('npm install');
    });

    it('shows warning indicator', () => {
      const state: ToolConfirmationState = {
        pending: true,
        toolName: 'Bash',
        input: { command: 'ls' },
        riskLevel: ToolRiskLevel.SAFE,
        reason: 'List files',
      };
      const { lastFrame } = render(<ToolConfirmationModal state={state} />);
      expect(lastFrame()).toContain('[!]');
    });

    it('displays keyboard shortcuts in footer', () => {
      const state: ToolConfirmationState = {
        pending: true,
        toolName: 'Bash',
        input: { command: 'ls' },
        riskLevel: ToolRiskLevel.SAFE,
        reason: 'List files',
      };
      const { lastFrame } = render(<ToolConfirmationModal state={state} />);
      const output = lastFrame() ?? '';
      expect(output).toContain('Y Allow');
      expect(output).toContain('N Deny');
      expect(output).toContain('A Always');
      expect(output).toContain('Esc');
    });

    it('extracts base command for Always label', () => {
      const state: ToolConfirmationState = {
        pending: true,
        toolName: 'bash',
        input: { command: 'npm run build' },
        riskLevel: ToolRiskLevel.SAFE,
        reason: 'Build project',
      };
      const { lastFrame } = render(<ToolConfirmationModal state={state} />);
      expect(lastFrame()).toContain('all npm');
    });

    it('shows first line only for multiline commands', () => {
      const state: ToolConfirmationState = {
        pending: true,
        toolName: 'Bash',
        input: { command: 'git commit -m "message"\ngit push' },
        riskLevel: ToolRiskLevel.SAFE,
        reason: 'Commit and push',
      };
      const { lastFrame } = render(<ToolConfirmationModal state={state} />);
      const output = lastFrame() ?? '';
      expect(output).toContain('git commit');
      expect(output).toContain('...');
    });

    it('truncates long commands', () => {
      const longCommand = 'a'.repeat(150);
      const state: ToolConfirmationState = {
        pending: true,
        toolName: 'Bash',
        input: { command: longCommand },
        riskLevel: ToolRiskLevel.SAFE,
        reason: 'Long command',
      };
      const { lastFrame } = render(<ToolConfirmationModal state={state} />);
      expect(lastFrame()).toContain('...');
    });
  });

  describe('file tool confirmation', () => {
    it('displays file path for Edit tool', () => {
      const state: ToolConfirmationState = {
        pending: true,
        toolName: 'Edit',
        input: {
          file_path: '/src/index.ts',
          old_string: 'foo',
          new_string: 'bar',
        },
        riskLevel: ToolRiskLevel.MODERATE,
        reason: 'Update code',
      };
      const { lastFrame } = render(<ToolConfirmationModal state={state} />);
      expect(lastFrame()).toContain('/src/index.ts');
    });

    it('displays file path for Write tool', () => {
      const state: ToolConfirmationState = {
        pending: true,
        toolName: 'Write',
        input: { file_path: '/new-file.ts', content: 'export const x = 1;' },
        riskLevel: ToolRiskLevel.DANGEROUS,
        reason: 'Create new file',
      };
      const { lastFrame } = render(<ToolConfirmationModal state={state} />);
      expect(lastFrame()).toContain('/new-file.ts');
    });

    it('displays file path for Read tool', () => {
      const state: ToolConfirmationState = {
        pending: true,
        toolName: 'Read',
        input: { file_path: '/secret.env' },
        riskLevel: ToolRiskLevel.SAFE,
        reason: 'Read configuration',
      };
      const { lastFrame } = render(<ToolConfirmationModal state={state} />);
      expect(lastFrame()).toContain('/secret.env');
    });

    it('shows tool name in Always label for file operations', () => {
      const state: ToolConfirmationState = {
        pending: true,
        toolName: 'Edit',
        input: { file_path: '/src/index.ts' },
        riskLevel: ToolRiskLevel.MODERATE,
        reason: 'Update file',
      };
      const { lastFrame } = render(<ToolConfirmationModal state={state} />);
      expect(lastFrame()).toContain('all Edit');
    });
  });

  describe('unknown tool confirmation', () => {
    it('falls back to formatted description for unknown tools', () => {
      const state: ToolConfirmationState = {
        pending: true,
        toolName: 'CustomTool',
        input: { data: 'some value' },
        riskLevel: ToolRiskLevel.SAFE,
        reason: 'Custom operation',
      };
      const { lastFrame } = render(<ToolConfirmationModal state={state} />);
      const output = lastFrame() ?? '';
      expect(output).toContain('CustomTool');
    });
  });

  describe('visual styling', () => {
    it('has yellow border (round style)', () => {
      const state: ToolConfirmationState = {
        pending: true,
        toolName: 'Bash',
        input: { command: 'ls' },
        riskLevel: ToolRiskLevel.SAFE,
        reason: 'List files',
      };
      const { lastFrame } = render(<ToolConfirmationModal state={state} />);
      const output = lastFrame() ?? '';
      // Round border uses ╭ ╮ ╰ ╯ characters
      expect(output).toContain('╭');
      expect(output).toContain('╯');
    });
  });

  describe('memoization', () => {
    it('maintains referential equality when props unchanged', () => {
      const state: ToolConfirmationState = {
        pending: true,
        toolName: 'Bash',
        input: { command: 'ls' },
        riskLevel: ToolRiskLevel.SAFE,
        reason: 'List files',
      };
      const { rerender, lastFrame } = render(
        <ToolConfirmationModal state={state} />
      );
      const firstFrame = lastFrame();

      rerender(<ToolConfirmationModal state={state} />);
      const secondFrame = lastFrame();

      expect(firstFrame).toBe(secondFrame);
    });
  });
});
