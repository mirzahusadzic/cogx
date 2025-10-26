import chalk from 'chalk';

/**
 * Shared logging utility for embedding generation
 * Provides consistent, concise progress output across all overlay types
 */
export class EmbedLogger {
  /**
   * Log the start of embedding for a symbol
   */
  static start(symbolName: string, overlayType?: string): void {
    const prefix = overlayType ? `[${overlayType}]` : '[Embed]';
    console.log(chalk.dim.gray(`  ${prefix} ${symbolName} - embedding...`));
  }

  /**
   * Log successful completion of embedding
   */
  static complete(symbolName: string, overlayType?: string): void {
    const prefix = overlayType ? `[${overlayType}]` : '[Embed]';
    console.log(chalk.green(`  ${prefix} ${symbolName} - ✓ complete`));
  }

  /**
   * Log embedding failure
   */
  static error(symbolName: string, error: Error, overlayType?: string): void {
    const prefix = overlayType ? `[${overlayType}]` : '[Embed]';
    console.error(
      chalk.red(`  ${prefix} ${symbolName} - ✗ failed: ${error.message}`)
    );
  }

  /**
   * Log batch progress (every N items)
   */
  static progress(current: number, total: number, overlayType?: string): void {
    const prefix = overlayType ? `[${overlayType}]` : '[Embed]';
    console.log(
      chalk.dim(`  ${prefix} Progress: ${current}/${total} embedded`)
    );
  }
}
