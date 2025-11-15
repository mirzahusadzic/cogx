/**
 * Cross-Session Query Utilities
 *
 * Provides advanced querying capabilities across multiple conversation sessions
 * using LanceDB's native vector operations for maximum performance.
 *
 * DESIGN:
 * Sigma stores all conversation turns across ALL sessions in a unified LanceDB table.
 * This enables powerful cross-session queries:
 * - Semantic search across entire conversation history
 * - Find similar discussions from previous sessions
 * - Track knowledge evolution over time
 * - Identify recurring patterns and paradigm shifts
 * - Query by date range, overlay alignment, or references
 *
 * Unlike single-session queries (query-conversation.ts), these utilities operate
 * across the global conversation space, making connections between different
 * projects, timeframes, and contexts.
 *
 * PERFORMANCE:
 * - Uses LanceDB's native vector similarity search (no Python overhead)
 * - Pre-filters with metadata (timestamp, alignment scores) before vector ops
 * - Supports session inclusion/exclusion for scoped queries
 * - Returns results in CrossSessionResult format (unified schema)
 */

import { ConversationLanceStore } from './conversation-lance-store.js';
import type { ConversationQueryFilter } from './conversation-lance-store.js';
import { WorkbenchClient } from '../core/executors/workbench-client.js';

export interface CrossSessionQueryOptions {
  workbenchUrl?: string;
  topK?: number;
  filters?: ConversationQueryFilter;
  includeSessions?: string[];
  excludeSessions?: string[];
}

export interface CrossSessionResult {
  id: string;
  session_id: string;
  role: string;
  content: string;
  timestamp: number;
  similarity: number;
  metadata: {
    novelty: number;
    importance: number;
    is_paradigm_shift: boolean;
    alignment_scores: {
      O1: number;
      O2: number;
      O3: number;
      O4: number;
      O5: number;
      O6: number;
      O7: number;
    };
    semantic_tags: string[];
    references: string[];
  };
}

export interface SessionCluster {
  session_ids: string[];
  representative_content: string;
  avg_similarity: number;
  turn_count: number;
  date_range: {
    start: number;
    end: number;
  };
}

/**
 * Find similar conversations across all sessions
 *
 * Performs semantic search across the entire conversation history to find
 * turns that are semantically related to the query, regardless of which
 * session they originated from.
 *
 * ALGORITHM:
 * 1. Generate query embedding via Workbench embed endpoint (768d)
 * 2. Perform LanceDB cosine similarity search across all sessions
 * 3. Apply optional metadata filters (importance, overlay alignment, etc.)
 * 4. Apply session inclusion/exclusion filters in-memory
 * 5. Return top-K results sorted by similarity descending
 *
 * DESIGN:
 * This is the primary cross-session discovery mechanism. Use it to:
 * - Find how similar problems were solved in the past
 * - Discover related architectural discussions
 * - Identify recurring patterns across projects
 * - Build context from previous sessions
 *
 * @param query - Natural language search query
 * @param sigmaRoot - Path to .sigma/ directory (conversation storage)
 * @param options - Query options (workbench URL, filters, session scope)
 * @returns Array of matching turns with similarity scores, metadata, and session IDs
 *
 * @example
 * // Find all past discussions about authentication
 * const results = await findSimilarConversations(
 *   "implement user authentication with JWT tokens",
 *   "/home/user/project/.sigma",
 *   { topK: 10 }
 * );
 *
 * results.forEach(r => {
 *   console.log(`[${r.session_id}] Similarity: ${r.similarity.toFixed(2)}`);
 *   console.log(`  ${r.content.substring(0, 100)}...`);
 *   console.log(`  Importance: ${r.metadata.importance}/10`);
 * });
 *
 * @example
 * // Search specific sessions only
 * const recent = await findSimilarConversations(
 *   "database migration strategy",
 *   sigmaRoot,
 *   {
 *     topK: 5,
 *     includeSessions: ['session_2024-01-15', 'session_2024-01-16'],
 *     filters: { min_importance: 7 }
 *   }
 * );
 *
 * @example
 * // Find high-importance security discussions, excluding old sessions
 * const security = await findSimilarConversations(
 *   "security vulnerabilities and mitigations",
 *   sigmaRoot,
 *   {
 *     topK: 20,
 *     excludeSessions: ['session_2023-*'], // Exclude 2023 sessions
 *     filters: {
 *       min_importance: 8,
 *       overlay: 'O2', // Security overlay
 *       min_overlay_alignment: 7.0
 *     }
 *   }
 * );
 */
