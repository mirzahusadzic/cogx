/**
 * Query Conversation Lattice
 *
 * Similar to ask.ts but for conversation overlays instead of project overlays.
 * Enables semantic search over past conversation with SLM + LLM synthesis.
 */

import { WorkbenchClient } from '../core/executors/workbench-client.js';
import type { ConversationOverlayRegistry } from './conversation-registry.js';
import type { SummarizeRequest } from '../core/types/workbench.js';
import type { OverlayMetadata } from '../core/algebra/overlay-algebra.js';
import { systemLog } from '../utils/debug-logger.js';
import {
  DEFAULT_SLM_MODEL_NAME,
  MEMORY_RECALL_MAX_TOKENS,
  PERSONA_QUERY_ANALYST,
  PERSONA_CONVERSATION_MEMORY_ASSISTANT,
} from '../config.js';

interface QueryIntent {
  intent: string;
  entities: string[];
  scope: string;
  refined_query: string;
}

interface QueryConversationOptions {
  workbenchUrl?: string;
  topK?: number;
  verbose?: boolean;
}

/**
 * Query conversation lattice with semantic search
 *
 * THREE-STAGE PIPELINE (from ask.ts pattern):
 * 1. SLM deconstructs query intent (extract entities, refine query)
 * 2. Multi-overlay semantic search (query all O1-O7 conversation stores)
 * 3. LLM synthesizes comprehensive answer from ranked results
 *
 * DESIGN:
 * - Uses workbench API for SLM/LLM calls
 * - Searches all 7 conversation overlays in parallel
 * - Re-ranks globally by similarity, then sorts chronologically
 * - Enriches context with overlay tags, importance, and alignment scores
 *
 * @param question - Natural language question about past conversation
 * @param conversationRegistry - Registry of conversation overlay managers
 * @param options - Configuration (workbench URL, topK, verbose logging)
 * @returns Synthesized answer from LLM based on relevant conversation history
 *
 * @example
 * const answer = await queryConversationLattice(
 *   "What did we discuss about TUI scrolling?",
 *   conversationRegistry,
 *   { topK: 10, verbose: true }
 * );
 * console.log(answer);
 */
