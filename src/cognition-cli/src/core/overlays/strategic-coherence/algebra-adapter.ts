import { StrategicCoherenceManager, SymbolCoherence } from './manager.js';
import { MissionConceptsManager } from '../mission-concepts/manager.js';
import {
  OverlayItem,
  SelectOptions,
  OverlayMetadata,
} from '../../algebra/overlay-algebra.js';
import { BaseOverlayManager } from '../../algebra/base-manager.js';

/**
 * Metadata for coherence overlay items (O₇)
 */
export interface CoherenceMetadata extends OverlayMetadata {
  /** Arbitrary domain-specific fields */
  [key: string]: unknown;

  text: string; // Symbol name
  symbolName: string; // Code symbol
  filePath: string; // Source file
  symbolHash: string; // Structural hash
  overallCoherence: number; // Average alignment score
  topConceptText: string; // Most aligned concept
  topConceptScore: number; // Highest alignment score
  alignmentCount: number; // Number of top alignments
}

/**
 * CoherenceAlgebraAdapter
 *
 * Adapter for O₇ Coherence overlay to implement OverlayAlgebra interface.
 * Coherence data is computed (synthesis of O₁ + O₄), not extracted.
 *
 * Now extends BaseOverlayManager to unify algebra logic.
 */
export class CoherenceAlgebraAdapter extends BaseOverlayManager<CoherenceMetadata> {
  private coherenceManager: StrategicCoherenceManager;
  private missionManager: MissionConceptsManager;

  constructor(
    private pgcRoot: string,
    workbenchUrl?: string
  ) {
    super(pgcRoot, workbenchUrl);
    this.coherenceManager = new StrategicCoherenceManager(
      pgcRoot,
      workbenchUrl
    );
    this.missionManager = new MissionConceptsManager(pgcRoot, workbenchUrl);
  }

  /**
   * Close all resources
   */
  async close(): Promise<void> {
    await this.coherenceManager.close();
  }

  // ========================================
  // OVERLAY ALGEBRA INTERFACE
  // ========================================

  getOverlayId(): string {
    return 'O7';
  }

  getOverlayName(): string {
    return 'Coherence';
  }

  getSupportedTypes(): string[] {
    return ['alignment', 'coherence_score', 'drift'];
  }

  async getAllItems(): Promise<OverlayItem<CoherenceMetadata>[]> {
    // Get coherence overlay
    const overlay = await this.coherenceManager.retrieve();
    if (!overlay) {
      return [];
    }

    // Get all mission concepts with embeddings
    const missionHashes = overlay.mission_document_hashes;
    const allConcepts: Map<string, number[]> = new Map();

    // Load embeddings helper (v1/v2 compatible)
    const { EmbeddingLoader } = await import('../../pgc/embedding-loader.js');
    const loader = new EmbeddingLoader();

    for (const hash of missionHashes) {
      const missionOverlay = await this.missionManager.retrieve(hash);
      if (missionOverlay) {
        // Load concepts with embeddings (v1 from YAML or v2 from LanceDB)
        const conceptsWithEmbeddings = await loader.loadConceptsWithEmbeddings(
          missionOverlay as unknown as import('../../pgc/embedding-loader.js').OverlayData,
          this.pgcRoot
        );

        for (const concept of conceptsWithEmbeddings) {
          if (concept.embedding && concept.embedding.length === 768) {
            allConcepts.set(concept.text, concept.embedding);
          }
        }
      }
    }

    // Convert each SymbolCoherence to OverlayItem
    const items: OverlayItem<CoherenceMetadata>[] = [];

    for (const symbolCoherence of overlay.symbol_coherence) {
      // Generate synthetic embedding by averaging top aligned concept embeddings
      const embedding = this.synthesizeEmbedding(symbolCoherence, allConcepts);

      if (embedding.length === 768) {
        const topAlignment = symbolCoherence.topAlignments[0];

        items.push({
          id: `${symbolCoherence.symbolHash}:${symbolCoherence.symbolName}`,
          embedding,
          metadata: {
            text: symbolCoherence.symbolName,
            symbolName: symbolCoherence.symbolName,
            filePath: symbolCoherence.filePath,
            symbolHash: symbolCoherence.symbolHash,
            overallCoherence: symbolCoherence.overallCoherence,
            topConceptText: topAlignment?.conceptText || 'unknown',
            topConceptScore: topAlignment?.alignmentScore || 0,
            alignmentCount: symbolCoherence.topAlignments.length,
            type: 'coherence_score', // Default type
          },
        });
      }
    }

    return items;
  }

