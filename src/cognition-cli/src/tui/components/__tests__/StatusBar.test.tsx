import React from 'react';
import { render } from 'ink-testing-library';
import { StatusBar } from '../StatusBar.js';

describe('StatusBar', () => {
  describe('rendering', () => {
    it('renders with default props', () => {
      const { lastFrame } = render(<StatusBar focused={false} />);
      expect(lastFrame()).toContain('Toggle Focus');
      expect(lastFrame()).toContain('Quit');
    });

    it('shows Scroll text when not focused', () => {
      const { lastFrame } = render(<StatusBar focused={false} />);
      expect(lastFrame()).toContain('Scroll');
      expect(lastFrame()).not.toContain('[ESC ESC] Clear');
    });

    it('shows Clear text when focused', () => {
      const { lastFrame } = render(<StatusBar focused={true} />);
      expect(lastFrame()).toContain('Clear');
      expect(lastFrame()).not.toContain('Scroll');
    });
  });

  describe('provider display', () => {
    it('displays claude provider with emoji', () => {
      const { lastFrame } = render(
        <StatusBar focused={false} providerName="claude" />
      );
      expect(lastFrame()).toContain('🟠');
      expect(lastFrame()).toContain('Claude');
    });

    it('displays gemini provider with emoji', () => {
      const { lastFrame } = render(
        <StatusBar focused={false} providerName="gemini" />
      );
      expect(lastFrame()).toContain('🔵');
      expect(lastFrame()).toContain('Gemini');
    });

    it('displays gemini-agent provider with robot emoji', () => {
      const { lastFrame } = render(
        <StatusBar focused={false} providerName="gemini-agent" />
      );
      expect(lastFrame()).toContain('🤖');
    });

    it('displays unknown provider with white circle', () => {
      const { lastFrame } = render(
        <StatusBar focused={false} providerName="unknown-provider" />
      );
      expect(lastFrame()).toContain('⚪');
    });
  });

  describe('model display names', () => {
    it('displays Opus 4.5 for claude-opus-4-5-20251101', () => {
      const { lastFrame } = render(
        <StatusBar
          focused={false}
          providerName="claude"
          modelId="claude-opus-4-5-20251101"
        />
      );
      expect(lastFrame()).toContain('Opus 4.5');
    });

    it('displays Sonnet 4.5 for claude-sonnet-4-5-20250929', () => {
      const { lastFrame } = render(
        <StatusBar
          focused={false}
          providerName="claude"
          modelId="claude-sonnet-4-5-20250929"
        />
      );
      expect(lastFrame()).toContain('Sonnet 4.5');
    });

    it('displays Gemini 3f for gemini-3-flash-preview', () => {
      const { lastFrame } = render(
        <StatusBar
          focused={false}
          providerName="gemini"
          modelId="gemini-3-flash-preview"
        />
      );
      expect(lastFrame()).toContain('Gemini 3f');
    });

    it('displays Gemini 2.5f (EOL) for gemini-2.5-flash', () => {
      const { lastFrame } = render(
        <StatusBar
          focused={false}
          providerName="gemini"
          modelId="gemini-2.5-flash"
        />
      );
      expect(lastFrame()).toContain('Gemini 2.5f (EOL)');
    });

    it('displays raw model ID for unknown models', () => {
      const { lastFrame } = render(
        <StatusBar
          focused={false}
          providerName="claude"
          modelId="claude-future-model"
        />
      );
      expect(lastFrame()).toContain('claude-future-model');
    });

    it('falls back to provider name when no modelId', () => {
      const { lastFrame } = render(
        <StatusBar focused={false} providerName="claude" />
      );
      expect(lastFrame()).toContain('Claude');
    });
  });

  describe('session ID display', () => {
    it('displays truncated session ID', () => {
      const { lastFrame } = render(
        <StatusBar focused={false} sessionId="claude-abc123def456ghi789" />
      );
      expect(lastFrame()).toContain('🪪');
      expect(lastFrame()).toContain('abc123de'); // First 8 chars after prefix removal
    });

    it('removes provider prefix from session ID', () => {
      const { lastFrame } = render(
        <StatusBar focused={false} sessionId="gemini-xyz987abc" />
      );
      // Should NOT contain the full "gemini-xyz987abc"
      expect(lastFrame()).toContain('xyz987ab');
    });

    it('does not display session section when no sessionId', () => {
      const { lastFrame } = render(<StatusBar focused={false} />);
      expect(lastFrame()).not.toContain('🪪');
    });
  });

  describe('token display', () => {
    it('formats tokens with K suffix for thousands', () => {
      const { lastFrame } = render(
        <StatusBar
          focused={false}
          tokenCount={{ input: 10000, output: 5000, total: 15000 }}
        />
      );
      expect(lastFrame()).toContain('📊');
      expect(lastFrame()).toContain('15k');
    });

    it('displays raw number for tokens under 1000', () => {
      const { lastFrame } = render(
        <StatusBar
          focused={false}
          tokenCount={{ input: 500, output: 300, total: 800 }}
        />
      );
      expect(lastFrame()).toContain('800');
    });

    it('calculates percentage of compression threshold', () => {
      const { lastFrame } = render(
        <StatusBar
          focused={false}
          tokenCount={{ input: 30000, output: 30000, total: 60000 }}
          compressionThreshold={120000}
        />
      );
      expect(lastFrame()).toContain('50.0%');
    });

    it('shows compression threshold with emoji', () => {
      const { lastFrame } = render(
        <StatusBar
          focused={false}
          tokenCount={{ input: 1000, output: 1000, total: 2000 }}
          compressionThreshold={100000}
        />
      );
      expect(lastFrame()).toContain('🗜️');
      expect(lastFrame()).toContain('100k');
    });

    it('does not display token section when total is 0', () => {
      const { lastFrame } = render(
        <StatusBar
          focused={false}
          tokenCount={{ input: 0, output: 0, total: 0 }}
        />
      );
      expect(lastFrame()).not.toContain('📊');
    });

    it('does not display token section when no tokenCount', () => {
      const { lastFrame } = render(<StatusBar focused={false} />);
      expect(lastFrame()).not.toContain('📊');
    });
  });

  describe('keyboard shortcuts display', () => {
    it('shows Tab toggle help', () => {
      const { lastFrame } = render(<StatusBar focused={false} />);
      expect(lastFrame()).toContain('[Tab] Toggle Focus');
    });

    it('shows Ctrl+S save help', () => {
      const { lastFrame } = render(<StatusBar focused={false} />);
      expect(lastFrame()).toContain('[Ctrl+S]');
      expect(lastFrame()).toContain('Save');
    });

    it('shows Ctrl+C quit help', () => {
      const { lastFrame } = render(<StatusBar focused={false} />);
      expect(lastFrame()).toContain('[Ctrl+C] Quit');
    });
  });
});
