import { describe, it, expect } from 'vitest';
import { messagesReducer } from '../messagesReducer.js';
import { TUIMessage } from '../types.js';

describe('messagesReducer', () => {
  it('should insert FINALIZE_TOOL_RESULT after the corresponding tool call', () => {
    const initialState: TUIMessage[] = [
      { type: 'user', content: 'hello', timestamp: new Date() },
      {
        type: 'tool_progress',
        content: 'Starting tool A...',
        timestamp: new Date(),
        toolCallId: 'A',
      },
      {
        type: 'thinking',
        content: 'Model is thinking...',
        timestamp: new Date(),
      },
      {
        type: 'tool_progress',
        content: 'Starting tool B...',
        timestamp: new Date(),
        toolCallId: 'B',
      },
    ];

    const action = {
      type: 'FINALIZE_TOOL_RESULT' as const,
      formattedResult: 'Result of tool A',
      toolCallId: 'A',
    };

    const newState = messagesReducer(initialState, action);

    expect(newState.length).toBe(5);
    expect(newState[1].toolCallId).toBe('A');
    expect(newState[1].content).not.toContain('(streaming)');
    expect(newState[2].type).toBe('tool_progress');
    expect(newState[2].content).toBe('Result of tool A');
    expect(newState[3].type).toBe('thinking');
    expect(newState[4].toolCallId).toBe('B');
  });

  it('should fallback to append if toolCallId is not found', () => {
    const initialState: TUIMessage[] = [
      { type: 'user', content: 'hello', timestamp: new Date() },
    ];

    const action = {
      type: 'FINALIZE_TOOL_RESULT' as const,
      formattedResult: 'Orphan result',
      toolCallId: 'unknown',
    };

    const newState = messagesReducer(initialState, action);

    expect(newState.length).toBe(2);
    expect(newState[1].content).toBe('Orphan result');
  });

  it('should update in place for APPEND_TOOL_OUTPUT', () => {
    const initialState: TUIMessage[] = [
      {
        type: 'tool_progress',
        content: 'Starting tool A...',
        timestamp: new Date(),
        toolCallId: 'A',
      },
    ];

    const action = {
      type: 'APPEND_TOOL_OUTPUT' as const,
      chunk: ' some output',
      toolCallId: 'A',
    };

    const newState = messagesReducer(initialState, action);

    expect(newState.length).toBe(1);
    expect(newState[0].content).toContain('Starting tool A...');
    expect(newState[0].content).toContain('some output');
  });

  it('should maintain order for multiple interleaved tool results', () => {
    const initialState: TUIMessage[] = [
      {
        type: 'tool_progress',
        content: 'Call A',
        timestamp: new Date(),
        toolCallId: 'A',
      },
      {
        type: 'tool_progress',
        content: 'Call B',
        timestamp: new Date(),
        toolCallId: 'B',
      },
    ];

    // Finalize B first
    const state1 = messagesReducer(initialState, {
      type: 'FINALIZE_TOOL_RESULT',
      formattedResult: 'Result B',
      toolCallId: 'B',
    });

    // Finalize A second
    const state2 = messagesReducer(state1, {
      type: 'FINALIZE_TOOL_RESULT',
      formattedResult: 'Result A',
      toolCallId: 'A',
    });

    // Expected order: Call A, Result A, Call B, Result B
    expect(state2[0].toolCallId).toBe('A');
    expect(state2[1].content).toBe('Result A');
    expect(state2[2].toolCallId).toBe('B');
    expect(state2[3].content).toBe('Result B');
  });
});
