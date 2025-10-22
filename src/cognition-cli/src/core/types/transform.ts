export interface TransformInput {
  path: string;
  hash: string;
}

export interface TransformOutput {
  path: string;
  hash: string;
}

export interface VerificationResult {
  status: 'Success' | 'Failure';
  details?: string;
}

export interface GoalData {
  objective: string;
  criteria: string[];
  phimin: number;
}

export interface TransformData {
  goal: GoalData;
  phi: number;
  verification_result: VerificationResult;
  inputs: TransformInput[];
  outputs: TransformOutput[];
  method?: string;
  fidelity?: number;
}
