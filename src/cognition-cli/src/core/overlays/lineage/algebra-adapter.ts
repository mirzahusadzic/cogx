import { LanceVectorStore } from '../vector-db/lance-store.js';
import { WorkbenchClient } from '../../executors/workbench-client.js';
import { PGCManager } from '../../pgc/manager.js';
import path from 'path';
import {
  OverlayAlgebra,
  OverlayItem,
  OverlayMetadata,
  SelectOptions,
} from '../../algebra/overlay-algebra.js';
import {
  LineagePatternMetadata,
  LineagePatternMetadataSchema,
} from './types.js';

/**
 * Metadata for lineage overlay items (O₃)
 */
export interface LineageMetadata extends OverlayMetadata {
  text: string; // Lineage signature (for queries)
  symbol: string; // Symbol name
  symbolType: 'class' | 'function' | 'interface' | 'type'; // Symbol type
  anchor: string; // File path anchor
  lineageHash: string; // Dependency graph hash
  embeddingHash: string; // Embedding hash
  lineageSignature: string; // Human-readable dependency signature
  computedAt: string; // ISO timestamp
  vectorId: string; // Vector DB ID
}

/**
 * LineageAlgebraAdapter
 *
 * Adapter for O₃ Lineage overlay to implement OverlayAlgebra interface.
 * Lineage data is stored in:
 * - LanceDB table: 'lineage_patterns' (embeddings)
 * - PGC overlays: 'lineage_patterns' (metadata)
 *
 * This adapter combines both sources to provide unified access.
 */
export class LineageAlgebraAdapter implements OverlayAlgebra<LineageMetadata> {
  private vectorStore: LanceVectorStore;
  private workbench: WorkbenchClient;
  private pgcManager: PGCManager;

  constructor(
    private pgcRoot: string,
    workbenchUrl?: string
  ) {
    this.vectorStore = new LanceVectorStore(pgcRoot);
    this.workbench = new WorkbenchClient(
      workbenchUrl || process.env.WORKBENCH_URL || 'http://localhost:8000'
    );
    // PGCManager expects projectRoot, not pgcRoot
    const projectRoot = path.dirname(pgcRoot);
    this.pgcManager = new PGCManager(projectRoot);
  }

  // ========================================
  // OVERLAY ALGEBRA INTERFACE
  // ========================================

  getOverlayId(): string {
    return 'O3';
  }

  getOverlayName(): string {
    return 'Lineage';
  }

  getSupportedTypes(): string[] {
    return [
      'dependency',
      'call_chain',
      'impact_zone',
      'class',
      'function',
      'interface',
      'type',
    ];
  }

  getPgcRoot(): string {
    return this.pgcRoot;
  }

  async getAllItems(): Promise<OverlayItem<LineageMetadata>[]> {
    // Initialize vector store for lineage patterns
    await this.vectorStore.initialize('lineage_patterns');

    // Get all vectors from LanceDB
    const vectors = await this.vectorStore.getAllVectors();

    // Get metadata manifest
    const manifest =
      await this.pgcManager.overlays.getManifest('lineage_patterns');

    // Convert to OverlayItem format
    const items: OverlayItem<LineageMetadata>[] = [];

    for (const vec of vectors) {
      if (
        vec.embedding &&
        Array.isArray(vec.embedding) &&
        vec.embedding.length === 768
      ) {
        // Try to find matching metadata in manifest
        const metadataKey = vec.symbol;
        let patternMetadata: LineagePatternMetadata | null = null;

        if (manifest && manifest[metadataKey]) {
          try {
            patternMetadata =
              await this.pgcManager.overlays.get<LineagePatternMetadata>(
                'lineage_patterns',
                metadataKey,
                LineagePatternMetadataSchema
              );
          } catch {
            // Metadata not found, use vector metadata only
          }
        }

        // Fields are top-level properties on VectorRecord, not nested in metadata
        items.push({
          id: vec.id,
          embedding: vec.embedding,
          metadata: {
            text:
              patternMetadata?.lineageSignature ||
              (vec.structural_signature as string) ||
              vec.symbol,
            symbol: vec.symbol,
            symbolType: patternMetadata?.symbolType || 'function',
            anchor: patternMetadata?.anchor || (vec.filePath as string) || '',
            lineageHash:
              patternMetadata?.lineageHash ||
              (vec.lineage_hash as string) ||
              '',
            embeddingHash: patternMetadata?.embeddingHash || '',
            lineageSignature:
              patternMetadata?.lineageSignature ||
              (vec.structural_signature as string) ||
              '',
            computedAt:
              patternMetadata?.computed_at ||
              (vec.computed_at as string) ||
              new Date().toISOString(),
            vectorId: patternMetadata?.vectorId || vec.id,
          },
        });
      }
    }

    return items;
  }

  async getItemsByType(type: string): Promise<OverlayItem<LineageMetadata>[]> {
    const allItems = await this.getAllItems();
    return allItems.filter((item) => item.metadata.symbolType === type);
  }

  async filter(
    predicate: (metadata: LineageMetadata) => boolean
  ): Promise<OverlayItem<LineageMetadata>[]> {
    const allItems = await this.getAllItems();
    return allItems.filter((item) => predicate(item.metadata));
  }

  async query(
    query: string,
    topK: number = 10
  ): Promise<
    Array<{ item: OverlayItem<LineageMetadata>; similarity: number }>
  > {
    // Generate embedding for query
    const embedResponse = await this.workbench.embed({
      signature: query,
      dimensions: 768,
    });

    const queryEmbedding = embedResponse['embedding_768d'] as number[];
    if (!queryEmbedding || queryEmbedding.length !== 768) {
      throw new Error('Failed to generate query embedding');
    }

    // Get all items and compute similarity
    const allItems = await this.getAllItems();
    const results = allItems.map((item) => ({
      item,
      similarity: this.cosineSimilarity(queryEmbedding, item.embedding),
    }));

    // Sort by similarity and return top K
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  async select(
    options: SelectOptions
  ): Promise<OverlayItem<LineageMetadata>[]> {
    const allItems = await this.getAllItems();

    if (options.symbols) {
      return allItems.filter((item) =>
        options.symbols!.has(item.metadata.symbol)
      );
    }

    if (options.ids) {
      return allItems.filter((item) => options.ids!.has(item.id));
    }

    return allItems;
  }

  async exclude(
    options: SelectOptions
  ): Promise<OverlayItem<LineageMetadata>[]> {
    const allItems = await this.getAllItems();

    if (options.symbols) {
      return allItems.filter(
        (item) => !options.symbols!.has(item.metadata.symbol)
      );
    }

    if (options.ids) {
      return allItems.filter((item) => !options.ids!.has(item.id));
    }

    return allItems;
  }

  async getSymbolSet(): Promise<Set<string>> {
    const allItems = await this.getAllItems();
    return new Set(allItems.map((item) => item.metadata.symbol));
  }

  async getIdSet(): Promise<Set<string>> {
    const allItems = await this.getAllItems();
    return new Set(allItems.map((item) => item.id));
  }

  /**
   * Get lineage items by symbol type (class, function, etc.)
   */
  async getItemsBySymbolType(
    symbolType: 'class' | 'function' | 'interface' | 'type'
  ): Promise<OverlayItem<LineageMetadata>[]> {
    return this.getItemsByType(symbolType);
  }

  /**
   * Get lineage for specific symbol
   */
  async getLineageForSymbol(
    symbol: string
  ): Promise<OverlayItem<LineageMetadata> | null> {
    const items = await this.select({ symbols: new Set([symbol]) });
    return items.length > 0 ? items[0] : null;
  }
}
