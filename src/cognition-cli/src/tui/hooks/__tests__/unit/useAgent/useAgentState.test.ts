import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAgentState } from '../../../useAgent/useAgentState.js';
import type { UseAgentOptions } from '../../../useAgent/types.js';

describe('useAgentState', () => {
  const mockOptions = {} as UseAgentOptions;
  const currentSessionId = 'test-session';

  it('should initialize with default state', () => {
    const { result } = renderHook(() =>
      useAgentState(mockOptions, currentSessionId)
    );

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].type).toBe('system');
    expect(result.current.isThinking).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.currentSessionIdRef.current).toBe(currentSessionId);
  });

  it('should update currentSessionIdRef when currentSessionId changes', () => {
    const { result, rerender } = renderHook(
      ({ sessionId }) => useAgentState(mockOptions, sessionId),
      {
        initialProps: { sessionId: 'session-1' },
      }
    );

    expect(result.current.currentSessionIdRef.current).toBe('session-1');

    rerender({ sessionId: 'session-2' });

    expect(result.current.currentSessionIdRef.current).toBe('session-2');
  });
});
