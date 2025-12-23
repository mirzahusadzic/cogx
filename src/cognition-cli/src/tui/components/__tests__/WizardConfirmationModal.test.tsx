import React from 'react';
import { render } from 'ink-testing-library';
import { WizardConfirmationModal } from '../WizardConfirmationModal.js';
import type { WizardConfirmationState } from '../../hooks/useOnboardingWizard.js';

describe('WizardConfirmationModal', () => {
  describe('confirm mode', () => {
    it('displays title with question indicator', () => {
      const state: WizardConfirmationState = {
        pending: true,
        mode: 'confirm',
        title: 'Initialize Project?',
        message: 'This will create configuration files.',
        confirmLabel: 'Y Yes',
        denyLabel: 'N No',
      };
      const { lastFrame } = render(<WizardConfirmationModal state={state} />);
      const output = lastFrame() ?? '';
      expect(output).toContain('[?]');
      expect(output).toContain('Initialize Project?');
    });

    it('displays message text', () => {
      const state: WizardConfirmationState = {
        pending: true,
        mode: 'confirm',
        title: 'Confirm Action',
        message: 'This action cannot be undone.',
        confirmLabel: 'Y Proceed',
        denyLabel: 'N Cancel',
      };
      const { lastFrame } = render(<WizardConfirmationModal state={state} />);
      expect(lastFrame()).toContain('This action cannot be undone.');
    });

    it('displays confirm and deny labels', () => {
      const state: WizardConfirmationState = {
        pending: true,
        mode: 'confirm',
        title: 'Confirm',
        message: 'Are you sure?',
        confirmLabel: 'Y Confirm',
        denyLabel: 'N Reject',
      };
      const { lastFrame } = render(<WizardConfirmationModal state={state} />);
      const output = lastFrame() ?? '';
      expect(output).toContain('Y Confirm');
      expect(output).toContain('N Reject');
    });

    it('displays Esc Cancel option', () => {
      const state: WizardConfirmationState = {
        pending: true,
        mode: 'confirm',
        title: 'Confirm',
        message: 'Proceed?',
        confirmLabel: 'Y',
        denyLabel: 'N',
      };
      const { lastFrame } = render(<WizardConfirmationModal state={state} />);
      expect(lastFrame()).toContain('Esc Cancel');
    });
  });

  describe('select mode', () => {
    const mockItems = [
      {
        id: 'item1',
        label: 'Option A',
        description: 'First option',
        selected: false,
      },
      {
        id: 'item2',
        label: 'Option B',
        description: 'Second option',
        selected: true,
      },
      { id: 'item3', label: 'Option C', selected: false },
    ];

    it('displays title with question indicator', () => {
      const state: WizardConfirmationState = {
        pending: true,
        mode: 'select',
        title: 'Select Options',
        message: 'Please choose an option',
        confirmLabel: 'Confirm',
        denyLabel: 'Skip',
        items: mockItems,
        selectedIndex: 0,
      };
      const { lastFrame } = render(<WizardConfirmationModal state={state} />);
      const output = lastFrame() ?? '';
      expect(output).toContain('[?]');
      expect(output).toContain('Select Options');
    });

    it('displays all items', () => {
      const state: WizardConfirmationState = {
        pending: true,
        mode: 'select',
        title: 'Choose',
        message: 'Please select items',
        confirmLabel: 'OK',
        denyLabel: 'Cancel',
        items: mockItems,
        selectedIndex: 0,
      };
      const { lastFrame } = render(<WizardConfirmationModal state={state} />);
      const output = lastFrame() ?? '';
      expect(output).toContain('Option A');
      expect(output).toContain('Option B');
      expect(output).toContain('Option C');
    });

    it('shows checkbox state correctly', () => {
      const state: WizardConfirmationState = {
        pending: true,
        mode: 'select',
        title: 'Choose',
        message: 'Please select items',
        confirmLabel: 'OK',
        denyLabel: 'Cancel',
        items: mockItems,
        selectedIndex: 0,
      };
      const { lastFrame } = render(<WizardConfirmationModal state={state} />);
      const output = lastFrame() ?? '';
      // Option B is selected (checked)
      expect(output).toContain('[x]');
      // Other options are unchecked
      expect(output).toContain('[ ]');
    });

    it('shows selection indicator for highlighted item', () => {
      const state: WizardConfirmationState = {
        pending: true,
        mode: 'select',
        title: 'Choose',
        message: 'Please select items',
        confirmLabel: 'OK',
        denyLabel: 'Cancel',
        items: mockItems,
        selectedIndex: 1,
      };
      const { lastFrame } = render(<WizardConfirmationModal state={state} />);
      expect(lastFrame()).toContain('▸');
    });

    it('displays item descriptions when present', () => {
      const state: WizardConfirmationState = {
        pending: true,
        mode: 'select',
        title: 'Choose',
        message: 'Please select items',
        confirmLabel: 'OK',
        denyLabel: 'Cancel',
        items: mockItems,
        selectedIndex: 0,
      };
      const { lastFrame } = render(<WizardConfirmationModal state={state} />);
      const output = lastFrame() ?? '';
      expect(output).toContain('First option');
      expect(output).toContain('Second option');
    });

    it('displays keyboard shortcut hints', () => {
      const state: WizardConfirmationState = {
        pending: true,
        mode: 'select',
        title: 'Choose',
        message: 'Please select items',
        confirmLabel: 'OK',
        denyLabel: 'Cancel',
        items: mockItems,
        selectedIndex: 0,
      };
      const { lastFrame } = render(<WizardConfirmationModal state={state} />);
      const output = lastFrame() ?? '';
      expect(output).toContain('↑↓ Navigate');
      expect(output).toContain('Space Toggle');
      expect(output).toContain('Enter');
      expect(output).toContain('Esc');
    });

    it('includes confirm and deny labels in footer', () => {
      const state: WizardConfirmationState = {
        pending: true,
        mode: 'select',
        title: 'Choose',
        message: 'Please select items',
        confirmLabel: 'Apply',
        denyLabel: 'Skip',
        items: mockItems,
        selectedIndex: 0,
      };
      const { lastFrame } = render(<WizardConfirmationModal state={state} />);
      const output = lastFrame() ?? '';
      expect(output).toContain('Apply');
      expect(output).toContain('Skip');
    });
  });

  describe('scrolling in select mode', () => {
    const manyItems = Array.from({ length: 15 }, (_, i) => ({
      id: `item${i}`,
      label: `Option ${i + 1}`,
      description: `Description ${i + 1}`,
      selected: false,
    }));

    it('shows scroll indicator when more items below', () => {
      const state: WizardConfirmationState = {
        pending: true,
        mode: 'select',
        title: 'Choose Many',
        message: 'Please select many items',
        confirmLabel: 'OK',
        denyLabel: 'Cancel',
        items: manyItems,
        selectedIndex: 0,
      };
      const { lastFrame } = render(<WizardConfirmationModal state={state} />);
      const output = lastFrame() ?? '';
      // Should show down arrow with count
      expect(output).toMatch(/↓\d+/);
    });
  });

  describe('visual styling', () => {
    it('has yellow border (round style)', () => {
      const state: WizardConfirmationState = {
        pending: true,
        mode: 'confirm',
        title: 'Confirm',
        message: 'Test',
        confirmLabel: 'Y',
        denyLabel: 'N',
      };
      const { lastFrame } = render(<WizardConfirmationModal state={state} />);
      const output = lastFrame() ?? '';
      // Round border uses ╭ ╮ ╰ ╯ characters
      expect(output).toContain('╭');
      expect(output).toContain('╯');
    });
  });

  describe('memoization', () => {
    it('maintains referential equality when props unchanged', () => {
      const state: WizardConfirmationState = {
        pending: true,
        mode: 'confirm',
        title: 'Test',
        message: 'Message',
        confirmLabel: 'Y',
        denyLabel: 'N',
      };
      const { rerender, lastFrame } = render(
        <WizardConfirmationModal state={state} />
      );
      const firstFrame = lastFrame();

      rerender(<WizardConfirmationModal state={state} />);
      const secondFrame = lastFrame();

      expect(firstFrame).toBe(secondFrame);
    });

    it('updates when selectedIndex changes in select mode', () => {
      const items = [
        { id: '1', label: 'A', selected: false },
        { id: '2', label: 'B', selected: false },
      ];
      const state1: WizardConfirmationState = {
        pending: true,
        mode: 'select',
        title: 'Choose',
        message: 'Please select items',
        confirmLabel: 'OK',
        denyLabel: 'Cancel',
        items,
        selectedIndex: 0,
      };
      const { rerender, lastFrame } = render(
        <WizardConfirmationModal state={state1} />
      );
      const firstFrame = lastFrame();

      const state2 = { ...state1, selectedIndex: 1 };
      rerender(<WizardConfirmationModal state={state2} />);
      const secondFrame = lastFrame();

      // Should have re-rendered with different selection
      expect(firstFrame).not.toBe(secondFrame);
    });

    it('updates when item selection changes', () => {
      const items1 = [
        { id: '1', label: 'A', selected: false },
        { id: '2', label: 'B', selected: false },
      ];
      const items2 = [
        { id: '1', label: 'A', selected: true },
        { id: '2', label: 'B', selected: false },
      ];
      const state1: WizardConfirmationState = {
        pending: true,
        mode: 'select',
        title: 'Choose',
        message: 'Please select items',
        confirmLabel: 'OK',
        denyLabel: 'Cancel',
        items: items1,
        selectedIndex: 0,
      };
      const { rerender, lastFrame } = render(
        <WizardConfirmationModal state={state1} />
      );
      const firstFrame = lastFrame();

      const state2 = { ...state1, items: items2 };
      rerender(<WizardConfirmationModal state={state2} />);
      const secondFrame = lastFrame();

      expect(firstFrame).not.toBe(secondFrame);
    });
  });
});
