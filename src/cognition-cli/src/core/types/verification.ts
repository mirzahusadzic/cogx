import { z } from 'zod';

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
 */

/**
 * Outcome of a verification operation with diagnostic messages.
 *
 * The success flag indicates whether verification passed, while messages
 * provide detailed information about what was checked and any issues found.
 */
export const VerificationResultSchema = z.object({
  /** Whether verification passed (true) or failed (false) */
  success: z.boolean(),
  /** Diagnostic messages describing verification results and any issues */
  messages: z.array(z.string()),
  /** @deprecated Use success instead */
  status: z.enum(['Success', 'Failure']).optional(),
  /** @deprecated Use messages instead */
  details: z.string().optional(),
});

/**
 * VerificationResult provides a unified contract for all verification operations.
 */
export type VerificationResult = z.infer<typeof VerificationResultSchema>;
