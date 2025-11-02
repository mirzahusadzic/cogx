/**
 * Context Sampling Sigma - Analyzer Module
 *
 * Analyzes conversation turns using embeddings to detect:
 * - Novelty (distance from recent context)
 * - Overlay activation (O1-O7 via semantic similarity)
 * - Importance scoring (novelty + overlay strength)
 * - Paradigm shift detection (high novelty)
 * - Semantic relationships
 */

import type {
  ConversationTurn,
  TurnAnalysis,
  OverlayScores,
  AnalyzerOptions,
} from './types.js';

const DEFAULT_OPTIONS: Required<AnalyzerOptions> = {
  overlay_threshold: 5,
  paradigm_shift_threshold: 7,
  routine_threshold: 3,
};

/**
 * Analyze a conversation turn
 */
export async function analyzeTurn(
  turn: ConversationTurn,
  _context: unknown,
  options: AnalyzerOptions = {}
): Promise<TurnAnalysis> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 1. Detect overlay activation
  const overlayScores = await detectOverlayActivation(turn, _context);

  // 2. Calculate importance
  const importance = calculateImportance(turn, overlayScores, _context);

  // 3. Detect paradigm shifts
  const isParadigmShift = importance >= opts.paradigm_shift_threshold;

  // 4. Find relationships
  const references = findReferences(turn, _context);

  // 5. Extract semantic tags
  const tags = extractSemanticTags(turn);

  return {
    turn_id: turn.id,
    content: turn.content,
    role: turn.role,
    timestamp: turn.timestamp,
    embedding: [], // Placeholder - use analyzer-with-embeddings.ts for real embeddings
    novelty: 0, // Placeholder - use analyzer-with-embeddings.ts for real novelty
    overlay_scores: overlayScores,
    importance_score: importance,
    is_paradigm_shift: isParadigmShift,
    is_routine: importance < opts.routine_threshold,
    references,
    semantic_tags: tags,
  };
}

/**
 * Detect which overlays are active in this turn
 */
async function detectOverlayActivation(
  turn: ConversationTurn,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context: unknown
): Promise<OverlayScores> {
  const content = turn.content.toLowerCase();
  const scores: OverlayScores = {
    O1_structural: 0,
    O2_security: 0,
    O3_lineage: 0,
    O4_mission: 0,
    O5_operational: 0,
    O6_mathematical: 0,
    O7_strategic: 0,
  };

  // O1 (Structural): Architecture, design, components
  const structuralKeywords = [
    'architecture',
    'structure',
    'component',
    'design',
    'interface',
    'module',
    'class',
    'function',
    'organize',
    'refactor',
  ];
  scores.O1_structural = calculateKeywordScore(content, structuralKeywords);

  // O2 (Security): Credentials, permissions, vulnerabilities
  const securityKeywords = [
    'security',
    'credential',
    'password',
    'token',
    'auth',
    'permission',
    'access',
    'vulnerability',
    'encrypt',
    'secure',
  ];
  scores.O2_security = calculateKeywordScore(content, securityKeywords);

  // O3 (Lineage): Cross-references, "as we discussed"
  const lineageKeywords = [
    'mentioned',
    'discussed',
    'earlier',
    'previous',
    'before',
    'remember',
    'recall',
    'said',
    'talked about',
    'refer',
  ];
  scores.O3_lineage = calculateKeywordScore(content, lineageKeywords);

  // O4 (Mission): Goals, objectives, planning
  const missionKeywords = [
    'goal',
    'objective',
    'plan',
    'strategy',
    'purpose',
    'intent',
    'aim',
    'target',
    'achieve',
    'accomplish',
  ];
  scores.O4_mission = calculateKeywordScore(content, missionKeywords);

  // O5 (Operational): Commands, workflows, execution
  const operationalKeywords = [
    'run',
    'execute',
    'command',
    'workflow',
    'process',
    'step',
    'operation',
    'perform',
    'implement',
    'deploy',
  ];
  scores.O5_operational = calculateKeywordScore(content, operationalKeywords);

  // O6 (Mathematical): Code, algorithms, formulas
  // Check for code blocks, formulas, algorithms
  if (turn.content.includes('```')) {
    scores.O6_mathematical = 8;
  } else if (/\d+\s*[+\-*/=]\s*\d+/.test(content)) {
    scores.O6_mathematical = 6;
  } else if (
    /\b(algorithm|formula|function|calculate|compute)\b/.test(content)
  ) {
    scores.O6_mathematical = 5;
  }

  // O7 (Strategic): Validation, testing, reflection
  const strategicKeywords = [
    'validate',
    'test',
    'verify',
    'check',
    'review',
    'assess',
    'evaluate',
    'reflect',
    'analyze',
    'measure',
  ];
  scores.O7_strategic = calculateKeywordScore(content, strategicKeywords);

  return scores;
}

