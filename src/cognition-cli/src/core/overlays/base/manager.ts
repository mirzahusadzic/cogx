import {
  OverlayAlgebra,
  OverlayItem,
  OverlayMetadata,
  SelectOptions,
} from '../../algebra/overlay-algebra.js';
import { WorkbenchClient } from '../../executors/workbench-client.js';

/**
 * BasePatternManager
 *
 * Generic base class for all PGC Pattern Managers (O1-O7).
 * Implements the core OverlayAlgebra logic while allowing domain-specific
 * storage and metadata mapping in subclasses.
 */
export abstract class BasePatternManager<
  T extends OverlayMetadata,
> implements OverlayAlgebra<T> {
  protected workbench: WorkbenchClient;

  constructor(
    protected pgcRoot: string,
    workbenchUrl?: string
  ) {
    this.workbench = new WorkbenchClient(
      workbenchUrl || process.env.WORKBENCH_URL || 'http://localhost:8000'
    );
  }

  // ========================================
  // ABSTRACT METHODS (Subclass must implement)
  // ========================================

  /** Get overlay identifier (e.g., 'O1') */
  abstract getOverlayId(): string;

  /** Get human-readable overlay name (e.g., 'Structure') */
  abstract getOverlayName(): string;

  /** Get all supported item types for this overlay */
  abstract getSupportedTypes(): string[];

  /** Load all items from the domain-specific storage (LanceDB, YAML, etc.) */
  abstract getAllItems(): Promise<OverlayItem<T>[]>;

  /**
   * Get the symbol identifier for an item.
   * Default uses metadata.text, but can be overridden (e.g., for O1 symbols).
   */
  protected getSymbol(item: OverlayItem<T>): string {
    return item.metadata.text;
  }

  // ========================================
  // COMMON OVERLAY ALGEBRA LOGIC
  // ========================================

  getPgcRoot(): string {
    return this.pgcRoot;
  }

  async getItemsByType(type: string): Promise<OverlayItem<T>[]> {
    const allItems = await this.getAllItems();
    return allItems.filter((item) => item.metadata.type === type);
  }

  async filter(predicate: (metadata: T) => boolean): Promise<OverlayItem<T>[]> {
    const allItems = await this.getAllItems();
    return allItems.filter((item) => predicate(item.metadata));
  }

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
      similarity: this.cosineSimilarity(queryEmbedding, item.embedding),
    }));

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  // ========================================
  // SET OPERATIONS
  // ========================================

  async select(options: SelectOptions): Promise<OverlayItem<T>[]> {
    const allItems = await this.getAllItems();

    if (options.symbols) {
      return allItems.filter((item) =>
        options.symbols!.has(this.getSymbol(item))
      );
    }

    if (options.ids) {
      return allItems.filter((item) => options.ids!.has(item.id));
    }

    return allItems;
  }

  async exclude(options: SelectOptions): Promise<OverlayItem<T>[]> {
    const allItems = await this.getAllItems();

    if (options.symbols) {
      return allItems.filter(
        (item) => !options.symbols!.has(this.getSymbol(item))
      );
    }

    if (options.ids) {
      return allItems.filter((item) => !options.ids!.has(item.id));
    }

    return allItems;
  }

  async getSymbolSet(): Promise<Set<string>> {
    const allItems = await this.getAllItems();
    return new Set(allItems.map((item) => this.getSymbol(item)));
  }

  async getIdSet(): Promise<Set<string>> {
    const allItems = await this.getAllItems();
    return new Set(allItems.map((item) => item.id));
  }

  // ========================================
  // UTILITIES
  // ========================================

  protected cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}
