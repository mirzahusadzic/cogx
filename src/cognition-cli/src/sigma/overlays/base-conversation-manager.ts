/**
 * Base Conversation Overlay Manager
 *
 * Common functionality for all 7 conversation overlays (O1-O7).
 * Each overlay stores conversation turns with project alignment scores.
 */

import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';
import { WorkbenchClient } from '../../core/executors/workbench-client.js';
import {
  OverlayAlgebra,
  OverlayItem,
  OverlayMetadata,
  SelectOptions,
} from '../../core/algebra/overlay-algebra.js';
import { ConversationLanceStore } from '../conversation-lance-store.js';
import { systemLog } from '../../utils/debug-logger.js';

/**
 * Metadata for conversation turn items
 */
export interface ConversationTurnMetadata extends OverlayMetadata {
  text: string;
  turn_id: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: number;
  project_alignment_score: number; // Similarity to project overlay
  novelty: number;
  importance: number;
  session_id: string;
}

/**
 * Conversation overlay structure (stored as YAML)
 *
 * FORMAT VERSIONS:
 * - v1 (legacy): Includes embedding arrays in YAML (deprecated in v2.x, will be removed in v3.0)
 * - v2 (current): Embeddings stored only in LanceDB, YAML is human-readable metadata
 */
export interface ConversationOverlay {
  session_id: string;
  format_version?: number; // v1 = undefined/1, v2 = 2
  turns: Array<{
    turn_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    embedding?: number[]; // v1 only (deprecated), v2 stores in LanceDB instead
    project_alignment_score: number;
    novelty: number;
    importance: number;
  }>;
  generated_at: string;
}

/**
 * Base manager for conversation overlays
 * Follows exact pattern from OperationalPatternsManager
 */
export abstract class BaseConversationManager<
  T extends ConversationTurnMetadata,
