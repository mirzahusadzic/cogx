/**
 * Tests for useSessionManager hook
 *
 * Week 1 Day 4-5: Extract Session Management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
  useSessionManager,
  UseSessionManagerOptions,
} from '../../../session/useSessionManager.js';

describe('useSessionManager', () => {
  let tempDir: string;
  let options: UseSessionManagerOptions;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'session-manager-test-')
    );
    options = {
      cwd: tempDir,
      debug: false,
    };
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('initialization', () => {
    it('generates anchor ID if not provided', () => {
      const { result } = renderHook(() => useSessionManager(options));

      expect(result.current.anchorId).toMatch(/^tui-\d+$/);
    });

    it('uses provided session ID as anchor', () => {
      const { result } = renderHook(() =>
        useSessionManager({ ...options, sessionId: 'my-session' })
      );

      expect(result.current.anchorId).toBe('my-session');
    });

    it('initializes with anchor ID as current session', () => {
      const { result } = renderHook(() =>
        useSessionManager({ ...options, sessionId: 'my-session' })
      );

      expect(result.current.currentSessionId).toBe('my-session');
    });

    it('initializes with no resume session', () => {
      const { result } = renderHook(() => useSessionManager(options));

      expect(result.current.resumeSessionId).toBeUndefined();
    });

    it('initializes with SDK session not received', () => {
      const { result } = renderHook(() => useSessionManager(options));

      expect(result.current.hasReceivedSDKSessionId).toBe(false);
    });
  });

  describe('updateCurrentSession()', () => {
    it('updates current session ID', () => {
      const { result } = renderHook(() =>
        useSessionManager({ ...options, sessionId: 'my-session' })
      );

      act(() => {
        result.current.updateCurrentSession('sdk-session-1');
      });

      expect(result.current.currentSessionId).toBe('sdk-session-1');
    });

    it('creates initial state file on first update', () => {
      const { result } = renderHook(() =>
        useSessionManager({ ...options, sessionId: 'my-session' })
      );

      act(() => {
        result.current.updateCurrentSession('sdk-session-1');
      });

      const statePath = path.join(tempDir, '.sigma', 'my-session.state.json');
      expect(fs.existsSync(statePath)).toBe(true);

      const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      expect(state.anchor_id).toBe('my-session');
      expect(state.current_session).toBe('sdk-session-1');
    });

    it('updates existing state file on subsequent updates', () => {
      const { result } = renderHook(() =>
        useSessionManager({ ...options, sessionId: 'my-session' })
      );

      act(() => {
        result.current.updateCurrentSession('sdk-session-1');
      });

      act(() => {
        result.current.updateCurrentSession('sdk-session-2');
      });

      const statePath = path.join(tempDir, '.sigma', 'my-session.state.json');
      const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));

      expect(state.current_session).toBe('sdk-session-2');
      expect(state.compression_history).toHaveLength(2);
    });

    it('does nothing if session ID unchanged', () => {
      const { result } = renderHook(() =>
        useSessionManager({ ...options, sessionId: 'my-session' })
      );

      act(() => {
        result.current.updateCurrentSession('sdk-session-1');
      });

      const statePath = path.join(tempDir, '.sigma', 'my-session.state.json');
      const state1 = fs.readFileSync(statePath, 'utf-8');

      act(() => {
        result.current.updateCurrentSession('sdk-session-1'); // Same ID
      });

      const state2 = fs.readFileSync(statePath, 'utf-8');
      expect(state1).toBe(state2); // File unchanged
    });
  });

  describe('updateResumeSession()', () => {
    it('updates resume session ID', () => {
      const { result } = renderHook(() => useSessionManager(options));

      act(() => {
        result.current.updateResumeSession('resume-123');
      });

      expect(result.current.resumeSessionId).toBe('resume-123');
    });

    it('clears resume session when set to undefined', () => {
      const { result } = renderHook(() => useSessionManager(options));

      act(() => {
        result.current.updateResumeSession('resume-123');
      });

      act(() => {
        result.current.updateResumeSession(undefined);
      });

      expect(result.current.resumeSessionId).toBeUndefined();
    });
  });

  describe('markSDKSessionReceived()', () => {
    it('marks SDK session as received', () => {
      const { result } = renderHook(() => useSessionManager(options));

      expect(result.current.hasReceivedSDKSessionId).toBe(false);

      act(() => {
        result.current.markSDKSessionReceived();
      });

      expect(result.current.hasReceivedSDKSessionId).toBe(true);
    });
  });

  describe('updateStats()', () => {
    it('updates session statistics', () => {
      const { result } = renderHook(() =>
        useSessionManager({ ...options, sessionId: 'my-session' })
      );

      // Create initial state first
      act(() => {
        result.current.updateCurrentSession('sdk-session-1');
      });

      // Update stats
      act(() => {
        result.current.updateStats({
          total_turns_analyzed: 10,
          paradigm_shifts: 2,
          routine_turns: 5,
          avg_novelty: '0.456',
          avg_importance: '6.2',
        });
      });

      const state = result.current.getState();
      expect(state?.stats).toMatchObject({
        total_turns_analyzed: 10,
        paradigm_shifts: 2,
        routine_turns: 5,
        avg_novelty: '0.456',
        avg_importance: '6.2',
      });
    });

    it('does nothing if no state exists', () => {
      const { result } = renderHook(() =>
        useSessionManager({ ...options, sessionId: 'my-session' })
      );

      // updateStats without creating state first
      act(() => {
        result.current.updateStats({
          total_turns_analyzed: 10,
          paradigm_shifts: 2,
          routine_turns: 5,
          avg_novelty: '0.456',
          avg_importance: '6.2',
        });
      });

      const state = result.current.getState();
      expect(state).toBeNull();
    });
  });

  describe('handleCompression()', () => {
    it('clears resume session on compression', () => {
      const { result } = renderHook(() => useSessionManager(options));

      act(() => {
        result.current.updateResumeSession('resume-123');
      });

      act(() => {
        result.current.handleCompression(120000);
      });

      expect(result.current.resumeSessionId).toBeUndefined();
    });
  });

  describe('getState()', () => {
    it('returns null if no state exists', () => {
      const { result } = renderHook(() =>
        useSessionManager({ ...options, sessionId: 'my-session' })
      );

      expect(result.current.getState()).toBeNull();
    });

    it('returns current state after update', () => {
      const { result } = renderHook(() =>
        useSessionManager({ ...options, sessionId: 'my-session' })
      );

      act(() => {
        result.current.updateCurrentSession('sdk-session-1');
      });

      const state = result.current.getState();
      expect(state).toMatchObject({
        anchor_id: 'my-session',
        current_session: 'sdk-session-1',
      });
    });
  });

  describe('integration scenarios', () => {
    it('handles complete session lifecycle', () => {
      const { result } = renderHook(() =>
        useSessionManager({ ...options, sessionId: 'test-session' })
      );

      // 1. Initial SDK session
      act(() => {
        result.current.updateCurrentSession('sdk-1');
        result.current.updateResumeSession('sdk-1');
        result.current.markSDKSessionReceived();
      });

      expect(result.current.currentSessionId).toBe('sdk-1');
      expect(result.current.resumeSessionId).toBe('sdk-1');
      expect(result.current.hasReceivedSDKSessionId).toBe(true);

      // 2. Compression triggers
      act(() => {
        result.current.handleCompression(120000);
      });

      expect(result.current.resumeSessionId).toBeUndefined();

      // 3. New SDK session after compression
      act(() => {
        result.current.updateCurrentSession('sdk-2');
        result.current.updateResumeSession('sdk-2');
      });

      expect(result.current.currentSessionId).toBe('sdk-2');
      expect(result.current.resumeSessionId).toBe('sdk-2');

      // 4. Verify state file
      const state = result.current.getState();
      expect(state?.compression_history).toHaveLength(2);
      // Second session should be marked as compression (flag was set by handleCompression)
      expect(state?.compression_history[1].reason).toBe('compression');
    });

    it('handles resume from existing session', () => {
      // Create initial state manually
      const sigmaDir = path.join(tempDir, '.sigma');
      fs.mkdirSync(sigmaDir, { recursive: true });
      const stateFile = path.join(sigmaDir, 'existing-session.state.json');
      fs.writeFileSync(
        stateFile,
        JSON.stringify({
          anchor_id: 'existing-session',
          current_session: 'sdk-old',
          created_at: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          compression_history: [
            {
              sdk_session: 'sdk-old',
              timestamp: new Date().toISOString(),
              reason: 'initial',
            },
          ],
        })
      );

      // Hook should load existing state
      const { result } = renderHook(() =>
        useSessionManager({ ...options, sessionId: 'existing-session' })
      );

      const state = result.current.getState();
      expect(state?.current_session).toBe('sdk-old');
      expect(state?.compression_history).toHaveLength(1);
    });
  });
});
