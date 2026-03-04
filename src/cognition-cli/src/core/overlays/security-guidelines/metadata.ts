import { SecurityKnowledge } from '../../analyzers/document-extractor.js';
import { OverlayMetadata } from '../../algebra/overlay-algebra.js';

/**
 * Security Guidelines Overlay (O₂) - FOUNDATIONAL LAYER
 */
export interface SecurityGuidelinesOverlay {
  document_hash: string; // Content hash of source document
  document_path: string; // Path to source markdown file
  extracted_knowledge: SecurityKnowledge[]; // Security patterns with embeddings
  generated_at: string; // ISO timestamp
  transform_id: string; // Transform that generated this overlay
  source_project?: string; // For imported .cogx files
  source_commit?: string; // Git commit hash (provenance)
  format_version?: number; // 2 = embeddings in LanceDB, 1 or undefined = embeddings in YAML
}

/**
 * Metadata for security overlay items
 */
export interface SecurityMetadata extends OverlayMetadata {
  text: string;
  securityType:
    | 'threat_model'
    | 'attack_vector'
    | 'mitigation'
    | 'boundary'
    | 'constraint'
    | 'vulnerability';
  severity: 'critical' | 'high' | 'medium' | 'low';
  weight: number;
  occurrences: number;
  section: string;
  sectionHash: string;
  documentHash: string;
  cveId?: string;
  affectedVersions?: string;
  mitigation?: string;
  references?: string[];
}
