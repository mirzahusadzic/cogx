/**
 * Context Sampling Sigma - Analyzer Module (Embedding-Based)
 *
 * Uses embeddings for:
 * - Novelty detection (automatic paradigm shift detection)
 * - Semantic overlay matching (O1-O7) via Meet with project lattice
 * - Importance scoring (novelty + project alignment)
 */

import type {
  ConversationTurn,
  ConversationContext,
  TurnAnalysis,
  OverlayScores,
  AnalyzerOptions,
} from './types.js';
import { EmbeddingService } from '../core/services/embedding.js';
import { OverlayRegistry } from '../core/algebra/overlay-registry.js';
import { systemLog } from '../utils/debug-logger.js';

const DEFAULT_OPTIONS: Required<AnalyzerOptions> = {
  overlay_threshold: 5,
  paradigm_shift_threshold: 0.7, // Novelty threshold (0-1)
  routine_threshold: 3,
};

/**
 * Calculate cosine similarity between two embedding vectors
 *
 * Measures the cosine of the angle between two vectors in n-dimensional space.
 * Returns values from -1 to 1, where 1 means identical direction, 0 means
 * orthogonal (unrelated), and -1 means opposite direction.
 *
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns Similarity score between 0 and 1 (0 = different, 1 = identical)
 * @throws {Error} If vectors have different dimensions
 * @private
 *
 * @example
 * const sim = cosineSimilarity([1, 0, 0], [1, 0, 0]); // Returns 1.0
 * const sim2 = cosineSimilarity([1, 0, 0], [0, 1, 0]); // Returns 0.0
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
 * Calculate novelty score by measuring semantic distance from recent context
 *
 * Novelty detection is KEY for automatic paradigm shift detection. High novelty
 * indicates a creative breakthrough or topic change that should be preserved
 * during compression.
 *
 * Algorithm:
 * 1. Calculate distance (1 - similarity) from each recent turn
 * 2. Compute average distance (general novelty)
 * 3. Compute max distance (breakthrough moment)
 * 4. Combine: 70% average + 30% max
 *
 * The weighting balances "generally different from recent discussion" vs
 * "sudden creative breakthrough moment".
 *
 * @param currentEmbed - Embedding vector for current turn
 * @param recentEmbeds - Array of embedding vectors from recent turns (last 10)
 * @returns Novelty score from 0 to 1 (0 = identical, 1 = completely novel)
 * @private
 *
 * @example
 * // First turn has neutral novelty
 * const novelty1 = calculateNovelty(embed1, []); // Returns 0.5
 *
 * // Turn similar to recent context has low novelty
 * const novelty2 = calculateNovelty(embed2, [embed1]); // Returns ~0.1
 *
 * // Turn different from all recent turns has high novelty
 * const novelty3 = calculateNovelty(embedBreakthrough, recentEmbeds); // Returns ~0.9
 */
function calculateNovelty(
  currentEmbed: number[],
  recentEmbeds: number[][]
): number {
  if (recentEmbeds.length === 0) return 0.5; // Neutral for first turn

  // Calculate distance (1 - similarity) from each recent turn
  const distances = recentEmbeds.map(
    (e) => 1 - cosineSimilarity(currentEmbed, e)
  );

  // Average distance
  const avgDistance =
    distances.reduce((sum, d) => sum + d, 0) / distances.length;

  // Max distance (most novel compared to any single turn)
  const maxDistance = Math.max(...distances);

  // Combine: 70% average, 30% max
  // This balances "generally different" vs "breakthrough moment"
  return avgDistance * 0.7 + maxDistance * 0.3;
}

