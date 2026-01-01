/**
 * useCompression Hook Tests
 *
 * Tests for the compression orchestration hook that manages the
 * compression lifecycle and state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompression } from '../../../compression/useCompression.js';

describe('useCompression', () => {
  const defaultOptions = {
    tokenCount: 100000,
    analyzedTurns: 10,
    isThinking: false,
    tokenThreshold: 120000,
    minTurns: 5,
    enabled: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useCompression(defaultOptions));

      expect(result.current.state.triggered).toBe(false);
      expect(result.current.state.compressionCount).toBe(0);
      expect(result.current.shouldTrigger).toBe(false);
    });

    it('should not trigger initially when below threshold', () => {
      const { result } = renderHook(() =>
        useCompression({
          ...defaultOptions,
          tokenCount: 50000,
        })
      );

      expect(result.current.shouldTrigger).toBe(false);
    });
  });

  describe('Automatic Triggering', () => {
    it('should calculate shouldTrigger when token threshold exceeded', async () => {
      const onTrigger = vi.fn();
      const { result, rerender } = renderHook(
        (props) => useCompression(props),
        {
          initialProps: {
            ...defaultOptions,
            tokenCount: 100000,
            onCompressionTriggered: onTrigger,
          },
        }
      );

      // Should not auto-trigger (automatic effect disabled in Option C)
      expect(onTrigger).not.toHaveBeenCalled();
      expect(result.current.shouldTrigger).toBe(false);

      // Increase token count above threshold
      rerender({
        ...defaultOptions,
        tokenCount: 130000,
        onCompressionTriggered: onTrigger,
      });

      // Should calculate shouldTrigger=true but not auto-trigger
      expect(result.current.shouldTrigger).toBe(true);
      expect(onTrigger).not.toHaveBeenCalled();

      // Manual trigger should work
      act(() => {
        result.current.triggerCompression();
      });

      expect(onTrigger).toHaveBeenCalledWith(130000, 10, false);
      expect(result.current.state.triggered).toBe(true);
      expect(result.current.state.compressionCount).toBe(1);
    });

    it('should not auto-trigger (automatic effect disabled)', async () => {
      const onTrigger = vi.fn();
      const { result } = renderHook((props) => useCompression(props), {
        initialProps: {
          ...defaultOptions,
          tokenCount: 130000,
          isThinking: false,
          onCompressionTriggered: onTrigger,
        },
      });

      // Wait to ensure no automatic trigger
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not auto-trigger (Option C: automatic effect disabled)
      expect(onTrigger).not.toHaveBeenCalled();

      // But shouldTrigger should be true
      expect(result.current.shouldTrigger).toBe(true);

      // Manual trigger should work
      act(() => {
        result.current.triggerCompression();
      });

      expect(onTrigger).toHaveBeenCalledWith(130000, 10, false);
    });

    it('should calculate shouldTrigger=false after first manual trigger', async () => {
      const onTrigger = vi.fn();
      const { result, rerender } = renderHook(
        (props) => useCompression(props),
        {
          initialProps: {
            ...defaultOptions,
            tokenCount: 130000,
            onCompressionTriggered: onTrigger,
          },
        }
      );

      // Manual trigger
      act(() => {
        result.current.triggerCompression();
      });

      expect(onTrigger).toHaveBeenCalledTimes(1);
      expect(result.current.state.triggered).toBe(true);

      // Increase tokens even more
      rerender({
        ...defaultOptions,
        tokenCount: 200000,
        onCompressionTriggered: onTrigger,
      });

      // shouldTrigger should now be false (already triggered)
      expect(result.current.shouldTrigger).toBe(false);

      // But manual triggering still works (user has full control)
      act(() => {
        result.current.triggerCompression();
      });

      expect(onTrigger).toHaveBeenCalledTimes(2);
      expect(result.current.state.compressionCount).toBe(2);
    });

    it('should not trigger when below minimum turns', async () => {
      const onTrigger = vi.fn();
      renderHook(() =>
        useCompression({
          ...defaultOptions,
          tokenCount: 130000,
          analyzedTurns: 3,
          onCompressionTriggered: onTrigger,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onTrigger).not.toHaveBeenCalled();
    });
  });

  describe('Manual Triggering', () => {
    it('should trigger compression manually', () => {
      const onTrigger = vi.fn();
      const { result } = renderHook(() =>
        useCompression({
          ...defaultOptions,
          onCompressionTriggered: onTrigger,
        })
      );

      act(() => {
        result.current.triggerCompression();
      });

      expect(onTrigger).toHaveBeenCalledWith(100000, 10, false);
      expect(result.current.state.triggered).toBe(true);
      expect(result.current.state.compressionCount).toBe(1);
    });

    it('should update compression count on manual trigger', () => {
      const { result } = renderHook(() => useCompression(defaultOptions));

      act(() => {
        result.current.triggerCompression();
      });

      expect(result.current.state.compressionCount).toBe(1);

      act(() => {
        result.current.reset();
        result.current.triggerCompression();
      });

      expect(result.current.state.compressionCount).toBe(2);
    });
  });

  describe('Reset', () => {
    it('should reset triggered state', async () => {
      const onTrigger = vi.fn();
      const { result, rerender } = renderHook(
        (props) => useCompression(props),
        {
          initialProps: {
            ...defaultOptions,
            tokenCount: 130000,
            onCompressionTriggered: onTrigger,
          },
        }
      );

      // Manual trigger
      act(() => {
        result.current.triggerCompression();
      });

      expect(result.current.state.triggered).toBe(true);

      // Force re-render to see updated shouldTrigger value
      rerender({
        ...defaultOptions,
        tokenCount: 130000,
        onCompressionTriggered: onTrigger,
      });

      expect(result.current.shouldTrigger).toBe(false); // Can't auto-trigger again

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.state.triggered).toBe(false);

      // Force re-render to see updated shouldTrigger value
      rerender({
        ...defaultOptions,
        tokenCount: 130000,
        onCompressionTriggered: onTrigger,
      });

      expect(result.current.shouldTrigger).toBe(true); // Can trigger again
    });

    it('should allow compression to trigger again after reset', async () => {
      const onTrigger = vi.fn();
      const { result, rerender } = renderHook(
        (props) => useCompression(props),
        {
          initialProps: {
            ...defaultOptions,
            tokenCount: 130000,
            onCompressionTriggered: onTrigger,
          },
        }
      );

      // First manual trigger
      act(() => {
        result.current.triggerCompression();
      });

      expect(onTrigger).toHaveBeenCalledTimes(1);

      // Force re-render to see updated shouldTrigger value
      rerender({
        ...defaultOptions,
        tokenCount: 130000,
        onCompressionTriggered: onTrigger,
      });

      expect(result.current.shouldTrigger).toBe(false);

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.state.triggered).toBe(false);

      // Trigger again manually with higher token count
      rerender({
        ...defaultOptions,
        tokenCount: 200000,
        onCompressionTriggered: onTrigger,
      });

      expect(result.current.shouldTrigger).toBe(true); // Can auto-trigger again

      act(() => {
        result.current.triggerCompression();
      });

      expect(onTrigger).toHaveBeenCalledTimes(2);
      expect(result.current.state.compressionCount).toBe(2);
    });
  });

  describe('getTriggerInfo', () => {
    it('should return current trigger information', () => {
      const { result } = renderHook(() =>
        useCompression({
          ...defaultOptions,
          tokenCount: 100000,
        })
      );

      const info = result.current.getTriggerInfo();

      expect(info.currentTokens).toBe(100000);
      expect(info.threshold).toBe(120000);
      expect(info.currentTurns).toBe(10);
      expect(info.minTurns).toBe(5);
      expect(info.reason).toBeDefined();
    });

    it('should reflect updated token count', () => {
      const { result, rerender } = renderHook(
        (props) => useCompression(props),
        {
          initialProps: defaultOptions,
        }
      );

      rerender({
        ...defaultOptions,
        tokenCount: 150000,
      });

      const info = result.current.getTriggerInfo();
      expect(info.currentTokens).toBe(150000);
    });
  });

  describe('Option Updates', () => {
    it('should update threshold dynamically', async () => {
      const onTrigger = vi.fn();
      const { result, rerender } = renderHook(
        (props) => useCompression(props),
        {
          initialProps: {
            ...defaultOptions,
            tokenCount: 130000,
            tokenThreshold: 150000,
            onCompressionTriggered: onTrigger,
          },
        }
      );

      // Verify getTriggerInfo reflects initial state (130k < 150k)
      const initialInfo = result.current.getTriggerInfo();
      expect(initialInfo.currentTokens).toBe(130000);
      expect(initialInfo.threshold).toBe(150000);
      expect(initialInfo.reason).toContain('130000 tokens');

      // Lower threshold (130k > 120k)
      rerender({
        ...defaultOptions,
        tokenCount: 130001,
        tokenThreshold: 120000,
        onCompressionTriggered: onTrigger,
      });

      // Verify getTriggerInfo reflects updated state
      const updatedInfo = result.current.getTriggerInfo();
      expect(updatedInfo.currentTokens).toBe(130001);
      expect(updatedInfo.threshold).toBe(120000);
      expect(updatedInfo.reason).toContain('130001 tokens > 120000 threshold');

      // But still no auto-trigger (automatic effect disabled)
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(onTrigger).not.toHaveBeenCalled();

      // Manual trigger works with updated threshold
      act(() => {
        result.current.triggerCompression();
      });

      expect(onTrigger).toHaveBeenCalledWith(130001, 10, false);
    });

    it('should respect enabled flag', async () => {
      const onTrigger = vi.fn();
      const { result, rerender } = renderHook(
        (props) => useCompression(props),
        {
          initialProps: {
            ...defaultOptions,
            tokenCount: 130000,
            enabled: false,
            onCompressionTriggered: onTrigger,
          },
        }
      );

      // Verify getTriggerInfo reflects disabled state
      const disabledInfo = result.current.getTriggerInfo();
      expect(disabledInfo.reason).toBe('Compression is disabled');

      // Enable compression (130k > 120k threshold)
      rerender({
        ...defaultOptions,
        tokenCount: 130001,
        enabled: true,
        onCompressionTriggered: onTrigger,
      });

      // Verify getTriggerInfo reflects enabled state
      const enabledInfo = result.current.getTriggerInfo();
      expect(enabledInfo.currentTokens).toBe(130001);
      expect(enabledInfo.threshold).toBe(120000);
      expect(enabledInfo.reason).toContain('130001 tokens > 120000 threshold');

      // But still no auto-trigger (automatic effect disabled)
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(onTrigger).not.toHaveBeenCalled();

      // Manual trigger works when enabled
      act(() => {
        result.current.triggerCompression();
      });

      expect(onTrigger).toHaveBeenCalledWith(130001, 10, false);
    });
  });

  describe('State Tracking', () => {
    it('should track last compression timestamp', async () => {
      const { result } = renderHook(() =>
        useCompression({
          ...defaultOptions,
          tokenCount: 130000,
        })
      );

      // Manual trigger
      act(() => {
        result.current.triggerCompression();
      });

      expect(result.current.state.lastCompression).toBeDefined();
      expect(result.current.state.lastCompression).toBeInstanceOf(Date);
    });

    it('should track last compressed token count', async () => {
      const { result } = renderHook(() =>
        useCompression({
          ...defaultOptions,
          tokenCount: 135000,
        })
      );

      // Manual trigger
      act(() => {
        result.current.triggerCompression();
      });

      expect(result.current.state.lastCompressedTokens).toBe(135000);
    });
  });

  describe('Debug Mode', () => {
    it('should log when debug is enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const { result } = renderHook(() =>
        useCompression({
          ...defaultOptions,
          tokenCount: 130000,
          debug: true,
        })
      );

      // Manual trigger
      act(() => {
        result.current.triggerCompression();
      });

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Manual compression trigger (semantic: false)'
      );

      consoleSpy.mockRestore();
    });
  });
});