export async function findSimilarConversations(
  query: string,
  sigmaRoot: string,
  options: CrossSessionQueryOptions = {}
): Promise<CrossSessionResult[]> {
  const workbenchUrl = options.workbenchUrl || 'http://localhost:8000';
  const topK = options.topK || 20;

  // Initialize LanceDB store
  const lanceStore = new ConversationLanceStore(sigmaRoot);

  try {
    await lanceStore.initialize('conversation_turns');

    // Get query embedding
    const workbench = new WorkbenchClient(workbenchUrl);
    const embedResponse = await workbench.embed({
      signature: query,
      dimensions: 768,
    });

    const queryEmbedding = embedResponse['embedding_768d'] as number[];
    if (!queryEmbedding || queryEmbedding.length !== 768) {
      throw new Error('Failed to generate query embedding');
    }

    // Build filters
    const filters: ConversationQueryFilter = { ...options.filters };

    // Apply session inclusion/exclusion
    if (options.includeSessions && options.includeSessions.length > 0) {
      // For inclusion, we'd need to query multiple times (LanceDB doesn't support OR in WHERE)
      // For now, we'll return all and filter in memory
    }

    // Query LanceDB across all sessions
    const results = await lanceStore.similaritySearch(
      queryEmbedding,
      topK * 2, // Get extra for filtering
      filters,
      'cosine'
    );

    // Apply session inclusion/exclusion in memory if needed
    let filteredResults = results;
    if (options.includeSessions && options.includeSessions.length > 0) {
      filteredResults = results.filter((r) =>
        options.includeSessions!.includes(r.session_id)
      );
    }
    if (options.excludeSessions && options.excludeSessions.length > 0) {
      filteredResults = filteredResults.filter(
        (r) => !options.excludeSessions!.includes(r.session_id)
      );
    }

    // Convert to CrossSessionResult format
    return filteredResults.slice(0, topK).map((result) => ({
      id: result.id,
      session_id: result.session_id,
      role: result.role,
      content: result.content,
      timestamp: result.timestamp,
      similarity: result.similarity,
      metadata: {
        novelty: result.metadata.novelty,
        importance: result.metadata.importance,
        is_paradigm_shift: result.metadata.is_paradigm_shift,
        alignment_scores: {
          O1: result.metadata.alignment_O1,
          O2: result.metadata.alignment_O2,
          O3: result.metadata.alignment_O3,
          O4: result.metadata.alignment_O4,
          O5: result.metadata.alignment_O5,
          O6: result.metadata.alignment_O6,
          O7: result.metadata.alignment_O7,
        },
        semantic_tags: result.metadata.semantic_tags,
        references: result.metadata.references,
      },
    }));
  } finally {
    // Ensure lanceStore is properly closed to avoid NAPI reference leaks
    await lanceStore.close();
  }
}

