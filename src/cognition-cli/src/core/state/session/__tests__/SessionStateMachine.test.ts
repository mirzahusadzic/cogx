import { describe, it, expect, vi } from 'vitest';
import { SessionStateMachine } from '../SessionStateMachine.js';
import { SessionStatus, SessionState } from '../types.js';

describe('SessionStateMachine', () => {
  const mockState: SessionState = {
    anchor_id: 'test-session',
    current_session: 'sdk-123',
    created_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    compression_history: [],
  };

  it('should initialize to INITIALIZING by default', () => {
    const sm = new SessionStateMachine();
    expect(sm.getStatus()).toBe(SessionStatus.INITIALIZING);
    expect(sm.getState()).toBeNull();
  });

  it('should initialize with provided state', () => {
    const sm = new SessionStateMachine(mockState);
    expect(sm.getStatus()).toBe(SessionStatus.ACTIVE);
    expect(sm.getState()).toEqual(mockState);
  });

  it('should transition to ACTIVE on LOAD_SUCCESS', () => {
    const sm = new SessionStateMachine();
    sm.handleEvent({ type: 'LOAD_SUCCESS', state: mockState });
    expect(sm.getStatus()).toBe(SessionStatus.ACTIVE);
    expect(sm.getState()).toEqual(mockState);
  });

  it('should transition to TASK_PROCESSING on TASK_START', () => {
    const sm = new SessionStateMachine(mockState);
    sm.handleEvent({ type: 'TASK_START', taskId: 'task-1' });
    expect(sm.getStatus()).toBe(SessionStatus.TASK_PROCESSING);
  });

  it('should return to ACTIVE on TASK_COMPLETE', () => {
    const sm = new SessionStateMachine(mockState);
    sm.handleEvent({ type: 'TASK_START', taskId: 'task-1' });
    sm.handleEvent({
      type: 'TASK_COMPLETE',
      taskId: 'task-1',
      summary: 'done',
    });
    expect(sm.getStatus()).toBe(SessionStatus.ACTIVE);
  });

  it('should transition to PRUNING on PRUNE_START', () => {
    const sm = new SessionStateMachine(mockState);
    sm.handleEvent({ type: 'PRUNE_START' });
    expect(sm.getStatus()).toBe(SessionStatus.PRUNING);
  });

  it('should transition to ERROR on LOAD_FAILURE', () => {
    const sm = new SessionStateMachine();
    const error = new Error('load failed');
    sm.handleEvent({ type: 'LOAD_FAILURE', error });
    expect(sm.getStatus()).toBe(SessionStatus.ERROR);
    expect(sm.getLastError()).toBe(error);
  });

  it('should notify listeners on transition', () => {
    const sm = new SessionStateMachine();
    const listener = vi.fn();
    sm.subscribe(listener);

    // Initial call on subscribe
    expect(listener).toHaveBeenCalledWith(
      SessionStatus.INITIALIZING,
      null,
      undefined
    );

    sm.handleEvent({ type: 'LOAD_SUCCESS', state: mockState });
    expect(listener).toHaveBeenCalledWith(
      SessionStatus.ACTIVE,
      mockState,
      undefined
    );
  });

  it('should transition to TERMINATED on TERMINATE', () => {
    const sm = new SessionStateMachine(mockState);
    sm.handleEvent({ type: 'TERMINATE' });
    expect(sm.getStatus()).toBe(SessionStatus.TERMINATED);
  });
});
