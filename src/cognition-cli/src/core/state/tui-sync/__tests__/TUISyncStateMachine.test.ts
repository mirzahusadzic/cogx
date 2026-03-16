import { describe, it, expect, vi } from 'vitest';
import { TUISyncStateMachine } from '../TUISyncStateMachine.js';
import { TUISyncStatus } from '../types.js';

describe('TUISyncStateMachine', () => {
  it('should initialize to IDLE', () => {
    const sm = new TUISyncStateMachine();
    expect(sm.getStatus()).toBe(TUISyncStatus.IDLE);
    const state = sm.getState();
    expect(state.status).toBe(TUISyncStatus.IDLE);
    expect(state.onboarding.step).toBe('idle');
    expect(state.overlayScores.O1_structural).toBe(0);
  });

  it('should transition to ONBOARDING on WIZARD_START', () => {
    const sm = new TUISyncStateMachine();
    sm.handleEvent({ type: 'WIZARD_START', sourceDirs: ['src'] });
    expect(sm.getStatus()).toBe(TUISyncStatus.ONBOARDING);
    expect(sm.getState().onboarding.step).toBe('detect');
    expect(sm.getState().onboarding.sourceDirs).toEqual(['src']);
  });

  it('should update step on WIZARD_STEP_CHANGE', () => {
    const sm = new TUISyncStateMachine();
    sm.handleEvent({ type: 'WIZARD_START' });
    sm.handleEvent({ type: 'WIZARD_STEP_CHANGE', step: 'genesis' });
    expect(sm.getState().onboarding.step).toBe('genesis');
  });

  it('should show confirmation on WIZARD_CONFIRM_SHOW', () => {
    const sm = new TUISyncStateMachine();
    const confirmation = {
      pending: true,
      mode: 'confirm' as const,
      title: 'Test',
      message: 'Msg',
      confirmLabel: 'Y',
      denyLabel: 'N',
    };
    sm.handleEvent({ type: 'WIZARD_CONFIRM_SHOW', confirmation });
    expect(sm.getState().onboarding.confirmation).toEqual(confirmation);
  });

  it('should handle wizard action on WIZARD_CONFIRM_ACTION', () => {
    const sm = new TUISyncStateMachine();
    sm.handleEvent({
      type: 'WIZARD_CONFIRM_SHOW',
      confirmation: {
        pending: true,
        mode: 'confirm',
        title: 'T',
        message: 'M',
        confirmLabel: 'Y',
        denyLabel: 'N',
      },
    });
    sm.handleEvent({ type: 'WIZARD_CONFIRM_ACTION', action: 'confirm' });
    expect(sm.getState().onboarding.confirmation?.pending).toBe(false);
  });

  it('should transition to ACTIVE on WIZARD_COMPLETE', () => {
    const sm = new TUISyncStateMachine();
    sm.handleEvent({ type: 'WIZARD_START' });
    sm.handleEvent({ type: 'WIZARD_COMPLETE' });
    expect(sm.getStatus()).toBe(TUISyncStatus.ACTIVE);
    expect(sm.getState().onboarding.step).toBe('complete');
  });

  it('should update overlay scores on OVERLAY_SCORES_UPDATE', () => {
    const sm = new TUISyncStateMachine();
    const scores = {
      O1_structural: 0.8,
      O2_security: 0.5,
      O3_lineage: 0.7,
      O4_mission: 0.6,
      O5_operational: 0.4,
      O6_mathematical: 0.3,
      O7_strategic: 0.9,
    };
    sm.handleEvent({ type: 'OVERLAY_SCORES_UPDATE', scores });
    expect(sm.getState().overlayScores).toEqual(scores);
  });

  it('should handle messages on MESSAGE_ADD', () => {
    const sm = new TUISyncStateMachine();
    const message = {
      id: '1',
      type: 'user' as const,
      content: 'Hello',
      timestamp: new Date(),
    };
    sm.handleEvent({ type: 'MESSAGE_ADD', message });
    expect(sm.getState().messages).toEqual([message]);
  });

  it('should clear messages on MESSAGES_CLEAR', () => {
    const sm = new TUISyncStateMachine();
    sm.handleEvent({
      type: 'MESSAGE_ADD',
      message: {
        id: '1',
        type: 'system',
        content: 'Hi',
        timestamp: new Date(),
      },
    });
    sm.handleEvent({ type: 'MESSAGES_CLEAR' });
    expect(sm.getState().messages).toEqual([]);
  });

  it('should notify listeners on transition', () => {
    const sm = new TUISyncStateMachine();
    const listener = vi.fn();
    sm.subscribe(listener);

    // Initial notification on subscribe
    expect(listener).toHaveBeenCalledWith(
      TUISyncStatus.IDLE,
      sm.getState(),
      undefined
    );

    sm.handleEvent({ type: 'WIZARD_START' });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(
      TUISyncStatus.ONBOARDING,
      sm.getState(),
      undefined
    );
  });

  it('should handle selection navigation in select mode', () => {
    const sm = new TUISyncStateMachine();
    const items = [
      { id: '1', label: '1', selected: false },
      { id: '2', label: '2', selected: false },
    ];
    sm.handleEvent({
      type: 'WIZARD_CONFIRM_SHOW',
      confirmation: {
        pending: true,
        mode: 'select',
        title: 'T',
        message: 'M',
        confirmLabel: 'Y',
        denyLabel: 'N',
        items,
        selectedIndex: 0,
      },
    });

    sm.handleEvent({ type: 'WIZARD_SELECTION_MOVE', direction: 'down' });
    expect(sm.getState().onboarding.confirmation?.selectedIndex).toBe(1);

    sm.handleEvent({ type: 'WIZARD_SELECTION_MOVE', direction: 'down' });
    expect(sm.getState().onboarding.confirmation?.selectedIndex).toBe(0);

    sm.handleEvent({ type: 'WIZARD_SELECTION_MOVE', direction: 'up' });
    expect(sm.getState().onboarding.confirmation?.selectedIndex).toBe(1);
  });

  it('should toggle selection in select mode', () => {
    const sm = new TUISyncStateMachine();
    const items = [{ id: '1', label: '1', selected: false }];
    sm.handleEvent({
      type: 'WIZARD_CONFIRM_SHOW',
      confirmation: {
        pending: true,
        mode: 'select',
        title: 'T',
        message: 'M',
        confirmLabel: 'Y',
        denyLabel: 'N',
        items,
        selectedIndex: 0,
      },
    });

    sm.handleEvent({ type: 'WIZARD_SELECTION_TOGGLE' });
    expect(sm.getState().onboarding.confirmation?.items?.[0].selected).toBe(
      true
    );

    sm.handleEvent({ type: 'WIZARD_SELECTION_TOGGLE' });
    expect(sm.getState().onboarding.confirmation?.items?.[0].selected).toBe(
      false
    );
  });
});
