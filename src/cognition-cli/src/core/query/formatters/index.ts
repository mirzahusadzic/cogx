import { BaseRegistry } from '../../common/registry.js';
import { IQueryFormatter, QueryFormat } from './types.js';
import { HumanReadableFormatter } from './human-readable.js';
import { JsonFormatter } from './json.js';
import { MarkdownFormatter } from './markdown.js';

export * from './types.js';
export * from './human-readable.js';
export * from './json.js';
export * from './markdown.js';

/**
 * Registry for query result formatters.
 *
 * Provides centralized management and retrieval of different
 * output formatters for PGC queries.
 */
export class QueryFormatterRegistry extends BaseRegistry<IQueryFormatter> {
  /**
   * Create a new query formatter registry with default formatters.
   */
  constructor() {
    super('QueryFormatter');
    this.register('human', new HumanReadableFormatter());
    this.register('json', new JsonFormatter(false));
    this.register('lineage', new JsonFormatter(true));
    this.register('markdown', new MarkdownFormatter());
  }

  /**
   * Get a formatter by its type.
   *
   * @param type - The format type
   * @returns The registered formatter
   * @throws RegistryError if formatter is not found
   */
  getFormatter(type: QueryFormat): IQueryFormatter {
    return this.get(type);
  }

  /**
   * Get a formatter by its type, falling back to a default if not found.
   *
   * @param type - The format type
   * @param fallback - The fallback format type
   * @returns The registered formatter
   */
  getFormatterWithFallback(
    type: string | undefined,
    fallback: QueryFormat = 'human'
  ): IQueryFormatter {
    if (!type || !this.has(type)) {
      return this.get(fallback);
    }
    return this.get(type);
  }
}

/**
 * Global instance of the query formatter registry.
 */
export const queryFormatterRegistry = new QueryFormatterRegistry();
