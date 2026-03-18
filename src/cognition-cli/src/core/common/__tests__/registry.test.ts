import { describe, it, expect, beforeEach } from 'vitest';
import { BaseRegistry } from '../registry.js';
import { RegistryError } from '../../errors/index.js';

interface MockItem {
  id: string;
  value: number;
}

describe('BaseRegistry', () => {
  let registry: BaseRegistry<MockItem>;

  beforeEach(() => {
    registry = new BaseRegistry<MockItem>('TestRegistry');
  });

  describe('register', () => {
    it('should register a new item', () => {
      const item = { id: 'test', value: 1 };
      registry.register('test', item);
      expect(registry.has('test')).toBe(true);
      expect(registry.get('test')).toBe(item);
    });

    it('should throw RegistryError when registering a duplicate name', () => {
      const item1 = { id: 'test', value: 1 };
      const item2 = { id: 'test', value: 2 };
      registry.register('test', item1);

      expect(() => registry.register('test', item2)).toThrow(RegistryError);
      expect(() => registry.register('test', item2)).toThrow(
        /already registered/
      );
    });
  });

  describe('get', () => {
    it('should return a registered item', () => {
      const item = { id: 'test', value: 1 };
      registry.register('test', item);
      expect(registry.get('test')).toBe(item);
    });

    it('should throw RegistryError when item not found', () => {
      expect(() => registry.get('non-existent')).toThrow(RegistryError);
      expect(() => registry.get('non-existent')).toThrow(/not found/);
    });

    it('should include available items in the error message', () => {
      registry.register('a', { id: 'a', value: 1 });
      registry.register('b', { id: 'b', value: 2 });

      expect(() => registry.get('c')).toThrow(/Available: a, b/);
    });

    it('should show "none" when no items are available in the error message', () => {
      expect(() => registry.get('c')).toThrow(/Available: none/);
    });
  });

  describe('tryGet', () => {
    it('should return a registered item', () => {
      const item = { id: 'test', value: 1 };
      registry.register('test', item);
      expect(registry.tryGet('test')).toBe(item);
    });

    it('should return undefined when item not found', () => {
      expect(registry.tryGet('non-existent')).toBeUndefined();
    });
  });

  describe('list and getAll', () => {
    it('should return all registered names', () => {
      registry.register('a', { id: 'a', value: 1 });
      registry.register('b', { id: 'b', value: 2 });
      const list = registry.list();
      expect(list).toContain('a');
      expect(list).toContain('b');
      expect(list).toHaveLength(2);
    });

    it('should return all registered items', () => {
      const item1 = { id: 'a', value: 1 };
      const item2 = { id: 'b', value: 2 };
      registry.register('a', item1);
      registry.register('b', item2);
      const all = registry.getAll();
      expect(all).toContain(item1);
      expect(all).toContain(item2);
      expect(all).toHaveLength(2);
    });
  });

  describe('unregister', () => {
    it('should remove a registered item', () => {
      registry.register('test', { id: 'test', value: 1 });
      expect(registry.unregister('test')).toBe(true);
      expect(registry.has('test')).toBe(false);
    });

    it('should return false when unregistering a non-existent item', () => {
      expect(registry.unregister('non-existent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all items', () => {
      registry.register('a', { id: 'a', value: 1 });
      registry.register('b', { id: 'b', value: 2 });
      registry.clear();
      expect(registry.list()).toHaveLength(0);
      expect(registry.has('a')).toBe(false);
    });
  });
});
