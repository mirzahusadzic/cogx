import { MissionConcept } from '../../analyzers/concept-extractor.js';
import { OverlayMetadata } from '../../algebra/overlay-algebra.js';

/**
 * Mission Concepts Overlay (O₄) - STRATEGIC VISION
 */
export interface MissionConceptsOverlay {
  document_hash: string; // Content hash of source document
  document_path: string; // Path to source markdown file
  extracted_concepts: MissionConcept[]; // Ranked concepts with 768d embeddings
  generated_at: string; // ISO timestamp
  transform_id: string; // Transform that generated this overlay
  format_version?: number; // 2 = embeddings in LanceDB, 1 or undefined = embeddings in YAML
}

/**
 * Metadata for mission concept overlay items
 */
export interface MissionConceptMetadata extends OverlayMetadata {
  text: string; // Concept text
  type: 'vision' | 'concept' | 'principle' | 'goal'; // Concept type
  weight: number; // Importance score (0-1)
  occurrences: number; // Frequency in document
  section: string; // Source section
  sectionHash: string; // Section hash for provenance
  documentHash: string; // Document hash for provenance
}
