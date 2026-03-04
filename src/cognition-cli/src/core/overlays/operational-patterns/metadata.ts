import { OperationalKnowledge } from '../../analyzers/document-extractor.js';
import { OverlayMetadata } from '../../algebra/overlay-algebra.js';

/**
 * Operational Patterns Overlay (O₅) - WORKFLOW GUIDANCE
 */
export interface OperationalPatternsOverlay {
  document_hash: string; // Content hash of source document
  document_path: string; // Path to source markdown file
  extracted_patterns: OperationalKnowledge[]; // Workflow patterns with embeddings
  generated_at: string; // ISO timestamp
  transform_id: string; // Transform that generated this overlay
  format_version?: number; // 2 = embeddings in LanceDB, 1 or undefined = embeddings in YAML
}

/**
 * Metadata for operational overlay items
 */
export interface OperationalMetadata extends OverlayMetadata {
  text: string;
  type:
    | 'quest_structure'
    | 'sacred_sequence'
    | 'workflow_pattern'
    | 'depth_rule'
    | 'terminology'
    | 'explanation';
  patternType: string; // For backward compatibility
  weight: number;
  occurrences: number;
  section: string;
  sectionHash: string;
  documentHash: string;
  steps?: string[];
  formula?: string;
  example?: string;
}
