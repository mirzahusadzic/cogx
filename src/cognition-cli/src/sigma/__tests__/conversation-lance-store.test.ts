/**
 * Tests for ConversationLanceStore
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { ConversationLanceStore } from '../conversation-lance-store.js';

describe('ConversationLanceStore', () => {
  let tempDir: string;
  let store: ConversationLanceStore;

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = path.join(os.tmpdir(), `conversation-lance-test-${Date.now()}`);
    await fs.ensureDir(tempDir);

    // Initialize store
    store = new ConversationLanceStore(tempDir);
    await store.initialize('conversation_turns');
  });

  afterEach(async () => {
    // Cleanup
    await store.close();
    await fs.remove(tempDir);
  });

  it('should store and retrieve a conversation turn', async () => {
    const sessionId = 'test-session-1';
    const turnId = 'turn_1';
    const embedding = new Array(768).fill(0.5);

    await store.storeTurn(
      sessionId,
      turnId,
      'user',
      'Hello, how do I implement authentication?',
      embedding,
      {
        novelty: 0.8,
        importance: 9,
        is_paradigm_shift: true,
        alignment_O1: 7.5,
        alignment_O2: 9.0,
        alignment_O3: 5.0,
        alignment_O4: 6.0,
        alignment_O5: 4.0,
        alignment_O6: 3.0,
        alignment_O7: 5.5,
        semantic_tags: ['authentication', 'implement', 'security'],
        references: [],
      }
    );

    const retrieved = await store.getTurn(turnId);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(turnId);
    expect(retrieved?.session_id).toBe(sessionId);
    expect(retrieved?.role).toBe('user');
    expect(retrieved?.content).toContain('authentication');
    expect(retrieved?.novelty).toBe(0.8);
    expect(retrieved?.importance).toBe(9);
    expect(retrieved?.is_paradigm_shift).toBe(true);
    expect(retrieved?.alignment_O2).toBe(9.0);
  });

  it('should perform semantic similarity search', async () => {
    const sessionId = 'test-session-2';

    // Store multiple turns
    const turns = [
      {
        turnId: 'turn_1',
        content: 'How do I implement JWT authentication?',
        embedding: new Array(768).fill(0.9),
      },
      {
        turnId: 'turn_2',
        content: 'Explain React hooks usage',
        embedding: new Array(768).fill(0.1),
      },
      {
        turnId: 'turn_3',
        content: 'OAuth2 flow for API security',
        embedding: new Array(768).fill(0.85),
      },
    ];

    for (const turn of turns) {
      await store.storeTurn(
        sessionId,
        turn.turnId,
        'user',
        turn.content,
        turn.embedding,
        {
          novelty: 0.5,
          importance: 7,
          alignment_O1: 5,
          alignment_O2: 8,
          alignment_O3: 5,
          alignment_O4: 5,
          alignment_O5: 5,
          alignment_O6: 5,
          alignment_O7: 5,
        }
      );
    }

    // Search for security-related content
    const queryEmbedding = new Array(768).fill(0.88);
    const results = await store.similaritySearch(queryEmbedding, 2);

    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(2);
    // Should find the authentication/security turns
    expect(
      results.some(
        (r) => r.content.includes('JWT') || r.content.includes('OAuth')
      )
    ).toBe(true);
  });

  it('should filter turns by session', async () => {
    const session1 = 'session-1';
    const session2 = 'session-2';

    await store.storeTurn(
      session1,
      'turn_1',
      'user',
      'Session 1 content',
      new Array(768).fill(0.5),
      {
        novelty: 0.5,
        importance: 5,
        alignment_O1: 5,
        alignment_O2: 5,
        alignment_O3: 5,
        alignment_O4: 5,
        alignment_O5: 5,
        alignment_O6: 5,
        alignment_O7: 5,
      }
    );

    await store.storeTurn(
      session2,
      'turn_2',
      'user',
      'Session 2 content',
      new Array(768).fill(0.5),
      {
        novelty: 0.5,
        importance: 5,
        alignment_O1: 5,
        alignment_O2: 5,
        alignment_O3: 5,
        alignment_O4: 5,
        alignment_O5: 5,
        alignment_O6: 5,
        alignment_O7: 5,
      }
    );

    const session1Turns = await store.getSessionTurns(session1);
    expect(session1Turns.length).toBe(1);
    expect(session1Turns[0].session_id).toBe(session1);

    const session2Turns = await store.getSessionTurns(session2);
    expect(session2Turns.length).toBe(1);
    expect(session2Turns[0].session_id).toBe(session2);
  });

  it('should find paradigm shifts', async () => {
    const sessionId = 'paradigm-test';

    // Store normal turn
    await store.storeTurn(
      sessionId,
      'turn_normal',
      'user',
      'Regular content',
      new Array(768).fill(0.5),
      {
        novelty: 0.3,
        importance: 5,
        is_paradigm_shift: false,
        alignment_O1: 5,
        alignment_O2: 5,
        alignment_O3: 5,
        alignment_O4: 5,
        alignment_O5: 5,
        alignment_O6: 5,
        alignment_O7: 5,
      }
    );

    // Store paradigm shift
    await store.storeTurn(
      sessionId,
      'turn_shift',
      'user',
      'Breakthrough insight!',
      new Array(768).fill(0.9),
      {
        novelty: 0.95,
        importance: 10,
        is_paradigm_shift: true,
        alignment_O1: 9,
        alignment_O2: 9,
        alignment_O3: 9,
        alignment_O4: 9,
        alignment_O5: 9,
        alignment_O6: 9,
        alignment_O7: 9,
      }
    );

    const shifts = await store.getParadigmShifts(sessionId);
    expect(shifts.length).toBe(1);
    expect(shifts[0].id).toBe('turn_shift');
    expect(shifts[0].is_paradigm_shift).toBe(true);
  });

  it('should get conversation statistics', async () => {
    const session1 = 'stats-session-1';
    const session2 = 'stats-session-2';

    // Add turns to different sessions
    await store.storeTurn(
      session1,
      'turn_1',
      'user',
      'Content 1',
      new Array(768).fill(0.5),
      {
        novelty: 0.6,
        importance: 7,
        is_paradigm_shift: true,
        alignment_O1: 8,
        alignment_O2: 6,
        alignment_O3: 5,
        alignment_O4: 5,
        alignment_O5: 5,
        alignment_O6: 5,
        alignment_O7: 5,
      }
    );

    await store.storeTurn(
      session2,
      'turn_2',
      'user',
      'Content 2',
      new Array(768).fill(0.5),
      {
        novelty: 0.4,
        importance: 5,
        alignment_O1: 6,
        alignment_O2: 6,
        alignment_O3: 6,
        alignment_O4: 6,
        alignment_O5: 6,
        alignment_O6: 6,
        alignment_O7: 6,
      }
    );

    const stats = await store.getStats();

    expect(stats.total_turns).toBe(2);
    expect(stats.total_sessions).toBe(2);
    expect(stats.paradigm_shifts).toBe(1);
    expect(stats.avg_importance).toBeGreaterThan(0);
    expect(stats.avg_novelty).toBeGreaterThan(0);
  });

  it('should delete turns', async () => {
    const sessionId = 'delete-test';
    const turnId = 'turn_delete';

    await store.storeTurn(
      sessionId,
      turnId,
      'user',
      'To be deleted',
      new Array(768).fill(0.5),
      {
        novelty: 0.5,
        importance: 5,
        alignment_O1: 5,
        alignment_O2: 5,
        alignment_O3: 5,
        alignment_O4: 5,
        alignment_O5: 5,
        alignment_O6: 5,
        alignment_O7: 5,
      }
    );

    let turn = await store.getTurn(turnId);
    expect(turn).toBeDefined();

    await store.deleteTurn(turnId);

    turn = await store.getTurn(turnId);
    expect(turn).toBeUndefined();
  });

  it('should delete entire sessions', async () => {
    const sessionId = 'session-delete-test';

    await store.storeTurn(
      sessionId,
      'turn_1',
      'user',
      'Content 1',
      new Array(768).fill(0.5),
      {
        novelty: 0.5,
        importance: 5,
        alignment_O1: 5,
        alignment_O2: 5,
        alignment_O3: 5,
        alignment_O4: 5,
        alignment_O5: 5,
        alignment_O6: 5,
        alignment_O7: 5,
      }
    );

    await store.storeTurn(
      sessionId,
      'turn_2',
      'user',
      'Content 2',
      new Array(768).fill(0.5),
      {
        novelty: 0.5,
        importance: 5,
        alignment_O1: 5,
        alignment_O2: 5,
        alignment_O3: 5,
        alignment_O4: 5,
        alignment_O5: 5,
        alignment_O6: 5,
        alignment_O7: 5,
      }
    );

    let turns = await store.getSessionTurns(sessionId);
    expect(turns.length).toBe(2);

    await store.deleteSession(sessionId);

    turns = await store.getSessionTurns(sessionId);
    expect(turns.length).toBe(0);
  });
});
