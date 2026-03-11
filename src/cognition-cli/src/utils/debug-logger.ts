/**
 * Debug Logger Utility
 *
 * @deprecated Use systemDiagnosticsService from src/core/services/diagnostics/SystemDiagnosticsService.js
 */

import {
  systemDiagnosticsService,
  LogEvent as ServiceLogEvent,
} from '../core/services/diagnostics/SystemDiagnosticsService.js';
import { EventEmitter } from 'events';

/**
 * @deprecated Use LogEvent from src/core/services/diagnostics/SystemDiagnosticsService.js
 */
export type LogEvent = ServiceLogEvent;

/**
 * @deprecated Use systemDiagnosticsService.getLogEmitter()
 */
export const logEmitter: EventEmitter =
  systemDiagnosticsService.getLogEmitter();

/**
 * @deprecated Use systemDiagnosticsService.initDebugLog()
 */
export function initDebugLog(projectRoot: string = process.cwd()): void {
  systemDiagnosticsService.initDebugLog(projectRoot);
}

/**
 * @deprecated Use systemDiagnosticsService.isDebugEnabled()
 */
export function isDebugEnabled(): boolean {
  return systemDiagnosticsService.isDebugEnabled();
}

/**
 * @deprecated Use systemDiagnosticsService.getDebugLogPath()
 */
export function getDebugLogPath(): string | null {
  return systemDiagnosticsService.getDebugLogPath();
}

/**
 * @deprecated Use systemDiagnosticsService.debugLog()
 */
export function debugLog(
  message: string,
  data?: Record<string, unknown>
): void {
  systemDiagnosticsService.debugLog(message, data);
}

/**
 * @deprecated Use systemDiagnosticsService.debugError()
 */
export function debugError(message: string, error: unknown): void {
  systemDiagnosticsService.debugError(message, error);
}

/**
 * @deprecated Use systemDiagnosticsService.systemLog()
 */
export function systemLog(
  source: string,
  message: string,
  data?: Record<string, unknown>,
  level: 'info' | 'warn' | 'error' | 'debug' = 'info'
): void {
  systemDiagnosticsService.systemLog(source, message, data, level);
}

/**
 * @deprecated Use systemDiagnosticsService.debugTimer()
 */
export function debugTiming(label: string, startTime: bigint): void {
  // Directly use the logic to maintain backward compatibility for start time
  if (!systemDiagnosticsService.isDebugEnabled()) return;

  const endTime = process.hrtime.bigint();
  const durationMs = Number(endTime - startTime) / 1_000_000;

  systemDiagnosticsService.debugLog(`TIMING: ${label}`, {
    durationMs: durationMs.toFixed(2),
  });
}

/**
 * @deprecated Use systemDiagnosticsService.debugTimer()
 */
export function debugTimer(label: string): () => void {
  return systemDiagnosticsService.debugTimer(label);
}

/**
 * @deprecated Use systemDiagnosticsService.finalizeDebugLog()
 */
export function finalizeDebugLog(success: boolean, exitCode?: number): void {
  systemDiagnosticsService.finalizeDebugLog(success, exitCode);
}
