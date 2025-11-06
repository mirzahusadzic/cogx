/**
 * Integration tests for session-state.ts
 * Tests real-world scenarios with file system interactions
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

describe('Session State Integration Tests', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-integration-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Real-world scenario: Multi-turn conversation with compressions', () => {
    it('should handle complete session lifecycle', () => {
      // Step 1: User starts TUI with --session-id tui-1234567890
      const anchorId = 'tui-1234567890';
      const initialSdkSession = '14181166-c7fe-4ece-98ca-ee1c98d1646d';

      // Create initial state
      let state = createSessionState(anchorId, initialSdkSession);
      saveSessionState(state, tempDir);

      // Verify file exists at correct location
      const stateFilePath = path.join(
        tempDir,
        '.sigma',
        `${anchorId}.state.json`
      );
      expect(fs.existsSync(stateFilePath)).toBe(true);

      // Step 2: User has 15 turns, triggers compression
      const compressedSdkSession = 'eacf8777-e9ef-4b80-85b5-d2b9628da800';

      // Load state by anchor_id (not SDK session!)
      state = loadSessionState(anchorId, tempDir)!;
      expect(state).not.toBeNull();

      // Update with compression
      state = updateSessionState(
        state,
        compressedSdkSession,
        'compression',
        150000
      );
      saveSessionState(state, tempDir);

      // Verify state persisted correctly
      const reloaded = loadSessionState(anchorId, tempDir)!;
      expect(reloaded.anchor_id).toBe(anchorId);
      expect(reloaded.current_session).toBe(compressedSdkSession);
      expect(reloaded.compression_history).toHaveLength(2);

      // Step 3: User exits and resumes with --session-id tui-1234567890
      // The CLI should resolve anchor_id → current SDK session
      const resumedState = loadSessionState(anchorId, tempDir)!;
      expect(resumedState.current_session).toBe(compressedSdkSession);

      // Step 4: Another compression happens
      const secondCompression = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
      state = updateSessionState(
        resumedState,
        secondCompression,
        'compression',
        98000
      );
      saveSessionState(state, tempDir);

      // Verify history tracks all sessions
      const finalState = loadSessionState(anchorId, tempDir)!;
      expect(finalState.compression_history).toHaveLength(3);
      expect(finalState.compression_history.map((h) => h.sdk_session)).toEqual([
        initialSdkSession,
        compressedSdkSession,
        secondCompression,
      ]);
    });

    it('should fail to load state using SDK session UUID', () => {
      // Setup: Create session with anchor_id
      const anchorId = 'tui-test-failure';
      const sdkSession = 'uuid-should-not-work';

      const state = createSessionState(anchorId, sdkSession);
      saveSessionState(state, tempDir);

      // Attempt 1: Load with anchor_id (should succeed)
      const loadedByAnchor = loadSessionState(anchorId, tempDir);
      expect(loadedByAnchor).not.toBeNull();

      // Attempt 2: Load with SDK session UUID (should fail)
      const loadedBySdk = loadSessionState(sdkSession, tempDir);
      expect(loadedBySdk).toBeNull(); // ✅ This is the critical test
    });

    it('should handle expiration and compression in same session', () => {
      const anchorId = 'tui-mixed-events';

      // Initial session
      let state = createSessionState(anchorId, 'sdk-initial');
      saveSessionState(state, tempDir);

      // Session expires (e.g., idle timeout)
      state = updateSessionState(state, 'sdk-after-expiry', 'expiration');
      saveSessionState(state, tempDir);

      // User continues, triggers compression
      state = updateSessionState(
        state,
        'sdk-after-compression',
        'compression',
        120000
      );
      saveSessionState(state, tempDir);

      // Verify history
      const loaded = loadSessionState(anchorId, tempDir)!;
      expect(loaded.compression_history).toHaveLength(3);
      expect(loaded.compression_history[1].reason).toBe('expiration');
      expect(loaded.compression_history[2].reason).toBe('compression');
    });
  });

  describe('File system verification', () => {
    it('should never create files named after SDK session UUIDs', () => {
      const anchorId = 'tui-file-test';
      const sdkSession = 'sdk-uuid-12345';

      const state = createSessionState(anchorId, sdkSession);
      saveSessionState(state, tempDir);

      const sigmaDir = path.join(tempDir, '.sigma');
      const files = fs.readdirSync(sigmaDir);

      // Should have exactly one state file
      const stateFiles = files.filter((f) => f.endsWith('.state.json'));
      expect(stateFiles).toHaveLength(1);

      // File should be named after anchor_id
      expect(stateFiles[0]).toBe(`${anchorId}.state.json`);

      // Should NOT have file named after SDK session
      expect(stateFiles[0]).not.toBe(`${sdkSession}.state.json`);
    });

    it('should maintain single state file across multiple compressions', () => {
      const anchorId = 'tui-single-file';
      let state = createSessionState(anchorId, 'sdk-1');
      saveSessionState(state, tempDir);

      // Multiple compressions
      for (let i = 2; i <= 5; i++) {
        state = updateSessionState(state, `sdk-${i}`, 'compression', 100000);
        saveSessionState(state, tempDir);
      }

      // Verify still only one file
      const sigmaDir = path.join(tempDir, '.sigma');
      const stateFiles = fs
        .readdirSync(sigmaDir)
        .filter((f) => f.endsWith('.state.json'));

      expect(stateFiles).toHaveLength(1);
      expect(stateFiles[0]).toBe(`${anchorId}.state.json`);

      // Verify history
      const finalState = loadSessionState(anchorId, tempDir)!;
      expect(finalState.compression_history).toHaveLength(5);
    });

    it('should verify JSON structure matches expected format', () => {
      const anchorId = 'tui-json-test';
      const sdkSession = 'sdk-session-123';

      const state = createSessionState(anchorId, sdkSession);
      saveSessionState(state, tempDir);

      // Read raw file
      const filePath = path.join(tempDir, '.sigma', `${anchorId}.state.json`);
      const rawContent = fs.readFileSync(filePath, 'utf-8');
      const parsedJson = JSON.parse(rawContent);

      // Verify structure
      expect(parsedJson).toHaveProperty('anchor_id');
      expect(parsedJson).toHaveProperty('current_session');
      expect(parsedJson).toHaveProperty('created_at');
      expect(parsedJson).toHaveProperty('last_updated');
      expect(parsedJson).toHaveProperty('compression_history');

      // Verify values
      expect(parsedJson.anchor_id).toBe(anchorId);
      expect(parsedJson.current_session).toBe(sdkSession);
      expect(Array.isArray(parsedJson.compression_history)).toBe(true);
    });

    it('should handle concurrent access (multiple reads)', () => {
      const anchorId = 'tui-concurrent';
      const state = createSessionState(anchorId, 'sdk-1');
      saveSessionState(state, tempDir);

      // Simulate multiple concurrent reads
      const read1 = loadSessionState(anchorId, tempDir);
      const read2 = loadSessionState(anchorId, tempDir);
      const read3 = loadSessionState(anchorId, tempDir);

      expect(read1).not.toBeNull();
      expect(read2).not.toBeNull();
      expect(read3).not.toBeNull();

      // All should have same data
      expect(read1?.anchor_id).toBe(anchorId);
      expect(read2?.anchor_id).toBe(anchorId);
      expect(read3?.anchor_id).toBe(anchorId);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle very long compression chains', () => {
      const anchorId = 'tui-long-chain';
      let state = createSessionState(anchorId, 'sdk-0');
      saveSessionState(state, tempDir);

      // Simulate 20 compressions
      for (let i = 1; i <= 20; i++) {
        state = loadSessionState(anchorId, tempDir)!;
        state = updateSessionState(state, `sdk-${i}`, 'compression', 100000);
        saveSessionState(state, tempDir);
      }

      // Verify all compressions tracked
      const finalState = loadSessionState(anchorId, tempDir)!;
      expect(finalState.compression_history).toHaveLength(21); // initial + 20 compressions
      expect(finalState.current_session).toBe('sdk-20');
    });

    it('should handle timestamps correctly across saves', async () => {
      const anchorId = 'tui-timestamps';
      const state = createSessionState(anchorId, 'sdk-1');
      saveSessionState(state, tempDir);

      const firstLoad = loadSessionState(anchorId, tempDir)!;
      const firstTimestamp = firstLoad.last_updated;

      // Wait a bit to ensure timestamps differ
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = updateSessionState(firstLoad, 'sdk-2', 'compression');
      saveSessionState(updated, tempDir);

      const secondLoad = loadSessionState(anchorId, tempDir)!;
      const secondTimestamp = secondLoad.last_updated;

      // Timestamps should be different
      expect(secondTimestamp).not.toBe(firstTimestamp);

      // Second timestamp should be later
      expect(new Date(secondTimestamp).getTime()).toBeGreaterThan(
        new Date(firstTimestamp).getTime()
      );
    });

    it('should handle empty stats gracefully', () => {
      const anchorId = 'tui-no-stats';
      const state = createSessionState(anchorId, 'sdk-1');
      // Don't add stats
      saveSessionState(state, tempDir);

      const loaded = loadSessionState(anchorId, tempDir);
      expect(loaded?.stats).toBeUndefined();
    });
  });

  describe('Simulated TUI usage patterns', () => {
    it('should simulate: start fresh, work, compress, exit, resume', () => {
      // === Day 1: Start fresh ===
      const anchorId = 'tui-1730000000000';
      let state = createSessionState(anchorId, 'sdk-session-1');
      saveSessionState(state, tempDir);

      // Work for a while... (simulated)
      // Compression triggered!
      state = loadSessionState(anchorId, tempDir)!;
      state = updateSessionState(state, 'sdk-session-2', 'compression', 150000);
      saveSessionState(state, tempDir);

      // User exits TUI
      // ...

      // === Day 2: Resume with --session-id tui-1730000000000 ===
      const resumedState = loadSessionState(anchorId, tempDir)!;
      expect(resumedState).not.toBeNull();
      expect(resumedState.current_session).toBe('sdk-session-2');

      // Work continues...
      // Another compression
      const updatedState = updateSessionState(
        resumedState,
        'sdk-session-3',
        'compression',
        145000
      );
      saveSessionState(updatedState, tempDir);

      // === Day 3: Resume again ===
      const day3State = loadSessionState(anchorId, tempDir)!;
      expect(day3State.compression_history).toHaveLength(3);
      expect(day3State.current_session).toBe('sdk-session-3');
    });

    it('should simulate: multiple parallel sessions', () => {
      // User has multiple TUI sessions for different projects
      const sessions = [
        { anchor: 'tui-project-a', sdk: 'sdk-a-1' },
        { anchor: 'tui-project-b', sdk: 'sdk-b-1' },
        { anchor: 'tui-project-c', sdk: 'sdk-c-1' },
      ];

      // Create all sessions
      sessions.forEach(({ anchor, sdk }) => {
        const state = createSessionState(anchor, sdk);
        saveSessionState(state, tempDir);
      });

      // Verify each can be loaded independently
      sessions.forEach(({ anchor, sdk }) => {
        const loaded = loadSessionState(anchor, tempDir);
        expect(loaded?.anchor_id).toBe(anchor);
        expect(loaded?.current_session).toBe(sdk);
      });

      // Verify no cross-contamination
      const stateA = loadSessionState('tui-project-a', tempDir)!;
      const stateB = loadSessionState('tui-project-b', tempDir)!;
      expect(stateA.current_session).not.toBe(stateB.current_session);
    });
  });
});
