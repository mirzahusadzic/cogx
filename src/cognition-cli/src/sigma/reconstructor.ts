/**
 * Context Sampling Sigma - Reconstructor Module
 *
 * Rebuilds context from compressed lattice for Claude queries.
 * Query-driven graph traversal with overlay-based relevance.
 */

import type {
  ConversationLattice,
  ConversationNode,
  ReconstructedContext,
  ReconstructorOptions,
  OverlayScores,
} from './types.js';

const DEFAULT_OPTIONS: Required<ReconstructorOptions> = {
  token_budget: 40000, // 40K tokens for reconstruction
  max_nodes: 50, // Maximum nodes to include
  sort_by: 'importance', // Sort by importance by default
  include_neighbors: true, // Include temporal neighbors
};

/**
 * Estimate token count for text
 *
 * Uses a simple heuristic: 1 token ≈ 4 characters
 *
 * @param text - Input text to estimate
 * @returns Estimated token count
 *
 * @private
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Reconstruct context from lattice for a query
 *
 * ALGORITHM:
 * 1. Analyze query to detect required overlay activation (O1-O7)
 * 2. Find nodes matching overlay patterns via graph traversal
 * 3. Expand to include temporal neighbors (conversation flow)
 * 4. Sort by importance or recency
 * 5. Build prompt within token budget
 *
 * @param query - Natural language query describing what context is needed
 * @param lattice - Compressed conversation lattice to search
 * @param options - Reconstruction options (token budget, max nodes, sorting)
 * @returns Reconstructed context with prompt, included turns, and relevance score
 *
 * @example
 * const context = await reconstructContext(
 *   "What did we discuss about security guidelines?",
 *   lattice,
 *   { token_budget: 30000, sort_by: 'importance' }
 * );
 * console.log(`Reconstructed ${context.turns_included.length} turns (${context.token_count} tokens)`);
 * console.log(`Relevance: ${context.relevance_score.toFixed(2)}`);
 */
export async function reconstructContext(
  query: string,
  lattice: ConversationLattice,
  options: ReconstructorOptions = {}
): Promise<ReconstructedContext> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 1. Analyze query to detect required overlays
  const queryOverlays = analyzeQuery(query);

  // 2. Find relevant nodes via graph traversal
  const relevantNodes = findNodesByOverlay(
    lattice,
    queryOverlays,
    opts.max_nodes
  );

  // 3. Expand to include temporal neighbors if requested
  let expandedNodes = relevantNodes;
  if (opts.include_neighbors) {
    expandedNodes = expandWithNeighbors(lattice, relevantNodes);
  }

  // 4. Sort by importance or recency
  const sorted = sortNodes(expandedNodes, opts.sort_by);

  // 5. Build prompt within token budget
  let budget = opts.token_budget;
  const included: string[] = [];
  const promptParts: string[] = [];

  for (const node of sorted) {
    const nodeSize = estimateTokens(node.content);

    if (budget >= nodeSize) {
      included.push(node.turn_id);
      promptParts.push(formatTurn(node));
      budget -= nodeSize;
    } else {
      // Budget exceeded, stop including nodes
      break;
    }
  }

  // Calculate relevance score
  const relevanceScore = calculateRelevance(
    included,
    relevantNodes,
    queryOverlays
  );

  return {
    prompt: promptParts.join('\n\n'),
    turns_included: included,
    token_count: opts.token_budget - budget,
    relevance_score: relevanceScore,
    overlay_activation: Object.fromEntries(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      Object.entries(queryOverlays).filter(([_key, score]) => score > 0)
    ) as Partial<OverlayScores>,
  };
}

/**
 * Analyze query to detect which overlays are needed
 *
 * Uses keyword matching to activate overlays:
 * - O1: architecture, structure, design, component
 * - O2: security, auth, credential, vulnerability
 * - O3: earlier, before, previous, mentioned (historical references)
 * - O4: goal, plan, strategy, purpose
 * - O5: run, execute, command, workflow, implement
 * - O6: code, function, algorithm, formula
 * - O7: test, validate, verify, check
 *
 * @param query - Natural language query text
 * @returns Overlay scores (0-10 scale) indicating which overlays to activate
 *
 * @private
 */
