import { LanceVectorStore } from '../vector-db/lance-store.js';
import { WorkbenchClient } from '../../executors/workbench-client.js';
import {
  OverlayAlgebra,
  OverlayItem,
  OverlayMetadata,
  SelectOptions,
} from '../../algebra/overlay-algebra.js';

/**
 * Metadata for structural pattern overlay items (O₁)
 */
export interface StructuralMetadata extends OverlayMetadata {
  text: string; // Symbol name (for semantic queries)
  symbol: string; // Symbol name (function, class, etc.)
  type: 'structural' | 'semantic'; // Embedding type
  structuralSignature: string; // class:X | methods:5
  semanticSignature: string; // docstring content
  architecturalRole: string; // service, model, controller, etc.
  filePath: string; // Source file path
  structuralHash: string; // Provenance hash
  lineageHash: string; // Lineage tracking hash
  computedAt: string; // ISO timestamp
}

/**
 * StructuralPatternsManager
 *
 * Manages O₁ Structure overlay - code artifacts with dual embeddings.
 * Data is stored in LanceDB vector store, not YAML files.
 *
 * THE SHADOW ARCHITECTURE (Monument 4.7):
 * - Structural embeddings: Pattern-based (class:X | methods:5)
 * - Semantic embeddings: Purpose-based (docstring + type)
 * - Mission alignment uses semantic embeddings
 * - Pattern matching uses structural embeddings
 *
 * OVERLAY DATA SOURCE:
 * - LanceDB table: 'structural_patterns'
 * - Created during genesis (monument generation)
 * - Contains both structural and semantic vectors
 *
 * SUPPORTED TYPES:
 * - Symbol types: function, class, interface, module, variable
 * - Architectural roles: service, model, controller, utility, config, test
 */
export class StructuralPatternsManager
  implements OverlayAlgebra<StructuralMetadata>
{
  private vectorStore: LanceVectorStore;
  private workbench: WorkbenchClient;

  constructor(
    private pgcRoot: string,
    workbenchUrl?: string
  ) {
    this.vectorStore = new LanceVectorStore(pgcRoot);
    this.workbench = new WorkbenchClient(
      workbenchUrl || process.env.WORKBENCH_URL || 'http://localhost:8000'
    );
  }

  // ========================================
  // OVERLAY ALGEBRA INTERFACE
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

  getPgcRoot(): string {
    return this.pgcRoot;
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

  async filter(
    predicate: (metadata: StructuralMetadata) => boolean
  ): Promise<OverlayItem<StructuralMetadata>[]> {
    const allItems = await this.getAllItems();
    return allItems.filter((item) => predicate(item.metadata));
  }

  async query(
    query: string,
    topK: number = 10,
    precomputedEmbedding?: number[]
  ): Promise<
    Array<{ item: OverlayItem<StructuralMetadata>; similarity: number }>
  > {
    let queryEmbedding: number[];

    // Use pre-computed embedding if provided (optimization)
    if (precomputedEmbedding && precomputedEmbedding.length === 768) {
      queryEmbedding = precomputedEmbedding;
    } else {
      // Generate embedding for query
      const embedResponse = await this.workbench.embed({
        signature: query,
        dimensions: 768,
      });

      queryEmbedding = embedResponse['embedding_768d'] as number[];
      if (!queryEmbedding || queryEmbedding.length !== 768) {
        throw new Error('Failed to generate query embedding');
      }
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
  ): Promise<OverlayItem<StructuralMetadata>[]> {
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
  ): Promise<OverlayItem<StructuralMetadata>[]> {
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
