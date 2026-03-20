import { QueryResult } from '../query.js';
import { IQueryFormatter } from './types.js';

/**
 * Formats a query result as human-readable text.
 *
 * Produces indented, hierarchical output showing the query,
 * relevant context, and dependencies.
 */
export class HumanReadableFormatter implements IQueryFormatter {
  /**
   * Format the query result.
   *
   * @param queryResult - The query result to format
   * @returns Formatted human-readable string
   */
  format(queryResult: QueryResult): string {
    let output = '';
    output += `Query: "${queryResult.question}"`;

    if (queryResult.initialContext.length === 0) {
      output += '\nNo relevant information found.';
      return output;
    }

    output += '\n--- Relevant Context ---';
    queryResult.initialContext.forEach((item, index) => {
      output += `\n\nResult ${index + 1}:`;
      output += `\n${JSON.stringify(item, null, 2)}`;
    });

    if (queryResult.dependencies.length > 0) {
      output += '\n\n--- Dependencies ---';
      queryResult.dependencies.forEach((dep) => {
        const indent = '  '.repeat(dep.depth);
        output += `\n${indent}Lineage: ${dep.path}`;
        output += `\n${indent}${JSON.stringify(dep.structuralData, null, 2)}`;
      });
    }

    return output;
  }
}