function analyzeQuery(query: string): OverlayScores {
  const content = query.toLowerCase();
  const scores: OverlayScores = {
    O1_structural: 0,
    O2_security: 0,
    O3_lineage: 0,
    O4_mission: 0,
    O5_operational: 0,
    O6_mathematical: 0,
    O7_strategic: 0,
  };

  // O1: Architecture, structure
  if (/\b(architecture|structure|design|component|interface)\b/.test(content)) {
    scores.O1_structural = 8;
  }

  // O2: Security
  if (/\b(security|auth|credential|permission|vulnerability)\b/.test(content)) {
    scores.O2_security = 8;
  }

  // O3: References, history
  if (
    /\b(earlier|before|previous|mentioned|discussed|remember)\b/.test(content)
  ) {
    scores.O3_lineage = 8;
  }

  // O4: Goals, planning
  if (/\b(goal|plan|strategy|purpose|objective)\b/.test(content)) {
    scores.O4_mission = 8;
  }

  // O5: Operations, commands
  if (/\b(run|execute|command|workflow|how to|implement)\b/.test(content)) {
    scores.O5_operational = 8;
  }

  // O6: Code, algorithms
  if (/\b(code|function|algorithm|formula|calculate)\b/.test(content)) {
    scores.O6_mathematical = 8;
  }

  // O7: Validation, testing
  if (/\b(test|validate|verify|check|review)\b/.test(content)) {
    scores.O7_strategic = 8;
  }

  // Question words activate O3 (looking for past context)
  if (/\b(what|how|why|when|where|who)\b/.test(content)) {
    scores.O3_lineage = Math.max(scores.O3_lineage, 5);
  }

  return scores;
}

/**
 * Find nodes matching overlay activation patterns
 *
 * Scores each node by how well its overlay activation aligns with
 * the query's overlay requirements. Returns top-N most relevant nodes.
 *
 * @param lattice - Conversation lattice to search
 * @param queryOverlays - Required overlay activation from query analysis
 * @param maxNodes - Maximum number of nodes to return
 * @returns Array of most relevant conversation nodes
 *
 * @private
 */
function findNodesByOverlay(
  lattice: ConversationLattice,
  queryOverlays: OverlayScores,
  maxNodes: number
): ConversationNode[] {
  // Calculate relevance score for each node
  const scored = lattice.nodes.map((node) => ({
    node,
    relevance: calculateNodeRelevance(node, queryOverlays),
  }));

  // Sort by relevance (high to low)
  scored.sort((a, b) => b.relevance - a.relevance);

  // Take top N nodes
  return scored.slice(0, maxNodes).map((s) => s.node);
}

/**
 * Calculate how relevant a node is to the query overlays
 *
 * Relevance formula:
 * - Base: sum of (nodeScore × queryScore) for each overlay
 * - Boost: +10 for paradigm shifts (always relevant)
 * - Boost: +importance_score (1-10 scale)
 *
 * @param node - Conversation node to score
 * @param queryOverlays - Required overlay activation from query
 * @returns Relevance score (higher = more relevant)
 *
 * @private
 */
function calculateNodeRelevance(
  node: ConversationNode,
  queryOverlays: OverlayScores
): number {
  let relevance = 0;

  // Compare node's overlay scores with query overlays
  for (const [overlay, queryScore] of Object.entries(queryOverlays)) {
    const nodeScore = node.overlay_scores[overlay as keyof OverlayScores] || 0;

    if (queryScore > 0 && nodeScore > 0) {
      // Both query and node have this overlay active
      relevance += nodeScore * (queryScore / 10); // Weight by query strength
    }
  }

  // Boost paradigm shifts (always relevant)
  if (node.is_paradigm_shift) {
    relevance += 10;
  }

  // Boost by base importance
  relevance += node.importance_score;

  return relevance;
}

/**
 * Expand node set to include temporal neighbors
 *
 * Follows temporal edges in the conversation lattice to include
 * adjacent turns that provide conversational context.
 *
 * @param lattice - Conversation lattice with temporal edges
 * @param nodes - Initial set of relevant nodes
 * @returns Expanded set including temporal neighbors
 *
 * @private
 */
function expandWithNeighbors(
  lattice: ConversationLattice,
  nodes: ConversationNode[]
): ConversationNode[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const expanded = new Set<ConversationNode>(nodes);

  // Find temporal edges
  for (const node of nodes) {
    const temporalEdges = lattice.edges.filter(
      (e) =>
        e.type === 'temporal' &&
        (e.from === node.id || e.to === node.id) &&
        (!nodeIds.has(e.from) || !nodeIds.has(e.to))
    );

    // Add neighbors
    for (const edge of temporalEdges) {
      const neighborId = edge.from === node.id ? edge.to : edge.from;
      const neighbor = lattice.nodes.find((n) => n.id === neighborId);
      if (neighbor) {
        expanded.add(neighbor);
      }
    }
  }

  return Array.from(expanded);
}

