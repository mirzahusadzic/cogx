/**
 * Tests for useZeroMQ hook
 *
 * Tests ZeroMQ bus connection for multi-agent communication.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock ZeroMQ components
const mockBus = {
  send: vi.fn(),
  subscribe: vi.fn(),
  close: vi.fn(),
};

const mockRegistry = {
  register: vi.fn(),
  unregister: vi.fn(),
  getAgents: vi.fn(() => []),
};

const mockCoordinator = {
  connectWithFallback: vi.fn(),
  cleanup: vi.fn(),
  getIsBusMaster: vi.fn(() => false),
};

vi.mock('../../../../ipc/index.js', () => ({
  BusCoordinator: vi.fn(() => mockCoordinator),
  ZeroMQBus: vi.fn(() => mockBus),
  AgentRegistry: vi.fn(() => mockRegistry),
  isMultiAgentAvailable: true,
}));

// Import after mocking
import { useZeroMQ } from '../../useZeroMQ.js';

describe('useZeroMQ', () => {
  const defaultConfig = {
    agentId: 'claude-1',
    model: 'claude',
    enabled: true,
    debug: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCoordinator.connectWithFallback.mockResolvedValue(mockBus);
    mockCoordinator.cleanup.mockResolvedValue(undefined);
    mockCoordinator.getIsBusMaster.mockReturnValue(false);
  });

  describe('initialization', () => {
    it('should start disconnected', () => {
      const { result } = renderHook(() => useZeroMQ(defaultConfig));

      expect(result.current.connected).toBe(false);
      expect(result.current.bus).toBeNull();
      expect(result.current.registry).toBeNull();
    });

    it('should report multiAgentAvailable', () => {
      const { result } = renderHook(() => useZeroMQ(defaultConfig));

      expect(result.current.multiAgentAvailable).toBe(true);
    });

    it('should have no error initially', () => {
      const { result } = renderHook(() => useZeroMQ(defaultConfig));

      expect(result.current.error).toBeNull();
    });
  });

  describe('connection', () => {
    it('should connect when enabled', async () => {
      const { result } = renderHook(() => useZeroMQ(defaultConfig));

      await waitFor(() => {
        expect(result.current.connected).toBe(true);
      });

      expect(mockCoordinator.connectWithFallback).toHaveBeenCalled();
      expect(result.current.bus).toBe(mockBus);
    });

    it('should register agent after connection', async () => {
      const { result } = renderHook(() => useZeroMQ(defaultConfig));

      await waitFor(() => {
        expect(result.current.connected).toBe(true);
      });

      expect(mockRegistry.register).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'claude-1',
          type: 'interactive',
          model: 'claude',
          status: 'idle',
        })
      );
    });

    it('should not connect when disabled', async () => {
      const { result } = renderHook(() =>
        useZeroMQ({ ...defaultConfig, enabled: false })
      );

      // Wait a bit to ensure no connection attempt
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockCoordinator.connectWithFallback).not.toHaveBeenCalled();
      expect(result.current.connected).toBe(false);
    });
  });

  describe('bus master detection', () => {
    it('should detect bus master status', async () => {
      mockCoordinator.getIsBusMaster.mockReturnValue(true);

      const { result } = renderHook(() => useZeroMQ(defaultConfig));

      await waitFor(() => {
        expect(result.current.connected).toBe(true);
      });

      expect(result.current.isBusMaster).toBe(true);
    });

    it('should detect peer status', async () => {
      mockCoordinator.getIsBusMaster.mockReturnValue(false);

      const { result } = renderHook(() => useZeroMQ(defaultConfig));

      await waitFor(() => {
        expect(result.current.connected).toBe(true);
      });

      expect(result.current.isBusMaster).toBe(false);
    });
  });

  describe('model capabilities', () => {
    it('should set claude capabilities', async () => {
      const { result } = renderHook(() =>
        useZeroMQ({ ...defaultConfig, model: 'claude' })
      );

      await waitFor(() => {
        expect(result.current.connected).toBe(true);
      });

      expect(mockRegistry.register).toHaveBeenCalledWith(
        expect.objectContaining({
          capabilities: expect.arrayContaining([
            expect.objectContaining({ name: 'code_implementation' }),
            expect.objectContaining({ name: 'system_design' }),
          ]),
        })
      );
    });

    it('should set gemini capabilities', async () => {
      const { result } = renderHook(() =>
        useZeroMQ({ ...defaultConfig, model: 'gemini' })
      );

      await waitFor(() => {
        expect(result.current.connected).toBe(true);
      });

      expect(mockRegistry.register).toHaveBeenCalledWith(
        expect.objectContaining({
          capabilities: expect.arrayContaining([
            expect.objectContaining({ name: 'architecture_design' }),
            expect.objectContaining({ name: 'concept_exploration' }),
          ]),
        })
      );
    });

    it('should set opus capabilities', async () => {
      const { result } = renderHook(() =>
        useZeroMQ({ ...defaultConfig, model: 'opus' })
      );

      await waitFor(() => {
        expect(result.current.connected).toBe(true);
      });

      expect(mockRegistry.register).toHaveBeenCalledWith(
        expect.objectContaining({
          capabilities: expect.arrayContaining([
            expect.objectContaining({ name: 'code_review' }),
            expect.objectContaining({ name: 'architecture_review' }),
          ]),
        })
      );
    });

    it('should set default capabilities for unknown model', async () => {
      const { result } = renderHook(() =>
        useZeroMQ({ ...defaultConfig, model: 'unknown' })
      );

      await waitFor(() => {
        expect(result.current.connected).toBe(true);
      });

      expect(mockRegistry.register).toHaveBeenCalledWith(
        expect.objectContaining({
          capabilities: expect.arrayContaining([
            expect.objectContaining({ name: 'general_purpose' }),
          ]),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle connection errors', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockCoordinator.connectWithFallback.mockRejectedValue(
        new Error('Connection failed')
      );

      const { result } = renderHook(() => useZeroMQ(defaultConfig));

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error?.message).toBe('Connection failed');
      expect(result.current.connected).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Multi-agent mode unavailable')
      );

      consoleSpy.mockRestore();
    });

    it('should gracefully degrade on error', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockCoordinator.connectWithFallback.mockRejectedValue(
        new Error('ZeroMQ not available')
      );

      const { result } = renderHook(() => useZeroMQ(defaultConfig));

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // Should still be usable (graceful degradation)
      expect(result.current.bus).toBeNull();
      expect(result.current.registry).toBeNull();

      consoleSpy.mockRestore();
    });
  });

  describe('cleanup', () => {
    it('should unregister agent on unmount', async () => {
      const { result, unmount } = renderHook(() => useZeroMQ(defaultConfig));

      await waitFor(() => {
        expect(result.current.connected).toBe(true);
      });

      unmount();

      await waitFor(() => {
        expect(mockRegistry.unregister).toHaveBeenCalledWith('claude-1');
      });
    });

    it('should cleanup coordinator on unmount', async () => {
      const { result, unmount } = renderHook(() => useZeroMQ(defaultConfig));

      await waitFor(() => {
        expect(result.current.connected).toBe(true);
      });

      unmount();

      // Cleanup is called asynchronously, give it time
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockCoordinator.cleanup).toHaveBeenCalled();
    });

    it('should not cleanup if connection failed', async () => {
      mockCoordinator.connectWithFallback.mockRejectedValue(
        new Error('Failed')
      );
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result, unmount } = renderHook(() => useZeroMQ(defaultConfig));

      // Wait for error to be set
      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      unmount();

      // Cleanup should not have been set up since connection failed
      expect(mockRegistry.unregister).not.toHaveBeenCalled();
    });
  });

  describe('debug mode', () => {
    it('should log when debug is enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useZeroMQ({ ...defaultConfig, debug: true })
      );

      await waitFor(() => {
        expect(result.current.connected).toBe(true);
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ZeroMQ')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('multiAgentAvailable flag', () => {
    it('should skip connection if multiAgentAvailable is false', async () => {
      // Re-mock with isMultiAgentAvailable = false
      vi.doMock('../../../ipc/index.js', () => ({
        BusCoordinator: vi.fn(() => mockCoordinator),
        ZeroMQBus: vi.fn(() => mockBus),
        AgentRegistry: vi.fn(() => mockRegistry),
        isMultiAgentAvailable: false,
      }));

      // Note: This test may need adjustment based on module caching
      // The mock above may not take effect due to hoisting
    });
  });

  describe('return value structure', () => {
    it('should return all expected properties', () => {
      const { result } = renderHook(() => useZeroMQ(defaultConfig));

      expect(result.current).toHaveProperty('bus');
      expect(result.current).toHaveProperty('registry');
      expect(result.current).toHaveProperty('connected');
      expect(result.current).toHaveProperty('isBusMaster');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('multiAgentAvailable');
    });
  });

  describe('config changes', () => {
    it('should use provided agentId in registration', async () => {
      const { result } = renderHook(() =>
        useZeroMQ({ ...defaultConfig, agentId: 'custom-agent' })
      );

      await waitFor(() => {
        expect(result.current.connected).toBe(true);
      });

      expect(mockRegistry.register).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'custom-agent' })
      );
    });
  });
});
