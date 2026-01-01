/**
 * Real-Time Lattice Context Injector
 *
 * Intelligently injects relevant context from the conversation lattice
 * when user makes continuation requests during fluent conversation.
 *
 * Unlike the recall tool (which requires explicit LLM call), this:
 * - Works transparently in real-time
 * - Uses in-memory lattice data (turnAnalyses)
 * - Filters by overlay activation + importance scores
 * - Only injects when needed (high O3 lineage detected)
 */

import type { TurnAnalysis } from './types.js';
import type { EmbeddingService } from '../core/services/embedding.js';
import { systemLog } from '../utils/debug-logger.js';

/**
 * Cosine similarity between two vectors
 *
 * Formula: dot(a, b) / (||a|| × ||b||)
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Similarity score from -1 (opposite) to 1 (identical)
 *
 * @throws Error if vectors have different dimensions
 *
 * @private
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimensions');
  }

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  if (magA === 0 || magB === 0) return 0;

  return dotProduct / (magA * magB);
}

/**
 * Calculate relevance score for a turn
 *
 * Combines three signals:
 * 1. Semantic similarity (cosine distance between embeddings)
 * 2. Importance boost (1-10 scale → 1.0-2.0x multiplier)
 * 3. Overlay boost (O1+O5+O4 activation → 0-2x multiplier)
 *
 * @param turn - Turn analysis with embedding and scores
 * @param queryEmbedding - Embedded user query
 * @returns Combined relevance score
 *
 * @private
 */
function calculateRelevance(
  turn: TurnAnalysis,
  queryEmbedding: number[]
): number {
  // Base similarity
  const similarity = cosineSimilarity(queryEmbedding, turn.embedding);

  // Importance boost (0-10 scale → 0-1 multiplier)
  const importanceBoost = 1 + turn.importance_score / 10;

  // Overlay boost for implementation-relevant overlays
  // O1 (structural) + O5 (operational) + O4 (mission)
  const overlayScore =
    turn.overlay_scores.O1_structural +
    turn.overlay_scores.O5_operational +
    turn.overlay_scores.O4_mission;

  const overlayBoost = 1 + overlayScore / 30; // 0-30 scale → 0-2x multiplier

  // Combined relevance
  return similarity * importanceBoost * overlayBoost;
}

/**
 * Inject relevant context from lattice into user message
 *
 * ALGORITHM:
 * 1. Embed user query
 * 2. Get recent turns (sliding window) + ALL paradigm shifts
 * 3. Score all candidates by semantic relevance (similarity × importance × overlay)
 * 4. Take top-K above relevance threshold
 * 5. Inject context snippets before user message
 *
 * DESIGN:
 * - Transparent real-time injection (no explicit LLM call)
 * - Uses in-memory lattice data (turnAnalyses)
 * - Filters by overlay activation (O1 structural + O5 operational + O4 mission)
 * - Always includes paradigm shifts for critical context
 *
 * @param userMessage - The raw user input
 * @param turnAnalyses - In-memory turn analyses (the lattice)
 * @param embedder - Embedding service for semantic search
 * @param options - Configuration options (thresholds, window size, max context)
 * @returns Object with enhanced message and embedding (for reuse)
 *
 * @example
 * const result = await injectRelevantContext(
 *   "continue with the TUI refactor",
 *   turnAnalyses,
 *   embedder,
 *   { minRelevance: 0.4, maxContextTurns: 5 }
 * );
 * // result.message now includes relevant past context automatically
 */