export async function queryConversationLattice(
  question: string,
  conversationRegistry: ConversationOverlayRegistry,
  options: QueryConversationOptions = {}
): Promise<string> {
  const workbenchUrl = options.workbenchUrl || 'http://localhost:8000';
  const topK = options.topK || 10; // Increased from 5 to 10 for better coverage
  const verbose = options.verbose || false;

  const workbench = new WorkbenchClient(workbenchUrl);

  // STEP 1: Query Deconstruction (SLM)
  if (verbose) {
    systemLog('sigma', 'Deconstructing query intent');
  }

  const deconstructRequest: SummarizeRequest = {
    content: question,
    filename: 'query.md',
    persona: PERSONA_QUERY_ANALYST,
    max_tokens: 2048,
    temperature: 0.1,
  };
  if (DEFAULT_SLM_MODEL_NAME) {
    deconstructRequest.model_name = DEFAULT_SLM_MODEL_NAME;
  }

  const deconstructResponse = await workbench.summarize(deconstructRequest);

  // Parse JSON from response
  let jsonMatch = deconstructResponse.summary.match(
    /```(?:json)?\s*(\{[\s\S]*?\})\s*```/
  );

  if (!jsonMatch) {
    jsonMatch = deconstructResponse.summary.match(/(\{[\s\S]*?\})/);
  }

  if (!jsonMatch) {
    throw new Error('Query deconstruction did not return valid JSON');
  }

  const queryIntent: QueryIntent = JSON.parse(jsonMatch[1]);

  if (verbose) {
    systemLog('sigma', 'Query intent deconstructed', {
      intent: queryIntent.intent,
      refined: queryIntent.refined_query,
    });
  }

  // STEP 2: Multi-Overlay Semantic Search
  if (verbose) {
    systemLog('sigma', 'Searching conversation overlays');
  }

  const overlayIds = ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'] as const;
  const allResults: Array<{
    item: { id: string; embedding: number[]; metadata: OverlayMetadata };
    similarity: number;
    overlay: string;
  }> = [];

  for (const overlayId of overlayIds) {
    try {
      const overlay = await conversationRegistry.get(overlayId);
      const results = await overlay.query(queryIntent.refined_query, topK);
      results.forEach((r) => {
        allResults.push({
          ...r,
          overlay: overlayId,
        });
      });
    } catch (error) {
      // Overlay might be empty, skip
      if (verbose) {
        systemLog(
          'sigma',
          `No data found for overlay ${overlayId}`,
          { error: error instanceof Error ? error.message : String(error) },
          'warn'
        );
      }
    }
  }

  if (allResults.length === 0) {
    return 'No relevant conversation history found.';
  }

  // Re-rank globally and take top K, then re-sort by timestamp for temporal coherence
  const topResultsBySimilarity = allResults
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  // Sort by timestamp to maintain chronological order
  const topResults = topResultsBySimilarity.sort((a, b) => {
    const tsA = (a.item.metadata as { timestamp?: number }).timestamp || 0;
    const tsB = (b.item.metadata as { timestamp?: number }).timestamp || 0;
    return tsA - tsB; // Chronological order
  });

  if (verbose) {
    systemLog('sigma', 'Found relevant turns', {
      count: topResults.length,
      topMatches: topResults.map((item) => ({
        sim: (item.similarity * 100).toFixed(1) + '%',
        overlay: item.overlay,
        text: item.item.metadata.text.slice(0, 50),
      })),
    });
  }

  // STEP 3: Answer Synthesis (LLM with improved context)
  if (verbose) {
    systemLog('sigma', 'Synthesizing answer');
  }

  // Build richer context with metadata
  const contextText = topResults
    .map((item) => {
      const metadata = item.item.metadata as {
        text: string;
        turn_id?: string;
        role?: string;
        importance?: number;
        timestamp?: number;
        project_alignment_score?: number;
      };

      const roleIcon = metadata.role === 'user' ? '👤' : '🤖';
      const importanceTag = metadata.importance
        ? ` [Importance: ${metadata.importance}/10]`
        : '';
      const alignmentTag = metadata.project_alignment_score
        ? ` [Alignment: ${metadata.project_alignment_score}/10]`
        : '';
      const overlayTag = `[${item.overlay}]`;

      return `${overlayTag}${importanceTag}${alignmentTag}
${roleIcon} ${metadata.role === 'user' ? 'User' : 'Assistant'}: ${metadata.text}`;
    })
    .join('\n\n---\n\n');

  const synthesisPrompt = `You are helping recall past conversation context with high fidelity.

**User's Question:** ${question}

**Relevant Conversation History** (sorted chronologically, with overlay classification):

${contextText}

---

**Instructions:**
- Provide a comprehensive answer based on the conversation history above
- Preserve important details, decisions, and context
- If multiple related points were discussed, organize them clearly
- Include relevant technical details, file names, or specific decisions mentioned
- If the history doesn't fully answer the question, clearly state what's missing
- Maintain the chronological flow when relevant
- Reference which overlay types (O1-O7) contained the most relevant information if helpful

Provide your answer now:`;

  const synthesisRequest: SummarizeRequest = {
    content: synthesisPrompt,
    filename: 'synthesis.md',
    persona: PERSONA_CONVERSATION_MEMORY_ASSISTANT,
    max_tokens: MEMORY_RECALL_MAX_TOKENS, // Use dedicated 32K budget for comprehensive recall
    temperature: 0.3,
  };
  if (DEFAULT_SLM_MODEL_NAME) {
    synthesisRequest.model_name = DEFAULT_SLM_MODEL_NAME;
  }

  const answerResponse = await workbench.summarize(synthesisRequest);

  return answerResponse.summary.trim();
}

/**
 * Simple filtering-based query (no LLM - fast)
 *
 * Used for static recap generation. Filters turns by project alignment score
 * without requiring expensive LLM synthesis.
 *
 * DESIGN:
 * - No semantic search or LLM calls (fast and cheap)
 * - Filters by metadata.project_alignment_score
 * - Returns top 5 per overlay sorted by alignment score
 *
 * @param conversationRegistry - Registry of conversation overlay managers
 * @param minAlignment - Minimum alignment score (0-10) to include (default: 6)
 * @returns Object with top aligned turns for each overlay
 *
 * @example
 * const recap = await filterConversationByAlignment(registry, 7);
 * console.log(`Found ${recap.mission.length} high-alignment mission turns`);
 */
