/**
 * Utility for unified verbosity state management across the CLI.
 *
 * Checks both local command options and the global environment variable
 * set by the preAction hook in cli.ts.
 *
 * @param options - The command options object from Commander
 * @returns true if verbose output is requested
 */
export function getVerboseState(options: Record<string, unknown>): boolean {
  return !!(options.verbose || process.env.COGNITION_VERBOSE === '1');
}
