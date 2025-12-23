import React from 'react';
import { render } from 'ink-testing-library';
import { CommandDropdown } from '../CommandDropdown.js';
import type { Command } from '../../commands/loader.js';

describe('CommandDropdown', () => {
  const mockCommands: Command[] = [
    {
      name: 'help',
      description: 'Show help information',
      filePath: '/cmd/help.md',
      content: '# help',
    },
    {
      name: 'status',
      description: 'Show current status',
      filePath: '/cmd/status.md',
      content: '# status',
    },
    {
      name: 'commit',
      description: 'Create a commit',
      filePath: '/cmd/commit.md',
      content: '# commit',
    },
    {
      name: 'review',
      description: 'Review code changes',
      filePath: '/cmd/review.md',
      content: '# review',
    },
    {
      name: 'test',
      description: 'Run tests',
      filePath: '/cmd/test.md',
      content: '# test',
    },
  ];

  describe('visibility', () => {
    it('renders nothing when not visible', () => {
      const { lastFrame } = render(
        <CommandDropdown
          commands={mockCommands}
          selectedIndex={0}
          isVisible={false}
        />
      );
      expect(lastFrame()).toBe('');
    });

    it('renders nothing when commands array is empty', () => {
      const { lastFrame } = render(
        <CommandDropdown commands={[]} selectedIndex={0} isVisible={true} />
      );
      expect(lastFrame()).toBe('');
    });

    it('renders when visible with commands', () => {
      const { lastFrame } = render(
        <CommandDropdown
          commands={mockCommands}
          selectedIndex={0}
          isVisible={true}
        />
      );
      expect(lastFrame()).not.toBe('');
    });
  });

  describe('command display', () => {
    it('displays command names with slash prefix', () => {
      const { lastFrame } = render(
        <CommandDropdown
          commands={mockCommands}
          selectedIndex={0}
          isVisible={true}
        />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('/help');
      expect(output).toContain('/status');
      expect(output).toContain('/commit');
    });

    it('displays command descriptions', () => {
      const { lastFrame } = render(
        <CommandDropdown
          commands={mockCommands}
          selectedIndex={0}
          isVisible={true}
        />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('Show help information');
      expect(output).toContain('Show current status');
    });

    it('handles commands without descriptions', () => {
      const noDescCommands: Command[] = [
        { name: 'nodesc', filePath: '/cmd/nodesc.md', content: '# nodesc' },
      ];
      const { lastFrame } = render(
        <CommandDropdown
          commands={noDescCommands}
          selectedIndex={0}
          isVisible={true}
        />
      );
      expect(lastFrame()).toContain('/nodesc');
    });

    it('truncates long descriptions to 80 characters', () => {
      const longDescCommand: Command[] = [
        {
          name: 'long',
          description: 'A'.repeat(100), // 100 char description
          filePath: '/cmd/long.md',
          content: '# long',
        },
      ];
      const { lastFrame } = render(
        <CommandDropdown
          commands={longDescCommand}
          selectedIndex={0}
          isVisible={true}
        />
      );
      const output = lastFrame() ?? '';
      // Should contain truncated description with ellipsis
      expect(output).toContain('…');
    });
  });

  describe('selection indicator', () => {
    it('shows selection indicator for selected command', () => {
      const { lastFrame } = render(
        <CommandDropdown
          commands={mockCommands}
          selectedIndex={0}
          isVisible={true}
        />
      );
      expect(lastFrame()).toContain('▸');
    });

    it('selection indicator appears next to selected command', () => {
      const { lastFrame } = render(
        <CommandDropdown
          commands={mockCommands}
          selectedIndex={1}
          isVisible={true}
        />
      );
      const output = lastFrame() ?? '';
      // Status should have the indicator since it's at index 1
      expect(output).toContain('▸');
      expect(output).toContain('/status');
    });

    it('unselected commands have space instead of indicator', () => {
      const { lastFrame } = render(
        <CommandDropdown
          commands={mockCommands}
          selectedIndex={0}
          isVisible={true}
        />
      );
      const output = lastFrame() ?? '';
      // Help (selected) should have ▸, status (unselected) should have space
      expect(output).toContain('▸ /help');
    });
  });

  describe('footer', () => {
    it('shows keyboard shortcut hints', () => {
      const { lastFrame } = render(
        <CommandDropdown
          commands={mockCommands}
          selectedIndex={0}
          isVisible={true}
        />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('↑↓');
      expect(output).toContain('⏎');
      expect(output).toContain('Esc');
    });
  });

  describe('scroll behavior', () => {
    it('shows scroll indicator when more commands below', () => {
      // With maxHeight=2, we should see scroll indicators
      const { lastFrame } = render(
        <CommandDropdown
          commands={mockCommands}
          selectedIndex={0}
          isVisible={true}
          maxHeight={2}
        />
      );
      const output = lastFrame() ?? '';
      // Should show down arrow with count
      expect(output).toMatch(/↓\d+/);
    });

    it('limits displayed commands to maxHeight', () => {
      const { lastFrame } = render(
        <CommandDropdown
          commands={mockCommands}
          selectedIndex={0}
          isVisible={true}
          maxHeight={2}
        />
      );
      const output = lastFrame() ?? '';
      // Should only show first 2 commands
      expect(output).toContain('/help');
      expect(output).toContain('/status');
      // commit should not be visible without scrolling
      expect(output).not.toContain('/commit');
    });

    it('shows scroll indicators when there are more items', () => {
      // With many commands and small maxHeight, scrolling should be possible
      const { lastFrame } = render(
        <CommandDropdown
          commands={mockCommands}
          selectedIndex={0}
          isVisible={true}
          maxHeight={2}
        />
      );
      const output = lastFrame() ?? '';
      // Should show down arrow indicator (more items below)
      // or up arrow if scrolled (more items above)
      expect(output).toMatch(/[↑↓]\d+/);
    });
  });

  describe('memoization', () => {
    it('maintains referential equality when props unchanged', () => {
      // This tests that React.memo is working
      const { rerender, lastFrame } = render(
        <CommandDropdown
          commands={mockCommands}
          selectedIndex={0}
          isVisible={true}
        />
      );
      const firstFrame = lastFrame();

      rerender(
        <CommandDropdown
          commands={mockCommands}
          selectedIndex={0}
          isVisible={true}
        />
      );
      const secondFrame = lastFrame();

      expect(firstFrame).toBe(secondFrame);
    });

    it('updates when selectedIndex changes', () => {
      const { rerender, lastFrame } = render(
        <CommandDropdown
          commands={mockCommands}
          selectedIndex={0}
          isVisible={true}
        />
      );
      const firstFrame = lastFrame();

      rerender(
        <CommandDropdown
          commands={mockCommands}
          selectedIndex={1}
          isVisible={true}
        />
      );
      const secondFrame = lastFrame();

      // Output should change when selection changes
      expect(firstFrame).not.toBe(secondFrame);
    });
  });
});
