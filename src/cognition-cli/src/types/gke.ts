export interface SourceRecord {
  uri: string;
  hash: string;
  timestamp: Date;
  verified_by: string;
}

export interface GKe {
  content: string | Buffer;
  type:
    | 'raw_file'
    | 'file_summary'
    | 'component'
    | 'overlay'
    | 'structural_metadata';
  sr: SourceRecord;
  path: string;
  status: 'Valid' | 'Invalidated';
  history_ref: string; // transform hash
}

export interface Goal {
  objective: string;
  criteria: string[];
  phimin: number; // minimum acceptable fidelity
  weights?: {
    tools?: number;
    grounding?: number;
    goal_specific?: number;
  };
}

export interface Persona {
  name: string;
  type: 'developer' | 'log_analyst' | 'architect' | 'structure_extractor';
  system_message: string;
  constraints?: string[];
}
