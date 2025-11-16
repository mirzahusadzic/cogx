/**
 * Validation Module - Oracle integration and F.L.T.B validation
 *
 * Exports validation functionality:
 * - Oracle client for external transform validation
 * - Four-Layered Trust Boundary (F.L.T.B) validation
 *
 * REFERENCE: docs/manual/part-5-cpow-loop/20-cpow-reference.md
 */

// Oracle Client
export {
  evaluateTransform,
  mockEvaluateTransform,
  checkOracleHealth,
} from './oracle-client.js';

// Oracle Types
export type {
  OracleRequest,
  OracleResponse,
  EvaluateTransformOptions,
  StateSnapshot,
  TransformSummary,
} from '../types/oracle.js';

export {
  OracleError,
  OracleTimeoutError,
  OracleInvalidResponseError,
  createStateSnapshot,
  createTransformSummary,
} from '../types/oracle.js';

// Note: F.L.T.B validation to be implemented:
// export { validateFLTB } from './fltb.js';