/**
 * Get all paradigm shifts across all sessions
 *
 * Retrieves breakthrough moments where significant cognitive shifts occurred
 * in the conversation. Paradigm shifts are turns marked with high novelty
 * and importance that represent major insights or direction changes.
 *
 * ALGORITHM:
 * 1. Query LanceDB for all turns where is_paradigm_shift = true
 * 2. Filter by sessionId if provided (single-session paradigm shifts)
 * 3. Convert to CrossSessionResult format with full metadata
 * 4. Return sorted by importance descending (most significant first)
 *
 * DESIGN:
 * Paradigm shifts represent the "aha moments" in conversations:
 * - Major architectural decisions
 * - Critical bug discoveries
 * - Conceptual breakthroughs
 * - Workflow pattern changes
 *
 * Use this to understand key decision points across all projects.
 *
 * @param sigmaRoot - Path to .sigma/ directory (conversation storage)
 * @param sessionId - Optional session ID to filter paradigm shifts to a specific session
 * @returns Array of paradigm shift turns with metadata (novelty, importance, alignment scores)
 *
 * @example
 * // Get all paradigm shifts across entire history
 * const shifts = await findAllParadigmShifts("/home/user/project/.sigma");
 * console.log(`Found ${shifts.length} paradigm shifts`);
 *
 * shifts.forEach(shift => {
 *   console.log(`\n[${shift.session_id}]`);
 *   console.log(`Importance: ${shift.metadata.importance}/10`);
 *   console.log(`Novelty: ${shift.metadata.novelty.toFixed(2)}`);
 *   console.log(shift.content.substring(0, 200));
 * });
 *
 * @example
 * // Get paradigm shifts for specific session
 * const sessionShifts = await findAllParadigmShifts(
 *   sigmaRoot,
 *   'session_2024-01-15_10-30-45'
 * );
 * console.log(`Session had ${sessionShifts.length} breakthrough moments`);
 */
export async function findAllParadigmShifts(
  sigmaRoot: string,
  sessionId?: string
): Promise<CrossSessionResult[]> {
  const lanceStore = new ConversationLanceStore(sigmaRoot);

  try {
    await lanceStore.initialize('conversation_turns');

    const shifts = await lanceStore.getParadigmShifts(sessionId);

    return shifts.map((turn) => ({
      id: turn.id,
      session_id: turn.session_id,
      role: turn.role,
      content: turn.content,
      timestamp: turn.timestamp,
      similarity: 1.0, // Not a similarity search
      metadata: {
        novelty: turn.novelty,
        importance: turn.importance,
        is_paradigm_shift: turn.is_paradigm_shift,
        alignment_scores: {
          O1: turn.alignment_O1,
          O2: turn.alignment_O2,
          O3: turn.alignment_O3,
          O4: turn.alignment_O4,
          O5: turn.alignment_O5,
          O6: turn.alignment_O6,
          O7: turn.alignment_O7,
        },
        semantic_tags: JSON.parse(turn.semantic_tags),
        references: JSON.parse(turn.references),
      },
    }));
  } finally {
    await lanceStore.close();
  }
}

/**
 * Get turns with high alignment to a specific overlay
 *
 * Finds conversation turns that strongly align with a particular overlay
 * dimension (Structural, Security, Lineage, Mission, Operational, Mathematical,
 * or Coherence). This reveals where conversations focused on specific aspects
 * of the system.
 *
 * ALGORITHM:
 * 1. Create dummy query embedding (all zeros - we're filtering by metadata only)
 * 2. Query LanceDB with overlay and min_overlay_alignment filters
 * 3. LanceDB returns turns where alignment_O[N] >= minAlignment
 * 4. Convert to CrossSessionResult format
 * 5. Sort by alignment score descending (most aligned first)
 *
 * DESIGN:
 * Each conversation turn is scored against all 7 overlays (0-10 scale).
 * High alignment indicates the turn was strongly focused on that dimension:
 * - O1 (Structural): Architecture, code structure, design patterns
 * - O2 (Security): Threats, vulnerabilities, security controls
 * - O3 (Lineage): Dependencies, knowledge evolution, history
 * - O4 (Mission): Goals, objectives, strategic alignment
 * - O5 (Operational): Actions, workflows, procedures
 * - O6 (Mathematical): Algorithms, logic, formal reasoning
 * - O7 (Coherence): Conversation flow, strategic coherence
 *
 * @param sigmaRoot - Path to .sigma/ directory (conversation storage)
 * @param overlay - Which overlay dimension to filter by (O1-O7)
 * @param minAlignment - Minimum alignment score (0-10 scale, default 7.0)
 * @param topK - Maximum number of results to return (default 20)
 * @returns Array of turns with high alignment to the specified overlay
 *
 * @example
 * // Find all security-focused discussions
 * const securityTurns = await findByOverlayAlignment(
 *   sigmaRoot,
 *   'O2',
 *   8.0, // Very high security alignment
 *   50
 * );
 *
 * console.log(`Found ${securityTurns.length} high-security turns`);
 * securityTurns.forEach(turn => {
 *   console.log(`[${turn.session_id}] O2 Score: ${turn.metadata.alignment_scores.O2}`);
 *   console.log(`  ${turn.content.substring(0, 100)}...`);
 * });
 *
 * @example
 * // Find architectural design discussions
 * const structural = await findByOverlayAlignment(
 *   sigmaRoot,
 *   'O1', // Structural overlay
 *   7.5,
 *   30
 * );
 *
 * // Group by session to see which sessions focused on architecture
 * const bySession = structural.reduce((acc, turn) => {
 *   acc[turn.session_id] = (acc[turn.session_id] || 0) + 1;
 *   return acc;
 * }, {});
 *
 * @example
 * // Find mission-critical conversations
 * const missionCritical = await findByOverlayAlignment(
 *   sigmaRoot,
 *   'O4', // Mission overlay
 *   9.0, // Extremely high mission alignment
 *   10
 * );
 */
