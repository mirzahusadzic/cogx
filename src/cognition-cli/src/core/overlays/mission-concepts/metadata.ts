import { MissionConcept } from '../../analyzers/concept-extractor.js';
import { IBaseOverlayFindings, IBaseOverlayMetadata } from '../base-types.js';

/**
 * Mission Concepts Overlay (O₄) - STRATEGIC VISION
 *
 * Stores extracted mission-critical concepts for strategic coherence analysis.
 * This overlay captures the "WHY" and "WHAT" of the project from strategic
 * documents (VISION.md, ROADMAP.md, etc.).
 *
 * LATTICE POSITION: O₄ (Strategic)
 * - Above security (O₂) - mission must respect security constraints
 * - Composes with operational (O₅) - vision guides how work is done
 * - Drives coherence (O₇) - code alignment measured against mission
 *
 * CONCEPT TYPES:
 * - vision: High-level purpose and opportunity (the "why")
 * - principle: Core values and philosophies
 * - concept: Key ideas and themes
 * - goal: Strategic objectives and path forward
 *
 * USE CASES:
 * - Strategic coherence: "Does this code align with our mission?"
 * - Drift detection: "Which code has diverged from strategic intent?"
 * - Impact analysis: "Which code implements our core principles?"
 * - Q&A: "What does our vision say about verifiable AI?"
 *
 * EMBEDDINGS:
 * - Each concept has a 768-dimensional vector from eGemma
 * - Used for semantic alignment scoring in strategic coherence (O₇)
 * - Enables queries like: "What mission concepts relate to security?"
 *
 * DESIGN RATIONALE:
 * - Strategic alignment: Ensures code serves the mission
 * - Semantic search: Natural language queries over mission
 * - Provenance: Tracks which documents defined each concept
 * - Evolution: Track how mission concepts change over time
 *
 * STORAGE:
 * - YAML: .open_cognition/overlays/mission_concepts/<doc_hash>.yaml
 * - LanceDB: .open_cognition/lance/documents.lancedb (overlay_type='O4')
 *
 * @example
 * // Query mission concepts semantically
 * const manager = new MissionConceptsManager(pgcRoot);
 * const results = await manager.query('verifiable AI systems', 5);
 *
 * @example
 * // Get top mission concepts by weight
 * const top = await manager.getTopConcepts(10);
 * console.log('Top mission concepts:', top.map(c => c.text));
 *
 * @example
 * // Filter by concept type
 * const principles = await manager.getItemsByType('principle');
 */
export type MissionConceptsOverlay = IBaseOverlayFindings<
  MissionConcept,
  'extracted_concepts'
>;

/**
 * Metadata for mission concept overlay items
 */
export interface MissionConceptMetadata extends IBaseOverlayMetadata {
  type: 'vision' | 'mission' | 'principle' | 'goal' | 'value' | 'concept'; // Concept type
}
