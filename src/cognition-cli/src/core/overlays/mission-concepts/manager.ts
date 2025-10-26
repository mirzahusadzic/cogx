import { MissionConcept } from '../../analyzers/concept-extractor.js';
import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';

/**
 * Mission concepts overlay
 * Stores extracted mission-critical concepts for strategic coherence analysis
 */
export interface MissionConceptsOverlay {
  document_hash: string; // Content hash of source document
  document_path: string; // Path to source markdown file
  extracted_concepts: MissionConcept[]; // Ranked concepts
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
 * PROVENANCE:
 * - Each concept tracks source section via sectionHash
 * - Overlay tracks source document via document_hash
 * - Full transform chain via transform_id
 */
export class MissionConceptsManager {
  private overlayPath: string;

  constructor(private pgcRoot: string) {
    this.overlayPath = path.join(pgcRoot, 'overlays', 'mission_concepts');
  }

  /**
   * Store mission concepts overlay
   */
  async store(overlay: MissionConceptsOverlay): Promise<void> {
    await fs.ensureDir(this.overlayPath);

    const filePath = path.join(
      this.overlayPath,
      `${overlay.document_hash}.yaml`
    );

    const yamlContent = YAML.stringify(overlay);
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
