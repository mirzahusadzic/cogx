import { MissionConcept } from '../../analyzers/concept-extractor.js';
import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';
import { WorkbenchClient } from '../../executors/workbench-client.js';
import { EmbedLogger } from '../shared/embed-logger.js';

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
export class MissionConceptsManager {
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
    concepts: MissionConcept[]
  ): Promise<MissionConcept[]> {
    const conceptsWithEmbeddings: MissionConcept[] = [];
    const total = concepts.length;

    for (let i = 0; i < concepts.length; i++) {
      const concept = concepts[i];

      // Show progress every 50 concepts or at specific milestones
      if (i === 0 || i === total - 1 || (i + 1) % 50 === 0) {
        EmbedLogger.progress(i + 1, total, 'MissionConcepts');
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

    // Generate embeddings for all concepts
    const conceptsWithEmbeddings = await this.generateEmbeddings(
      overlay.extracted_concepts
    );

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
