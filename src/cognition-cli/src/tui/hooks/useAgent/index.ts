import { useAgentState } from './useAgentState.js';
import type { UseAgentOptions } from './types.js';

/**
 * useAgent hook - Refactored to use AgentContext for orchestration.
 *
 * This hook now only initializes the agent's core state.
 * All orchestration logic has been moved to AgentProvider in src/tui/contexts/AgentContext.tsx.
 */
export function useAgent(options: UseAgentOptions) {
  const state = useAgentState(options, options.sessionId || 'initial');

  return {
    options,
    state,
  };
}

export type { UseAgentOptions, TUIMessage, SigmaTask } from './types.js';
