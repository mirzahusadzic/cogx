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
 */
export interface ConversationOverlay {
  session_id: string;
  turns: Array<{
    turn_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    embedding: number[];
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

    // 1. Load from disk (if exists)
    if (await fs.pathExists(this.overlayPath)) {
      const overlayFiles = await fs.readdir(this.overlayPath);

      for (const file of overlayFiles) {
        if (!file.endsWith('.yaml')) continue;

        const sessionId = file.replace('.yaml', '');
        const content = await fs.readFile(
          path.join(this.overlayPath, file),
          'utf-8'
        );
        const overlay = YAML.parse(content) as ConversationOverlay;

        for (const turn of overlay.turns) {
          if (turn.embedding && turn.embedding.length === 768) {
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
                session_id: sessionId,
              } as T,
            });
          }
        }
      }
    }

    // 2. Add in-memory turns (current session)
    for (const turn of this.inMemoryTurns) {
      if (turn.embedding && turn.embedding.length === 768) {
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

    const allItems = await this.getAllItems();
    const results = allItems.map((item) => ({
      item,
      similarity: this.cosineSimilarity(queryEmbedding, item.embedding),
    }));

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
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
   * Flush in-memory turns to disk
   */
  async flush(sessionId: string): Promise<void> {
    if (this.inMemoryTurns.length === 0) return;

    const overlay: ConversationOverlay = {
      session_id: sessionId,
      turns: this.inMemoryTurns,
      generated_at: new Date().toISOString(),
    };

    await fs.ensureDir(this.overlayPath);

    const filePath = path.join(this.overlayPath, `${sessionId}.yaml`);
    await fs.writeFile(filePath, YAML.stringify(overlay), 'utf-8');
  }

  /**
   * Get in-memory turn count
   */
  getInMemoryCount(): number {
    return this.inMemoryTurns.length;
  }
}
