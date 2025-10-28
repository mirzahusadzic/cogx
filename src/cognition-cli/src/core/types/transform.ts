/**
 * Represents an input artifact consumed by a transformation.
 */
export interface TransformInput {
  path: string;
  hash: string;
}

/**
 * Represents an output artifact produced by a transformation.
 */
export interface TransformOutput {
  path: string;
  hash: string;
}

/**
 * Represents the outcome of a transformation verification check.
 */
export interface VerificationResult {
  status: 'Success' | 'Failure';
  details?: string;
}

/**
 * Represents the objective and acceptance criteria for a transformation.
 */
export interface GoalData {
  objective: string;
  criteria: string[];
  phimin: number;
}

/**
 * Represents a complete transformation record with inputs, outputs, and verification data.
 */
export interface TransformData {
  goal: GoalData;
  phi: number;
  verification_result: VerificationResult;
  inputs: TransformInput[];
  outputs: TransformOutput[];
  method?: string;
  fidelity?: number;
}
