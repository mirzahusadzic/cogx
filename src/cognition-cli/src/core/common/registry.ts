import { RegistryError } from '../errors/index.js';

/**
 * Base Registry Interface
 *
 * Defines the standard battery of registry operations used throughout
 * the Cognition Σ system for extension points and discovery.
 */
export interface IRegistry<T> {
  /**
   * Register an item in the registry.
   *
   * @param name - Unique name for the item
   * @param item - The item to register
   * @throws RegistryError if an item with the same name is already registered
   */
  register(name: string, item: T): void;

  /**
   * Get an item from the registry by name.
   *
   * @param name - The name of the item to retrieve
   * @returns The requested item
   * @throws RegistryError if the item is not found
   */
  get(name: string): T;

  /**
   * Try to get an item from the registry by name.
   *
   * @param name - The name of the item to retrieve
   * @returns The requested item, or undefined if not found
   */
  tryGet(name: string): T | undefined;

  /**
   * Check if an item is registered.
   *
   * @param name - The name to check
   * @returns true if registered, false otherwise
   */
  has(name: string): boolean;

  /**
   * List all registered item names.
   *
   * @returns Array of registered names
   */
  list(): string[];

  /**
   * Get all registered items.
   *
   * @returns Array of registered items
   */
  getAll(): T[];

  /**
   * Unregister an item by name.
   *
   * @param name - The name of the item to remove
   * @returns true if the item was found and removed, false otherwise
   */
  unregister(name: string): boolean;

  /**
   * Clear all items from the registry.
   */
  clear(): void;
}

/**
 * Base Async Registry Interface
 *
 * For registries that handle lazy initialization or async operations.
 */
export interface IAsyncRegistry<T> {
  /**
   * Get an item from the registry by name.
   *
   * @param name - The name of the item to retrieve
   * @returns Promise resolving to the requested item
   */
  get(name: string): Promise<T>;

  /**
   * Check if an item is already initialized.
   *
   * @param name - The name to check
   * @returns true if initialized, false otherwise
   */
  has(name: string): boolean;

  /**
   * List all initialized item names.
   *
   * @returns Array of initialized names
   */
  list(): string[];

  /**
   * Clear all initialized items from the registry.
   */
  clear(): void;
}

/**
 * Base Registry Implementation
 *
 * Provides a standardized, thread-safe (in-memory) store for named items.
 * Handles common concerns like duplicate registration checks and
 * consistent error reporting with available item listing.
 *
 * DESIGN:
 * - Uses a Map for O(1) lookups.
 * - Centralizes error messaging for "not found" and "already exists" scenarios.
 * - Protects the underlying Map to allow subclasses to extend logic (e.g., lazy loading).
 *
 * @template T The type of item stored in the registry.
 *
 * @example
 * ```typescript
 * class MyRegistry extends BaseRegistry<MyType> {
 *   constructor() {
 *     super('MyRegistry');
 *   }
 * }
 * ```
 */
export class BaseRegistry<T> implements IRegistry<T> {
  /**
   * The underlying store for registered items.
   */
  protected items = new Map<string, T>();

  /**
   * Create a new registry instance.
   *
   * @param registryName - The name of the registry for error reporting (e.g., 'ProviderRegistry')
   */
  constructor(protected readonly registryName: string) {}

  /**
   * Register an item in the registry.
   *
   * @param name - Unique name for the item
   * @param item - The item to register
   * @throws RegistryError if an item with the same name is already registered
   */
  register(name: string, item: T): void {
    if (this.items.has(name)) {
      throw new RegistryError(
        `Item '${name}' is already registered in ${this.registryName}.`,
        { registry: this.registryName, name }
      );
    }
    this.items.set(name, item);
  }

  /**
   * Get an item from the registry by name.
   *
   * @param name - The name of the item to retrieve
   * @returns The requested item
   * @throws RegistryError if the item is not found
   */
  get(name: string): T {
    const item = this.items.get(name);
    if (!item) {
      const available = this.list().join(', ') || 'none';
      throw new RegistryError(
        `Item '${name}' not found in ${this.registryName}. Available: ${available}`,
        { registry: this.registryName, name, available }
      );
    }
    return item;
  }

  /**
   * Try to get an item from the registry by name.
   *
   * @param name - The name of the item to retrieve
   * @returns The requested item, or undefined if not found
   */
  tryGet(name: string): T | undefined {
    return this.items.get(name);
  }

  /**
   * Check if an item is registered.
   *
   * @param name - The name to check
   * @returns true if registered, false otherwise
   */
  has(name: string): boolean {
    return this.items.has(name);
  }

  /**
   * List all registered item names.
   *
   * @returns Array of registered names
   */
  list(): string[] {
    return Array.from(this.items.keys());
  }

  /**
   * Get all registered items.
   *
   * @returns Array of registered items
   */
  getAll(): T[] {
    return Array.from(this.items.values());
  }

  /**
   * Unregister an item by name.
   *
   * @param name - The name of the item to remove
   * @returns true if the item was found and removed, false otherwise
   */
  unregister(name: string): boolean {
    return this.items.delete(name);
  }

  /**
   * Clear all items from the registry.
   */
  clear(): void {
    this.items.clear();
  }
}

/**
 * Async Base Registry Implementation
 *
 * Provides a standardized pattern for lazy-initialized, async registries.
 * Subclasses must implement createItem to define how items are created on demand.
 *
 * @template T The type of item stored in the registry.
 *
 * @example
 * ```typescript
 * class MyAsyncRegistry extends AsyncBaseRegistry<MyType> {
 *   protected async createItem(name: string): Promise<MyType> {
 *     return new MyType(name);
 *   }
 * }
 * ```
 */
export abstract class AsyncBaseRegistry<T> implements IAsyncRegistry<T> {
  /**
   * The underlying store for initialized items.
   */
  protected items = new Map<string, T>();

  /**
   * Create a new async registry instance.
   *
   * @param registryName - The name of the registry for error reporting
   */
  constructor(protected readonly registryName: string) {}

  /**
   * Get an item from the registry by name.
   * Lazy-initializes the item if not already present.
   *
   * @param name - The name of the item to retrieve
   * @returns Promise resolving to the requested item
   */
  async get(name: string): Promise<T> {
    const existing = this.items.get(name);
    if (existing) {
      return existing;
    }

    const item = await this.createItem(name);
    this.items.set(name, item);
    return item;
  }

  /**
   * Check if an item is already initialized.
   *
   * @param name - The name to check
   * @returns true if initialized, false otherwise
   */
  has(name: string): boolean {
    return this.items.has(name);
  }

  /**
   * List all initialized item names.
   *
   * @returns Array of initialized names
   */
  list(): string[] {
    return Array.from(this.items.keys());
  }

  /**
   * Clear all initialized items from the registry.
   */
  clear(): void {
    this.items.clear();
  }

  /**
   * Abstract factory method to create an item on demand.
   *
   * @param name - The name of the item to create
   * @returns Promise resolving to the newly created item
   */
  protected abstract createItem(name: string): Promise<T>;
}
