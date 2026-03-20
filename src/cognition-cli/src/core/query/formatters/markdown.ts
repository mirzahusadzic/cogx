import { QueryResult } from '../query.js';
import { IQueryFormatter } from './types.js';

/**
 * Formats a query result as Markdown.
 *
 * Produces structured Markdown output for use in reports or documentation.
 */
export class MarkdownFormatter implements IQueryFormatter {
  /**
   * Format the query result as Markdown.
   *
   * @param result - The query result to format
   * @returns Formatted Markdown string
   */
  format(result: QueryResult): string {
    let output = `# Query Result: ${result.question}\n\n`;

    if (result.initialContext.length === 0) {
      output += '> No relevant information found.\n';
      return output;
    }

    output += `## Relevant Context (${result.initialContext.length})\n\n`;
    result.initialContext.forEach((item, index) => {
      const name =
        item.classes?.[0]?.name ||
        item.functions?.[0]?.name ||
        item.interfaces?.[0]?.name ||
        `Symbol ${index + 1}`;
      output += `### ${name}\n\n\`\`\`json\n${JSON.stringify(item, null, 2)}\n\`\`\`\n\n`;
    });

    if (result.dependencies.length > 0) {
      output += `## Dependencies (${result.dependencies.length})\n\n`;
      output += '| Symbol | Lineage | Depth |\n';
      output += '| --- | --- | --- |\n';
      result.dependencies.forEach((dep) => {
        const parts = dep.path.split(' -> ');
        const symbol = parts[parts.length - 1];
        output += `| ${symbol} | ${dep.path} | ${dep.depth} |\n`;
      });
      output += '\n';

      output += '### Dependency Details\n\n';
      result.dependencies.forEach((dep) => {
        const parts = dep.path.split(' -> ');
        const symbol = parts[parts.length - 1];
        output += `#### ${symbol}\n**Path**: \`${dep.path}\` | **Depth**: ${dep.depth}\n\n`;
        output += `\`\`\`json\n${JSON.stringify(dep.structuralData, null, 2)}\n\`\`\`\n\n`;
      });
    }

    return output;
  }
}
