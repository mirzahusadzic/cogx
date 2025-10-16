import { Goal } from './gke.js';

export interface TransformData {
  goal: Goal;
  inputs: string[];
  outputs: string[];
  method?: string;
  fidelity?: number;
  timestamp?: Date;
}
