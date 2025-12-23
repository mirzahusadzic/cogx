import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BaseConversationManager,
  ConversationTurnMetadata,
} from '../overlays/base-conversation-manager.js';
import fs from 'fs-extra';

// Concrete implementation for testing
class TestManager extends BaseConversationManager<ConversationTurnMetadata> {
  getOverlayId() {
    return 'O1';
  }
  getOverlayName() {
    return 'Test';
  }
  getSupportedTypes() {
    return ['user'];
  }
}

const { mockLanceStore } = vi.hoisted(() => ({
  mockLanceStore: {
    initialize: vi.fn(),
    getSessionTurns: vi.fn().mockResolvedValue([]),
    getTurn: vi.fn(),
    storeTurn: vi.fn(),
    similaritySearch: vi.fn(),
  },
}));

vi.mock('../conversation-lance-store.js', () => ({
  ConversationLanceStore: vi.fn().mockImplementation(() => mockLanceStore),
}));

const { mockWorkbench } = vi.hoisted(() => ({
  mockWorkbench: {
    embed: vi
      .fn()
      .mockResolvedValue({ embedding_768d: new Array(768).fill(0.1) }),
  },
}));

vi.mock('../../core/executors/workbench-client.js', () => ({
  WorkbenchClient: vi.fn().mockImplementation(() => mockWorkbench),
}));

describe('BaseConversationManager', () => {
  const sigmaRoot = '/tmp/sigma-test';
  let manager: TestManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new TestManager(sigmaRoot, 'test-overlay');
  });

  it('should add turns to memory', () => {
    manager.addTurn({
      turn_id: 't1',
      role: 'user',
      content: 'hello',
      timestamp: 100,
      embedding: [0.1],
      project_alignment_score: 5,
      novelty: 0.1,
      importance: 5,
    });
    expect(manager.getInMemoryCount()).toBe(1);
  });

  it('should clear memory', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal turn for test
    manager.addTurn({} as any);
    manager.clearMemory();
    expect(manager.getInMemoryCount()).toBe(0);
  });

  it('should initialize lance store', async () => {
    await manager.initializeLanceStore();
    expect(mockLanceStore.initialize).toHaveBeenCalledWith(
      'conversation_turns'
    );
  });

  it('should set current session', () => {
    manager.setCurrentSession('session-1');
    // @ts-expect-error - accessing protected property for testing
    expect(manager.currentSessionId).toBe('session-1');
  });

  it('should flush turns to YAML and LanceDB', async () => {
    const spyWriteFile = vi
      .spyOn(fs, 'writeFile')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fs-extra overloads
      .mockResolvedValue(undefined as any);
    const spyEnsureDir = vi
      .spyOn(fs, 'ensureDir')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fs-extra overloads
      .mockResolvedValue(undefined as any);

    manager.addTurn({
      turn_id: 't1',
      role: 'user',
      content: 'hello',
      timestamp: 100,
      embedding: new Array(768).fill(0.1),
      project_alignment_score: 5,
      novelty: 0.1,
      importance: 5,
    });

    await manager.flush('session-1');

    expect(spyEnsureDir).toHaveBeenCalled();
    expect(spyWriteFile).toHaveBeenCalled();
    expect(mockLanceStore.storeTurn).toHaveBeenCalled();
  });
});
