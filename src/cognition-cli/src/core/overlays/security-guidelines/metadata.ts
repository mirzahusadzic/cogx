import { SecurityKnowledge } from '../../analyzers/document-extractor.js';
import { IBaseOverlayFindings, IBaseOverlayMetadata } from '../base-types.js';

/**
 * Security Guidelines Overlay (O₂) - FOUNDATIONAL LAYER
 *
 * Stores extracted security knowledge for safe development guidance.
 * This is the foundational security layer in the lattice - checked BEFORE
 * mission alignment to ensure safety constraints are never violated.
 *
 * LATTICE POSITION: O₂ (Foundational)
 * - Below mission (O₄) - security constraints cannot be overridden by mission
 * - Composes with operational (O₅) - guides secure workflows
 * - Informs coherence (O₇) - ensures aligned code is also secure
 *
 * KNOWLEDGE TYPES:
 * - threat_model: Attack scenarios and threat actors
 * - attack_vector: Specific exploit methods (SQL injection, XSS, etc.)
 * - mitigation: Countermeasures and defenses
 * - boundary: Security boundaries and trust zones
 * - constraint: Security requirements and policies
 * - vulnerability: Known issues, CVEs from dependencies
 *
 * PORTABILITY (.cogx):
 * O₂ overlays can be exported/imported for security knowledge reuse:
 * ```
 * express.cogx → O₂ (CVEs, safe patterns)
 *   ↓ import
 * Your Project → Inherits express security knowledge
 *   ↓ query
 * "Safe input handling?" → Combines your O₂ + express O₂
 * ```
 *
 * DESIGN RATIONALE:
 * - Foundational: Security is never negotiable
 * - Portable: Reuse security knowledge across projects
 * - Queryable: "What mitigations exist for X attack?"
 * - Composable: Combine project + dependency security layers
 *
 * STORAGE:
 * - YAML: .open_cognition/overlays/security_guidelines/<doc_hash>.yaml
 * - LanceDB: .open_cognition/lance/documents.lancedb (overlay_type='O2')
 *
 * @example
 * // Query security guidelines semantically
 * const manager = new SecurityGuidelinesManager(pgcRoot);
 * const results = await manager.query('SQL injection prevention', 5);
 *
 * @example
 * // Get all CVEs
 * const cves = await manager.getCVEs();
 * console.log(`Found ${cves.length} known vulnerabilities`);
 *
 * @example
 * // Export for .cogx packaging
 * const overlay = await manager.exportForCogx(documentHash);
 * // Import into another project
 * await otherManager.importFromCogx(overlay, 'express', 'abc123');
 */
export type SecurityGuidelinesOverlay = IBaseOverlayFindings<
  SecurityKnowledge,
  'extracted_knowledge'
>;

/**
 * Metadata for security overlay items
 */
export interface SecurityMetadata extends IBaseOverlayMetadata {
  /** Security finding classification */
  type:
    | 'threat_model'
    | 'attack_vector'
    | 'mitigation'
    | 'boundary'
    | 'constraint'
    | 'vulnerability';
  severity: 'critical' | 'high' | 'medium' | 'low';
  cveId?: string;
  affectedVersions?: string;
  mitigation?: string;
  references?: string[];
}
