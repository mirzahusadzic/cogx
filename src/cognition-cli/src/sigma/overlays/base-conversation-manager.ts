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
> implements OverlayAlgebra<T>
{
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

  constructor(
    protected sigmaRoot: string,
    protected overlayName: string,
    workbenchUrl?: string,
    debug?: boolean
  ) {
    this.overlayPath = path.join(sigmaRoot, 'overlays', overlayName);
    this.workbench = new WorkbenchClient(
      workbenchUrl || process.env.WORKBENCH_URL || 'http://localhost:8000',
      debug || false
    );
    // Initialize LanceDB store for fast semantic search
    this.lanceStore = new ConversationLanceStore(sigmaRoot);
  }

  /**
   * Initialize the LanceDB store (must be called before use).
   * This is async so it can't be done in constructor.
   */
  async initializeLanceStore(): Promise<void> {
    await this.lanceStore.initialize('conversation_turns');
  }

  /**
   * Set the current session ID for filtering queries.
   */
  setCurrentSession(sessionId: string): void {
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
      const overlayFiles = await fs.readdir(this.overlayPath);

      for (const file of overlayFiles) {
        if (!file.endsWith('.yaml')) continue;

        const sessionId = file.replace('.yaml', '');

        // 1. Try LanceDB first (fast path - avoid reading YAML)
        try {
          const lanceTurns = await this.lanceStore.getSessionTurns(sessionId);

          if (lanceTurns.length > 0) {
            // LanceDB has data - use it! (skip YAML)
            for (const turn of lanceTurns) {
              items.push({
                id: turn.id,
                embedding: turn.embedding,
                metadata: {
                  text: turn.content,
                  turn_id: turn.id,
                  role: turn.role as 'user' | 'assistant' | 'system',
                  timestamp: turn.timestamp,
                  project_alignment_score: turn.alignment_O1, // Use O1 as default
                  novelty: turn.novelty,
                  importance: turn.importance,
                  session_id: turn.session_id,
                } as T,
              });
            }
            continue; // Skip YAML for this session
          }
        } catch (lanceError) {
          // LanceDB failed or not initialized - fall through to YAML
          console.warn(
            `[BaseConversationManager] LanceDB unavailable for ${sessionId}, using YAML fallback`
          );
        }

        // 2. LanceDB empty/failed - Load from YAML and migrate
        const content = await fs.readFile(
          path.join(this.overlayPath, file),
          'utf-8'
        );
        const overlay = YAML.parse(content) as ConversationOverlay;

        // Detect format version
        const formatVersion = overlay.format_version || 1;
        const isLegacyFormat =
          formatVersion === 1 && overlay.turns[0]?.embedding;

        if (isLegacyFormat) {
          console.warn(
            `[DEPRECATED] Session ${sessionId} uses v1 format (embeddings in YAML). Migrating to v2 (LanceDB)...`
          );
          console.warn(
            `[DEPRECATED] v1 format will be removed in v3.0. Migration happens automatically.`
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
              // These will be regenerated in background during future refactor
              // Only log in debug mode to avoid spamming TUI
              if (process.env.DEBUG) {
                console.warn(
                  `[BaseConversationManager] Skipping turn ${turn.turn_id} - no embedding in LanceDB`
                );
              }
              continue; // Skip this turn instead of blocking UI
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
      return lanceResults.map((result) => ({
        item: {
          id: result.id,
          embedding: queryEmbedding, // We don't return embeddings from LanceDB to save memory
          metadata: {
            text: result.content,
            turn_id: result.id,
            role: result.role,
            timestamp: result.timestamp,
            project_alignment_score: result.metadata.alignment_O1, // Use O1 (structural) as default
            novelty: result.metadata.novelty,
            importance: result.metadata.importance,
            session_id: result.session_id,
          } as T,
        },
        similarity: result.similarity,
      }));
    } catch (error) {
      // Fallback to in-memory search if LanceDB fails
      console.warn(
        '[BaseConversationManager] LanceDB query failed, falling back to in-memory:',
        error
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
   * Add turn to in-memory overlay
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
   * Clear in-memory turns (after flush)
   */
  clearMemory(): void {
    this.inMemoryTurns = [];
  }

  /**
   * Migrate a v1 YAML session to LanceDB (v2 format).
   * Called automatically when v1 format is detected.
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
        console.error(
          `[Migration] Failed to migrate turn ${turn.turn_id}:`,
          error
        );
        failedCount++;
      }
    }

    console.log(
      `[Migration] ✓ Migrated ${migratedCount} turns to LanceDB (${failedCount} failed)`
    );
  }

  /**
   * Flush in-memory turns to disk (dual-write: YAML + LanceDB).
   * v2 Format: YAML is human-readable metadata, LanceDB stores embeddings.
   *
   * FILTERING: Only stores turns relevant to this overlay (based on alignment score).
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
      console.warn(
        '[BaseConversationManager] Failed to write to LanceDB:',
        error
      );
      // Continue even if LanceDB write fails - YAML is the source of truth
    }
  }

  /**
   * Check if a turn is relevant to this specific overlay.
   * Override in subclasses for custom filtering logic.
   *
   * Default: For conversation overlays, store ALL turns in O1 (Structural)
   * to ensure complete conversation history in LanceDB. Other overlays filter
   * by alignment score.
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
   * Extract alignment scores for all 7 overlays.
   * Subclasses can override to provide overlay-specific scores.
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
   * Extract semantic tags from content.
   * Override in subclasses for domain-specific extraction.
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
   * Extract references to other turns from content.
   * Override in subclasses for domain-specific extraction.
   */
  protected extractReferences(content: string): string[] {
    // Simple extraction: look for patterns like "turn_1", "turn_2", etc.
    const turnPattern = /turn_\d+/g;
    const matches = content.match(turnPattern);
    return matches ? [...new Set(matches)] : [];
  }

  /**
   * Get in-memory turn count
   */
  getInMemoryCount(): number {
    return this.inMemoryTurns.length;
  }
}