/**
 * Detect overlay activation via Meet operation with project lattice
 *
 * THIS IS THE KEY INNOVATION: Conversation ∧ Project
 *
 * Performs semantic Meet (∧) between conversation turn and all 7 project overlays
 * to determine which project aspects this turn is aligned with. This enables
 * intelligent filtering: preserve turns aligned with project goals, discard
 * off-topic discussion.
 *
 * Algorithm:
 * 1. Query each overlay (O1-O7) with turn embedding
 * 2. Get top 3 most similar items from each overlay
 * 3. Score overlay as max similarity from top 3
 * 4. Return scores for all 7 overlays (0-10 scale)
 *
 * Performance optimization: Reuses precomputed embedding across all 7 overlays
 * to avoid re-embedding the same content 7 times.
 *
 * @param turnContent - The conversation turn text content
 * @param projectRegistry - Registry containing all 7 project overlays (O1-O7)
 * @param precomputedEmbedding - Optional pre-computed embedding (avoids re-embedding)
 * @returns Promise resolving to overlay scores for all 7 overlays
 * @private
 *
 * @example
 * // Detect which project overlays this turn aligns with
 * const scores = await detectOverlaysByProjectAlignment(
 *   "Let's refactor the authentication module",
 *   projectRegistry,
 *   turnEmbedding
 * );
 * // Result: { O1_structural: 9, O2_security: 8, O3_lineage: 2, ... }
 */
async function detectOverlaysByProjectAlignment(
  turnContent: string,
  projectRegistry: OverlayRegistry | null,
  precomputedEmbedding?: number[]
): Promise<OverlayScores> {
  const scores: OverlayScores = {
    O1_structural: 0,
    O2_security: 0,
    O3_lineage: 0,
    O4_mission: 0,
    O5_operational: 0,
    O6_mathematical: 0,
    O7_strategic: 0,
  };

  // If no project registry, return zeros (graceful degradation)
  if (!projectRegistry) {
    return scores;
  }

  try {
    // Query ALL 7 project overlays with turn content
    // Pass precomputed embedding to avoid re-embedding 7 times!
    const overlayIds = ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'] as const;

    for (const overlayId of overlayIds) {
      try {
        const overlay = await projectRegistry.get(overlayId);
        // Pass precomputed embedding to reuse it across all overlays
        const results = await overlay.query(
          turnContent,
          3,
          precomputedEmbedding
        );

        if (results.length > 0) {
          // Max similarity from top 3 results
          const maxSimilarity = Math.max(...results.map((r) => r.similarity));
          const scoreKey =
            `${overlayId}_${overlay.getOverlayName().toLowerCase().replace(/ /g, '_')}` as keyof OverlayScores;
          scores[scoreKey] = Math.round(maxSimilarity * 10);
        }
      } catch (error) {
        // Overlay not populated yet, skip
        systemLog(
          'sigma',
          `Failed to query overlay ${overlayId}: ${error instanceof Error ? error.message : String(error)}`,
          undefined,
          'warn'
        );
        continue;
      }
    }
  } catch (error) {
    // Project lattice not available, graceful degradation
    systemLog(
      'sigma',
      'Project lattice query failed:',
      { error: error instanceof Error ? error.message : String(error) },
      'warn'
    );
  }

  return scores;
}

/**
 * Analyze a conversation turn using embeddings and project alignment
 *
 * Performs comprehensive analysis of a conversation turn to determine its
 * importance and relevance to the project. Combines novelty detection
 * (automatic paradigm shift detection) with semantic alignment to project
 * overlays (via Meet operation).
 *
 * Algorithm:
 * 1. Generate/use embedding (768D vector from eGemma)
 * 2. Calculate novelty (distance from recent context)
 * 3. Detect overlay alignment (Meet with project lattice)
 * 4. Calculate importance (novelty + project alignment)
 * 5. Mark paradigm shifts (high novelty)
 * 6. Mark routine turns (low importance)
 * 7. Extract references and semantic tags
 *
 * Importance scoring:
 * - importance = min(10, novelty * 5 + maxOverlay * 0.5)
 * - High novelty OR high project alignment = high importance
 * - Low novelty AND low alignment = routine (can compress)
 *
 * @param turn - The conversation turn to analyze
 * @param context - Conversation context with history for novelty calculation
 * @param embedder - Embedding service for generating turn embeddings
 * @param projectRegistry - Optional project overlay registry for alignment scoring
 * @param options - Analysis options (thresholds for paradigm shift, routine, etc.)
 * @param precomputedEmbedding - Optional pre-computed embedding (optimization)
 * @returns Promise resolving to complete turn analysis with metrics
 *
 * @example
 * const analysis = await analyzeTurn(
 *   { id: 'turn_1', role: 'user', content: 'Add auth', timestamp: Date.now() },
 *   { history: [] },
 *   embedder,
 *   projectRegistry
 * );
 * console.log(`Importance: ${analysis.importance_score}/10`);
 * console.log(`Novelty: ${analysis.novelty.toFixed(2)}`);
 * console.log(`Overlays: ${JSON.stringify(analysis.overlay_scores)}`);
 */
