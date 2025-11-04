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

/**
 * Cosine similarity between two vectors
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
 * Detect if message is a continuation request
 */
function isContinuationRequest(message: string): boolean {
  // Short messages with continuation keywords
  if (message.length < 100) {
    return /\b(implement|do it|continue|let'?s go|please do|make it|go ahead|proceed|start|begin)\b/i.test(
      message
    );
  }

  // Longer messages that start with continuation keywords
  if (
    /^(ok|yes|alright|sure|good),?\s+(implement|do it|let'?s|please|go)/i.test(
      message
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Calculate relevance score for a turn
 * Combines semantic similarity + importance + overlay activation
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
 * @param userMessage - The raw user input
 * @param turnAnalyses - In-memory turn analyses (the lattice)
 * @param embedder - Embedding service for semantic search
 * @param options - Configuration options
 * @returns Enhanced message with injected context (or original if not needed)
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
): Promise<string> {
  const {
    debug = false,
    minRelevance = 0.4,
    windowSize = 20,
    maxContextTurns = 3,
    maxSnippetLength = 400,
  } = options;

  // Skip if no history
  if (turnAnalyses.length === 0) {
    return userMessage;
  }

  // Skip if not a continuation request
  if (!isContinuationRequest(userMessage)) {
    if (debug) {
      console.log('[Context Injector] Not a continuation request, skipping');
    }
    return userMessage;
  }

  if (debug) {
    console.log('[Context Injector] Continuation detected, querying lattice');
  }

  try {
    // Embed the user message
    const embedResponse = await embedder.getEmbedding(userMessage, 768);
    const userEmbed = embedResponse.embedding;

    // Validate embedding is an array
    if (!Array.isArray(userEmbed)) {
      if (debug) {
        console.log('[Context Injector] Invalid embedding format, skipping');
      }
      return userMessage;
    }

    // Get recent turns (sliding window)
    const recentTurns = turnAnalyses.slice(-windowSize);

    // Filter to only important turns (skip routine/noise)
    const importantTurns = recentTurns.filter(
      (turn) => turn.importance_score >= 5 || turn.is_paradigm_shift
    );

    if (importantTurns.length === 0) {
      if (debug) {
        console.log('[Context Injector] No important turns found in window');
      }
      return userMessage;
    }

    // Score and rank turns by relevance
    const scoredTurns = importantTurns
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
        console.log(
          '[Context Injector] No turns above relevance threshold',
          minRelevance
        );
      }
      return userMessage;
    }

    if (debug) {
      console.log('[Context Injector] Found relevant context:');
      relevantTurns.forEach((scored, i) => {
        console.log(
          `  ${i + 1}. [Relevance: ${scored.relevance.toFixed(2)}] ${scored.turn.content.substring(0, 60)}...`
        );
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

    // Inject context before user message
    const enrichedMessage = `${contextSnippets.join('\n\n')}\n\n---\n\nBased on the above context:\n${userMessage}`;

    if (debug) {
      console.log('[Context Injector] Injected context successfully');
    }

    return enrichedMessage;
  } catch (err) {
    // On error, return original message (fail gracefully)
    if (debug) {
      console.error('[Context Injector] Error:', err);
    }
    return userMessage;
  }
}
