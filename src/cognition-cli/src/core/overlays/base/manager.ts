import {
  OverlayItem,
  OverlayMetadata,
  SelectOptions,
} from '../../algebra/overlay-algebra.js';
import { BaseOverlayManager } from '../../algebra/base-manager.js';

/**
 * BasePatternManager
 *
 * Generic base class for all PGC Pattern Managers (O1-O7).
 * Implements the core OverlayAlgebra logic while allowing domain-specific
 * storage and metadata mapping in subclasses.
 *
 * Now delegates common logic to BaseOverlayManager.
 */
export abstract class BasePatternManager<
  T extends OverlayMetadata,
> extends BaseOverlayManager<T> {
  constructor(
    protected pgcRoot: string,
    workbenchUrl?: string
  ) {
    super(pgcRoot, workbenchUrl);
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
  // EXTENDED OVERLAY ALGEBRA LOGIC
  // ========================================

  /**
   * Override select to support symbol-based selection used in PGC.
   */
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

    return super.select(options);
  }

  /**
   * Override exclude to support symbol-based exclusion used in PGC.
   */
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

    return super.exclude(options);
  }

  /**
   * Override getSymbolSet to use getSymbol helper.
   */
  async getSymbolSet(): Promise<Set<string>> {
    const allItems = await this.getAllItems();
    return new Set(allItems.map((item) => this.getSymbol(item)));
  }

  /**
   * Return the PGC root path.
   */
  getPgcRoot(): string {
    return this.pgcRoot;
  }
}