export async function findByOverlayAlignment(
  sigmaRoot: string,
  overlay: 'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7',
  minAlignment: number = 7.0,
  topK: number = 20
): Promise<CrossSessionResult[]> {
  const lanceStore = new ConversationLanceStore(sigmaRoot);

  try {
    await lanceStore.initialize('conversation_turns');

    // Create a dummy query embedding (all zeros) since we're filtering by metadata
    const dummyEmbedding = new Array(768).fill(0.0);

    const results = await lanceStore.similaritySearch(
      dummyEmbedding,
      topK,
      {
        overlay,
        min_overlay_alignment: minAlignment,
      },
      'cosine'
    );

    return results.map((result) => ({
      id: result.id,
      session_id: result.session_id,
      role: result.role,
      content: result.content,
      timestamp: result.timestamp,
      similarity: result.similarity,
      metadata: {
        novelty: result.metadata.novelty,
        importance: result.metadata.importance,
        is_paradigm_shift: result.metadata.is_paradigm_shift,
        alignment_scores: {
          O1: result.metadata.alignment_O1,
          O2: result.metadata.alignment_O2,
          O3: result.metadata.alignment_O3,
          O4: result.metadata.alignment_O4,
          O5: result.metadata.alignment_O5,
          O6: result.metadata.alignment_O6,
          O7: result.metadata.alignment_O7,
        },
        semantic_tags: result.metadata.semantic_tags,
        references: result.metadata.references,
      },
    }));
  } finally {
    await lanceStore.close();
  }
}

/**
 * Get conversation statistics across all sessions
 *
 * Computes aggregate statistics across the entire conversation history stored
 * in LanceDB. Provides high-level metrics for understanding conversation patterns,
 * quality, and overlay focus distribution.
 *
 * ALGORITHM:
 * 1. Query LanceDB for aggregate statistics (via getStats())
 * 2. Count total turns, unique sessions, paradigm shifts
 * 3. Calculate average importance and novelty scores
 * 4. Return statistics object with overlay distribution
 *
 * DESIGN:
 * This gives a bird's-eye view of all conversation activity:
 * - Volume: How many turns and sessions recorded
 * - Quality: Average importance and novelty (higher = more valuable)
 * - Paradigm shifts: Number of breakthrough moments
 * - Focus: Distribution across overlay dimensions (future enhancement)
 *
 * Note: by_overlay field currently returns placeholder zeros (would require
 * custom aggregation queries in LanceDB). Future enhancement to show average
 * alignment per overlay.
 *
 * @param sigmaRoot - Path to .sigma/ directory (conversation storage)
 * @returns Statistics object with turn count, session count, quality metrics, and overlay distribution
 *
 * @example
 * // Get overall conversation health metrics
 * const stats = await getConversationStats("/home/user/project/.sigma");
 *
 * console.log(`Total Conversations: ${stats.total_sessions}`);
 * console.log(`Total Turns: ${stats.total_turns}`);
 * console.log(`Paradigm Shifts: ${stats.paradigm_shifts}`);
 * console.log(`Average Importance: ${stats.avg_importance.toFixed(2)}/10`);
 * console.log(`Average Novelty: ${stats.avg_novelty.toFixed(2)}`);
 *
 * @example
 * // Track conversation quality over time
 * const stats = await getConversationStats(sigmaRoot);
 * if (stats.avg_importance < 5) {
 *   console.warn("Recent conversations have low importance - mostly routine?");
 * }
 * if (stats.paradigm_shifts / stats.total_turns > 0.1) {
 *   console.log("High breakthrough rate - lots of innovation!");
 * }
 */