  /**
   * Synthesize embedding from top aligned concept embeddings
   * Uses weighted average based on alignment scores
   */
  private synthesizeEmbedding(
    symbolCoherence: SymbolCoherence,
    conceptEmbeddings: Map<string, number[]>
  ): number[] {
    const embeddings: Array<{ embedding: number[]; weight: number }> = [];

    for (const alignment of symbolCoherence.topAlignments) {
      const embedding = conceptEmbeddings.get(alignment.conceptText);
      if (embedding) {
        embeddings.push({
          embedding,
          weight: alignment.alignmentScore,
        });
      }
    }

    if (embeddings.length === 0) {
      // No concept embeddings found, return zero vector
      return new Array(768).fill(0);
    }

    // Weighted average
    const result = new Array(768).fill(0);
    let totalWeight = 0;

    for (const { embedding, weight } of embeddings) {
      for (let i = 0; i < 768; i++) {
        result[i] += embedding[i] * weight;
      }
      totalWeight += weight;
    }

    // Normalize
    if (totalWeight > 0) {
      for (let i = 0; i < 768; i++) {
        result[i] /= totalWeight;
      }
    }

    return result;
  }

  /**
   * Override getItemsByType to support coherence-specific classifications.
   */
  async getItemsByType(
    type: string
  ): Promise<OverlayItem<CoherenceMetadata>[]> {
    const allItems = await this.getAllItems();

    // Classify by coherence level
    if (type === 'alignment') {
      return allItems.filter((item) => item.metadata.overallCoherence >= 0.7);
    } else if (type === 'drift') {
      return allItems.filter((item) => item.metadata.overallCoherence < 0.5);
    } else if (type === 'coherence_score') {
      return allItems; // All items are coherence scores
    }

    return super.getItemsByType(type);
  }

  /**
   * Override select to support symbol-based selection used in Coherence.
   */
  async select(
    options: SelectOptions
  ): Promise<OverlayItem<CoherenceMetadata>[]> {
    const allItems = await this.getAllItems();

    if (options.symbols) {
      return allItems.filter((item) =>
        options.symbols!.has(item.metadata.symbolName)
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
  async exclude(
    options: SelectOptions
  ): Promise<OverlayItem<CoherenceMetadata>[]> {
    const allItems = await this.getAllItems();

    if (options.symbols) {
      return allItems.filter(
        (item) => !options.symbols!.has(item.metadata.symbolName)
      );
    }

    if (options.ids) {
      return allItems.filter((item) => !options.ids!.has(item.id));
    }

    return super.exclude(options);
  }

  /**
   * Override getSymbolSet to return symbolName.
   */
  async getSymbolSet(): Promise<Set<string>> {
    const allItems = await this.getAllItems();
    return new Set(allItems.map((item) => item.metadata.symbolName));
  }

  /**
   * Get aligned symbols (high coherence >= 0.7)
   */
  async getAlignedItems(): Promise<OverlayItem<CoherenceMetadata>[]> {
    return this.getItemsByType('alignment');
  }

  /**
   * Get drifted symbols (low coherence < 0.5)
   */
  async getDriftedItems(): Promise<OverlayItem<CoherenceMetadata>[]> {
    return this.getItemsByType('drift');
  }

  /**
   * Get items sorted by coherence score
   */
  async getItemsByCoherence(
    descending: boolean = true
  ): Promise<OverlayItem<CoherenceMetadata>[]> {
    const allItems = await this.getAllItems();
    return allItems.sort((a, b) =>
      descending
        ? b.metadata.overallCoherence - a.metadata.overallCoherence
        : a.metadata.overallCoherence - b.metadata.overallCoherence
    );
  }
}
