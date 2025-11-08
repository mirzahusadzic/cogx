/**
 * Tests for SessionStateStore
 *
 * Week 1 Day 4-5: Extract Session Management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { SessionStateStore } from '../../../session/SessionStateStore.js';

describe('SessionStateStore', () => {
  let tempDir: string;
  let store: SessionStateStore;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-store-test-'));
    store = new SessionStateStore(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.remove(tempDir);
  });

  describe('create()', () => {
    it('creates initial session state correctly', () => {
      const state = store.create('test-anchor', 'sdk-session-1');

      expect(state).toMatchObject({
        anchor_id: 'test-anchor',
        current_session: 'sdk-session-1',
      });
      expect(state.compression_history).toHaveLength(1);
      expect(state.compression_history[0]).toMatchObject({
        sdk_session: 'sdk-session-1',
        reason: 'initial',
      });
    });

    it('includes timestamps', () => {
      const state = store.create('test-anchor', 'sdk-session-1');

      expect(state.created_at).toBeDefined();
      expect(state.last_updated).toBeDefined();
      expect(state.compression_history[0].timestamp).toBeDefined();
    });
  });

  describe('save() and load()', () => {
    it('saves and loads state correctly', () => {
      const state = store.create('test-anchor', 'sdk-session-1');
      store.save(state);

      const loaded = store.load('test-anchor');
      expect(loaded).toEqual(state);
    });

    it('returns null for non-existent state', () => {
      const loaded = store.load('non-existent');
      expect(loaded).toBeNull();
    });

    it('creates .sigma directory if needed', () => {
      const state = store.create('test-anchor', 'sdk-session-1');
      store.save(state);

      const sigmaDir = path.join(tempDir, '.sigma');
      expect(fs.existsSync(sigmaDir)).toBe(true);
    });

    it('uses anchor ID for filename', () => {
      const state = store.create('my-anchor', 'sdk-session-1');
      store.save(state);

      const filePath = path.join(tempDir, '.sigma', 'my-anchor.state.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('updateSession()', () => {
    it('updates SDK session on compression', () => {
      const state = store.create('test-anchor', 'sdk-session-1');
      const updated = store.updateSession(
        state,
        'sdk-session-2',
        'compression',
        120000
      );

      expect(updated.current_session).toBe('sdk-session-2');
      expect(updated.compression_history).toHaveLength(2);
      expect(updated.compression_history[1]).toMatchObject({
        sdk_session: 'sdk-session-2',
        reason: 'compression',
        tokens: 120000,
      });
    });

    it('updates SDK session on expiration', () => {
      const state = store.create('test-anchor', 'sdk-session-1');
      const updated = store.updateSession(state, 'sdk-session-2', 'expiration');

      expect(updated.current_session).toBe('sdk-session-2');
      expect(updated.compression_history[1].reason).toBe('expiration');
      expect(updated.compression_history[1].tokens).toBeUndefined();
    });

    it('preserves compression history', () => {
      let state = store.create('test-anchor', 'sdk-session-1');
      state = store.updateSession(state, 'sdk-session-2', 'compression');
      state = store.updateSession(state, 'sdk-session-3', 'compression');

      expect(state.compression_history).toHaveLength(3);
      expect(state.compression_history.map((h) => h.sdk_session)).toEqual([
        'sdk-session-1',
        'sdk-session-2',
        'sdk-session-3',
      ]);
    });

    it('updates last_updated timestamp', async () => {
      const state = store.create('test-anchor', 'sdk-session-1');
      const originalTimestamp = state.last_updated;

      // Wait 2ms to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 2));

      const updated = store.updateSession(
        state,
        'sdk-session-2',
        'compression'
      );

      expect(updated.last_updated).not.toBe(originalTimestamp);
    });
  });

  describe('updateStats()', () => {
    it('updates session statistics', () => {
      const state = store.create('test-anchor', 'sdk-session-1');
      const updated = store.updateStats(state, {
        total_turns_analyzed: 10,
        paradigm_shifts: 2,
        routine_turns: 5,
        avg_novelty: '0.456',
        avg_importance: '6.2',
      });

      expect(updated.stats).toMatchObject({
        total_turns_analyzed: 10,
        paradigm_shifts: 2,
        routine_turns: 5,
        avg_novelty: '0.456',
        avg_importance: '6.2',
      });
    });

    it('overwrites previous stats', () => {
      let state = store.create('test-anchor', 'sdk-session-1');
      state = store.updateStats(state, {
        total_turns_analyzed: 5,
        paradigm_shifts: 1,
        routine_turns: 3,
        avg_novelty: '0.3',
        avg_importance: '5.0',
      });

      const updated = store.updateStats(state, {
        total_turns_analyzed: 10,
        paradigm_shifts: 2,
        routine_turns: 5,
        avg_novelty: '0.456',
        avg_importance: '6.2',
      });

      expect(updated.stats?.total_turns_analyzed).toBe(10);
    });
  });

  describe('getOrCreate()', () => {
    it('creates new state if none exists', () => {
      const state = store.getOrCreate('test-anchor', 'sdk-session-1');

      expect(state.anchor_id).toBe('test-anchor');
      expect(state.current_session).toBe('sdk-session-1');

      // Verify it was saved
      const loaded = store.load('test-anchor');
      expect(loaded).toEqual(state);
    });

    it('loads existing state if it exists', () => {
      // Create and save initial state
      const initial = store.create('test-anchor', 'sdk-session-1');
      store.save(initial);

      // getOrCreate should return existing state
      const loaded = store.getOrCreate('test-anchor', 'sdk-session-2');

      expect(loaded.current_session).toBe('sdk-session-1'); // Not sdk-session-2!
      expect(loaded).toEqual(initial);
    });
  });

  describe('error handling', () => {
    it('handles corrupt JSON gracefully', () => {
      const sigmaDir = path.join(tempDir, '.sigma');
      fs.mkdirSync(sigmaDir, { recursive: true });
      fs.writeFileSync(
        path.join(sigmaDir, 'test-anchor.state.json'),
        'invalid json{'
      );

      const loaded = store.load('test-anchor');
      expect(loaded).toBeNull();
    });

    it('handles missing .sigma directory', () => {
      const loaded = store.load('test-anchor');
      expect(loaded).toBeNull();
    });
  });
});
