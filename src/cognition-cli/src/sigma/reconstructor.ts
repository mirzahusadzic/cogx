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
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Reconstruct context from lattice for a query
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
