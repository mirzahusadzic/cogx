import { MissionConcept } from '../../analyzers/concept-extractor.js';
import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';
import { WorkbenchClient } from '../../executors/workbench-client.js';
import { EmbedLogger } from '../shared/embed-logger.js';
import {
  OverlayAlgebra,
  OverlayItem,
  OverlayMetadata,
  SelectOptions,
} from '../../algebra/overlay-algebra.js';

/**
 * Mission concepts overlay
 * Stores extracted mission-critical concepts for strategic coherence analysis
 *
 * EMBEDDINGS:
 * - Each concept has a 768-dimensional vector from eGemma
 * - Used for semantic alignment scoring in strategic coherence analysis
 */
export interface MissionConceptsOverlay {
  document_hash: string; // Content hash of source document
  document_path: string; // Path to source markdown file
  extracted_concepts: MissionConcept[]; // Ranked concepts with 768d embeddings
  generated_at: string; // ISO timestamp
  transform_id: string; // Transform that generated this overlay
}

/**
 * Metadata for mission concept overlay items
 */
export interface MissionConceptMetadata extends OverlayMetadata {
  text: string; // Concept text
  type: 'vision' | 'concept' | 'principle' | 'goal'; // Concept type
  weight: number; // Importance score (0-1)
  occurrences: number; // Frequency in document
  section: string; // Source section
  sectionHash: string; // Section hash for provenance
  documentHash: string; // Document hash for provenance
}

/**
 * MissionConceptsManager
 *
 * Manages mission concepts overlays in the PGC.
 * Stores extracted concepts from strategic documents (VISION.md, etc.)
 * for use in strategic coherence scoring.
 *
 * OVERLAY STRUCTURE:
 * .open_cognition/overlays/mission_concepts/<doc-hash>.yaml
 *
 * EMBEDDINGS (O₃ = O₁ Pattern):
 * - Generates 768-dimensional embeddings via eGemma (Workbench)
 * - Follows Monument O₁ pattern: Extract → Embed → Store
 * - Embeddings enable semantic alignment scoring
 *
 * PROVENANCE:
 * - Each concept tracks source section via sectionHash
 * - Overlay tracks source document via document_hash
 * - Full transform chain via transform_id
 */