export async function injectRelevantContext(
  userMessage: string,
  turnAnalyses: TurnAnalysis[],
  embedder: EmbeddingService,
  options: {
    /** Enable debug logging */
    debug?: boolean;
    /** Minimum relevance score to inject context (0-1) */
    minRelevance?: number;
    /** Number of recent turns to consider */
    windowSize?: number;
    /** Maximum context turns to inject */
    maxContextTurns?: number;
    /** Maximum characters per context snippet */
    maxSnippetLength?: number;
  } = {}
): Promise<{ message: string; embedding: number[] | null }> {
  const {
    debug = false,
    minRelevance = 0.35, // Lower threshold to catch more relevant context
    windowSize = 50, // Increased from 20 to scan more history
    maxContextTurns = 5, // Increased from 3 to inject more context
    maxSnippetLength = 500, // Increased from 400 for more detail
  } = options;

  // Skip if no history
  if (turnAnalyses.length === 0) {
    return { message: userMessage, embedding: null };
  }

  if (debug) {
    systemLog(
      'sigma',
      'Querying lattice for relevant context',
      undefined,
      'info'
    );
  }

  try {
    // Embed the user message
    const embedResponse = await embedder.getEmbedding(userMessage, 768);

    // eGemma returns embedding with dimension in key name: "embedding_768d"
    // Try multiple possible response formats for compatibility
    const userEmbed =
      (embedResponse['embedding_768d'] as number[]) ||
      (embedResponse['vector'] as number[]) ||
      (embedResponse['embedding'] as number[]) ||
      (embedResponse['embeddings'] as number[]) ||
      (embedResponse['data'] as number[]);

    // Validate embedding is an array
    if (!Array.isArray(userEmbed)) {
      if (debug) {
        systemLog(
          'sigma',
          'Invalid embedding format, skipping',
          { keys: Object.keys(embedResponse) },
          'warn'
        );
      }
      return { message: userMessage, embedding: null };
    }

    // Get recent turns (sliding window)
    // Also include ALL paradigm shifts regardless of recency
    const recentTurns = turnAnalyses.slice(-windowSize);
    const paradigmShifts = turnAnalyses.filter(
      (t) => t.is_paradigm_shift && !recentTurns.includes(t)
    );

    // Combine recent turns with paradigm shifts for comprehensive context
    const allCandidates = [...recentTurns, ...paradigmShifts];

    // Score and rank ALL turns by semantic relevance
    // Importance is already factored into relevance calculation, no need to pre-filter
    const scoredTurns = allCandidates
      .map((turn) => ({
        turn,
        relevance: calculateRelevance(turn, userEmbed),
      }))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxContextTurns);

    // Filter by minimum relevance threshold
    const relevantTurns = scoredTurns.filter(
      (scored) => scored.relevance >= minRelevance
    );

    if (relevantTurns.length === 0) {
      if (debug) {
        systemLog(
          'sigma',
          'No turns above relevance threshold',
          { minRelevance },
          'info'
        );
      }
      return { message: userMessage, embedding: userEmbed };
    }

    if (debug) {
      systemLog('sigma', 'Found relevant context', {
        count: relevantTurns.length,
        relevanceScores: relevantTurns.map((t) => t.relevance.toFixed(2)),
      });
    }

    // Build context snippets
    const contextSnippets = relevantTurns.map((scored, idx) => {
      const turn = scored.turn;
      const snippet =
        turn.content.length > maxSnippetLength
          ? turn.content.substring(0, maxSnippetLength) + '...'
          : turn.content;

      // Include role and importance for clarity
      const roleLabel = turn.role === 'user' ? 'You asked' : 'I explained';
      return `[Recent context ${idx + 1}] ${roleLabel}:\n${snippet}`;
    });

    // Inject context as supporting information after user message
    const enrichedMessage = `${userMessage}\n\n---\n\n**Recent context for reference:**\n\n${contextSnippets.join('\n\n')}`;

    if (debug) {
      systemLog('sigma', 'Injected context successfully');
    }

    return { message: enrichedMessage, embedding: userEmbed };
  } catch (err) {
    // On error, return original message (fail gracefully)
    if (debug) {
      systemLog(
        'sigma',
        'Context injection failed',
        { error: err instanceof Error ? err.message : String(err) },
        'error'
      );
    }
    return { message: userMessage, embedding: null };
  }
}
