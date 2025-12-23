import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversationOverlayRegistry } from '../conversation-registry.js';

const { mockManager } = vi.hoisted(() => ({
  mockManager: () => ({
    flush: vi.fn(),
    clearMemory: vi.fn(),
    initializeLanceStore: vi.fn(),
    setCurrentSession: vi.fn(),
    query: vi.fn(),
    storeTurn: vi.fn(),
    deleteTurn: vi.fn(),
    getStats: vi.fn(),
  }),
}));

vi.mock('../overlays/conversation-structural/manager.js', () => ({
  ConversationStructuralManager: vi.fn().mockImplementation(mockManager),
}));

vi.mock('../overlays/conversation-security/manager.js', () => ({
  ConversationSecurityManager: vi.fn().mockImplementation(mockManager),
}));

vi.mock('../overlays/conversation-lineage/manager.js', () => ({
  ConversationLineageManager: vi.fn().mockImplementation(mockManager),
}));

vi.mock('../overlays/conversation-mission/manager.js', () => ({
  ConversationMissionManager: vi.fn().mockImplementation(mockManager),
}));

vi.mock('../overlays/conversation-operational/manager.js', () => ({
  ConversationOperationalManager: vi.fn().mockImplementation(mockManager),
}));

vi.mock('../overlays/conversation-mathematical/manager.js', () => ({
  ConversationMathematicalManager: vi.fn().mockImplementation(mockManager),
}));

vi.mock('../overlays/conversation-coherence/manager.js', () => ({
  ConversationCoherenceManager: vi.fn().mockImplementation(mockManager),
}));

describe('ConversationOverlayRegistry', () => {
  let registry: ConversationOverlayRegistry;
  const sigmaRoot = '/tmp/sigma';

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new ConversationOverlayRegistry(sigmaRoot);
  });

  it('should return overlay info', () => {
    const info = registry.getOverlayInfo();
    expect(info).toHaveLength(7);
    expect(info[0].id).toBe('O1');
    expect(info[0].name).toBe('Structural');
  });

  it('should lazy load managers', async () => {
    const manager = await registry.get('O1');
    expect(manager).toBeDefined();
    expect(manager.initializeLanceStore).toHaveBeenCalled();

    const manager2 = await registry.get('O1');
    expect(manager2).toBe(manager);
    expect(manager.initializeLanceStore).toHaveBeenCalledTimes(1);
  });

  it('should get multiple overlays', async () => {
    const managers = await registry.getAll(['O1', 'O2']);
    expect(managers.size).toBe(2);
    expect(managers.get('O1')).toBeDefined();
    expect(managers.get('O2')).toBeDefined();
  });

  it('should set current session for loaded and lazy-loaded managers', async () => {
    const o1 = await registry.get('O1');
    await registry.setCurrentSession('session-123');

    expect(o1.setCurrentSession).toHaveBeenCalledWith('session-123');

    const o2 = await registry.get('O2');
    expect(o2.setCurrentSession).toHaveBeenCalledWith('session-123');
  });

  it('should flush all overlays', async () => {
    const o1 = await registry.get('O1');
    const o2 = await registry.get('O2');

    await registry.flushAll('session-123');

    expect(o1.flush).toHaveBeenCalledWith('session-123');
    expect(o2.flush).toHaveBeenCalledWith('session-123');
  });

  it('should clear all memory', async () => {
    const o1 = await registry.get('O1');
    await registry.clearAllMemory();
    expect(o1.clearMemory).toHaveBeenCalled();
  });

  it('should throw for unknown overlay', async () => {
    // @ts-expect-error - testing invalid input
    await expect(registry.get('O99')).rejects.toThrow(
      'Unknown conversation overlay: O99'
    );
  });
});