export async function getConversationStats(sigmaRoot: string): Promise<{
  total_turns: number;
  total_sessions: number;
  paradigm_shifts: number;
  avg_importance: number;
  avg_novelty: number;
  by_overlay: {
    O1: number;
    O2: number;
    O3: number;
    O4: number;
    O5: number;
    O6: number;
    O7: number;
  };
}> {
  const lanceStore = new ConversationLanceStore(sigmaRoot);

  try {
    await lanceStore.initialize('conversation_turns');

    const stats = await lanceStore.getStats();

    // Get average alignment scores by overlay (would need custom query)
    // For now, return basic stats with placeholder overlay counts
    return {
      ...stats,
      by_overlay: {
        O1: 0, // Would need custom aggregation query
        O2: 0,
        O3: 0,
        O4: 0,
        O5: 0,
        O6: 0,
        O7: 0,
      },
    };
  } finally {
    await lanceStore.close();
  }
}

/**
 * Query by date range across all sessions
 *
 * Retrieves conversation turns within a specific time period, optionally
 * filtered by semantic search. Useful for temporal analysis and reviewing
 * work done during a specific timeframe.
 *
 * ALGORITHM:
 * 1. Build date range filter (min_timestamp, max_timestamp)
 * 2. If searchQuery provided:
 *    a. Generate query embedding via Workbench
 *    b. Perform semantic search with date range filter
 *    c. Return top-K semantically relevant results in range
 * 3. If no searchQuery:
 *    a. Use dummy embedding (all zeros)
 *    b. Query with large limit (1000) to get all turns in range
 *    c. Return all turns chronologically
 * 4. Apply additional filters from options (importance, overlay alignment, etc.)
 *
 * DESIGN:
 * Temporal queries enable:
 * - Review what was discussed last week/month
 * - Track project evolution over time
 * - Find specific discussions from known timeframe
 * - Generate activity reports by date range
 *
 * Combining date range with semantic search is powerful:
 * "What did we discuss about authentication in January?"
 *
 * @param sigmaRoot - Path to .sigma/ directory (conversation storage)
 * @param startDate - Start of date range (inclusive)
 * @param endDate - End of date range (inclusive)
 * @param searchQuery - Optional semantic search query within the date range
 * @param options - Additional query options (filters, topK, workbench URL)
 * @returns Array of turns within date range, optionally filtered by semantic relevance
 *
 * @example
 * // Get all conversations from last week
 * const lastWeek = new Date();
 * lastWeek.setDate(lastWeek.getDate() - 7);
 * const today = new Date();
 *
 * const recentTurns = await queryByDateRange(
 *   sigmaRoot,
 *   lastWeek,
 *   today
 * );
 * console.log(`Had ${recentTurns.length} turns in the last week`);
 *
 * @example
 * // Find security discussions from January 2024
 * const results = await queryByDateRange(
 *   sigmaRoot,
 *   new Date('2024-01-01'),
 *   new Date('2024-01-31'),
 *   "security vulnerabilities and mitigations",
 *   { topK: 20, filters: { min_importance: 7 } }
 * );
 *
 * results.forEach(r => {
 *   const date = new Date(r.timestamp);
 *   console.log(`[${date.toLocaleDateString()}] ${r.content.substring(0, 100)}`);
 * });
 *
 * @example
 * // Get all paradigm shifts from Q1 2024
 * const q1Shifts = await queryByDateRange(
 *   sigmaRoot,
 *   new Date('2024-01-01'),
 *   new Date('2024-03-31'),
 *   undefined, // No semantic filter
 *   {
 *     filters: { is_paradigm_shift: true },
 *     topK: 100
 *   }
 * );
 */
