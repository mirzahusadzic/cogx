import { environmentService } from '../core/services/environment/EnvironmentService.js';

/**
 * Gets the base directory for Cognition configuration and state.
 *
 * @deprecated Use environmentService.getHomeDir()
 * Defaults to the user's home directory, but can be overridden
 * via the COGNITION_HOME_DIR environment variable for testing and isolation.
 */
export function getHomeDir(): string {
  return environmentService.getHomeDir();
}
