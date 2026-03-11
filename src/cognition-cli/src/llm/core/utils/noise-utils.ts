/**
 * Utility for suppressing SDK noise that can leak into stdout/stderr and mess up the TUI.
 *
 * @deprecated Use systemDiagnosticsService from src/core/services/diagnostics/SystemDiagnosticsService.js
 */

import {
  systemDiagnosticsService,
  NoiseState as ServiceNoiseState,
} from '../../../core/services/diagnostics/SystemDiagnosticsService.js';

/**
 * @deprecated Use SystemDiagnosticsService.suppressNoise()
 */
export type NoiseState = ServiceNoiseState;

/**
 * @deprecated Use systemDiagnosticsService.suppressNoise()
 */
export function suppressNoise(): NoiseState {
  systemDiagnosticsService.suppressNoise();
  // We don't have access to the internal state from the service,
  // but this utility is deprecated and we should move to service.restoreNoise()
  // which handles its own state.
  // For backward compatibility, we return a dummy state that doesn't do anything
  // if passed to restoreNoise (below).
  return {} as NoiseState;
}

/**
 * @deprecated Use systemDiagnosticsService.restoreNoise()
 */
export function restoreNoise(): void {
  systemDiagnosticsService.restoreNoise();
}
