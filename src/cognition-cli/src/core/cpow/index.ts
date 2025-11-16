/**
 * cPOW Module - Cognitive Proof of Work System
 *
 * Exports core cPOW functionality:
 * - cPOW generation and verification
 * - AQS (Agentic Quality Score) computation
 * - Wisdom distillation (CoMP generation)
 * - Pattern querying and reuse
 *
 * REFERENCE: docs/manual/part-5-cpow-loop/20-cpow-reference.md
 */

// Types
export type {
  CPOW,
  CPOWOptions,
  FLTBResult,
  LayerResult,
  VerificationResult,
  AQSOptions,
  AQSResult,
  CoMP,
  CompactTransform,
  WisdomOptions,
  PatternQuery,
} from './types.js';

// cPOW Generation & Storage
export {
  generateCPOW,
  storeCPOW,
  loadCPOW,
  listCPOWs,
  computeStateHash,
  generateAndStoreCPOW,
} from './cpow-generator.js';

// cPOW Verification
export {
  verifyCPOW,
  verifyCPOWFromDisk,
  verifyStateChecksum,
} from './cpow-verifier.js';

// AQS Computation
export {
  computeAQS,
  getAQSThresholds,
  getAQSInterpretation,
} from './aqs-computer.js';

// Note: Wisdom distillation (CoMP) to be implemented:
// export { distillWisdom, queryPatterns } from './wisdom-distiller.js';
