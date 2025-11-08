/**
 * useCompression Hook Tests
 *
 * Tests for the compression orchestration hook that manages the
 * compression lifecycle and state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
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
    it('should trigger when token threshold exceeded', async () => {
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

      // Should not trigger initially
      expect(onTrigger).not.toHaveBeenCalled();

      // Increase token count above threshold
      rerender({
        ...defaultOptions,
        tokenCount: 130000,
        onCompressionTriggered: onTrigger,
      });

      await waitFor(() => {
        expect(onTrigger).toHaveBeenCalledWith(130000, 10);
      });

      expect(result.current.state.triggered).toBe(true);
      expect(result.current.state.compressionCount).toBe(1);
    });

    it('should not trigger when isThinking is true', async () => {
      const onTrigger = vi.fn();
      const { rerender } = renderHook((props) => useCompression(props), {
        initialProps: {
          ...defaultOptions,
          tokenCount: 130000,
          isThinking: true,
          onCompressionTriggered: onTrigger,
        },
      });

      // Wait a bit to ensure no trigger
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onTrigger).not.toHaveBeenCalled();

      // Now set isThinking to false
      rerender({
        ...defaultOptions,
        tokenCount: 130000,
        isThinking: false,
        onCompressionTriggered: onTrigger,
      });

      await waitFor(() => {
        expect(onTrigger).toHaveBeenCalled();
      });
    });

    it('should not trigger twice without reset', async () => {
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

      await waitFor(() => {
        expect(onTrigger).toHaveBeenCalledTimes(1);
      });

      // Increase tokens even more
      rerender({
        ...defaultOptions,
        tokenCount: 200000,
        onCompressionTriggered: onTrigger,
      });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should still only be called once
      expect(onTrigger).toHaveBeenCalledTimes(1);
      expect(result.current.state.triggered).toBe(true);
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

      expect(onTrigger).toHaveBeenCalledWith(100000, 10);
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

      // Wait for trigger
      await waitFor(() => {
        expect(result.current.state.triggered).toBe(true);
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.state.triggered).toBe(false);
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

      // Wait for first trigger
      await waitFor(() => {
        expect(onTrigger).toHaveBeenCalledTimes(1);
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      // Trigger again
      rerender({
        ...defaultOptions,
        tokenCount: 200000,
        onCompressionTriggered: onTrigger,
      });

      await waitFor(() => {
        expect(onTrigger).toHaveBeenCalledTimes(2);
      });

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
      const { result, rerender } = renderHook((props) => useCompression(props), {
        initialProps: defaultOptions,
      });

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
      const { rerender } = renderHook((props) => useCompression(props), {
        initialProps: {
          ...defaultOptions,
          tokenCount: 130000,
          tokenThreshold: 150000,
          onCompressionTriggered: onTrigger,
        },
      });

      // Should not trigger with higher threshold
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(onTrigger).not.toHaveBeenCalled();

      // Lower threshold and trigger re-check by changing tokenCount slightly
      rerender({
        ...defaultOptions,
        tokenCount: 130001, // Change value to trigger useEffect
        tokenThreshold: 120000,
        onCompressionTriggered: onTrigger,
      });

      await waitFor(() => {
        expect(onTrigger).toHaveBeenCalled();
      });
    });

    it('should respect enabled flag', async () => {
      const onTrigger = vi.fn();
      const { rerender } = renderHook((props) => useCompression(props), {
        initialProps: {
          ...defaultOptions,
          tokenCount: 130000,
          enabled: false,
          onCompressionTriggered: onTrigger,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(onTrigger).not.toHaveBeenCalled();

      // Enable and trigger re-check by changing tokenCount slightly
      rerender({
        ...defaultOptions,
        tokenCount: 130001, // Change value to trigger useEffect
        enabled: true,
        onCompressionTriggered: onTrigger,
      });

      await waitFor(() => {
        expect(onTrigger).toHaveBeenCalled();
      });
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

      await waitFor(() => {
        expect(result.current.state.lastCompression).toBeDefined();
      });

      expect(result.current.state.lastCompression).toBeInstanceOf(Date);
    });

    it('should track last compressed token count', async () => {
      const { result } = renderHook(() =>
        useCompression({
          ...defaultOptions,
          tokenCount: 135000,
        })
      );

      await waitFor(() => {
        expect(result.current.state.lastCompressedTokens).toBe(135000);
      });
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

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });
});
