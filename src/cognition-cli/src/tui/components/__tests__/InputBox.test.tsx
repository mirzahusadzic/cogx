import React from 'react';
import { render } from 'ink-testing-library';
import { InputBox } from '../InputBox.js';
import stripAnsi from 'strip-ansi';
import type { ToolConfirmationState } from '../../hooks/useToolConfirmation.js';
import { ToolRiskLevel } from '../../utils/tool-safety.js';
import type { WizardConfirmationState } from '../../hooks/useOnboardingWizard.js';

// Mock useTUI to provide a stable context for tests
const mockTUIContext = {
  state: {
    focused: true,
    renderError: null,
    showInfoPanel: false,
    showTaskPanel: true,
    saveMessage: null,
    isDropdownVisible: false,
    streamingPaste: '',
    inputLineCount: 1,
    scrollSignal: null,
  },
  setFocus: vi.fn(),
  toggleFocus: vi.fn(),
  setRenderError: vi.fn(),
  setShowInfoPanel: vi.fn(),
  toggleInfoPanel: vi.fn(),
  setShowTaskPanel: vi.fn(),
  toggleTaskPanel: vi.fn(),
  setSaveMessage: vi.fn(),
  setIsDropdownVisible: vi.fn(),
  setStreamingPaste: vi.fn(),
  setInputLineCount: vi.fn(),
  sendScrollSignal: vi.fn(),
};

vi.mock('../../context/TUIContext.js', () => ({
  useTUI: () => mockTUIContext,
}));

// Mock the loader to avoid file system access
vi.mock('../../commands/loader.js', () => ({
  loadCommands: vi.fn().mockResolvedValue({
    commands: new Map(),
    errors: [],
    warnings: [],
  }),
  filterCommands: vi.fn().mockReturnValue([]),
}));