export async function queryByDateRange(
  sigmaRoot: string,
  startDate: Date,
  endDate: Date,
  searchQuery?: string,
  options: CrossSessionQueryOptions = {}
): Promise<CrossSessionResult[]> {
  const lanceStore = new ConversationLanceStore(sigmaRoot);

  try {
    await lanceStore.initialize('conversation_turns');

    const filters: ConversationQueryFilter = {
      min_timestamp: startDate.getTime(),
      max_timestamp: endDate.getTime(),
      ...options.filters,
    };

    if (searchQuery) {
      // Semantic search with date range filter
      const workbenchUrl = options.workbenchUrl || 'http://localhost:8000';
      const workbench = new WorkbenchClient(workbenchUrl);
      const embedResponse = await workbench.embed({
        signature: searchQuery,
        dimensions: 768,
      });

      const queryEmbedding = embedResponse['embedding_768d'] as number[];
      if (!queryEmbedding || queryEmbedding.length !== 768) {
        throw new Error('Failed to generate query embedding');
      }

      const results = await lanceStore.similaritySearch(
        queryEmbedding,
        options.topK || 20,
        filters,
        'cosine'
      );

      return results.map((result) => ({
        id: result.id,
        session_id: result.session_id,
        role: result.role,
        content: result.content,
        timestamp: result.timestamp,
        similarity: result.similarity,
        metadata: {
          novelty: result.metadata.novelty,
          importance: result.metadata.importance,
          is_paradigm_shift: result.metadata.is_paradigm_shift,
          alignment_scores: {
            O1: result.metadata.alignment_O1,
            O2: result.metadata.alignment_O2,
            O3: result.metadata.alignment_O3,
            O4: result.metadata.alignment_O4,
            O5: result.metadata.alignment_O5,
            O6: result.metadata.alignment_O6,
            O7: result.metadata.alignment_O7,
          },
          semantic_tags: result.metadata.semantic_tags,
          references: result.metadata.references,
        },
      }));
    } else {
      // Get all turns in date range (use dummy embedding)
      const dummyEmbedding = new Array(768).fill(0.0);
      const results = await lanceStore.similaritySearch(
        dummyEmbedding,
        1000, // Large limit for date range queries
        filters,
        'cosine'
      );

      return results.map((result) => ({
        id: result.id,
        session_id: result.session_id,
        role: result.role,
        content: result.content,
        timestamp: result.timestamp,
        similarity: result.similarity,
        metadata: {
          novelty: result.metadata.novelty,
          importance: result.metadata.importance,
          is_paradigm_shift: result.metadata.is_paradigm_shift,
          alignment_scores: {
            O1: result.metadata.alignment_O1,
            O2: result.metadata.alignment_O2,
            O3: result.metadata.alignment_O3,
            O4: result.metadata.alignment_O4,
            O5: result.metadata.alignment_O5,
            O6: result.metadata.alignment_O6,
            O7: result.metadata.alignment_O7,
          },
          semantic_tags: result.metadata.semantic_tags,
          references: result.metadata.references,
        },
      }));
    }
  } finally {
    await lanceStore.close();
  }
}