export async function filterConversationByAlignment(
  conversationRegistry: ConversationOverlayRegistry,
  minAlignment: number = 6
): Promise<{
  structural: Array<{ text: string; score: number }>;
  security: Array<{ text: string; score: number }>;
  lineage: Array<{ text: string; score: number }>;
  mission: Array<{ text: string; score: number }>;
  operational: Array<{ text: string; score: number }>;
  mathematical: Array<{ text: string; score: number }>;
  coherence: Array<{ text: string; score: number }>;
}> {
  const results = {
    structural: [] as Array<{ text: string; score: number }>,
    security: [] as Array<{ text: string; score: number }>,
    lineage: [] as Array<{ text: string; score: number }>,
    mission: [] as Array<{ text: string; score: number }>,
    operational: [] as Array<{ text: string; score: number }>,
    mathematical: [] as Array<{ text: string; score: number }>,
    coherence: [] as Array<{ text: string; score: number }>,
  };

  // Query O1 (structural)
  try {
    const o1 = await conversationRegistry.get('O1');
    const items = await o1.getAllItems();
    results.structural = items
      .filter(
        (item) =>
          typeof item.metadata.project_alignment_score === 'number' &&
          item.metadata.project_alignment_score >= minAlignment
      )
      .map((item) => ({
        text: item.metadata.text,
        score: item.metadata.project_alignment_score as number,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  } catch {
    // Silently skip if overlay unavailable
  }

  // Query O4 (mission)
  try {
    const o4 = await conversationRegistry.get('O4');
    const items = await o4.getAllItems();
    results.mission = items
      .filter(
        (item) =>
          typeof item.metadata.project_alignment_score === 'number' &&
          item.metadata.project_alignment_score >= minAlignment
      )
      .map((item) => ({
        text: item.metadata.text,
        score: item.metadata.project_alignment_score as number,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  } catch {
    // Silently skip if overlay unavailable
  }

  // Query O5 (operational)
  try {
    const o5 = await conversationRegistry.get('O5');
    const items = await o5.getAllItems();
    results.operational = items
      .filter(
        (item) =>
          typeof item.metadata.project_alignment_score === 'number' &&
          item.metadata.project_alignment_score >= minAlignment
      )
      .map((item) => ({
        text: item.metadata.text,
        score: item.metadata.project_alignment_score as number,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  } catch {
    // Silently skip if overlay unavailable
  }

  // Query O2 (security)
  try {
    const o2 = await conversationRegistry.get('O2');
    const items = await o2.getAllItems();
    results.security = items
      .filter(
        (item) =>
          typeof item.metadata.project_alignment_score === 'number' &&
          item.metadata.project_alignment_score >= minAlignment
      )
      .map((item) => ({
        text: item.metadata.text,
        score: item.metadata.project_alignment_score as number,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  } catch {
    // Silently skip if overlay unavailable
  }

  // Query O3 (lineage)
  try {
    const o3 = await conversationRegistry.get('O3');
    const items = await o3.getAllItems();
    results.lineage = items
      .filter(
        (item) =>
          typeof item.metadata.project_alignment_score === 'number' &&
          item.metadata.project_alignment_score >= minAlignment
      )
      .map((item) => ({
        text: item.metadata.text,
        score: item.metadata.project_alignment_score as number,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  } catch {
    // Silently skip if overlay unavailable
  }

  // Query O6 (mathematical)
  try {
    const o6 = await conversationRegistry.get('O6');
    const items = await o6.getAllItems();
    results.mathematical = items
      .filter(
        (item) =>
          typeof item.metadata.project_alignment_score === 'number' &&
          item.metadata.project_alignment_score >= minAlignment
      )
      .map((item) => ({
        text: item.metadata.text,
        score: item.metadata.project_alignment_score as number,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  } catch {
    // Silently skip if overlay unavailable
  }

  // Query O7 (coherence)
  try {
    const o7 = await conversationRegistry.get('O7');
    const items = await o7.getAllItems();
    results.coherence = items
      .filter(
        (item) =>
          typeof item.metadata.project_alignment_score === 'number' &&
          item.metadata.project_alignment_score >= minAlignment
      )
      .map((item) => ({
        text: item.metadata.text,
        score: item.metadata.project_alignment_score as number,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  } catch {
    // Silently skip if overlay unavailable
  }

  return results;
}
