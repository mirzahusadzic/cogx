/**
 * Compression Flow Integration Tests
 *
 * Tests the complete compression flow including:
 * - Multiple compressions in a row
 * - Compression flag reset behavior
 * - Session state persistence across compressions
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  loadSessionState,
  saveSessionState,
  createSessionState,
  updateSessionState,
} from '../session-state';

describe('Compression Flow Integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compression-flow-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Multiple Compressions in a Row', () => {
    it('should handle 5 consecutive compressions correctly', () => {
      const anchorId = 'tui-sequential-compress';

      // Simulate initial session
      let state = createSessionState(anchorId, 'sdk-session-1');
      saveSessionState(state, tempDir);

      // Verify initial state
      let loaded = loadSessionState(anchorId, tempDir)!;
      expect(loaded.anchor_id).toBe(anchorId);
      expect(loaded.current_session).toBe('sdk-session-1');
      expect(loaded.compression_history).toHaveLength(1);

      // Simulate 5 compressions in a row
      const compressions = [
        { session: 'sdk-session-2', tokens: 150000 },
        { session: 'sdk-session-3', tokens: 145000 },
        { session: 'sdk-session-4', tokens: 138000 },
        { session: 'sdk-session-5', tokens: 142000 },
        { session: 'sdk-session-6', tokens: 149000 },
      ];

      for (let i = 0; i < compressions.length; i++) {
        const { session, tokens } = compressions[i];

        // Load current state (simulating what useClaudeAgent does)
        state = loadSessionState(anchorId, tempDir)!;
        expect(state).not.toBeNull();

        // Update with new compressed session
        state = updateSessionState(state, session, 'compression', tokens);
        saveSessionState(state, tempDir);

        // Verify state was updated
        loaded = loadSessionState(anchorId, tempDir)!;
        expect(loaded.anchor_id).toBe(anchorId);
        expect(loaded.current_session).toBe(session);
        expect(loaded.compression_history).toHaveLength(i + 2); // initial + compressions
        expect(loaded.compression_history[i + 1]).toMatchObject({
          sdk_session: session,
          reason: 'compression',
          tokens: tokens,
        });
      }

      // Final verification
      const finalState = loadSessionState(anchorId, tempDir)!;
      expect(finalState.compression_history).toHaveLength(6); // initial + 5 compressions
      expect(finalState.current_session).toBe('sdk-session-6');
      expect(finalState.anchor_id).toBe(anchorId); // Never changes!
    });

    it('should maintain correct compression history order', () => {
      const anchorId = 'tui-history-order';
      let state = createSessionState(anchorId, 'initial');
      saveSessionState(state, tempDir);

      // Three quick compressions
      state = loadSessionState(anchorId, tempDir)!;
      state = updateSessionState(state, 'compress-1', 'compression', 100000);
      saveSessionState(state, tempDir);

      state = loadSessionState(anchorId, tempDir)!;
      state = updateSessionState(state, 'compress-2', 'compression', 105000);
      saveSessionState(state, tempDir);

      state = loadSessionState(anchorId, tempDir)!;
      state = updateSessionState(state, 'compress-3', 'compression', 98000);
      saveSessionState(state, tempDir);

      // Verify order
      const loaded = loadSessionState(anchorId, tempDir)!;
      expect(loaded.compression_history.map((h) => h.sdk_session)).toEqual([
        'initial',
        'compress-1',
        'compress-2',
        'compress-3',
      ]);

      // Verify reasons
      expect(loaded.compression_history[0].reason).toBe('initial');
      expect(loaded.compression_history[1].reason).toBe('compression');
      expect(loaded.compression_history[2].reason).toBe('compression');
      expect(loaded.compression_history[3].reason).toBe('compression');
    });

    it('should handle mixed compression and expiration events', () => {
      const anchorId = 'tui-mixed-events';
      let state = createSessionState(anchorId, 'session-0');
      saveSessionState(state, tempDir);

      // Compression 1
      state = loadSessionState(anchorId, tempDir)!;
      state = updateSessionState(state, 'session-1', 'compression', 150000);
      saveSessionState(state, tempDir);

      // Expiration (session timeout)
      state = loadSessionState(anchorId, tempDir)!;
      state = updateSessionState(state, 'session-2', 'expiration');
      saveSessionState(state, tempDir);

      // Compression 2
      state = loadSessionState(anchorId, tempDir)!;
      state = updateSessionState(state, 'session-3', 'compression', 145000);
      saveSessionState(state, tempDir);

      // Expiration again
      state = loadSessionState(anchorId, tempDir)!;
      state = updateSessionState(state, 'session-4', 'expiration');
      saveSessionState(state, tempDir);

      // Compression 3
      state = loadSessionState(anchorId, tempDir)!;
      state = updateSessionState(state, 'session-5', 'compression', 140000);
      saveSessionState(state, tempDir);

      // Verify history
      const loaded = loadSessionState(anchorId, tempDir)!;
      expect(loaded.compression_history).toHaveLength(6);
      expect(loaded.compression_history.map((h) => h.reason)).toEqual([
        'initial',
        'compression',
        'expiration',
        'compression',
        'expiration',
        'compression',
      ]);

      // Verify only compressions have token counts
      expect(loaded.compression_history[1].tokens).toBe(150000);
      expect(loaded.compression_history[2].tokens).toBeUndefined();
      expect(loaded.compression_history[3].tokens).toBe(145000);
      expect(loaded.compression_history[4].tokens).toBeUndefined();
      expect(loaded.compression_history[5].tokens).toBe(140000);
    });
  });

  describe('Compression Flag Reset Simulation', () => {
    it('should simulate the compression flag reset pattern from useClaudeAgent', () => {
      const anchorId = 'tui-flag-reset-sim';

      // Simulate compression flow with flag tracking
      let compressionTriggered = false;
      let currentSession = 'initial-session';

      // Initial setup
      const state = createSessionState(anchorId, currentSession);
      saveSessionState(state, tempDir);

      // Simulate 3 compression cycles
      for (let i = 1; i <= 3; i++) {
        // Simulate: compression threshold reached
        compressionTriggered = true;

        // Simulate: new SDK session created after compression
        const newSession = `compressed-session-${i}`;
        currentSession = newSession;

        // Simulate: update state when SDK reports new session ID
        const loadedState = loadSessionState(anchorId, tempDir)!;
        const reason = compressionTriggered ? 'compression' : 'expiration';
        const updatedState = updateSessionState(
          loadedState,
          newSession,
          reason,
          compressionTriggered ? 120000 + i * 1000 : undefined
        );
        saveSessionState(updatedState, tempDir);

        // Simulate: reset flag after state update (this is critical!)
        if (compressionTriggered) {
          compressionTriggered = false;
        }

        // Verify flag was reset
        expect(compressionTriggered).toBe(false);

        // Verify state was updated correctly
        const verifyState = loadSessionState(anchorId, tempDir)!;
        expect(verifyState.current_session).toBe(newSession);
        expect(verifyState.compression_history).toHaveLength(i + 1);
      }

      // Final verification
      const finalState = loadSessionState(anchorId, tempDir)!;
      expect(finalState.compression_history).toHaveLength(4); // initial + 3 compressions
      expect(compressionTriggered).toBe(false); // Flag should be reset
    });
  });

  describe('Real-world Compression Scenarios', () => {
    it('should handle long-running session with many compressions', () => {
      const anchorId = 'tui-long-session';
      let state = createSessionState(anchorId, 'session-0');
      saveSessionState(state, tempDir);

      // Simulate 10 compressions (like a very long conversation)
      for (let i = 1; i <= 10; i++) {
        state = loadSessionState(anchorId, tempDir)!;
        state = updateSessionState(
          state,
          `session-${i}`,
          'compression',
          120000 + Math.floor(Math.random() * 30000) // Varying token counts
        );
        saveSessionState(state, tempDir);
      }

      const finalState = loadSessionState(anchorId, tempDir)!;
      expect(finalState.compression_history).toHaveLength(11); // initial + 10
      expect(finalState.current_session).toBe('session-10');
      expect(finalState.anchor_id).toBe(anchorId);

      // Verify all compressions have token counts
      for (let i = 1; i <= 10; i++) {
        expect(finalState.compression_history[i].reason).toBe('compression');
        expect(finalState.compression_history[i].tokens).toBeGreaterThan(0);
      }
    });

    it('should handle rapid compressions without data loss', () => {
      const anchorId = 'tui-rapid-compress';
      let state = createSessionState(anchorId, 'initial');
      saveSessionState(state, tempDir);

      // Simulate rapid compressions (< 1 second between each)
      const compressionCount = 5;
      for (let i = 1; i <= compressionCount; i++) {
        // Load, update, save immediately
        state = loadSessionState(anchorId, tempDir)!;
        expect(state).not.toBeNull();

        state = updateSessionState(state, `rapid-${i}`, 'compression', 120000);
        saveSessionState(state, tempDir);

        // Immediately verify
        const verified = loadSessionState(anchorId, tempDir)!;
        expect(verified.current_session).toBe(`rapid-${i}`);
        expect(verified.compression_history).toHaveLength(i + 1);
      }

      // Final check: no data loss
      const final = loadSessionState(anchorId, tempDir)!;
      expect(final.compression_history).toHaveLength(compressionCount + 1);
      expect(final.compression_history.map((h) => h.sdk_session)).toEqual([
        'initial',
        'rapid-1',
        'rapid-2',
        'rapid-3',
        'rapid-4',
        'rapid-5',
      ]);
    });

    it('should maintain file consistency across compressions', () => {
      const anchorId = 'tui-file-consistency';
      let state = createSessionState(anchorId, 'session-0');
      saveSessionState(state, tempDir);

      const stateFilePath = path.join(
        tempDir,
        '.sigma',
        `${anchorId}.state.json`
      );

      // Verify only one file exists initially
      const sigmaDir = path.join(tempDir, '.sigma');
      let files = fs
        .readdirSync(sigmaDir)
        .filter((f) => f.endsWith('.state.json'));
      expect(files).toHaveLength(1);
      expect(files[0]).toBe(`${anchorId}.state.json`);

      // Perform 5 compressions
      for (let i = 1; i <= 5; i++) {
        state = loadSessionState(anchorId, tempDir)!;
        state = updateSessionState(
          state,
          `compress-${i}`,
          'compression',
          120000
        );
        saveSessionState(state, tempDir);

        // Verify still only one file
        files = fs
          .readdirSync(sigmaDir)
          .filter((f) => f.endsWith('.state.json'));
        expect(files).toHaveLength(1);
        expect(files[0]).toBe(`${anchorId}.state.json`);

        // Verify file is valid JSON
        const content = fs.readFileSync(stateFilePath, 'utf-8');
        const parsed = JSON.parse(content);
        expect(parsed.anchor_id).toBe(anchorId);
        expect(parsed.current_session).toBe(`compress-${i}`);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle compression with zero tokens', () => {
      const anchorId = 'tui-zero-tokens';
      let state = createSessionState(anchorId, 'initial');
      state = updateSessionState(state, 'compressed', 'compression', 0);
      saveSessionState(state, tempDir);

      const loaded = loadSessionState(anchorId, tempDir)!;
      expect(loaded.compression_history[1].tokens).toBe(0);
    });

    it('should handle compression without token count', () => {
      const anchorId = 'tui-no-tokens';
      let state = createSessionState(anchorId, 'initial');
      state = updateSessionState(state, 'compressed', 'compression'); // No tokens
      saveSessionState(state, tempDir);

      const loaded = loadSessionState(anchorId, tempDir)!;
      expect(loaded.compression_history[1].tokens).toBeUndefined();
    });

    it('should handle very large token counts', () => {
      const anchorId = 'tui-large-tokens';
      let state = createSessionState(anchorId, 'initial');
      const largeTokenCount = 999999999;
      state = updateSessionState(
        state,
        'compressed',
        'compression',
        largeTokenCount
      );
      saveSessionState(state, tempDir);

      const loaded = loadSessionState(anchorId, tempDir)!;
      expect(loaded.compression_history[1].tokens).toBe(largeTokenCount);
    });
  });
});
