/**
 * Context Sampling Sigma - Analyzer Module (Embedding-Based)
 *
 * Uses embeddings for:
 * - Novelty detection (automatic paradigm shift detection)
 * - Semantic overlay matching (O1-O7)
 * - Importance scoring (novelty + overlay strength)
 */

import type {
  ConversationTurn,
  ConversationContext,
  TurnAnalysis,
  OverlayScores,
  AnalyzerOptions,
} from './types.js';
import { EmbeddingService } from '../core/services/embedding.js';

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
 * Overlay semantic signatures (for similarity matching)
 */
const OVERLAY_SIGNATURES = {
  O1_structural:
    'architecture structure design components modules interfaces hierarchy organization',
  O2_security:
    'security credentials authentication permissions authorization vulnerabilities threats',
  O3_lineage:
    'earlier mentioned discussed previously before remember recall history reference',
  O4_mission:
    'goal objective plan strategy purpose intent target achieve mission accomplish',
  O5_operational:
    'command execute run workflow process implement operation perform deploy action',
  O6_mathematical:
    'algorithm function code formula calculate compute mathematics logic proof',
  O7_strategic:
    'validate test verify check review assess evaluate measure analyze strategy',
};

/**
 * Detect overlay activation via semantic similarity
 */
async function detectOverlaysBySimilarity(
  turnEmbed: number[],
  embedder: EmbeddingService
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

  // Generate embeddings for overlay signatures (cached in real impl)
  for (const [overlay, signature] of Object.entries(OVERLAY_SIGNATURES)) {
    const overlayResponse = await embedder.getEmbedding(signature, 768);

    // eGemma returns embedding with dimension in key name: "embedding_768d"
    const overlayEmbed =
      (overlayResponse['embedding_768d'] as number[]) ||
      (overlayResponse['vector'] as number[]) ||
      (overlayResponse['embedding'] as number[]);

    if (!Array.isArray(overlayEmbed)) continue; // Skip if invalid

    const similarity = cosineSimilarity(turnEmbed, overlayEmbed);

    // Scale to 0-10
    scores[overlay as keyof OverlayScores] = Math.round(similarity * 10);
  }

  return scores;
}

/**
 * Analyze a conversation turn (embedding-based)
 */
export async function analyzeTurn(
  turn: ConversationTurn,
  context: ConversationContext,
  embedder: EmbeddingService,
  options: AnalyzerOptions = {}
): Promise<TurnAnalysis> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 1. Generate embedding for this turn
  const embeddingResponse = await embedder.getEmbedding(turn.content, 768);

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

  // 3. Detect overlay activation via semantic similarity
  const overlayScores = await detectOverlaysBySimilarity(turnEmbed, embedder);

  // 4. Calculate importance (novelty + overlay strength)
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
      options
    );
    analyses.push(analysis);
  }

  return analyses;
}