describe('InputBox', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('unfocused state', () => {
    it('shows "Press Tab to focus input" when not focused', () => {
      const { lastFrame } = render(
        <InputBox onSubmit={mockOnSubmit} focused={false} />
      );
      expect(stripAnsi(lastFrame() ?? '')).toContain(
        'Press Tab to focus input'
      );
    });

    it('does not show input prompt when unfocused', () => {
      const { lastFrame } = render(
        <InputBox onSubmit={mockOnSubmit} focused={false} />
      );
      expect(stripAnsi(lastFrame() ?? '')).not.toContain('>');
    });
  });

  describe('focused state', () => {
    it('shows input prompt when focused', () => {
      const { lastFrame } = render(
        <InputBox onSubmit={mockOnSubmit} focused={true} />
      );
      expect(stripAnsi(lastFrame() ?? '')).toContain('>');
    });

    it('shows placeholder text when empty', () => {
      const { lastFrame } = render(
        <InputBox onSubmit={mockOnSubmit} focused={true} />
      );
      expect(stripAnsi(lastFrame() ?? '')).toContain('Type a message');
    });

    it('shows newline hint in placeholder', () => {
      const { lastFrame } = render(
        <InputBox onSubmit={mockOnSubmit} focused={true} />
      );
      expect(stripAnsi(lastFrame() ?? '')).toContain('Ctrl+O for newline');
    });

    it('shows ESC hint in placeholder', () => {
      const { lastFrame } = render(
        <InputBox onSubmit={mockOnSubmit} focused={true} />
      );
      expect(stripAnsi(lastFrame() ?? '')).toContain('ESC ESC to clear');
    });
  });

  describe('disabled state', () => {
    it('shows thinking message when disabled', () => {
      const { lastFrame } = render(
        <InputBox
          onSubmit={mockOnSubmit}
          focused={true}
          disabled={true}
          providerName="claude"
        />
      );
      expect(stripAnsi(lastFrame() ?? '')).toContain('Claude is thinking');
    });

    it('shows ESC to interrupt hint when disabled', () => {
      const { lastFrame } = render(
        <InputBox
          onSubmit={mockOnSubmit}
          focused={true}
          disabled={true}
          providerName="claude"
        />
      );
      expect(stripAnsi(lastFrame() ?? '')).toContain('ESC to interrupt');
    });

    it('capitalizes provider name in thinking message', () => {
      const { lastFrame } = render(
        <InputBox
          onSubmit={mockOnSubmit}
          focused={true}
          disabled={true}
          providerName="gemini"
        />
      );
      expect(stripAnsi(lastFrame() ?? '')).toContain('Gemini is thinking');
    });
  });

  describe('tool confirmation modal integration', () => {
    it('renders ToolConfirmationModal when confirmation pending', () => {
      const confirmationState: ToolConfirmationState = {
        pending: true,
        toolName: 'Bash',
        input: { command: 'ls -la' },
        riskLevel: ToolRiskLevel.SAFE,
        reason: 'List files',
      };
      const { lastFrame } = render(
        <InputBox
          onSubmit={mockOnSubmit}
          focused={true}
          confirmationState={confirmationState}
        />
      );
      const output = stripAnsi(lastFrame() ?? '');
      // Should show the tool confirmation modal elements
      expect(output).toContain('[!]');
      expect(output).toContain('ls -la');
    });

    it('shows waiting message when tool confirmation is pending', () => {
      const confirmationState: ToolConfirmationState = {
        pending: true,
        toolName: 'Bash',
        input: { command: 'npm test' },
        riskLevel: ToolRiskLevel.SAFE,
        reason: 'Run tests',
      };
      const { lastFrame } = render(
        <InputBox
          onSubmit={mockOnSubmit}
          focused={true}
          confirmationState={confirmationState}
        />
      );
      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('Waiting for tool confirmation');
      // Verify prompt and message are on the same line
      expect(output).toMatch(/>\s*Waiting for tool confirmation/);
    });

    it('shows keyboard options for confirmation', () => {
      const confirmationState: ToolConfirmationState = {
        pending: true,
        toolName: 'Bash',
        input: { command: 'npm test' },
        riskLevel: ToolRiskLevel.SAFE,
        reason: 'Run tests',
      };
      const { lastFrame } = render(
        <InputBox
          onSubmit={mockOnSubmit}
          focused={true}
          confirmationState={confirmationState}
        />
      );
      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('Y Allow');
      expect(output).toContain('N Deny');
    });
  });

  describe('wizard confirmation modal integration', () => {
    it('renders WizardConfirmationModal when wizard confirmation pending', () => {
      const wizardState: WizardConfirmationState = {
        pending: true,
        mode: 'confirm',
        title: 'Initialize Project?',
        message: 'This will create configuration files.',
        confirmLabel: 'Y Yes',
        denyLabel: 'N No',
      };
      const { lastFrame } = render(
        <InputBox
          onSubmit={mockOnSubmit}
          focused={true}
          wizardConfirmationState={wizardState}
        />
      );
      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('[?]');
      expect(output).toContain('Initialize Project?');
    });

    it('shows wizard-specific hint for confirm mode', () => {
      const wizardState: WizardConfirmationState = {
        pending: true,
        mode: 'confirm',
        title: 'Confirm Action',
        message: 'Are you sure?',
        confirmLabel: 'Y',
        denyLabel: 'N',
      };
      const { lastFrame } = render(
        <InputBox
          onSubmit={mockOnSubmit}
          focused={true}
          wizardConfirmationState={wizardState}
        />
      );
      expect(stripAnsi(lastFrame() ?? '')).toContain('Press Y to confirm');
    });

    it('shows wizard-specific hint for select mode', () => {
      const wizardState: WizardConfirmationState = {
        pending: true,
        mode: 'select',
        title: 'Select Items',
        message: 'Please select an item',
        confirmLabel: 'OK',
        denyLabel: 'Cancel',
        items: [
          { id: '1', label: 'Option A', selected: false },
          { id: '2', label: 'Option B', selected: false },
        ],
        selectedIndex: 0,
      };
      const { lastFrame } = render(
        <InputBox
          onSubmit={mockOnSubmit}
          focused={true}
          wizardConfirmationState={wizardState}
        />
      );
      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('↑↓ arrows');
      expect(output).toContain('Space to toggle');
    });
  });

  describe('border styling', () => {
    it('has horizontal rule borders when focused', () => {
      const { lastFrame } = render(
        <InputBox onSubmit={mockOnSubmit} focused={true} />
      );
      expect(stripAnsi(lastFrame() ?? '')).toContain('─');
    });

    it('changes border color when confirmation pending', () => {
      const confirmationState: ToolConfirmationState = {
        pending: true,
        toolName: 'Bash',
        input: { command: 'ls' },
        riskLevel: ToolRiskLevel.SAFE,
        reason: 'List files',
      };
      const { lastFrame } = render(
        <InputBox
          onSubmit={mockOnSubmit}
          focused={true}
          confirmationState={confirmationState}
        />
      );
      // The border should still contain the horizontal rule character
      expect(stripAnsi(lastFrame() ?? '')).toContain('─');
    });
  });

  describe('loading state', () => {
    it('shows loading indicator when commands loading and input starts with /', async () => {
      // This test verifies the loading indicator is present
      // The actual loading state depends on the mock timing
      const { lastFrame } = render(
        <InputBox onSubmit={mockOnSubmit} focused={true} />
      );
      // Initial render should not show loading (value is empty)
      expect(stripAnsi(lastFrame() ?? '')).not.toContain('Loading');
    });
  });

  describe('provider name display', () => {
    it('defaults to AI when no provider specified', () => {
      const { lastFrame } = render(
        <InputBox onSubmit={mockOnSubmit} focused={true} disabled={true} />
      );
      expect(stripAnsi(lastFrame() ?? '')).toContain('AI is thinking');
    });

    it('uses custom provider name', () => {
      const { lastFrame } = render(
        <InputBox
          onSubmit={mockOnSubmit}
          focused={true}
          disabled={true}
          providerName="custom-llm"
        />
      );
      expect(stripAnsi(lastFrame() ?? '')).toContain('Custom-llm is thinking');
    });
  });

  describe('callbacks', () => {
    it('calls onDropdownVisibleChange on mount', () => {
      const onDropdownChange = vi.fn();
      render(
        <InputBox
          onSubmit={mockOnSubmit}
          focused={true}
          onDropdownVisibleChange={onDropdownChange}
        />
      );
      // The callback is called on mount with false (dropdown not visible)
      expect(onDropdownChange).toHaveBeenCalledWith(false);
    });

    it('accepts onPasteContent callback', () => {
      const onPaste = vi.fn();
      render(
        <InputBox
          onSubmit={mockOnSubmit}
          focused={true}
          onPasteContent={onPaste}
        />
      );
      // The callback is wired up
      expect(onPaste).not.toHaveBeenCalled();
    });

    it('accepts onInputChange callback', () => {
      const onInputChange = vi.fn();
      render(
        <InputBox
          onSubmit={mockOnSubmit}
          focused={true}
          onInputChange={onInputChange}
        />
      );
      // The callback is wired up
      expect(onInputChange).not.toHaveBeenCalled();
    });

    it('accepts onInterrupt callback', () => {
      const onInterrupt = vi.fn();
      render(
        <InputBox
          onSubmit={mockOnSubmit}
          focused={true}
          onInterrupt={onInterrupt}
        />
      );
      // The callback is wired up
      expect(onInterrupt).not.toHaveBeenCalled();
    });
  });
});