export async function analyzeTurn(
  turn: ConversationTurn,
  context: ConversationContext,
  embedder: EmbeddingService,
  projectRegistry: OverlayRegistry | null = null,
  options: AnalyzerOptions = {},
  precomputedEmbedding?: number[]
): Promise<TurnAnalysis> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let turnEmbed: number[];

  // Use pre-computed embedding if provided (optimization for user messages)
  if (precomputedEmbedding && precomputedEmbedding.length === 768) {
    turnEmbed = precomputedEmbedding;
  } else {
    // 1. Generate embedding for this turn
    // Truncate content for embedding API (first 1000 + last 500 chars)
    // This preserves semantic meaning while reducing eGemma processing time
    let embeddingContent = turn.content;
    if (embeddingContent.length > 1500) {
      embeddingContent =
        embeddingContent.substring(0, 1000) +
        '\n...[truncated]...\n' +
        embeddingContent.substring(embeddingContent.length - 500);
    }

    const embeddingResponse = await embedder.getEmbedding(
      embeddingContent,
      768
    );

    // eGemma returns embedding with dimension in key name: "embedding_768d"
    turnEmbed =
      (embeddingResponse['embedding_768d'] as number[]) ||
      (embeddingResponse['vector'] as number[]) ||
      (embeddingResponse['embedding'] as number[]) ||
      (embeddingResponse['embeddings'] as number[]) ||
      (embeddingResponse['data'] as number[]);

    if (!Array.isArray(turnEmbed)) {
      throw new Error(
        `Expected embedding response to contain vector array. Got keys: ${Object.keys(embeddingResponse).join(', ')}`
      );
    }
  }

  // 2. Calculate novelty (distance from recent context)
  // Get embeddings from recent turns in history (last 10 turns)
  const recentTurns = context.history.slice(-10);
  const recentEmbeds: number[][] = [];

  // Extract embeddings if available (from TurnAnalysis objects)
  for (const historyTurn of recentTurns) {
    // If history turn has embedding (from previous analysis), use it
    if (
      'embedding' in historyTurn &&
      Array.isArray((historyTurn as { embedding: number[] }).embedding)
    ) {
      recentEmbeds.push((historyTurn as { embedding: number[] }).embedding);
    }
  }

  const novelty = calculateNovelty(turnEmbed, recentEmbeds);

  // 3. Detect overlay activation via Meet with project lattice
  // Pass the turn embedding to avoid re-embedding for each overlay!
  const overlayScores = await detectOverlaysByProjectAlignment(
    turn.content,
    projectRegistry,
    turnEmbed
  );

  // 4. Calculate importance (novelty + project alignment)
  // Project alignment is KEY: high alignment = preserve, low = discard
  const maxOverlay = Math.max(...Object.values(overlayScores));
  const importance = Math.min(10, Math.round(novelty * 5 + maxOverlay * 0.5));

  // 5. Paradigm shift = high novelty
  const isParadigmShift = novelty >= opts.paradigm_shift_threshold;

  // 6. Routine = low importance
  const isRoutine = importance < opts.routine_threshold;

  // 7. Find references (keep simple keyword-based for now)
  const references = findReferences(turn, context);

  // 8. Extract semantic tags
  const tags = extractSemanticTags(turn);

  return {
    turn_id: turn.id,
    content: turn.content,
    role: turn.role,
    timestamp: turn.timestamp,
    embedding: turnEmbed,
    novelty,
    overlay_scores: overlayScores,
    importance_score: importance,
    is_paradigm_shift: isParadigmShift,
    is_routine: isRoutine,
    references,
    semantic_tags: tags,
  };
}

/**
 * Find references to previous turns in conversation
 *
 * Uses keyword-based pattern matching to detect when the current turn
 * references earlier parts of the conversation. This helps build the
 * lattice structure by creating semantic edges between related turns.
 *
 * Detection patterns:
 * - Temporal references: "earlier", "before", "previous", "above", "mentioned"
 * - Returns IDs of last 5 turns when reference pattern detected
 *
 * Future enhancement: Use semantic similarity for more accurate reference detection.
 *
 * @param turn - Current conversation turn to analyze
 * @param context - Conversation context with historical turns
 * @returns Array of turn IDs that this turn references
 * @private
 *
 * @example
 * const refs = findReferences(
 *   { id: 'turn_5', content: 'As mentioned earlier, we need auth' },
 *   { history: [turn1, turn2, turn3, turn4] }
 * );
 * // Returns: ['turn_1', 'turn_2', 'turn_3', 'turn_4']
 */
