/**
 * Base Conversation Overlay Manager
 *
 * Common functionality for all 7 conversation overlays (O1-O7).
 * Each overlay stores conversation turns with project alignment scores.
 */

import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';
import {
  OverlayItem,
  OverlayMetadata,
  SelectOptions,
} from '../../core/algebra/overlay-algebra.js';
import { BaseOverlayManager } from '../../core/algebra/base-manager.js';
import { ConversationLanceStore } from '../conversation-lance-store.js';
import { systemDiagnosticsService } from '../../core/services/diagnostics/SystemDiagnosticsService.js';

import { AlignmentScores } from './types.js';

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
 *
 * Now extends BaseOverlayManager to unify algebra logic.
 */
export abstract class BaseConversationManager<
  T extends ConversationTurnMetadata,
> extends BaseOverlayManager<T> {
  protected overlayPath: string;
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
    debug?: boolean,
    lanceStore?: ConversationLanceStore
  ) {
    super(sigmaRoot, workbenchUrl, debug);
    this.overlayPath = path.join(sigmaRoot, 'overlays', overlayName);
    // Initialize LanceDB store for fast semantic search
    // Use shared store if provided, otherwise create new one (legacy)
    this.lanceStore = lanceStore || new ConversationLanceStore(sigmaRoot);
  }

  /**
   * Initialize the LanceDB store for fast semantic search
   */
  async initializeLanceStore(): Promise<void> {
    await this.lanceStore.initialize('conversation_turns');
  }

  /**
   * Set the current session ID for filtering queries
   */
  setCurrentSession(sessionId: string): void {
    if (this.debug) {
      systemDiagnosticsService.systemLog(
        'sigma',
        `[Manager] ${this.overlayName}.setCurrentSession(${sessionId})`
      );
    }
    this.currentSessionId = sessionId;
  }

  // ========================================
  // OVERLAY ALGEBRA INTERFACE IMPLEMENTATION
  // ========================================

  abstract getOverlayId(): string;
  abstract getOverlayName(): string;
  abstract getSupportedTypes(): string[];

  /**
   * Sigma specific: use 'role' as the metadata discriminator instead of 'type'.
   */
  protected getItemType(item: OverlayItem<T>): string | undefined {
    return item.metadata.role;
  }

  async getAllItems(): Promise<OverlayItem<T>[]> {
    const items: OverlayItem<T>[] = [];

    // Priority: LanceDB first (fast), YAML fallback (migration)
    if (await fs.pathExists(this.overlayPath)) {
      if (this.currentSessionId) {
        await this.loadItemsFromSession(this.currentSessionId, items);
      } else {
        const overlayFiles = await fs.readdir(this.overlayPath);
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
            type: turn.role, // Populate common 'type' from 'role'
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
   */
  private async loadItemsFromSession(
    sessionId: string,
    items: OverlayItem<T>[]
  ): Promise<void> {
    // 1. Try LanceDB first (fast path - avoid reading YAML)
    try {
      const lanceTurns = await this.lanceStore.getSessionTurns(sessionId);

      if (lanceTurns.length > 0) {
        for (const turn of lanceTurns) {
          // Get overlay-specific alignment score
          const overlayId = this.getOverlayId();
          const alignmentKey = `alignment_${overlayId}` as keyof typeof turn;
          const alignmentScore = (turn[alignmentKey] as number) || 0;

          items.push({
            id: turn.id,
            embedding: turn.embedding,
            metadata: {
              type: turn.role, // Populate common 'type' from 'role'
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
    } catch {
      // Fall through to YAML
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
            continue;
          }
        }

        if (embedding && Array.isArray(embedding) && embedding.length > 0) {
          items.push({
            id: turn.turn_id,
            embedding: embedding,
            metadata: {
              type: turn.role, // Populate common 'type' from 'role'
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
    } catch {
      // Handle or log YAML error
    }
  }

  /**
   * Optimized query using LanceDB for fast vector search.
   */
  async query(
    queryText: string,
    topK: number = 10,
    precomputedEmbedding?: number[]
  ): Promise<Array<{ item: OverlayItem<T>; similarity: number }>> {
    let queryEmbedding: number[];

    if (precomputedEmbedding && precomputedEmbedding.length === 768) {
      queryEmbedding = precomputedEmbedding;
    } else {
      const embedResponse = await this.workbench.embed({
        signature: queryText,
        dimensions: 768,
      });

      queryEmbedding = embedResponse['embedding_768d'] as number[];
      if (!queryEmbedding || queryEmbedding.length !== 768) {
        throw new Error('Failed to generate query embedding');
      }
    }

    // Use LanceDB for fast vector search
    try {
      const lanceResults = await this.lanceStore.similaritySearch(
        queryEmbedding,
        topK,
        this.currentSessionId
          ? { session_id: this.currentSessionId }
          : undefined,
        'cosine'
      );

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
            embedding: queryEmbedding,
            metadata: {
              type: result.role,
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
    } catch {
      // Fallback to in-memory search if LanceDB fails
      return super.query(queryText, topK, queryEmbedding);
    }
  }

  /**
   * Override select to support symbol-based selection used in Sigma (mapped to text).
   */
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

    return super.select(options);
  }

  /**
   * Override exclude to support symbol-based exclusion.
   */
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

    return super.exclude(options);
  }

  /**
   * Override getSymbolSet to return text of turns.
   */
  async getSymbolSet(): Promise<Set<string>> {
    const allItems = await this.getAllItems();
    return new Set(allItems.map((item) => item.metadata.text));
  }

  // ========================================
  // SIGMA SPECIFIC LOGIC
  // ========================================

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

  clearMemory(): void {
    this.inMemoryTurns = [];
  }

  private async migrateSessionToLanceDB(
    sessionId: string,
    overlay: ConversationOverlay
  ): Promise<void> {
    for (const turn of overlay.turns) {
      if (!turn.embedding || turn.embedding.length !== 768) {
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
      } catch {
        // Ignore or log error
      }
    }
  }

  async flush(sessionId: string): Promise<void> {
    if (this.inMemoryTurns.length === 0) return;

    const relevantTurns = this.inMemoryTurns.filter((turn) =>
      this.isRelevantToOverlay(turn)
    );

    if (relevantTurns.length === 0) return;

    const overlay: ConversationOverlay = {
      session_id: sessionId,
      format_version: 2,
      turns: relevantTurns.map((turn) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { embedding, ...turnWithoutEmbedding } = turn;
        return turnWithoutEmbedding;
      }),
      generated_at: new Date().toISOString(),
    };

    await fs.ensureDir(this.overlayPath);
    const filePath = path.join(this.overlayPath, `${sessionId}.yaml`);
    await fs.writeFile(filePath, YAML.stringify(overlay), 'utf-8');

    try {
      for (const turn of relevantTurns) {
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
      }
    } catch {
      // Ignore or log error
    }
  }

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
    if (overlayId === 'O1') return true;

    const alignmentScores = this.extractAlignmentScores(
      turn.project_alignment_score
    );
    const scoreKey = `alignment_${overlayId}` as keyof typeof alignmentScores;
    return alignmentScores[scoreKey] > 0 || turn.importance >= 8;
  }

  protected extractAlignmentScores(
    projectAlignmentScore: number
  ): AlignmentScores {
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

  protected extractSemanticTags(content: string): string[] {
    const words = content
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 4);
    return [...new Set(words)].slice(0, 10);
  }

  protected extractReferences(content: string): string[] {
    const turnPattern = /turn_\d+/g;
    const matches = content.match(turnPattern);
    return matches ? [...new Set(matches)] : [];
  }

  getInMemoryCount(): number {
    return this.inMemoryTurns.length;
  }
}
