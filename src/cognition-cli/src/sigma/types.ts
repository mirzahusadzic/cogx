/**
 * Context Sampling Sigma - Type Definitions
 *
 * Core types for conversation analysis, compression, and reconstruction.
 * Part of the AGPLv3 cognition-cli project.
 */

/**
 * Overlay activation scores (0-10 scale)
 * Maps to O1-O7 overlay system
 */
export interface OverlayScores {
  O1_structural: number; // Architecture, components, design
  O2_security: number; // Credentials, permissions, vulnerabilities
  O3_lineage: number; // Cross-references, "as we discussed"
  O4_mission: number; // Goals, strategic planning
  O5_operational: number; // Commands, workflows, execution
  O6_mathematical: number; // Code, algorithms, formulas
  O7_strategic: number; // Validation, testing, reflection
}

/**
 * A single conversation turn (user or assistant message)
 */
export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/**
 * Context for analyzing a conversation
 */
export interface ConversationContext {
  projectRoot: string;
  sessionId?: string;
  history: ConversationTurn[];
}

/**
 * Analysis result for a single turn
 */
export interface TurnAnalysis {
  turn_id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: number;

  // Overlay activation (0-10 per overlay)
  overlay_scores: OverlayScores;

  // Importance metrics
  importance_score: number; // 1-10 overall
  is_paradigm_shift: boolean; // High I.P.S. moment
  is_routine: boolean; // Low importance (< 3)

  // Relationships
  references: string[]; // Turn IDs this relates to
  semantic_tags: string[]; // Keywords for retrieval
}

/**
 * Compression result
 */
export interface CompressionResult {
  original_size: number; // Tokens before
  compressed_size: number; // Tokens after
  compression_ratio: number; // original / compressed

  lattice: ConversationLattice; // Graph representation

  preserved_turns: string[]; // High-importance kept verbatim
  summarized_turns: string[]; // Medium-importance compressed
  discarded_turns: string[]; // Low-importance removed

  metrics: {
    paradigm_shifts: number; // Count of high I.P.S. moments
    routine_turns: number; // Count of low importance
    avg_importance: number; // Average importance score
  };
}

/**
 * Reconstructed context for a query
 */
export interface ReconstructedContext {
  prompt: string; // Context for Claude
  turns_included: string[]; // Which turns used
  token_count: number; // Size of reconstructed context
  relevance_score: number; // How relevant to query (0-1)

  overlay_activation: Partial<OverlayScores>; // Which overlays were used
}

/**
 * Conversation node in the lattice
 */
export interface ConversationNode {
  id: string;
  type: 'conversation_turn';
  turn_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;

  // Sigma metadata
  overlay_scores: OverlayScores;
  importance_score: number;
  is_paradigm_shift: boolean;
  semantic_tags: string[];
}

/**
 * Edge connecting conversation turns
 */
export interface ConversationEdge {
  from: string; // Turn ID
  to: string; // Turn ID
  type: 'conversation_reference' | 'semantic_similarity' | 'temporal';
  weight: number; // Relationship strength (0-1)
}

/**
 * Conversation lattice (extends base Lattice)
 */
export interface ConversationLattice {
  nodes: ConversationNode[];
  edges: ConversationEdge[];

  metadata: {
    session_id?: string;
    created_at: number;
    original_turn_count: number;
    compressed_turn_count: number;
    compression_ratio: number;
  };
}

/**
 * Options for analyzer
 */
export interface AnalyzerOptions {
  // Minimum score to consider overlay active (default: 5)
  overlay_threshold?: number;

  // Minimum importance to preserve verbatim (default: 7)
  paradigm_shift_threshold?: number;

  // Maximum importance to discard (default: 3)
  routine_threshold?: number;
}

/**
 * Options for compressor
 */
export interface CompressorOptions {
  // Target size in tokens (default: 40000)
  target_size?: number;

  // Whether to use LLM for semantic summarization (default: false)
  use_llm_summary?: boolean;

  // Minimum importance to preserve (default: 7)
  preserve_threshold?: number;
}

/**
 * Options for reconstructor
 */
export interface ReconstructorOptions {
  // Token budget for reconstruction (default: 40000)
  token_budget?: number;

  // Maximum nodes to include (default: 50)
  max_nodes?: number;

  // Sort by importance or recency (default: 'importance')
  sort_by?: 'importance' | 'recency';

  // Include temporal neighbors (default: true)
  include_neighbors?: boolean;
}
