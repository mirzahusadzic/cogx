/**
 * useZeroMQ Hook
 *
 * Manages ZeroMQ bus connection for multi-agent communication.
 * Handles:
 * - Bus coordination (race condition prevention)
 * - Agent registration/unregistration
 * - Graceful degradation if ZeroMQ unavailable
 */

import { useEffect, useState, useRef } from 'react';
import {
  BusCoordinator,
  ZeroMQBus,
  AgentRegistry,
  isMultiAgentAvailable,
} from '../../ipc/index.js';
import { systemLog } from '../../utils/debug-logger.js';

export interface UseZeroMQConfig {
  agentId: string; // Unique agent ID (e.g., 'claude-1')
  model: string; // 'gemini', 'claude', 'opus'
  enabled?: boolean; // If false, skip ZeroMQ (single-agent mode)
  debug?: boolean;
}

export interface UseZeroMQResult {
  bus: ZeroMQBus | null;
  registry: AgentRegistry | null;
  connected: boolean;
  isBusMaster: boolean;
  error: Error | null;
  multiAgentAvailable: boolean;
}

export function useZeroMQ(config: UseZeroMQConfig): UseZeroMQResult {
  const [bus, setBus] = useState<ZeroMQBus | null>(null);
  const [registry, setRegistry] = useState<AgentRegistry | null>(null);
  const [connected, setConnected] = useState(false);
  const [isBusMaster, setIsBusMaster] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const coordinatorRef = useRef<BusCoordinator | null>(null);
  const cleanupRef = useRef<(() => Promise<void>) | null>(null);

  // Check if multi-agent is available
  const multiAgentAvailable = isMultiAgentAvailable;

  useEffect(() => {
    // Skip if disabled or not available
    if (!config.enabled || !multiAgentAvailable) {
      if (config.debug) {
        systemLog('tui', 'ZeroMQ: Skipped (disabled or unavailable)');
      }
      return;
    }

    let mounted = true;

    async function connect() {
      try {
        if (config.debug) {
          systemLog('tui', 'ZeroMQ: Connecting...');
        }

        // Create coordinator
        const coordinator = new BusCoordinator();
        coordinatorRef.current = coordinator;

        // Connect to bus (with race condition prevention)
        const connectedBus = await coordinator.connectWithFallback();

        if (!mounted) {
          await coordinator.cleanup();
          return;
        }

        // Create registry
        const agentRegistry = new AgentRegistry(connectedBus, config.agentId);

        // Register this agent
        agentRegistry.register({
          id: config.agentId,
          type: 'interactive',
          model: config.model,
          capabilities: getCapabilitiesForModel(config.model),
          status: 'idle',
          subscriptions: new Set(),
        });

        // Update state
        setBus(connectedBus);
        setRegistry(agentRegistry);
        setConnected(true);
        setIsBusMaster(coordinator.getIsBusMaster());

        if (config.debug) {
          systemLog(
            'tui',
            `ZeroMQ: Connected (${coordinator.getIsBusMaster() ? 'Bus Master' : 'Peer'})`
          );
        }

        // Setup cleanup function
        cleanupRef.current = async () => {
          if (agentRegistry && config.agentId) {
            agentRegistry.unregister(config.agentId);
          }
          await coordinator.cleanup();
        };
      } catch (err) {
        if (!mounted) return;

        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);

        if (config.debug) {
          systemLog('tui', 'ZeroMQ: Connection failed:', {
            error: error.message,
          });
        }

        // Gracefully degrade to single-agent mode
        systemLog(
          'tui',
          '⚠️  Multi-agent mode unavailable. Running in single-agent mode.',
          undefined,
          'warn'
        );
      }
    }

    connect();

    // Cleanup on unmount
    return () => {
      mounted = false;

      if (cleanupRef.current) {
        cleanupRef.current().catch((err) => {
          systemLog('tui', 'ZeroMQ: Cleanup error:', err);
        });
      }
    };
  }, [
    config.enabled,
    config.agentId,
    config.model,
    config.debug,
    multiAgentAvailable,
  ]);

  return {
    bus,
    registry,
    connected,
    isBusMaster,
    error,
    multiAgentAvailable,
  };
}

/**
 * Get default capabilities for each model
 */
function getCapabilitiesForModel(model: string) {
  switch (model) {
    case 'gemini':
      return [
        {
          name: 'architecture_design',
          description: 'High-level system architecture and design',
          model,
        },
        {
          name: 'concept_exploration',
          description: 'Explore concepts and propose approaches',
          model,
        },
      ];

    case 'claude':
      return [
        {
          name: 'code_implementation',
          description: 'Write production-quality code',
          model,
        },
        {
          name: 'system_design',
          description: 'Detailed system design and implementation planning',
          model,
        },
      ];

    case 'opus':
      return [
        {
          name: 'code_review',
          description: 'In-depth code review and quality assurance',
          model,
        },
        {
          name: 'architecture_review',
          description: 'Review architectural decisions and trade-offs',
          model,
        },
      ];

    default:
      return [
        {
          name: 'general_purpose',
          description: 'General-purpose AI assistant',
          model,
        },
      ];
  }
}