> implements OverlayAlgebra<T> {
  protected overlayPath: string;
  protected workbench: WorkbenchClient;
  protected lanceStore: ConversationLanceStore;
  protected inMemoryTurns: Array<{
    turn_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    embedding: number[];
    project_alignment_score: number;
    novelty: number;
    importance: number;
  }> = [];
  protected currentSessionId: string | null = null;
  protected debug: boolean;

  constructor(
    protected sigmaRoot: string,
    protected overlayName: string,
    workbenchUrl?: string,
    debug?: boolean
  ) {
    this.debug = debug || false;
    this.overlayPath = path.join(sigmaRoot, 'overlays', overlayName);
    this.workbench = new WorkbenchClient(
      workbenchUrl || process.env.WORKBENCH_URL || 'http://localhost:8000',
      this.debug
    );
    // Initialize LanceDB store for fast semantic search
    this.lanceStore = new ConversationLanceStore(sigmaRoot);
  }

  /**
   * Initialize the LanceDB store for fast semantic search
   *
   * Must be called before using query operations. Cannot be done in constructor
   * because it's async and constructors must be synchronous.
   *
   * Creates/opens the conversation_turns table in LanceDB with proper schema.
   *
   * @returns Promise that resolves when LanceDB is initialized
   *
   * @example
   * const manager = new ConversationStructuralManager('.sigma');
   * await manager.initializeLanceStore();
   * // Now ready to query
   */
  async initializeLanceStore(): Promise<void> {
    await this.lanceStore.initialize('conversation_turns');
  }

  /**
   * Set the current session ID for filtering queries
   *
   * When set, all query operations will only return results from the
   * specified session. This is used during compression to ensure we only
   * query turns from the current conversation, not all historical conversations.
   *
   * @param sessionId - Session ID to filter by (e.g., "abc-123")
   *
   * @example
   * manager.setCurrentSession('abc-123');
   * // Now all queries only return turns from session abc-123
   */
  setCurrentSession(sessionId: string): void {
    if (this.debug) {
      systemLog(
        'sigma',
        `[Manager] ${this.overlayName}.setCurrentSession(${sessionId})`
      );
    }
    this.currentSessionId = sessionId;
  }

  // ========================================
  // OVERLAY ALGEBRA INTERFACE
  // ========================================

  abstract getOverlayId(): string;
  abstract getOverlayName(): string;
  abstract getSupportedTypes(): string[];

  getPgcRoot(): string {
    return this.sigmaRoot;
  }

  async getAllItems(): Promise<OverlayItem<T>[]> {
    const items: OverlayItem<T>[] = [];

    // Priority: LanceDB first (fast), YAML fallback (migration)
    if (await fs.pathExists(this.overlayPath)) {
      // OPTIMIZATION: If currentSessionId is set, only load that session.
      // This avoids scanning the whole directory and logging "Skipping historical session"
      // for hundreds of files on every turn.
      if (this.currentSessionId) {
        await this.loadItemsFromSession(this.currentSessionId, items);
      } else {
        const overlayFiles = await fs.readdir(this.overlayPath);
        if (this.debug) {
          systemLog(
            'sigma',
            `[getAllItems] ${this.overlayName}: Found ${overlayFiles.length} files`,
            {
              currentSessionId: 'NONE',
            }
          );
        }

        for (const file of overlayFiles) {
          if (!file.endsWith('.yaml')) continue;
          const sessionId = file.replace('.yaml', '');
          await this.loadItemsFromSession(sessionId, items);
        }
      }
    }

    // 2. Add in-memory turns (current session)
    for (const turn of this.inMemoryTurns) {
      if (
        turn.embedding &&
        Array.isArray(turn.embedding) &&
        turn.embedding.length > 0
      ) {
        items.push({
          id: turn.turn_id,
          embedding: turn.embedding,
          metadata: {
            text: turn.content,
            turn_id: turn.turn_id,
            role: turn.role,
            timestamp: turn.timestamp,
            project_alignment_score: turn.project_alignment_score,
            novelty: turn.novelty,
            importance: turn.importance,
            session_id: 'in-memory',
          } as T,
        });
      }
    }

    return items;
  }

  /**
   * Load items from a specific session into the provided items array.
   * Checks LanceDB first, then falls back to YAML.
   *
   * @param sessionId - Session ID to load
   * @param items - Array to add items to
   * @private
   */
  private async loadItemsFromSession(
    sessionId: string,
    items: OverlayItem<T>[]
  ): Promise<void> {
    // 1. Try LanceDB first (fast path - avoid reading YAML)
    try {
      const lanceStartTime = Date.now();
      const lanceTurns = await this.lanceStore.getSessionTurns(sessionId);
      const lanceTime = Date.now() - lanceStartTime;

      if (lanceTurns.length > 0) {
        if (this.debug) {
          systemLog(
            'sigma',
            `[getAllItems] ${this.overlayName}: Loaded session ${sessionId} from LanceDB in ${lanceTime}ms`
          );
        }

        for (const turn of lanceTurns) {
          // Get overlay-specific alignment score
          const overlayId = this.getOverlayId();
          const alignmentKey = `alignment_${overlayId}` as keyof typeof turn;
          const alignmentScore = (turn[alignmentKey] as number) || 0;

          items.push({
            id: turn.id,
            embedding: turn.embedding,
            metadata: {
              text: turn.content,
              turn_id: turn.id,
              role: turn.role as 'user' | 'assistant' | 'system',
              timestamp: turn.timestamp,
              project_alignment_score: alignmentScore,
              novelty: turn.novelty,
              importance: turn.importance,
              session_id: turn.session_id,
            } as T,
          });
        }
        return; // Success, skip YAML
      }
    } catch (lanceError) {
      // LanceDB failed or not initialized - fall through to YAML
      systemLog(
        'sigma',
        `LanceDB unavailable for ${sessionId}, using YAML fallback`,
        {
          error:
            lanceError instanceof Error
              ? lanceError.message
              : String(lanceError),
        },
        'warn'
      );
    }

    // 2. LanceDB empty/failed - Load from YAML and migrate
    const yamlPath = path.join(this.overlayPath, `${sessionId}.yaml`);
    if (!(await fs.pathExists(yamlPath))) return;

    try {
      const content = await fs.readFile(yamlPath, 'utf-8');
      const overlay = YAML.parse(content) as ConversationOverlay;

      // Detect format version
      const formatVersion = overlay.format_version || 1;
      const isLegacyFormat = formatVersion === 1 && overlay.turns[0]?.embedding;

      if (isLegacyFormat) {
        systemLog(
          'sigma',
          `Session ${sessionId} uses v1 format (embeddings in YAML). Migrating to v2 (LanceDB)...`,
          undefined,
          'warn'
        );

        // Migrate to LanceDB
        await this.migrateSessionToLanceDB(sessionId, overlay);
      }

      // Add items from YAML
      for (const turn of overlay.turns) {
        let embedding = turn.embedding;

        // If no embedding in YAML (v2 format), load from LanceDB
        if (!embedding) {
          const lanceRecord = await this.lanceStore.getTurn(turn.turn_id);
          if (lanceRecord) {
            embedding = lanceRecord.embedding;
          } else {
            // DISABLED: Re-embedding blocks UI - skip turns without embeddings
            if (process.env.DEBUG) {
              systemLog(
                'sigma',
                `Skipping turn ${turn.turn_id} - no embedding in LanceDB`,
                undefined,
                'warn'
              );
            }
            continue;
          }
        }

        if (embedding && Array.isArray(embedding) && embedding.length > 0) {
          items.push({
            id: turn.turn_id,
            embedding: embedding,
            metadata: {
              text: turn.content,
              turn_id: turn.turn_id,
              role: turn.role,
              timestamp: turn.timestamp,
              project_alignment_score: turn.project_alignment_score,
              novelty: turn.novelty,
              importance: turn.importance,
              session_id: sessionId,
            } as T,
          });
        }
      }
    } catch (yamlError) {
      systemLog(
        'sigma',
        `Failed to load session ${sessionId} from YAML`,
        {
          error:
            yamlError instanceof Error ? yamlError.message : String(yamlError),
        },
        'error'
      );
    }
  }

  async getItemsByType(type: string): Promise<OverlayItem<T>[]> {
    const allItems = await this.getAllItems();
    return allItems.filter((item) => item.metadata.role === type);
  }

  async filter(predicate: (metadata: T) => boolean): Promise<OverlayItem<T>[]> {
    const allItems = await this.getAllItems();
    return allItems.filter((item) => predicate(item.metadata));
  }

  async query(
    query: string,
    topK: number = 10
  ): Promise<Array<{ item: OverlayItem<T>; similarity: number }>> {
    const embedResponse = await this.workbench.embed({
      signature: query,
      dimensions: 768,
    });

    const queryEmbedding = embedResponse['embedding_768d'] as number[];
    if (!queryEmbedding || queryEmbedding.length !== 768) {
      throw new Error('Failed to generate query embedding');
    }

    // Use LanceDB for fast vector search instead of manual similarity calculation
    try {
      const lanceResults = await this.lanceStore.similaritySearch(
        queryEmbedding,
        topK,
        this.currentSessionId
          ? { session_id: this.currentSessionId }
          : undefined,
        'cosine'
      );

      // Convert LanceDB results to OverlayItem format
      // Get overlay-specific alignment score dynamically
      const overlayId = this.getOverlayId();

      return lanceResults.map((result) => {
        const alignmentKey = `alignment_${overlayId}` as
          | 'alignment_O1'
          | 'alignment_O2'
          | 'alignment_O3'
          | 'alignment_O4'
          | 'alignment_O5'
          | 'alignment_O6'
          | 'alignment_O7';
        const alignmentScore = result.metadata[alignmentKey] || 0;

        return {
          item: {
            id: result.id,
            embedding: queryEmbedding, // We don't return embeddings from LanceDB to save memory
            metadata: {
              text: result.content,
              turn_id: result.id,
              role: result.role,
              timestamp: result.timestamp,
              project_alignment_score: alignmentScore,
              novelty: result.metadata.novelty,
              importance: result.metadata.importance,
              session_id: result.session_id,
            } as T,
          },
          similarity: result.similarity,
        };
      });
    } catch (error) {
      // Fallback to in-memory search if LanceDB fails
      systemLog(
        'sigma',
        'LanceDB query failed, falling back to in-memory',
        { error: error instanceof Error ? error.message : String(error) },
        'warn'
      );
      const allItems = await this.getAllItems();
      const results = allItems.map((item) => ({
        item,
        similarity: this.cosineSimilarity(queryEmbedding, item.embedding),
      }));

      results.sort((a, b) => b.similarity - a.similarity);
      return results.slice(0, topK);
    }
  }

  async select(options: SelectOptions): Promise<OverlayItem<T>[]> {
    const allItems = await this.getAllItems();

    if (options.symbols) {
      return allItems.filter((item) =>
        options.symbols!.has(item.metadata.text)
      );
    }

    if (options.ids) {
      return allItems.filter((item) => options.ids!.has(item.id));
    }

    return allItems;
  }

  async exclude(options: SelectOptions): Promise<OverlayItem<T>[]> {
    const allItems = await this.getAllItems();

    if (options.symbols) {
      return allItems.filter(
        (item) => !options.symbols!.has(item.metadata.text)
      );
    }

    if (options.ids) {
      return allItems.filter((item) => !options.ids!.has(item.id));
    }

    return allItems;
  }

  async getSymbolSet(): Promise<Set<string>> {
    const allItems = await this.getAllItems();
    return new Set(allItems.map((item) => item.metadata.text));
  }

  async getIdSet(): Promise<Set<string>> {
    const allItems = await this.getAllItems();
    return new Set(allItems.map((item) => item.id));
  }

  protected cosineSimilarity(a: number[], b: number[]): number {
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

  // ========================================
  // IN-MEMORY MANAGEMENT
  // ========================================

  /**
   * Add conversation turn to in-memory overlay
   *
   * Accumulates turns in memory during compression. Turns are held in memory
   * until flush() is called to write them to disk (YAML + LanceDB).
   *
   * This enables batching: collect all turns during compression, then write
   * once instead of writing each turn individually.
   *
   * @param turn - Turn to add to in-memory buffer
   *
   * @example
   * manager.addTurn({
   *   turn_id: 'turn_1',
   *   role: 'user',
   *   content: 'Add authentication',
   *   timestamp: Date.now(),
   *   embedding: [0.1, 0.2, ...],
   *   project_alignment_score: 8.5,
   *   novelty: 0.7,
   *   importance: 9
   * });
   */
  addTurn(turn: {
    turn_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    embedding: number[];
    project_alignment_score: number;
    novelty: number;
    importance: number;
  }): void {
    this.inMemoryTurns.push(turn);
  }

  /**
   * Clear in-memory turn buffer
   *
   * Called after flush() to reset in-memory state for next compression cycle.
   * Prevents duplicate writes and memory bloat.
   *
   * @example
   * await manager.flush('session-123');
   * manager.clearMemory(); // Clear buffer for next session
   */
  clearMemory(): void {
    this.inMemoryTurns = [];
  }

  /**
   * Migrate a v1 YAML session to LanceDB (v2 format)
   *
   * Called automatically when v1 format (embeddings in YAML) is detected
   * during getAllItems(). Migrates embeddings to LanceDB for fast search.
   *
   * Algorithm:
   * 1. Extract turns with embeddings from v1 YAML
   * 2. Validate embedding dimensions (must be 768D)
   * 3. Map to alignment scores for all overlays
   * 4. Store in LanceDB with full metadata
   * 5. Log migration statistics
   *
   * @param sessionId - Session ID being migrated
   * @param overlay - v1 overlay data with embedded arrays
   * @returns Promise that resolves when migration completes
   * @private
   */
  private async migrateSessionToLanceDB(
    sessionId: string,
    overlay: ConversationOverlay
  ): Promise<void> {
    let migratedCount = 0;
    let failedCount = 0;

    for (const turn of overlay.turns) {
      if (!turn.embedding || turn.embedding.length !== 768) {
        failedCount++;
        continue;
      }

      try {
        const alignmentScores = this.extractAlignmentScores(
          turn.project_alignment_score
        );

        await this.lanceStore.storeTurn(
          sessionId,
          turn.turn_id,
          turn.role,
          turn.content,
          turn.embedding,
          {
            novelty: turn.novelty,
            importance: turn.importance,
            is_paradigm_shift: turn.novelty > 0.8,
            ...alignmentScores,
            semantic_tags: this.extractSemanticTags(turn.content),
            references: this.extractReferences(turn.content),
          }
        );
        migratedCount++;
      } catch (error) {
        systemLog(
          'sigma',
          `Failed to migrate turn ${turn.turn_id}`,
          { error: error instanceof Error ? error.message : String(error) },
          'error'
        );
        failedCount++;
      }
    }

    systemLog(
      'sigma',
      `Migrated ${migratedCount} turns to LanceDB (${failedCount} failed)`
    );
  }

  /**
   * Flush in-memory turns to disk with dual-write (YAML + LanceDB)
   *
   * Writes accumulated turns to both storage formats:
   * - YAML: Human-readable metadata (NO embeddings in v2)
   * - LanceDB: Fast semantic search with full embeddings
   *
   * v2 Format advantages:
   * - YAML is 90% smaller (no 768D arrays)
   * - Fast writes (<10 seconds vs 2-3 minutes)
   * - LanceDB enables millisecond semantic queries
   *
   * FILTERING: Only stores turns relevant to this overlay based on
   * alignment scores. O1 (Structural) stores ALL turns to ensure complete
   * conversation history in LanceDB. Other overlays filter by alignment score.
   *
   * @param sessionId - Session ID for the conversation
   * @returns Promise that resolves when both writes complete
   *
   * @example
   * // Add turns during compression
   * manager.addTurn(turn1);
   * manager.addTurn(turn2);
   *
   * // Flush to disk
   * await manager.flush('session-123');
   *
   * // Clear memory for next session
   * manager.clearMemory();
   */
  async flush(sessionId: string): Promise<void> {
    if (this.inMemoryTurns.length === 0) return;

    // Filter turns relevant to THIS overlay
    const relevantTurns = this.inMemoryTurns.filter((turn) =>
      this.isRelevantToOverlay(turn)
    );

    if (relevantTurns.length === 0) {
      // No relevant turns for this overlay - skip writing
      return;
    }

    // v2 Format: Remove embeddings from YAML (stored in LanceDB only)
    const overlay: ConversationOverlay = {
      session_id: sessionId,
      format_version: 2, // Mark as v2 format
      turns: relevantTurns.map((turn) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { embedding, ...turnWithoutEmbedding } = turn;
        return turnWithoutEmbedding;
      }),
      generated_at: new Date().toISOString(),
    };

    // 1. Write to YAML (human-readable backup, NO embeddings)
    await fs.ensureDir(this.overlayPath);
    const filePath = path.join(this.overlayPath, `${sessionId}.yaml`);
    await fs.writeFile(filePath, YAML.stringify(overlay), 'utf-8');

    // 2. Write to LanceDB (fast semantic search) - only relevant turns
    try {
      for (const turn of relevantTurns) {
        // Extract alignment scores based on overlay type
        const alignmentScores = this.extractAlignmentScores(
          turn.project_alignment_score
        );

        await this.lanceStore.storeTurn(
          sessionId,
          turn.turn_id,
          turn.role,
          turn.content,
          turn.embedding,
          {
            novelty: turn.novelty,
            importance: turn.importance,
            is_paradigm_shift: turn.novelty > 0.8, // High novelty = paradigm shift
            ...alignmentScores,
            semantic_tags: this.extractSemanticTags(turn.content),
            references: this.extractReferences(turn.content),
          }
        );
      }
    } catch (error) {
      systemLog(
        'sigma',
        'Failed to write to LanceDB',
        { error: error instanceof Error ? error.message : String(error) },
        'warn'
      );
      // Continue even if LanceDB write fails - YAML is the source of truth
    }
  }

  /**
   * Check if a turn is relevant to this specific overlay
   *
   * Determines whether a turn should be stored in this overlay's YAML file.
   * Override in subclasses for custom filtering logic.
   *
   * Default behavior:
   * - O1 (Structural): Store ALL turns for complete conversation history
   * - Other overlays: Filter by alignment score OR high importance
   *
   * Why O1 stores everything:
   * - Ensures embeddings are always written to LanceDB
   * - Provides complete conversation record
   * - Other overlays can reference O1's LanceDB data
   *
   * @param turn - Turn to check for relevance
   * @returns True if turn should be stored in this overlay
   * @protected
   *
   * @example
   * // O1 accepts all turns
   * isRelevantToOverlay(anyTurn) // → true
   *
   * // O2 filters by alignment
   * isRelevantToOverlay({ alignment_O2: 8.5, ... }) // → true
   * isRelevantToOverlay({ alignment_O2: 0, importance: 3, ... }) // → false
   */
  protected isRelevantToOverlay(turn: {
    turn_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    embedding: number[];
    project_alignment_score: number;
    novelty: number;
    importance: number;
  }): boolean {
    const overlayId = this.getOverlayId();

    // O1 (Structural) stores ALL turns for complete conversation history
    // This ensures embeddings are always written to LanceDB
    if (overlayId === 'O1') {
      return true;
    }

    // Other overlays filter by alignment score
    const alignmentScores = this.extractAlignmentScores(
      turn.project_alignment_score
    );
    const scoreKey = `alignment_${overlayId}` as keyof typeof alignmentScores;

    // Include if alignment score > 0 OR importance >= 8 (critical turns)
    return alignmentScores[scoreKey] > 0 || turn.importance >= 8;
  }

  /**
   * Extract alignment scores for all 7 overlays from base project score
   *
   * Maps a single project alignment score to scores for all 7 overlays.
   * Subclasses SHOULD override to boost their specific overlay score.
   *
   * Default: All overlays get the same base score
   * Override: Set specific overlay higher (e.g., O2 manager boosts alignment_O2)
   *
   * @param projectAlignmentScore - Base alignment score from turn analysis
   * @returns Alignment scores for all 7 overlays (O1-O7)
   * @protected
   *
   * @example
   * // Base class: all overlays get same score
   * extractAlignmentScores(5.0)
   * // → { alignment_O1: 5, alignment_O2: 5, ..., alignment_O7: 5 }
   *
   * // Subclass (e.g., SecurityManager): boost O2
   * extractAlignmentScores(5.0)
   * // → { alignment_O1: 0, alignment_O2: 5, alignment_O3: 0, ... }
   */
  protected extractAlignmentScores(projectAlignmentScore: number): {
    alignment_O1: number;
    alignment_O2: number;
    alignment_O3: number;
    alignment_O4: number;
    alignment_O5: number;
    alignment_O6: number;
    alignment_O7: number;
  } {
    // Default: use project alignment score for all overlays
    // Subclasses should override to set their specific overlay higher
    return {
      alignment_O1: projectAlignmentScore,
      alignment_O2: projectAlignmentScore,
      alignment_O3: projectAlignmentScore,
      alignment_O4: projectAlignmentScore,
      alignment_O5: projectAlignmentScore,
      alignment_O6: projectAlignmentScore,
      alignment_O7: projectAlignmentScore,
    };
  }

  /**
   * Extract semantic tags from turn content
   *
   * Identifies keywords for indexing and filtering. Override in subclasses
   * to add domain-specific keywords.
   *
   * Base extraction:
   * - Generic technical words longer than 4 characters
   * - Limited to top 10 unique tags
   *
   * Subclass enhancement:
   * - Add domain keywords (e.g., "security", "authentication" for O2)
   * - Merge with base tags
   *
   * @param content - Turn content to extract tags from
   * @returns Array of unique semantic tags (max 10)
   * @protected
   *
   * @example
   * // Base extraction
   * extractSemanticTags('Update the authentication module')
   * // → ['update', 'authentication', 'module']
   *
   * // O2 Security override adds domain keywords
   * extractSemanticTags('Fix XSS vulnerability')
   * // → ['security', 'vulnerability', 'fix']
   */
  protected extractSemanticTags(content: string): string[] {
    // Simple extraction: extract words longer than 4 characters
    const words = content
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 4);
    // Return unique tags, limit to top 10
    return [...new Set(words)].slice(0, 10);
  }

  /**
   * Extract references to other conversation turns
   *
   * Detects patterns that reference other turns, enabling lattice edge
   * construction. Override in subclasses for domain-specific patterns.
   *
   * Base pattern: "turn_123" format
   *
   * @param content - Turn content to extract references from
   * @returns Array of unique turn IDs referenced
   * @protected
   *
   * @example
   * extractReferences('As discussed in turn_42...')
   * // → ['turn_42']
   */
  protected extractReferences(content: string): string[] {
    // Simple extraction: look for patterns like "turn_1", "turn_2", etc.
    const turnPattern = /turn_\d+/g;
    const matches = content.match(turnPattern);
    return matches ? [...new Set(matches)] : [];
  }

  /**
   * Get count of turns currently in memory buffer
   *
   * Used for monitoring and debugging to check how many turns are pending
   * flush to disk.
   *
   * @returns Number of turns in memory buffer
   *
   * @example
   * console.log(`Buffered: ${manager.getInMemoryCount()} turns`);
   */
  getInMemoryCount(): number {
    return this.inMemoryTurns.length;
  }
}