/**
 * Calculate keyword match score (0-10)
 */
function calculateKeywordScore(content: string, keywords: string[]): number {
  let matches = 0;
  for (const keyword of keywords) {
    if (content.includes(keyword)) {
      matches++;
    }
  }

  // Scale to 0-10
  const ratio = matches / keywords.length;
  return Math.min(10, Math.round(ratio * 15)); // 15x multiplier for sensitivity
}

/**
 * Calculate overall importance score (1-10)
 */
function calculateImportance(
  turn: ConversationTurn,
  overlayScores: OverlayScores,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context: unknown
): number {
  let importance = 5; // Base score

  // Factor 1: Overlay activation (high activation = important)
  const maxOverlay = Math.max(...Object.values(overlayScores));
  importance += maxOverlay * 0.3;

  // Factor 2: Content length (very short = routine, very long = detailed)
  const length = turn.content.length;
  if (length < 50) {
    importance -= 2; // "ok", "thanks", etc
  } else if (length > 500) {
    importance += 1; // Detailed explanation
  }

  // Factor 3: User questions (indicate exploration)
  if (turn.role === 'user' && turn.content.includes('?')) {
    importance += 1;
  }

  // Factor 4: Code blocks (technical implementation)
  if (turn.content.includes('```')) {
    importance += 1.5;
  }

  // Factor 5: Paradigm shift indicators
  const paradigmKeywords = [
    'eureka',
    'aha',
    'breakthrough',
    'solved',
    'insight',
    'realized',
    'perfect',
    'exactly',
    'fundamental',
    'paradigm',
  ];
  for (const keyword of paradigmKeywords) {
    if (turn.content.toLowerCase().includes(keyword)) {
      importance += 2;
      break;
    }
  }

  // Factor 6: Error/problem solving (important moments)
  const problemKeywords = ['error', 'bug', 'issue', 'problem', 'fix', 'broken'];
  for (const keyword of problemKeywords) {
    if (turn.content.toLowerCase().includes(keyword)) {
      importance += 1;
      break;
    }
  }

  // Clamp to 1-10
  return Math.max(1, Math.min(10, Math.round(importance)));
}

/**
 * Find references to previous turns
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function findReferences(turn: ConversationTurn, _context: unknown): string[] {
  const references: string[] = [];
  const content = turn.content.toLowerCase();

  // Look for temporal references
  if (/\b(earlier|before|previous|above|mentioned)\b/.test(content)) {
    // Context-based references would go here
    // Currently disabled as context is not used in this placeholder implementation
  }

  // Look for explicit file/code references
  // (e.g., "in useClaudeAgent.ts", "the stdin interception")
  // This is domain-specific and can be enhanced

  return references;
}

/**
 * Extract semantic tags (keywords, entities)
 */
function extractSemanticTags(turn: ConversationTurn): string[] {
  const tags: string[] = [];
  const content = turn.content;

  // Extract file references (e.g., "useClaudeAgent.ts")
  const fileMatches = content.match(/\b[\w-]+\.(ts|tsx|js|jsx|py|md)\b/g);
  if (fileMatches) {
    tags.push(...fileMatches);
  }

  // Extract npm packages (e.g., "@anthropic-ai/claude-agent-sdk")
  const packageMatches = content.match(/@[\w-]+\/[\w-]+/g);
  if (packageMatches) {
    tags.push(...packageMatches);
  }

  // Extract technical terms (capitalized or camelCase)
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
  _context: unknown,
  options: AnalyzerOptions = {}
): Promise<TurnAnalysis[]> {
  const analyses: TurnAnalysis[] = [];

  for (const turn of turns) {
    const analysis = await analyzeTurn(turn, _context, options);
    analyses.push(analysis);
  }

  return analyses;
}
