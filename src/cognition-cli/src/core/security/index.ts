/**
 * Security Module
 *
 * PURPOSE:
 * Defend against subtle lattice-based alignment attacks on mission documents.
 *
 * THREAT MODEL:
 * - Gradual mission poisoning through plausible PRs
 * - Trust erosion via social engineering
 * - Security weakening disguised as "pragmatism"
 * - Ambiguity injection to enable malicious interpretations
 *
 * PHILOSOPHY:
 * - 🔓 Advisory by default (warn, don't block)
 * - 🔍 Transparent (all detection logic documented)
 * - 👤 User control (easy to configure/disable)
 * - 🚫 No telemetry (all analysis local)
 * - 🤝 Augment humans (help reviewers, don't replace)
 *
 * COMPONENTS:
 * - MissionIntegrityMonitor: Immutable audit trail of mission versions
 * - SemanticDriftDetector: Pattern detection + embedding-based distance
 * - MissionValidatorService: Multi-layer pre-ingestion validation
 * - SecurityConfig: User-configurable settings
 *
 * USAGE:
 * ```typescript
 * import { MissionValidatorService, loadSecurityConfig } from './security/index.js';
 *
 * const config = await loadSecurityConfig(projectRoot);
 * const validator = new MissionValidatorService(pgcRoot, config);
 * const result = await validator.validate('VISION.md');
 *
 * if (!result.safe) {
 *   console.warn('Security concerns detected:', result.layers);
 * }
 * ```
 */

export {
  MissionIntegrityMonitor,
  type MissionVersion,
} from './mission-integrity.js';

export {
  SemanticDriftService,
  type DriftAnalysis,
} from '../services/security/drift.js';

export {
  MissionValidatorService,
  type ValidationLayer,
  type ValidationResult,
} from '../services/security/mission.js';

export {
  loadSecurityConfig,
  validateSecurityConfig,
  DEFAULT_SECURITY_CONFIG,
  type SecurityConfig,
  type SecurityMode,
} from './security-config.js';
