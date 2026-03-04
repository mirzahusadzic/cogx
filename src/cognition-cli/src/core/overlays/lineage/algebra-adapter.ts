import { LanceVectorStore } from '../vector-db/lance-store.js';
import { PGCManager } from '../../pgc/manager.js';
import path from 'path';
import { OverlayItem } from '../../algebra/overlay-algebra.js';
import {
  LineagePatternMetadata,
  LineagePatternMetadataSchema,
} from './types.js';
import { BasePatternManager } from '../base/manager.js';
import { LineageMetadata } from './metadata.js';

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
export class LineageAlgebraAdapter extends BasePatternManager<LineageMetadata> {
  private vectorStore: LanceVectorStore;
  private pgcManager: PGCManager;

  constructor(pgcRoot: string, workbenchUrl?: string) {
    super(pgcRoot, workbenchUrl);
    this.vectorStore = new LanceVectorStore(pgcRoot);
    // PGCManager expects projectRoot, not pgcRoot
    const projectRoot = path.dirname(pgcRoot);
    this.pgcManager = new PGCManager(projectRoot);
  }

  // ========================================
  // BASE PATTERN MANAGER IMPLEMENTATION
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

  protected getSymbol(item: OverlayItem<LineageMetadata>): string {
    return item.metadata.symbol;
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
            type: patternMetadata?.symbolType || (vec.symbolType as string) || 'function',
            symbol: vec.symbol,
            symbolType:
              (patternMetadata?.symbolType as any) ||
              (vec.symbolType as any) ||
              'function',
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

  // ========================================
  // LEGACY METHODS (preserved for compatibility)
  // ========================================

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
