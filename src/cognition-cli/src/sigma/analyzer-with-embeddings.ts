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

const DEFAULT_OPTIONS: Required<AnalyzerOptions> = {
  overlay_threshold: 5,
  paradigm_shift_threshold: 0.7, // Novelty threshold (0-1)
  routine_threshold: 3,
};

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
 * Calculate novelty (distance from recent context)
 * Returns 0-1 where 1 = completely novel, 0 = identical to recent
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
 * Detect overlay activation via Meet with project lattice
 * This is the KEY INNOVATION: Conversation ∧ Project
 */
async function detectOverlaysByProjectAlignment(
  turnContent: string,
  projectRegistry: OverlayRegistry | null
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
    const overlayIds = ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'] as const;

    for (const overlayId of overlayIds) {
      try {
        const overlay = await projectRegistry.get(overlayId);
        const results = await overlay.query(turnContent, 3); // Top 3 matches

        if (results.length > 0) {
          // Max similarity from top 3 results
          const maxSimilarity = Math.max(...results.map((r) => r.similarity));
          const scoreKey =
            `${overlayId}_${overlay.getOverlayName().toLowerCase().replace(/ /g, '_')}` as keyof OverlayScores;
          scores[scoreKey] = Math.round(maxSimilarity * 10);
        }
      } catch (error) {
        // Overlay not populated yet, skip
        continue;
      }
    }
  } catch (error) {
    // Project lattice not available, graceful degradation
    console.warn('Project lattice query failed:', error);
  }

  return scores;
}

/**
 * Analyze a conversation turn (embedding-based with project alignment)
 */
export async function analyzeTurn(
  turn: ConversationTurn,
  context: ConversationContext,
  embedder: EmbeddingService,
  projectRegistry: OverlayRegistry | null = null,
  options: AnalyzerOptions = {}
): Promise<TurnAnalysis> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

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

  const embeddingResponse = await embedder.getEmbedding(embeddingContent, 768);

  // eGemma returns embedding with dimension in key name: "embedding_768d"
  const turnEmbed =
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
  const overlayScores = await detectOverlaysByProjectAlignment(
    turn.content,
    projectRegistry
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
 * Find references to previous turns (keyword-based for now)
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
 * Extract semantic tags (keywords, entities)
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
 * Batch analyze multiple turns
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
