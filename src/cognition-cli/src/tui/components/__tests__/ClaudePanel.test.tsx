import React from 'react';
import { render } from 'ink-testing-library';
import { ClaudePanel } from '../ClaudePanel.js';

// Mock IPty interface
interface MockPty {
  onData: (callback: (data: string) => void) => void;
}

describe('ClaudePanel', () => {
  describe('no session state', () => {
    it('shows "No Claude session active" when ptySession is null', () => {
      const { lastFrame } = render(
        <ClaudePanel ptySession={null} focused={false} />
      );
      expect(lastFrame()).toContain('No Claude session active');
    });

    it('shows help text about starting a session', () => {
      const { lastFrame } = render(
        <ClaudePanel ptySession={null} focused={false} />
      );
      expect(lastFrame()).toContain('Start a Claude session first');
    });

    it('mentions --session-id flag option', () => {
      const { lastFrame } = render(
        <ClaudePanel ptySession={null} focused={false} />
      );
      expect(lastFrame()).toContain('--session-id');
    });
  });

  describe('session provided state', () => {
    it('renders session panel when session provided', () => {
      const mockPty: MockPty = {
        onData: vi.fn(),
      };
      const { lastFrame } = render(
        <ClaudePanel ptySession={mockPty as never} focused={false} />
      );
      // Should not show "no session" message when session is provided
      expect(lastFrame()).not.toContain('No Claude session active');
    });

    it('does not show help text when session exists', () => {
      const mockPty: MockPty = {
        onData: vi.fn(),
      };
      const { lastFrame } = render(
        <ClaudePanel ptySession={mockPty as never} focused={false} />
      );
      expect(lastFrame()).not.toContain('Start a Claude session first');
    });

    it('registers data handler on session', () => {
      const onDataMock = vi.fn();
      const mockPty: MockPty = {
        onData: onDataMock,
      };
      render(<ClaudePanel ptySession={mockPty as never} focused={false} />);
      // The component should register the data handler
      expect(onDataMock).toHaveBeenCalled();
    });
  });

  describe('focus indicator', () => {
    it('shows content regardless of focus state when no session', () => {
      const { lastFrame: unfocused } = render(
        <ClaudePanel ptySession={null} focused={false} />
      );
      const { lastFrame: focused } = render(
        <ClaudePanel ptySession={null} focused={true} />
      );
      // Both should show the same "no session" message
      expect(unfocused()).toContain('No Claude session active');
      expect(focused()).toContain('No Claude session active');
    });
  });

  describe('ptySession handlers', () => {
    it('registers onData handler when session provided', () => {
      const onDataMock = vi.fn();
      const mockPty: MockPty = {
        onData: onDataMock,
      };
      render(<ClaudePanel ptySession={mockPty as never} focused={false} />);
      expect(onDataMock).toHaveBeenCalled();
    });
  });

  describe('component structure', () => {
    it('renders without crashing with null session', () => {
      expect(() => {
        render(<ClaudePanel ptySession={null} focused={false} />);
      }).not.toThrow();
    });

    it('renders without crashing with mock session', () => {
      const mockPty: MockPty = {
        onData: vi.fn(),
      };
      expect(() => {
        render(<ClaudePanel ptySession={mockPty as never} focused={false} />);
      }).not.toThrow();
    });
  });
});
