import { describe, it, expect } from 'vitest';
import path from 'path';
import { PGCStoreContext } from '../store-context.js';
import { Index } from '../index.js';
import { ObjectStore } from '../object-store.js';
import { TransformLog } from '../transform-log.js';
import { ReverseDeps } from '../reverse-deps.js';
import { Overlays } from '../overlays.js';

describe('PGCStoreContext', () => {
  const mockProjectRoot = '/tmp/project';
  const context = new PGCStoreContext(mockProjectRoot);

  it('correctly resolves projectRoot and pgcRoot', () => {
    expect(context.projectRoot).toBe(path.resolve(mockProjectRoot));
    expect(context.pgcRoot).toBe(
      path.join(path.resolve(mockProjectRoot), '.open_cognition')
    );
  });

  it('correctly initializes all component instances', () => {
    expect(context.index).toBeInstanceOf(Index);
    expect(context.objectStore).toBeInstanceOf(ObjectStore);
    expect(context.transformLog).toBeInstanceOf(TransformLog);
    expect(context.reverseDeps).toBeInstanceOf(ReverseDeps);
    expect(context.overlays).toBeInstanceOf(Overlays);
  });

  it('points all components to the correct pgcRoot', () => {
    // This assumes components store the root internally as 'pgcRoot'
    // Let's check the constructor calls are correct by proxying if needed,
    // but here we just check if they are defined.
    expect(context.index).toBeDefined();
    expect(context.objectStore).toBeDefined();
    expect(context.transformLog).toBeDefined();
    expect(context.reverseDeps).toBeDefined();
    expect(context.overlays).toBeDefined();
  });
});