/**
 * Find related turns by following references
 *
 * Performs graph traversal through conversation references to discover
 * related turns. Each turn can reference other turns (cross-references,
 * callbacks, dependencies). This function explores the reference graph
 * to find connected context.
 *
 * ALGORITHM (Depth-First Search):
 * 1. Start with turnId as root node
 * 2. Fetch turn from LanceDB and extract references array
 * 3. For each reference:
 *    a. If not visited and depth < maxDepth:
 *       - Fetch referenced turn recursively
 *       - Add to results with similarity = 1.0 - (depth * 0.2)
 *       - Explore that turn's references (depth + 1)
 * 4. Return all discovered turns with decreasing similarity by depth
 *
 * DESIGN:
 * References create a knowledge graph where:
 * - Turns can refer back to earlier context
 * - Related discussions are explicitly linked
 * - Following references builds complete context chains
 *
 * Depth parameter controls exploration:
 * - depth=1: Direct references only (immediate context)
 * - depth=2: References + their references (extended context)
 * - depth=3+: Deep context chains (be careful of graph size)
 *
 * Similarity score decreases with depth (1.0, 0.8, 0.6, ...) to indicate
 * distance from the original turn.
 *
 * @param sigmaRoot - Path to .sigma/ directory (conversation storage)
 * @param turnId - Starting turn ID to explore from
 * @param depth - Maximum traversal depth (default 1 = direct references only)
 * @returns Array of related turns discovered via reference traversal, with similarity scores
 *
 * @example
 * // Find all directly referenced turns
 * const related = await findRelatedTurns(
 *   sigmaRoot,
 *   'turn_1234567890_5', // A turn that references earlier context
 *   1 // Direct references only
 * );
 *
 * console.log(`Found ${related.length} directly related turns`);
 * related.forEach(turn => {
 *   console.log(`[Similarity: ${turn.similarity}] ${turn.content.substring(0, 80)}`);
 * });
 *
 * @example
 * // Build complete context chain (deep exploration)
 * const contextChain = await findRelatedTurns(
 *   sigmaRoot,
 *   'turn_1234567890_42',
 *   3 // Explore 3 levels deep
 * );
 *
 * // Group by depth for visualization
 * const byDepth = contextChain.reduce((acc, turn) => {
 *   const depth = Math.round((1.0 - turn.similarity) / 0.2);
 *   acc[depth] = acc[depth] || [];
 *   acc[depth].push(turn);
 *   return acc;
 * }, {});
 *
 * console.log('Context Chain:');
 * Object.entries(byDepth).forEach(([depth, turns]) => {
 *   console.log(`\nDepth ${depth}: ${turns.length} turns`);
 * });
 *
 * @example
 * // Find conversation threads
 * const thread = await findRelatedTurns(sigmaRoot, rootTurnId, 2);
 * const threadSessions = new Set(thread.map(t => t.session_id));
 * console.log(`Thread spans ${threadSessions.size} sessions`);
 */
export async function findRelatedTurns(
  sigmaRoot: string,
  turnId: string,
  depth: number = 1
): Promise<CrossSessionResult[]> {
  const lanceStore = new ConversationLanceStore(sigmaRoot);

  try {
    await lanceStore.initialize('conversation_turns');

    const visited = new Set<string>();
    const results: CrossSessionResult[] = [];

    const explore = async (currentTurnId: string, currentDepth: number) => {
      if (currentDepth > depth || visited.has(currentTurnId)) {
        return;
      }

      visited.add(currentTurnId);

      const turn = await lanceStore.getTurn(currentTurnId);
      if (!turn) return;

      results.push({
        id: turn.id,
        session_id: turn.session_id,
        role: turn.role,
        content: turn.content,
        timestamp: turn.timestamp,
        similarity: 1.0 - currentDepth * 0.2, // Decrease similarity with depth
        metadata: {
          novelty: turn.novelty,
          importance: turn.importance,
          is_paradigm_shift: turn.is_paradigm_shift,
          alignment_scores: {
            O1: turn.alignment_O1,
            O2: turn.alignment_O2,
            O3: turn.alignment_O3,
            O4: turn.alignment_O4,
            O5: turn.alignment_O5,
            O6: turn.alignment_O6,
            O7: turn.alignment_O7,
          },
          semantic_tags: JSON.parse(turn.semantic_tags),
          references: JSON.parse(turn.references),
        },
      });

      // Explore references
      const references = JSON.parse(turn.references);
      for (const refId of references) {
        await explore(refId, currentDepth + 1);
      }
    };

    await explore(turnId, 0);

    return results;
  } finally {
    await lanceStore.close();
  }
}