/**
 * Sort nodes by importance or recency
 *
 * @param nodes - Nodes to sort
 * @param sortBy - Sort criteria: 'importance' (high to low) or 'recency' (chronological)
 * @returns Sorted array of nodes
 *
 * @private
 */
function sortNodes(
  nodes: ConversationNode[],
  sortBy: 'importance' | 'recency'
): ConversationNode[] {
  const sorted = [...nodes];

  if (sortBy === 'importance') {
    sorted.sort((a, b) => b.importance_score - a.importance_score);
  } else {
    sorted.sort((a, b) => a.timestamp - b.timestamp); // Chronological order
  }

  return sorted;
}

/**
 * Format a turn for inclusion in Claude prompt
 *
 * Adds metadata headers for high-importance turns:
 * - Role indicator (USER/ASSISTANT)
 * - ⚡ marker for paradigm shifts
 * - Importance score for highly important turns (≥8)
 *
 * @param node - Conversation node to format
 * @returns Formatted string for Claude context
 *
 * @private
 */
function formatTurn(node: ConversationNode): string {
  const role = node.role.toUpperCase();

  // Add metadata for high-importance turns
  let header = `[${role}]`;
  if (node.is_paradigm_shift) {
    header += ' ⚡ PARADIGM SHIFT';
  }
  if (node.importance_score >= 8) {
    header += ` (importance: ${node.importance_score})`;
  }

  return `${header}\n${node.content}`;
}

/**
 * Calculate relevance score (0-1) for reconstruction
 *
 * Combines two metrics:
 * - Coverage: what fraction of relevant nodes were included? (60% weight)
 * - Overlay match: how well do included nodes match query overlays? (40% weight)
 *
 * @param includedIds - Turn IDs that were included in reconstruction
 * @param relevantNodes - All nodes identified as relevant
 * @param queryOverlays - Required overlay activation from query
 * @returns Relevance score from 0 (poor) to 1 (excellent)
 *
 * @private
 */
function calculateRelevance(
  includedIds: string[],
  relevantNodes: ConversationNode[],
  queryOverlays: OverlayScores
): number {
  if (relevantNodes.length === 0) return 0;

  // How many of the relevant nodes did we include?
  const included = relevantNodes.filter((n) => includedIds.includes(n.id));
  const coverage = included.length / relevantNodes.length;

  // How well do included nodes match query overlays?
  const overlayMatch =
    included.reduce((sum, node) => {
      return sum + calculateNodeRelevance(node, queryOverlays);
    }, 0) / included.length;

  // Normalize overlay match (rough scale 0-20)
  const normalizedMatch = Math.min(1, overlayMatch / 20);

  // Combine coverage and match (weighted average)
  return coverage * 0.6 + normalizedMatch * 0.4;
}

/**
 * Get reconstruction statistics (for debugging)
 *
 * Provides metrics about a reconstructed context:
 * - turn_count: number of turns included
 * - token_count: total tokens used
 * - relevance_score: how well reconstruction matched query (0-1)
 * - active_overlays: which overlays were activated
 * - token_efficiency: average tokens per turn
 *
 * @param context - Reconstructed context to analyze
 * @returns Statistics object with metrics for analysis
 *
 * @example
 * const stats = getReconstructionStats(context);
 * console.log(`Used ${stats.turn_count} turns, ${stats.token_count} tokens`);
 * console.log(`Active overlays: ${stats.active_overlays.join(', ')}`);
 */
export function getReconstructionStats(context: ReconstructedContext): {
  turn_count: number;
  token_count: number;
  relevance_score: number;
  active_overlays: string[];
  token_efficiency: number;
} {
  const activeOverlays = Object.entries(context.overlay_activation || {})
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .filter(([_key, score]) => score && score > 0)
    .map(([overlay]) => overlay);

  // Token efficiency: how many tokens per turn
  const tokenEfficiency =
    context.turns_included.length > 0
      ? context.token_count / context.turns_included.length
      : 0;

  return {
    turn_count: context.turns_included.length,
    token_count: context.token_count,
    relevance_score: Math.round(context.relevance_score * 100) / 100,
    active_overlays: activeOverlays,
    token_efficiency: Math.round(tokenEfficiency),
  };
}
