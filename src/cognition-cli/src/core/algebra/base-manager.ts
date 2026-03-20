import {
  OverlayAlgebra,
  OverlayItem,
  OverlayMetadata,
  SelectOptions,
} from './overlay-algebra.js';
import { WorkbenchClient } from '../executors/workbench-client.js';
import { cosineSimilarity } from './math.js';

/**
 * Base abstract class for all Overlay Managers.
 *
 * Implements the core logic for the OverlayAlgebra interface, delegating
 * item retrieval to the subclass via the abstract getAllItems() method.
 *
 * This consolidation reduces redundancy between Project (PGC) and
 * Conversation (Sigma) overlays.
 *
 * @abstract
 * @class BaseOverlayManager
 * @template T - The metadata type for the overlay items
 */
export abstract class BaseOverlayManager<
  T extends OverlayMetadata,
> implements OverlayAlgebra<T> {
  protected workbench: WorkbenchClient;

  /**
   * Creates an instance of BaseOverlayManager.
   * @param rootPath - Base path for the overlay storage
   * @param workbenchUrl - Optional override for the workbench URL
   * @param debug - Whether to enable debug logging
   */
  constructor(
    protected rootPath: string,
    workbenchUrl?: string,
    protected debug: boolean = false
  ) {
    this.workbench = new WorkbenchClient(
      workbenchUrl || process.env.WORKBENCH_URL || 'http://localhost:8000',
      this.debug
    );
  }

  /**
   * Load all items from the domain-specific storage.
   * Subclasses must implement this to provide the underlying data.
   */
  abstract getAllItems(): Promise<OverlayItem<T>[]>;

  /**
   * Returns the ID of the overlay (e.g., 'O1', 'O2').
   * Subclasses must implement this.
   */
  abstract getOverlayId(): string;

  /**
   * Returns the human-readable name of the overlay.
   * Subclasses must implement this.
   */
  abstract getOverlayName(): string;

  /**
   * Returns a list of supported metadata types for this overlay.
   */
  getSupportedTypes(): string[] {
    return []; // Subclasses can override
  }

  /**
   * Returns items of a specific type.
   */
  async getItemsByType(type: string): Promise<OverlayItem<T>[]> {
    const allItems = await this.getAllItems();
    return allItems.filter((item) => this.getItemType(item) === type);
  }

  /**
   * Helper to get the type from an item's metadata.
   * Overridable for cases where 'type' isn't the primary discriminator.
   */
  protected getItemType(item: OverlayItem<T>): string | undefined {
    return item.metadata.type;
  }

  /**
   * Filters items based on a metadata predicate.
   */
  async filter(predicate: (metadata: T) => boolean): Promise<OverlayItem<T>[]> {
    const allItems = await this.getAllItems();
    return allItems.filter((item) => predicate(item.metadata));
  }

  /**
   * Performs a semantic similarity search across overlay items.
   */
  async query(
    query: string,
    topK: number = 10,
    precomputedEmbedding?: number[]
  ): Promise<Array<{ item: OverlayItem<T>; similarity: number }>> {
    let queryEmbedding: number[];

    if (precomputedEmbedding && precomputedEmbedding.length === 768) {
      queryEmbedding = precomputedEmbedding;
    } else {
      const embedResponse = await this.workbench.embed({
        signature: query,
        dimensions: 768,
      });

      queryEmbedding = embedResponse['embedding_768d'] as number[];
      if (!queryEmbedding || queryEmbedding.length !== 768) {
        throw new Error('Failed to generate query embedding');
      }
    }

    const allItems = await this.getAllItems();
    const results = allItems.map((item) => ({
      item,
      similarity: cosineSimilarity(queryEmbedding, item.embedding),
    }));

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  /**
   * Selects items based on complex criteria.
   */
  async select(options: SelectOptions): Promise<OverlayItem<T>[]> {
    let results = await this.getAllItems();

    if (options.type) {
      results = results.filter(
        (item) => this.getItemType(item) === options.type
      );
    }

    if (options.minSimilarity && options.query) {
      const queried = await this.query(options.query, results.length);
      results = queried
        .filter((q) => q.similarity >= options.minSimilarity!)
        .map((q) => q.item);
    }

    return results;
  }

  /**
   * Excludes items based on criteria.
   */
  async exclude(options: SelectOptions): Promise<OverlayItem<T>[]> {
    const allItems = await this.getAllItems();
    const selectedIds = new Set(
      (await this.select(options)).map((item) => item.id)
    );

    return allItems.filter((item) => !selectedIds.has(item.id));
  }

  /**
   * Returns a set of all unique symbol names in the overlay.
   */
  async getSymbolSet(): Promise<Set<string>> {
    const allItems = await this.getAllItems();
    return new Set(allItems.map((item) => item.id));
  }

  /**
   * Returns a set of all unique item IDs.
   */
  async getIdSet(): Promise<Set<string>> {
    const allItems = await this.getAllItems();
    return new Set(allItems.map((item) => item.id));
  }

  /**
   * Returns the root path for storage.
   */
  getPgcRoot(): string {
    return this.rootPath;
  }
}
