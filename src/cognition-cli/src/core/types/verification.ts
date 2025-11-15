/**
 * Verification Result Types
 *
 * Types for verification operations that validate system integrity and coherence.
 *
 * DESIGN:
 * Verification operations span multiple domains:
 * - Index coherence: PGC matches source code state
 * - Overlay alignment: Mission principles align with security constraints
 * - Transform validity: Goals achieved with sufficient fidelity
 * - Lineage integrity: Transformation chains are traceable
 *
 * All verifications return a unified VerificationResult that can accumulate
 * diagnostic messages for detailed debugging.
 *
 * @example
 * // Verify index coherence
 * const result: VerificationResult = {
 *   success: true,
 *   messages: [
 *     'All tracked files match indexed hashes',
 *     'No orphaned embeddings found',
 *     'Verified 1,234 structural patterns'
 *   ]
 * };
 *
 * @example
 * // Failed verification with diagnostics
 * const result: VerificationResult = {
 *   success: false,
 *   messages: [
 *     'ERROR: 15 dirty files detected',
 *     'ERROR: auth-handler.ts hash mismatch',
 *     'WARN: 3 untracked TypeScript files',
 *     'Run `cogni reindex` to update'
 *   ]
 * };
 *
 * @example
 * // Mission-security alignment verification
 * const alignment = await verifyOverlayCoherence();
 * if (!alignment.success) {
 *   console.error('Mission-security misalignment detected:');
 *   alignment.messages.forEach(msg => console.error(`  ${msg}`));
 * }
 */

/**
 * Outcome of a verification operation with diagnostic messages.
 *
 * The success flag indicates whether verification passed, while messages
 * provide detailed information about what was checked and any issues found.
 *
 * Verification operations should be idempotent and non-destructive.
 * They report issues but do not modify state.
 */
export interface VerificationResult {
  /** Whether verification passed (true) or failed (false) */
  success: boolean;
  /** Diagnostic messages describing verification results and any issues */
  messages: string[];
}
