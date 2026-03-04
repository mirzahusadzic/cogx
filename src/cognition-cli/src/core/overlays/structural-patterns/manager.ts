import { LanceVectorStore } from '../vector-db/lance-store.js';
import { OverlayItem } from '../../algebra/overlay-algebra.js';
import { BasePatternManager } from '../base/manager.js';
import type { StructuralMetadata } from './metadata.js';

export type { StructuralMetadata };

/**
 * StructuralPatternsManager
 *
 * Manages O₁ Structure overlay - code artifacts with dual embeddings.
 * Data is stored in LanceDB vector store, not YAML files.
 */
export class StructuralPatternsManager extends BasePatternManager<StructuralMetadata> {
  private vectorStore: LanceVectorStore;

  constructor(pgcRoot: string, workbenchUrl?: string) {
    super(pgcRoot, workbenchUrl);
    this.vectorStore = new LanceVectorStore(pgcRoot);
  }

  // ========================================
  // OVERLAY ALGEBRA IMPLEMENTATION
  // ========================================

  getOverlayId(): string {
    return 'O1';
  }

  getOverlayName(): string {
    return 'Structure';
  }

  getSupportedTypes(): string[] {
    return [
      'function',
      'class',
      'interface',
      'module',
      'variable',
      'service',
      'model',
      'controller',
      'utility',
      'config',
      'test',
    ];
  }

  protected getSymbol(item: OverlayItem<StructuralMetadata>): string {
    return item.metadata.symbol;
  }

  async getAllItems(): Promise<OverlayItem<StructuralMetadata>[]> {
    // Initialize vector store
    await this.vectorStore.initialize('structural_patterns');

    // Get all vectors from LanceDB
    const vectors = await this.vectorStore.getAllVectors();

    // Convert to OverlayItem format
    const items: OverlayItem<StructuralMetadata>[] = [];

    for (const vec of vectors) {
      if (
        vec.embedding &&
        Array.isArray(vec.embedding) &&
        vec.embedding.length === 768
      ) {
        // Fields are top-level properties on VectorRecord, not nested in metadata
        const vectorType = (vec.type as string) || 'structural';
        const isSemanticVector = vectorType === 'semantic';
        const structuralSig = (vec.structural_signature as string) || '';
        const semanticSig = (vec.semantic_signature as string) || '';

        // Use semantic signature (shadow) for semantic vectors, structural signature for structural vectors
        const displayText = isSemanticVector
          ? semanticSig || vec.symbol
          : structuralSig || vec.symbol;

        items.push({
          id: vec.id,
          embedding: vec.embedding,
          metadata: {
            text: displayText, // Include the shadow/signature content
            symbol: vec.symbol,
            type: vectorType as 'structural' | 'semantic',
            structuralSignature: structuralSig,
            semanticSignature: semanticSig,
            architecturalRole: (vec.architectural_role as string) || 'unknown',
            filePath: (vec.filePath as string) || '',
            structuralHash: (vec.structuralHash as string) || '',
            lineageHash: (vec.lineage_hash as string) || '',
            computedAt: (vec.computed_at as string) || new Date().toISOString(),
          },
        });
      }
    }

    return items;
  }

  /**
   * Override getItemsByType to support both embedding type (structural/semantic)
   * and architectural role.
   */
  async getItemsByType(
    type: string
  ): Promise<OverlayItem<StructuralMetadata>[]> {
    const allItems = await this.getAllItems();

    // Type can be either embedding type (structural/semantic) or architectural role
    return allItems.filter(
      (item) =>
        item.metadata.type === type || item.metadata.architecturalRole === type
    );
  }

  // ========================================
  // DOMAIN-SPECIFIC METHODS
  // ========================================

  /**
   * Get only semantic embeddings (for mission alignment)
   */
  async getSemanticItems(): Promise<OverlayItem<StructuralMetadata>[]> {
    return this.getItemsByType('semantic');
  }

  /**
   * Get only structural embeddings (for pattern matching)
   */
  async getStructuralItems(): Promise<OverlayItem<StructuralMetadata>[]> {
    return this.getItemsByType('structural');
  }

  /**
   * Get items by architectural role (service, model, controller, etc.)
   */
  async getItemsByRole(
    role: string
  ): Promise<OverlayItem<StructuralMetadata>[]> {
    const allItems = await this.getAllItems();
    return allItems.filter((item) => item.metadata.architecturalRole === role);
  }

  /**
   * Get items from specific file
   */
  async getItemsByFile(
    filePath: string
  ): Promise<OverlayItem<StructuralMetadata>[]> {
    const allItems = await this.getAllItems();
    return allItems.filter((item) => item.metadata.filePath === filePath);
  }
}
