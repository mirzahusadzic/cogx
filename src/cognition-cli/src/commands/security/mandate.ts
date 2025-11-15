/**
 * Dual-Use Mandate Display Command
 *
 * Displays the embedded Dual-Use Mandate, a critical security document
 * that defines the ethical and operational boundaries for dual-use AI
 * technologies. This mandate is permanently embedded in the system and
 * must be displayed on demand.
 *
 * DESIGN RATIONALE:
 * The Dual-Use Mandate serves multiple purposes:
 * 1. Transparency: Users can verify the system's ethical constraints
 * 2. Auditability: The mandate is version-controlled and immutable
 * 3. Compliance: Required for regulatory and ethical review
 * 4. Mission Alignment: Reinforces core security and ethical principles
 *
 * SECURITY IMPLICATIONS:
 * - The mandate text is imported from core/security/dual-use-mandate.js
 * - It is NOT dynamically loaded or user-modifiable
 * - Changes to the mandate require code review and version control
 * - This prevents runtime tampering with ethical boundaries
 *
 * USAGE:
 * This command is typically used for:
 * - Onboarding: New team members review the mandate
 * - Audits: Compliance checks verify mandate presence
 * - Documentation: Include mandate in security reports
 * - Verification: Confirm mandate has not been altered
 *
 * @example
 * // Display the dual-use mandate
 * await showMandate();
 * // Outputs the full text of the embedded mandate to console
 *
 * @example
 * // Typical CLI usage:
 * // $ cognition-cli security mandate
 * // [Dual-Use Mandate text appears]
 */

import { DUAL_USE_MANDATE } from '../../core/security/dual-use-mandate.js';

/**
 * Display the embedded Dual-Use Mandate
 *
 * Outputs the complete text of the Dual-Use Mandate to the console.
 * This is a security-critical function that provides transparency about
 * the system's ethical and operational constraints.
 *
 * @returns Promise that resolves when display is complete
 *
 * @example
 * await showMandate();
 * // Console output: [Dual-Use Mandate text]
 */
export async function showMandate(): Promise<void> {
  console.log(DUAL_USE_MANDATE);
}
