import { OperationalKnowledge } from '../../analyzers/document-extractor.js';
import { OverlayMetadata } from '../../algebra/overlay-algebra.js';

/**
 * Operational Patterns Overlay (O₅) - WORKFLOW GUIDANCE
 *
 * Stores extracted workflow patterns for AI agent guidance.
 * This overlay captures HOW work gets done from process documents
 * (OPERATIONAL_LATTICE.md, workflows, etc.).
 *
 * LATTICE POSITION: O₅ (Operational)
 * - Respects security (O₂) - workflows must be secure
 * - Guided by mission (O₄) - processes serve strategic goals
 * - Informs coherence (O₇) - ensures code follows correct workflows
 *
 * PATTERN TYPES:
 * - quest_structure: Quest initialization patterns (What/Why/Success)
 * - sacred_sequence: Invariant step sequences (F.L.T.B)
 * - workflow_pattern: Process guidance (depth tracking, rebalancing)
 * - depth_rule: Depth-specific rules (Depth 0-3 guidance)
 * - terminology: Operational vocabulary (Quest, Oracle, AQS)
 * - explanation: Explanatory paragraphs from manuals
 *
 * USE CASES:
 * - Agent guidance: "How should I handle depth 2 work?"
 * - Workflow queries: "What's the sacred sequence for quests?"
 * - Process discovery: "What patterns exist for rebalancing?"
 * - Projection: O₁ (code state) → O₅ (next steps)
 *
 * EMBEDDINGS:
 * - Each pattern has a 768-dimensional vector from eGemma
 * - Enables semantic search: "How to initialize a new quest?"
 * - Supports projection queries across overlays
 *
 * DESIGN RATIONALE:
 * - Workflow knowledge: Capture tribal process knowledge
 * - Queryable: "What's the workflow for X?"
 * - Composable: Combine with code state for context-aware guidance
 * - Evolution: Track how processes change over time
 *
 * STORAGE:
 * - YAML: .open_cognition/overlays/operational_patterns/<doc_hash>.yaml
 * - LanceDB: .open_cognition/lance/documents.lancedb (overlay_type='O5')
 *
 * @example
 * // Query operational patterns semantically
 * const manager = new OperationalPatternsManager(pgcRoot);
 * const results = await manager.query('quest initialization', 5);
 *
 * @example
 * // Get sacred sequence patterns
 * const sequences = await manager.getItemsByType('sacred_sequence');
 *
 * @example
 * // Find depth-specific rules
 * const depthRules = await manager.getPatternsByType('depth_rule');
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
