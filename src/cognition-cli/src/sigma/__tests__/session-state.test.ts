/**
 * Unit tests for session-state.ts
 * Ensures anchor_id is used consistently for file access
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  loadSessionState,
  saveSessionState,
  createSessionState,
  updateSessionState,
  updateSessionStats,
  listSessions,
  migrateOldStateFile,
} from '../session-state';

describe('session-state', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create unique temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-test-'));
  });

  afterEach(() => {
    // Cleanup temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('File Access by anchor_id', () => {
    it('should save state file using anchor_id', () => {
      const anchorId = 'tui-1234567890';
      const sdkSession = 'uuid-sdk-session-1';

      const state = createSessionState(anchorId, sdkSession);
      saveSessionState(state, tempDir);

      // Verify file exists at correct path
      const filePath = path.join(tempDir, '.sigma', `${anchorId}.state.json`);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should load state file using anchor_id', () => {
      const anchorId = 'tui-9876543210';
      const sdkSession = 'uuid-sdk-session-2';

      // Create and save state
      const state = createSessionState(anchorId, sdkSession);
      saveSessionState(state, tempDir);

      // Load it back
      const loaded = loadSessionState(anchorId, tempDir);

      expect(loaded).not.toBeNull();
      expect(loaded?.anchor_id).toBe(anchorId);
      expect(loaded?.current_session).toBe(sdkSession);
    });

    it('should return null when loading non-existent anchor_id', () => {
      const result = loadSessionState('non-existent-anchor', tempDir);
      expect(result).toBeNull();
    });

    it('should NOT load state using SDK session UUID', () => {
      const anchorId = 'tui-1111111111';
      const sdkSession = 'eacf8777-e9ef-4b80-85b5-d2b9628da800';

      // Save with anchor_id
      const state = createSessionState(anchorId, sdkSession);
      saveSessionState(state, tempDir);

      // Try to load with SDK session UUID (should fail)
      const result = loadSessionState(sdkSession, tempDir);
      expect(result).toBeNull(); // ✅ Should not find file
    });
  });

  describe('Session State Lifecycle', () => {
    it('should create initial session state correctly', () => {
      const anchorId = 'tui-test-anchor';
      const sdkSession = 'sdk-uuid-initial';

      const state = createSessionState(anchorId, sdkSession);

      expect(state.anchor_id).toBe(anchorId);
      expect(state.current_session).toBe(sdkSession);
      expect(state.compression_history).toHaveLength(1);
      expect(state.compression_history[0]).toMatchObject({
        sdk_session: sdkSession,
        reason: 'initial',
      });
    });

    it('should update state on compression', () => {
      const anchorId = 'tui-compress-test';
      const initialSdk = 'sdk-session-1';
      const newSdk = 'sdk-session-2';
      const tokens = 150000;

      const state = createSessionState(anchorId, initialSdk);
      const updated = updateSessionState(state, newSdk, 'compression', tokens);

      expect(updated.anchor_id).toBe(anchorId); // ✅ anchor_id never changes
      expect(updated.current_session).toBe(newSdk); // ✅ current_session updates
      expect(updated.compression_history).toHaveLength(2);
      expect(updated.compression_history[1]).toMatchObject({
        sdk_session: newSdk,
        reason: 'compression',
        tokens: tokens,
      });
    });

    it('should update state on expiration', () => {
      const anchorId = 'tui-expire-test';
      const initialSdk = 'sdk-session-old';
      const newSdk = 'sdk-session-new';

      const state = createSessionState(anchorId, initialSdk);
      const updated = updateSessionState(state, newSdk, 'expiration');

      expect(updated.anchor_id).toBe(anchorId);
      expect(updated.current_session).toBe(newSdk);
      expect(updated.compression_history[1].reason).toBe('expiration');
    });
  });

  describe('Multiple Compressions', () => {
    it('should maintain anchor_id across multiple compressions', () => {
      const anchorId = 'tui-multi-compress';
      let state = createSessionState(anchorId, 'session-1');

      // First compression
      state = updateSessionState(state, 'session-2', 'compression', 100000);
      expect(state.anchor_id).toBe(anchorId);
      expect(state.current_session).toBe('session-2');

      // Second compression
      state = updateSessionState(state, 'session-3', 'compression', 120000);
      expect(state.anchor_id).toBe(anchorId);
      expect(state.current_session).toBe('session-3');

      // Third compression
      state = updateSessionState(state, 'session-4', 'compression', 95000);
      expect(state.anchor_id).toBe(anchorId);
      expect(state.current_session).toBe('session-4');

      // Verify history
      expect(state.compression_history).toHaveLength(4);
      expect(state.compression_history.map((h) => h.sdk_session)).toEqual([
        'session-1',
        'session-2',
        'session-3',
        'session-4',
      ]);
    });

    it('should save/load state correctly across compressions', () => {
      const anchorId = 'tui-persist-test';

      // Initial state
      let state = createSessionState(anchorId, 'session-1');
      saveSessionState(state, tempDir);

      // Compression 1
      state = updateSessionState(state, 'session-2', 'compression', 100000);
      saveSessionState(state, tempDir);

      // Load and verify
      let loaded = loadSessionState(anchorId, tempDir);
      expect(loaded?.current_session).toBe('session-2');

      // Compression 2
      state = updateSessionState(state, 'session-3', 'compression', 110000);
      saveSessionState(state, tempDir);

      // Load and verify
      loaded = loadSessionState(anchorId, tempDir);
      expect(loaded?.current_session).toBe('session-3');
      expect(loaded?.compression_history).toHaveLength(3);
    });
  });

  describe('Statistics Updates', () => {
    it('should update stats without changing anchor_id', () => {
      const anchorId = 'tui-stats-test';
      const state = createSessionState(anchorId, 'session-1');

      const updated = updateSessionStats(state, {
        total_turns_analyzed: 42,
        paradigm_shifts: 3,
        routine_turns: 39,
        avg_novelty: '0.45',
        avg_importance: '6.2',
      });

      expect(updated.anchor_id).toBe(anchorId); // ✅ Never changes
      expect(updated.stats?.total_turns_analyzed).toBe(42);
      expect(updated.stats?.paradigm_shifts).toBe(3);
    });

    it('should preserve other state fields when updating stats', () => {
      const anchorId = 'tui-preserve-test';
      const sdkSession = 'sdk-session-1';

      let state = createSessionState(anchorId, sdkSession);

      // Add compression history
      state = updateSessionState(state, 'sdk-session-2', 'compression', 100000);

      // Update stats
      const updated = updateSessionStats(state, {
        total_turns_analyzed: 10,
        paradigm_shifts: 1,
        routine_turns: 9,
        avg_novelty: '0.3',
        avg_importance: '5.0',
      });

      // Verify all fields preserved
      expect(updated.anchor_id).toBe(anchorId);
      expect(updated.current_session).toBe('sdk-session-2');
      expect(updated.compression_history).toHaveLength(2);
      expect(updated.stats).toBeDefined();
    });
  });

  describe('Session Listing', () => {
    it('should list all sessions by anchor_id', () => {
      // Create multiple sessions
      const sessions = [
        createSessionState('tui-111', 'sdk-1'),
        createSessionState('tui-222', 'sdk-2'),
        createSessionState('tui-333', 'sdk-3'),
      ];

      sessions.forEach((s) => saveSessionState(s, tempDir));

      const list = listSessions(tempDir);

      expect(list).toHaveLength(3);
      expect(list.map((s) => s.anchor_id)).toContain('tui-111');
      expect(list.map((s) => s.anchor_id)).toContain('tui-222');
      expect(list.map((s) => s.anchor_id)).toContain('tui-333');
    });

    it('should return empty array when no sessions exist', () => {
      const list = listSessions(tempDir);
      expect(list).toEqual([]);
    });

    it('should sort sessions by last_updated descending', () => {
      // Create sessions with different timestamps
      const state1 = createSessionState('tui-old', 'sdk-1');
      saveSessionState(state1, tempDir);

      // Wait a bit
      const state2 = createSessionState('tui-new', 'sdk-2');
      saveSessionState(state2, tempDir);

      const list = listSessions(tempDir);

      expect(list).toHaveLength(2);
      // Most recent should be first
      expect(list[0].anchor_id).toBe('tui-new');
      expect(list[1].anchor_id).toBe('tui-old');
    });
  });

  describe('Old Format Migration', () => {
    it('should migrate old chained format to new anchor-based format', () => {
      // Create old format file
      const anchorId = 'tui-old-format';
      const oldState = {
        timestamp: '2025-01-01T00:00:00.000Z',
        newSessionId: 'chained-session-2',
      };

      const sigmaDir = path.join(tempDir, '.sigma');
      fs.mkdirSync(sigmaDir, { recursive: true });
      fs.writeFileSync(
        path.join(sigmaDir, `${anchorId}.state.json`),
        JSON.stringify(oldState)
      );

      // Migrate
      const migrated = migrateOldStateFile(anchorId, tempDir);

      expect(migrated).not.toBeNull();
      expect(migrated?.anchor_id).toBe(anchorId);
      expect(migrated?.compression_history).toBeDefined();
      expect(migrated?.compression_history.length).toBeGreaterThan(0);
    });

    it('should return existing state if already in new format', () => {
      const anchorId = 'tui-already-new';
      const state = createSessionState(anchorId, 'sdk-1');
      saveSessionState(state, tempDir);

      // Try to migrate (should just return the existing state)
      const migrated = migrateOldStateFile(anchorId, tempDir);

      expect(migrated).not.toBeNull();
      expect(migrated?.anchor_id).toBe(anchorId);
      expect(migrated?.compression_history).toHaveLength(1);
    });

    it('should return null if state file does not exist', () => {
      const result = migrateOldStateFile('non-existent', tempDir);
      expect(result).toBeNull();
    });
  });

  describe('File System Consistency', () => {
    it('should create .sigma directory if it does not exist', () => {
      const anchorId = 'tui-create-dir';
      const state = createSessionState(anchorId, 'sdk-1');

      // .sigma directory should not exist yet
      const sigmaDir = path.join(tempDir, '.sigma');
      expect(fs.existsSync(sigmaDir)).toBe(false);

      // Save state
      saveSessionState(state, tempDir);

      // .sigma directory should now exist
      expect(fs.existsSync(sigmaDir)).toBe(true);
    });

    it('should handle malformed JSON gracefully when listing', () => {
      const sigmaDir = path.join(tempDir, '.sigma');
      fs.mkdirSync(sigmaDir, { recursive: true });

      // Create valid session
      const state = createSessionState('tui-valid', 'sdk-1');
      saveSessionState(state, tempDir);

      // Create malformed JSON file
      fs.writeFileSync(
        path.join(sigmaDir, 'tui-malformed.state.json'),
        'invalid json{'
      );

      // Should still list the valid session
      const list = listSessions(tempDir);
      expect(list).toHaveLength(1);
      expect(list[0].anchor_id).toBe('tui-valid');
    });
  });
});
