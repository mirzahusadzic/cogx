import { QueryResult, StructuralData } from '../query.js';
import { IQueryFormatter } from './types.js';

/**
 * Formats a query result as a structured JSON representation.
 *
 * Can output the full query result as JSON or a lineage-specific
 * JSON showing symbol relationships.
 */
export class JsonFormatter implements IQueryFormatter {
  /**
   * Create a new JSON formatter.
   *
   * @param lineageOnly - If true, only outputs the symbol lineage
   */
  constructor(private lineageOnly: boolean = false) {}

  /**
   * Format the query result as JSON.
   *
   * @param result - The query result to format
   * @returns Formatted JSON string
   */
  format(result: QueryResult): string {
    if (this.lineageOnly) {
      return this.formatAsLineageJSON(result);
    }
    return JSON.stringify(result, null, 2);
  }

  /**
   * Format the query result as lineage JSON structure.
   *
   * @param queryResult - The query result to format
   * @returns JSON string with lineage structure
   */
  private formatAsLineageJSON(queryResult: QueryResult): string {
    const { question, dependencies } = queryResult;

    const rootData = queryResult.initialContext[0];
    if (!rootData) {
      return JSON.stringify({ symbol: question, lineage: [] }, null, 2);
    }

    const lineageItems = dependencies.map((dep) => {
      const parts = dep.path.split(' -> ');
      const type = parts[parts.length - 1];
      const parentType = parts.length > 1 ? parts[parts.length - 2] : question;

      // Find parent data by searching through the whole result
      const parentData = [
        ...queryResult.initialContext,
        ...dependencies.map((d) => d.structuralData),
      ].find(
        (d) =>
          d.classes?.[0]?.name === parentType ||
          d.functions?.[0]?.name === parentType ||
          d.interfaces?.[0]?.name === parentType
      );

      const relationship = parentData
        ? this.inferRelationship(parentData, type)
        : 'uses';

      return { type, relationship, depth: dep.depth };
    });

    const uniqueLineage = Array.from(
      new Map(lineageItems.map((item) => [JSON.stringify(item), item])).values()
    );

    return JSON.stringify(
      { symbol: question, lineage: uniqueLineage },
      null,
      2
    );
  }

  /**
   * Infer the relationship type between parent and child symbol.
   *
   * @param parent - Parent symbol's structural data
   * @param childSymbol - Child symbol name
   * @returns Relationship type
   */
  private inferRelationship(
    parent: StructuralData,
    childSymbol: string
  ): string {
    for (const c of parent.classes || []) {
      if (c.base_classes?.includes(childSymbol)) return 'extends';
      if (c.implements_interfaces?.includes(childSymbol)) return 'implements';
      for (const m of c.methods || []) {
        if (m.returns?.includes(childSymbol)) return 'returns';
        if (
          m.params?.some((p: { type: string }) => p.type.includes(childSymbol))
        )
          return 'uses';
      }
    }
    return 'uses'; // Default
  }
}
