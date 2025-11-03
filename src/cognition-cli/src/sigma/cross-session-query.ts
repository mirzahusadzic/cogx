/**
 * Cross-Session Query Utilities
 *
 * Provides advanced querying capabilities across multiple conversation sessions
 * using LanceDB's native vector operations for maximum performance.
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
 * Find similar conversations across all sessions.
 * Uses LanceDB vector search without session filtering.
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
}

/**
 * Get all paradigm shifts across all sessions.
 */
export async function findAllParadigmShifts(
  sigmaRoot: string,
  sessionId?: string
): Promise<CrossSessionResult[]> {
  const lanceStore = new ConversationLanceStore(sigmaRoot);
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
}

/**
 * Get turns with high alignment to a specific overlay.
 */
export async function findByOverlayAlignment(
  sigmaRoot: string,
  overlay: 'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7',
  minAlignment: number = 7.0,
  topK: number = 20
): Promise<CrossSessionResult[]> {
  const lanceStore = new ConversationLanceStore(sigmaRoot);
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
}

/**
 * Get conversation statistics across all sessions.
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
}

/**
 * Query by date range across all sessions.
 */
export async function queryByDateRange(
  sigmaRoot: string,
  startDate: Date,
  endDate: Date,
  searchQuery?: string,
  options: CrossSessionQueryOptions = {}
): Promise<CrossSessionResult[]> {
  const lanceStore = new ConversationLanceStore(sigmaRoot);
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
}

/**
 * Find related turns by following references.
 */
export async function findRelatedTurns(
  sigmaRoot: string,
  turnId: string,
  depth: number = 1
): Promise<CrossSessionResult[]> {
  const lanceStore = new ConversationLanceStore(sigmaRoot);
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
}