export class MissionConceptsManager
  implements OverlayAlgebra<MissionConceptMetadata>
{
  private overlayPath: string;
  private workbench: WorkbenchClient;

  constructor(
    private pgcRoot: string,
    workbenchUrl?: string
  ) {
    this.overlayPath = path.join(pgcRoot, 'overlays', 'mission_concepts');
    this.workbench = new WorkbenchClient(
      workbenchUrl || process.env.WORKBENCH_URL || 'http://localhost:8000'
    );
  }

  // ========================================
  // OVERLAY ALGEBRA INTERFACE
  // ========================================

  getOverlayId(): string {
    return 'O4';
  }

  getOverlayName(): string {
    return 'Mission Concepts';
  }

  getSupportedTypes(): string[] {
    return ['vision', 'concept', 'principle', 'goal'];
  }

  getPgcRoot(): string {
    return this.pgcRoot;
  }

  /**
   * Classify concept type based on section name
   */
  private classifyConceptType(
    sectionName: string
  ): 'vision' | 'concept' | 'principle' | 'goal' {
    const normalized = sectionName.toLowerCase();

    if (
      normalized.includes('vision') ||
      normalized.includes('why') ||
      normalized.includes('purpose') ||
      normalized.includes('opportunity')
    ) {
      return 'vision';
    }

    if (
      normalized.includes('principle') ||
      normalized.includes('value') ||
      normalized.includes('philosophy')
    ) {
      return 'principle';
    }

    if (
      normalized.includes('goal') ||
      normalized.includes('strategic intent') ||
      normalized.includes('path forward')
    ) {
      return 'goal';
    }

    // Default: concept (for Mission, Solution, Architecture, etc.)
    return 'concept';
  }

  async getAllItems(): Promise<OverlayItem<MissionConceptMetadata>[]> {
    const hashes = await this.list();
    const items: OverlayItem<MissionConceptMetadata>[] = [];

    // Load embeddings helper (v1/v2 compatible)
    const { EmbeddingLoader } = await import('../../pgc/embedding-loader.js');
    const loader = new EmbeddingLoader();

    for (const hash of hashes) {
      const overlay = await this.retrieve(hash);
      if (overlay) {
        // Load concepts with embeddings (v1 from YAML or v2 from LanceDB)
        const conceptsWithEmbeddings = await loader.loadConceptsWithEmbeddings(
          overlay as unknown as import('../../pgc/embedding-loader.js').OverlayData,
          this.pgcRoot
        );

        for (const concept of conceptsWithEmbeddings) {
          items.push({
            id: `${hash}:${concept.text}`,
            embedding: concept.embedding!,
            metadata: {
              text: concept.text,
              type: this.classifyConceptType(concept.section),
              weight: concept.weight,
              occurrences: concept.occurrences,
              section: concept.section || 'unknown',
              sectionHash: concept.sectionHash || hash,
              documentHash: hash,
            },
          });
        }
      }
    }

    return items;
  }

  async getItemsByType(
    type: string
  ): Promise<OverlayItem<MissionConceptMetadata>[]> {
    const allItems = await this.getAllItems();
    return allItems.filter((item) => item.metadata.type === type);
  }

  async filter(
    predicate: (metadata: MissionConceptMetadata) => boolean
  ): Promise<OverlayItem<MissionConceptMetadata>[]> {
    const allItems = await this.getAllItems();
    return allItems.filter((item) => predicate(item.metadata));
  }

  async query(
    query: string,
    topK: number = 10,
    precomputedEmbedding?: number[]
  ): Promise<
    Array<{ item: OverlayItem<MissionConceptMetadata>; similarity: number }>
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

  async select(
    options: SelectOptions
  ): Promise<OverlayItem<MissionConceptMetadata>[]> {
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

  async exclude(
    options: SelectOptions
  ): Promise<OverlayItem<MissionConceptMetadata>[]> {
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

  // ========================================
  // LEGACY METHODS (keep for compatibility)
  // ========================================

  /**
   * Sanitize text for embedding (remove chars that trigger binary detection)
   */
  private sanitizeForEmbedding(text: string): string {
    return (
      text
        // Replace em-dash and en-dash with regular dash
        .replace(/[\u2013\u2014]/g, '-')
        // Replace various quotes with straight quotes
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        // Replace bullet points and checkmarks with asterisk
        .replace(/[\u2022\u2023\u25E6\u2043\u2219\u25CF\u2713\u2714]/g, '*')
        // Replace arrows with ASCII equivalents
        .replace(/[\u2192\u2190\u2191\u2193]/g, '->')
        // Remove any remaining non-ASCII characters
        .replace(/[^\x20-\x7E\n\r\t]/g, '')
    );
  }

  /**
   * Generate embeddings for mission concepts
   * Uses eGemma via Workbench (768 dimensions)
   */
  private async generateEmbeddings(
    concepts: MissionConcept[],
    documentName?: string
  ): Promise<MissionConcept[]> {
    const conceptsWithEmbeddings: MissionConcept[] = [];
    const total = concepts.length;

    for (let i = 0; i < concepts.length; i++) {
      const concept = concepts[i];

      // Show progress every 50 concepts or at specific milestones
      if (i === 0 || i === total - 1 || (i + 1) % 50 === 0) {
        EmbedLogger.progress(i + 1, total, 'MissionConcepts', documentName);
      }

      try {
        // Sanitize text to avoid triggering eGemma's binary detection
        const sanitizedText = this.sanitizeForEmbedding(concept.text);

        // Generate embedding for concept text
        const embedResponse = await this.workbench.embed({
          signature: sanitizedText,
          dimensions: 768, // eGemma native dimension
        });

        const embedding = embedResponse['embedding_768d'];

        if (!embedding || !Array.isArray(embedding)) {
          throw new Error(
            `Failed to generate embedding for concept: ${concept.text}`
          );
        }

        conceptsWithEmbeddings.push({
          ...concept,
          embedding: embedding as number[],
        });
      } catch (error) {
        throw new Error(
          `Failed to embed concept ${i + 1}/${total} "${concept.text.substring(0, 100)}...": ${(error as Error).message}`
        );
      }
    }

    return conceptsWithEmbeddings;
  }

  /**
   * Store mission concepts overlay (with embeddings)
   */
  async store(overlay: MissionConceptsOverlay): Promise<void> {
    await fs.ensureDir(this.overlayPath);

    // Extract document name from path for progress logging
    const documentName = path.basename(overlay.document_path);

    // Check if concepts already have embeddings (from security validation)
    const alreadyEmbedded = overlay.extracted_concepts.every(
      (c) => c.embedding && c.embedding.length === 768
    );

    let conceptsWithEmbeddings: MissionConcept[];

    if (alreadyEmbedded) {
      // Reuse existing embeddings (no re-embedding needed)
      conceptsWithEmbeddings = overlay.extracted_concepts;
    } else {
      // Generate embeddings for concepts that don't have them
      conceptsWithEmbeddings = await this.generateEmbeddings(
        overlay.extracted_concepts,
        documentName
      );
    }

    const enrichedOverlay: MissionConceptsOverlay = {
      ...overlay,
      extracted_concepts: conceptsWithEmbeddings,
    };

    const filePath = path.join(
      this.overlayPath,
      `${overlay.document_hash}.yaml`
    );

    const yamlContent = YAML.stringify(enrichedOverlay);
    await fs.writeFile(filePath, yamlContent, 'utf-8');
  }

  /**
   * Retrieve mission concepts for a document
   */
  async retrieve(documentHash: string): Promise<MissionConceptsOverlay | null> {
    const filePath = path.join(this.overlayPath, `${documentHash}.yaml`);

    if (!(await fs.pathExists(filePath))) {
      return null;
    }

    const yamlContent = await fs.readFile(filePath, 'utf-8');
    return YAML.parse(yamlContent) as MissionConceptsOverlay;
  }

  /**
   * List all mission concept overlays
   */
  async list(): Promise<string[]> {
    if (!(await fs.pathExists(this.overlayPath))) {
      return [];
    }

    const files = await fs.readdir(this.overlayPath);
    return files
      .filter((f) => f.endsWith('.yaml'))
      .map((f) => f.replace('.yaml', ''));
  }

  /**
   * Delete mission concepts overlay
   */
  async delete(documentHash: string): Promise<void> {
    const filePath = path.join(this.overlayPath, `${documentHash}.yaml`);

    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
    }
  }

  /**
   * Get all concepts across all overlays (no merging, preserves embeddings)
   * Used for semantic similarity search in Q&A
   */
  async getAllConcepts(): Promise<MissionConcept[]> {
    const hashes = await this.list();
    const allConcepts: MissionConcept[] = [];

    for (const hash of hashes) {
      const overlay = await this.retrieve(hash);
      if (overlay) {
        allConcepts.push(...overlay.extracted_concepts);
      }
    }

    return allConcepts;
  }

  /**
   * Get top N concepts across all overlays (global mission concepts)
   */
  async getTopConcepts(topN: number = 50): Promise<MissionConcept[]> {
    const hashes = await this.list();
    const allConcepts: MissionConcept[] = [];

    for (const hash of hashes) {
      const overlay = await this.retrieve(hash);
      if (overlay) {
        allConcepts.push(...overlay.extracted_concepts);
      }
    }

    // Merge duplicates and sort by weight
    const conceptMap = new Map<string, MissionConcept>();

    for (const concept of allConcepts) {
      const key = concept.text.toLowerCase();
      if (conceptMap.has(key)) {
        const existing = conceptMap.get(key)!;
        existing.occurrences += concept.occurrences;
        existing.weight = Math.max(existing.weight, concept.weight);
      } else {
        conceptMap.set(key, { ...concept });
      }
    }

    const merged = Array.from(conceptMap.values());
    merged.sort((a, b) => b.weight - a.weight);

    return merged.slice(0, topN);
  }
}
