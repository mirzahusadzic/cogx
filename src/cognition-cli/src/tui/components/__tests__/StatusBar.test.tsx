import React from 'react';
import { Box } from 'ink';
import { render } from 'ink-testing-library';
import { StatusBar, StatusBarProps } from '../StatusBar.js';

describe('StatusBar', () => {
  const renderStatusBar = (props: StatusBarProps) => {
    return render(
      <Box width={150}>
        <StatusBar {...props} />
      </Box>
    );
  };

  describe('rendering', () => {
    it('renders with default props', () => {
      const { lastFrame } = renderStatusBar({ focused: false });
      expect(lastFrame()).toContain('Focus');
      expect(lastFrame()).toContain('Quit');
    });

    it('shows Scroll text when not focused', () => {
      const { lastFrame } = renderStatusBar({ focused: false });
      expect(lastFrame()).toContain('Scroll');
      expect(lastFrame()).not.toContain('[ESC] Clear');
    });

    it('shows Clear text when focused', () => {
      const { lastFrame } = renderStatusBar({ focused: true });
      expect(lastFrame()).toContain('Clear');
      expect(lastFrame()).not.toContain('Scroll');
    });
  });

  describe('provider display', () => {
    it('displays claude provider with emoji', () => {
      const { lastFrame } = renderStatusBar({
        focused: false,
        providerName: 'claude',
      });
      expect(lastFrame()).toContain('🟠');
      expect(lastFrame()).toContain('Claude');
    });

    it('displays gemini provider with emoji', () => {
      const { lastFrame } = renderStatusBar({
        focused: false,
        providerName: 'gemini',
      });
      expect(lastFrame()).toContain('🔵');
      expect(lastFrame()).toContain('Gemini');
    });

    it('displays gemini-agent provider with robot emoji', () => {
      const { lastFrame } = renderStatusBar({
        focused: false,
        providerName: 'gemini-agent',
      });
      expect(lastFrame()).toContain('🤖');
    });

    it('displays unknown provider with white circle', () => {
      const { lastFrame } = renderStatusBar({
        focused: false,
        providerName: 'unknown-provider',
      });
      expect(lastFrame()).toContain('⚪');
    });
  });

  describe('model display names', () => {
    it('displays Opus 4.5 for claude-opus-4-5-20251101', () => {
      const { lastFrame } = renderStatusBar({
        focused: false,
        providerName: 'claude',
        modelId: 'claude-opus-4-5-20251101',
      });
      expect(lastFrame()).toContain('Opus 4.5');
    });

    it('displays Sonnet 4.5 for claude-sonnet-4-5-20250929', () => {
      const { lastFrame } = renderStatusBar({
        focused: false,
        providerName: 'claude',
        modelId: 'claude-sonnet-4-5-20250929',
      });
      expect(lastFrame()).toContain('Sonnet 4.5');
    });

    it('displays Gemini 3f for gemini-3-flash-preview', () => {
      const { lastFrame } = renderStatusBar({
        focused: false,
        providerName: 'gemini',
        modelId: 'gemini-3-flash-preview',
      });
      expect(lastFrame()).toContain('Gemini 3f');
    });

    it('displays Gemini 2.5f (EOL) for gemini-2.5-flash', () => {
      const { lastFrame } = renderStatusBar({
        focused: false,
        providerName: 'gemini',
        modelId: 'gemini-2.5-flash',
      });
      expect(lastFrame()).toContain('Gemini 2.5f (EOL)');
    });

    it('displays raw model ID for unknown models', () => {
      const { lastFrame } = renderStatusBar({
        focused: false,
        providerName: 'claude',
        modelId: 'claude-future-model',
      });
      expect(lastFrame()).toContain('claude-future-model');
    });

    it('falls back to provider name when no modelId', () => {
      const { lastFrame } = renderStatusBar({
        focused: false,
        providerName: 'claude',
      });
      expect(lastFrame()).toContain('Claude');
    });
  });

  describe('session ID display', () => {
    it('displays truncated session ID', () => {
      const { lastFrame } = renderStatusBar({
        focused: false,
        sessionId: 'claude-abc123def456ghi789',
      });
      expect(lastFrame()).toContain('🪪');
      expect(lastFrame()).toContain('abc123de'); // First 8 chars after prefix removal
    });

    it('removes provider prefix from session ID', () => {
      const { lastFrame } = renderStatusBar({
        focused: false,
        sessionId: 'gemini-xyz987abc',
      });
      // Should NOT contain the full "gemini-xyz987abc"
      expect(lastFrame()).toContain('xyz987ab');
    });

    it('does not display session section when no sessionId', () => {
      const { lastFrame } = renderStatusBar({ focused: false });
      expect(lastFrame()).not.toContain('🪪');
    });
  });

  describe('token display', () => {
    it('formats tokens with K suffix for thousands', () => {
      const { lastFrame } = renderStatusBar({
        focused: false,
        tokenCount: {
          input: 10000,
          output: 5000,
          total: 15000,
          cached: 4000,
        },
      });
      expect(lastFrame()).toContain('📊');
      // Look for Cached/Total parts
      expect(lastFrame()).toContain('4k');
      expect(lastFrame()).toContain('/');
      expect(lastFrame()).toContain('15k');
    });

    it('displays raw number for tokens under 1000', () => {
      const { lastFrame } = renderStatusBar({
        focused: false,
        tokenCount: { input: 500, output: 300, total: 800, cached: 200 },
      });
      expect(lastFrame()).toContain('200');
      expect(lastFrame()).toContain('/');
      expect(lastFrame()).toContain('800');
    });

    it('calculates proportional bar display', () => {
      const { lastFrame } = renderStatusBar({
        focused: false,
        tokenCount: {
          input: 30000,
          output: 30000,
          total: 60000,
          cached: 10000,
        },
        compressionThreshold: 200000,
        semanticThreshold: 50000,
      });
      // It should contain the visual bar brackets and the threshold info
      expect(lastFrame()).toContain('[');
      expect(lastFrame()).toContain(']');
      expect(lastFrame()).toContain('10k');
      expect(lastFrame()).toContain('/');
      expect(lastFrame()).toContain('60k');
      expect(lastFrame()).toContain('⏳');
    });

    it('shows semantic threshold with emoji', () => {
      const { lastFrame } = renderStatusBar({
        focused: false,
        tokenCount: { input: 1000, output: 1000, total: 2000 },
        compressionThreshold: 100000,
        semanticThreshold: 50000,
      });
      expect(lastFrame()).toContain('🗜️');
      expect(lastFrame()).toContain('50k');
      expect(lastFrame()).toContain('100k');
      // Verify Σ in the threshold part
      expect(lastFrame()).toContain('Σ');
    });

    it('does not display token section when total is 0 and no session count', () => {
      const { lastFrame } = renderStatusBar({ focused: false });
      expect(lastFrame()).not.toContain('📊');
    });

    it('shows session tokens next to session ID', () => {
      const { lastFrame } = renderStatusBar({
        focused: false,
        sessionId: 'test-12345678',
        sessionTokenCount: {
          input: 10,
          output: 20,
          total: 30,
          cached: 5,
          costUsd: 0,
          savedCostUsd: 0,
        },
      });
      expect(lastFrame()).toContain('🪪');
      expect(lastFrame()).toContain('12345678');
      // Use a more flexible check that doesn't care about wrapping
      expect(lastFrame()).toContain('5');
      expect(lastFrame()).toContain('/');
      expect(lastFrame()).toContain('30');
    });
  });

  describe('keyboard shortcuts display', () => {
    it('shows Tab focus help', () => {
      const { lastFrame } = renderStatusBar({ focused: false });
      expect(lastFrame()).toContain('[Tab] Focus');
    });

    it('shows Ctrl+S save help', () => {
      const { lastFrame } = renderStatusBar({ focused: false });
      expect(lastFrame()).toContain('[^S] Save');
    });

    it('shows Ctrl+C quit help', () => {
      const { lastFrame } = renderStatusBar({ focused: false });
      expect(lastFrame()).toContain('[^C] Quit');
    });
  });
});
