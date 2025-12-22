import * as os from 'os';

/**
 * Gets the base directory for Cognition configuration and state.
 * Defaults to the user's home directory, but can be overridden
 * via the COGNITION_HOME_DIR environment variable for testing and isolation.
 */
export function getHomeDir(): string {
  return process.env.COGNITION_HOME_DIR || os.homedir();
}