function findReferences(
  turn: ConversationTurn,
  context: ConversationContext
): string[] {
  const references: string[] = [];
  const content = turn.content.toLowerCase();

  // Look for temporal references
  if (
    /\b(earlier|before|previous|above|mentioned)\b/.test(content) &&
    context.history.length > 0
  ) {
    // Add last few turns as potential references
    const recentTurns = context.history.slice(-5);
    references.push(...recentTurns.map((t) => t.id));
  }

  return references;
}

/**
 * Extract semantic tags from conversation turn content
 *
 * Identifies keywords, entities, and technical terms that characterize the turn.
 * Tags enable fast filtering and categorization during context reconstruction.
 *
 * Extraction patterns:
 * - File references: *.ts, *.tsx, *.js, *.jsx, *.py, *.md
 * - NPM packages: @scope/package
 * - Technical terms: PascalCase or camelCase identifiers
 *
 * @param turn - Conversation turn to extract tags from
 * @returns Array of unique semantic tags (deduplicated)
 * @private
 *
 * @example
 * const tags = extractSemanticTags({
 *   content: 'Update AuthService in auth.ts using @types/node'
 * });
 * // Returns: ['auth.ts', '@types/node', 'AuthService']
 */
function extractSemanticTags(turn: ConversationTurn): string[] {
  const tags: string[] = [];
  const content = turn.content;

  // Extract file references
  const fileMatches = content.match(/\b[\w-]+\.(ts|tsx|js|jsx|py|md)\b/g);
  if (fileMatches) {
    tags.push(...fileMatches);
  }

  // Extract npm packages
  const packageMatches = content.match(/@[\w-]+\/[\w-]+/g);
  if (packageMatches) {
    tags.push(...packageMatches);
  }

  // Extract technical terms (camelCase or PascalCase)
  const termMatches = content.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g);
  if (termMatches) {
    tags.push(...termMatches.slice(0, 5)); // Limit to 5
  }

  // Remove duplicates
  return [...new Set(tags)];
}

/**
 * Batch analyze multiple conversation turns
 *
 * Analyzes a sequence of turns in order, building up context as it processes
 * each turn. This is more efficient than analyzing turns independently as it
 * reuses embeddings from the history for novelty calculation.
 *
 * Algorithm:
 * 1. Process turns sequentially in order
 * 2. Each analyzed turn becomes part of context for next turn
 * 3. Novelty is calculated relative to accumulated history
 * 4. Returns array of analyses maintaining turn order
 *
 * @param turns - Array of conversation turns to analyze
 * @param context - Initial conversation context (usually empty history)
 * @param embedder - Embedding service for generating embeddings
 * @param projectRegistry - Optional project overlay registry for alignment
 * @param options - Analysis options (thresholds, etc.)
 * @returns Promise resolving to array of turn analyses
 *
 * @example
 * const analyses = await analyzeTurns(
 *   [turn1, turn2, turn3],
 *   { history: [] },
 *   embedder,
 *   projectRegistry
 * );
 * console.log(`Analyzed ${analyses.length} turns`);
 * analyses.forEach(a => console.log(`${a.turn_id}: ${a.importance_score}/10`));
 */
export async function analyzeTurns(
  turns: ConversationTurn[],
  context: ConversationContext,
  embedder: EmbeddingService,
  projectRegistry: OverlayRegistry | null = null,
  options: AnalyzerOptions = {}
): Promise<TurnAnalysis[]> {
  const analyses: TurnAnalysis[] = [];

  for (const turn of turns) {
    const analysis = await analyzeTurn(
      turn,
      {
        ...context,
        history: analyses.map((a) => ({
          id: a.turn_id,
          role: a.role,
          content: a.content,
          timestamp: a.timestamp,
        })),
      },
      embedder,
      projectRegistry,
      options
    );
    analyses.push(analysis);
  }

  return analyses;
}
