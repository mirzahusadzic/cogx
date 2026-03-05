import { MissionConcept } from '../../analyzers/concept-extractor.js';
import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';
import { EmbedLogger } from '../shared/embed-logger.js';
import { OverlayItem } from '../../algebra/overlay-algebra.js';
import { BasePatternManager } from '../base/manager.js';
import { MissionConceptMetadata, MissionConceptsOverlay } from './metadata.js';

/**
 * MissionConceptsManager
 *
 * Manages mission concepts overlays in the PGC.
 * Stores extracted concepts from strategic documents (VISION.md, etc.)
 * for use in strategic coherence scoring.
 *
 * LATTICE POSITION: O₄ (Strategic)
 */
export class MissionConceptsManager extends BasePatternManager<MissionConceptMetadata> {
  private overlayPath: string;

  constructor(pgcRoot: string, workbenchUrl?: string) {
    super(pgcRoot, workbenchUrl);
    this.overlayPath = path.join(pgcRoot, 'overlays', 'mission_concepts');
  }

  // ========================================
  // BASE PATTERN MANAGER IMPLEMENTATION
  // ========================================

  getOverlayId(): string {
    return 'O4';
  }

  getOverlayName(): string {
    return 'Mission Concepts';
  }

  getSymbol(item: OverlayItem<MissionConceptMetadata>): string {
    return item.metadata.text;
  }

  getSupportedTypes(): string[] {
    return ['vision', 'concept', 'principle', 'goal'];
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

  // ========================================
  // INGESTION & STORAGE (Domain-Specific)
  // ========================================

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
   * Store embeddings in LanceDB (NOT in YAML!)
   */
  private async storeEmbeddingsInLance(
    concepts: MissionConcept[],
    documentHash: string,
    documentPath: string
  ): Promise<void> {
    const { LanceVectorStore } = await import('../vector-db/lance-store.js');
    const lanceStore = new LanceVectorStore(this.pgcRoot);
    await lanceStore.initialize('mission_concepts');

    const vectors = concepts
      .filter((item) => item.embedding && item.embedding.length > 0)
      .map((item, index) => ({
        id: `${documentHash}_${index}`,
        symbol: item.text.substring(0, 100),
        embedding: item.embedding!,
        document_hash: documentHash,
        structural_signature: `mission:${this.classifyConceptType(item.section || 'unknown')}`,
        semantic_signature: item.text,
        type: 'semantic',
        architectural_role: this.classifyConceptType(item.section || 'unknown'),
        computed_at: new Date().toISOString(),
        lineage_hash: documentHash,
        filePath: documentPath,
        structuralHash: documentHash,
      }));

    if (vectors.length > 0) {
      await lanceStore.batchStoreVectors(
        vectors.map((v) => ({
          id: v.id,
          embedding: v.embedding,
          metadata: {
            symbol: v.symbol,
            document_hash: v.document_hash,
            structural_signature: v.structural_signature,
            semantic_signature: v.semantic_signature,
            type: v.type,
            architectural_role: v.architectural_role,
            computed_at: v.computed_at,
            lineage_hash: v.lineage_hash,
            filePath: v.filePath,
            structuralHash: v.structuralHash,
          },
        }))
      );
    }

    await lanceStore.close();
  }

  /**
   * Store mission concepts overlay (with embeddings)
   */
  async store(overlay: MissionConceptsOverlay): Promise<void> {
    await fs.ensureDir(this.overlayPath);

    const documentName = path.basename(overlay.document_path);

    const alreadyEmbedded = overlay.extracted_concepts.every(
      (c) => c.embedding && c.embedding.length === 768
    );

    let conceptsWithEmbeddings: MissionConcept[];

    if (alreadyEmbedded) {
      conceptsWithEmbeddings = overlay.extracted_concepts;
    } else {
      conceptsWithEmbeddings = await this.generateEmbeddings(
        overlay.extracted_concepts,
        documentName
      );
    }

    await this.storeEmbeddingsInLance(
      conceptsWithEmbeddings,
      overlay.document_hash,
      overlay.document_path
    );

    const conceptsWithoutEmbeddings = conceptsWithEmbeddings.map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { embedding, ...rest } = item;
      return rest as MissionConcept;
    });

    const enrichedOverlay: MissionConceptsOverlay = {
      ...overlay,
      extracted_concepts: conceptsWithoutEmbeddings,
      format_version: 2,
    };

    const filePath = path.join(
      this.overlayPath,
      `${overlay.document_hash}.yaml`
    );

    const yamlContent = YAML.stringify(enrichedOverlay);
    await fs.writeFile(filePath, yamlContent, 'utf-8');

    await this.updateManifest(overlay);
  }
  /**
   * Update manifest with document metadata for incremental updates
   */

  private async updateManifest(overlay: MissionConceptsOverlay): Promise<void> {
    const manifestPath = path.join(this.overlayPath, 'manifest.json');

    let manifest: Record<
      string,
      {
        documentHash: string;
        sourceFile: string;
        conceptCount: number;
        lastProcessed: string;
      }
    > = {};

    if (await fs.pathExists(manifestPath)) {
      manifest = await fs.readJSON(manifestPath);
    }

    const documentName = path.basename(overlay.document_path);
    manifest[documentName] = {
      documentHash: overlay.document_hash,
      sourceFile: overlay.document_path,
      conceptCount: overlay.extracted_concepts.length,
      lastProcessed: overlay.generated_at,
    };

    await fs.writeJSON(manifestPath, manifest, { spaces: 2 });
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
    const items = await this.getAllItems();
    return items.map((item) => ({
      text: item.metadata.text,
      section: item.metadata.section,
      weight: item.metadata.weight,
      occurrences: item.metadata.occurrences,
      sectionHash: item.metadata.sectionHash,
    }));
  }
  /**
   * Get top N concepts across all overlays (global mission concepts)
   */

  async getTopConcepts(topN: number = 50): Promise<MissionConcept[]> {
    const allItems = await this.getAllItems();

    // Merge duplicates and sort by weight
    const conceptMap = new Map<string, MissionConcept>();

    for (const item of allItems) {
      const key = item.metadata.text.toLowerCase();
      if (conceptMap.has(key)) {
        const existing = conceptMap.get(key)!;
        existing.occurrences =
          (existing.occurrences || 0) + (item.metadata.occurrences || 1);
        existing.weight = Math.max(existing.weight, item.metadata.weight);
      } else {
        conceptMap.set(key, {
          text: item.metadata.text,
          section: item.metadata.section,
          weight: item.metadata.weight,
          occurrences: item.metadata.occurrences,
          sectionHash: item.metadata.sectionHash,
        });
      }
    }

    const merged = Array.from(conceptMap.values());
    merged.sort((a, b) => b.weight - a.weight);

    return merged.slice(0, topN);
  }
}
