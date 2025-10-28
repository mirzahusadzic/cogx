import path from 'path';
import fs from 'fs-extra';
import YAML from 'yaml';
import { MissionConceptsManager } from '../mission-concepts/manager.js';
import { LanceVectorStore } from '../vector-db/lance-store.js';
import type { MissionConcept } from '../../analyzers/concept-extractor.js';

/**
 * Alignment between a code symbol and mission concept
 */
export interface ConceptAlignment {
  conceptText: string; // Mission concept text
  conceptSection: string; // Source section (Vision, Mission, etc.)
  alignmentScore: number; // Cosine similarity (0-1)
  sectionHash: string; // Provenance to concept's source section
}

/**
 * Strategic coherence score for a code symbol
 */
export interface SymbolCoherence {
  symbolName: string; // e.g., "ConceptExtractor"
  filePath: string; // e.g., "src/core/analyzers/concept-extractor.ts"
  symbolHash: string; // Structural hash (provenance)
  topAlignments: ConceptAlignment[]; // Top N mission concepts
  overallCoherence: number; // Average of top alignments
}

/**
 * Mission concept implementation mapping
 */
export interface ConceptImplementation {
  conceptText: string;
  conceptSection: string;
  implementingSymbols: {
    symbolName: string;
    filePath: string;
    alignmentScore: number;
  }[];
}

/**
 * Strategic coherence overlay
 * Maps code symbols to mission concepts via semantic similarity
 */
export interface StrategicCoherenceOverlay {
  generated_at: string; // ISO timestamp
  mission_document_hashes: string[]; // Hashes of strategic docs (VISION.md, PATTERN_LIBRARY.md, etc.)
  mission_concepts_count: number; // Number of mission concepts (aggregated from all docs)
  symbol_coherence: SymbolCoherence[]; // Symbol → Concept alignments
  concept_implementations: ConceptImplementation[]; // Concept → Symbol mappings
  overall_metrics: {
    average_coherence: number; // Mean coherence across all symbols
    high_alignment_threshold: number; // e.g., 0.7
    aligned_symbols_count: number; // Symbols above threshold
    drifted_symbols_count: number; // Symbols below threshold
    total_symbols: number; // Total number of symbols analyzed
  };
}

/**
 * StrategicCoherenceManager
 *
 * Computes semantic alignment between code (O₁) and mission (O₃).
 *
 * ALGORITHM:
 * 1. Load structural pattern embeddings (code symbols)
 * 2. Load mission concept embeddings (VISION.md concepts)
 * 3. For each symbol, compute cosine similarity with all concepts
 * 4. Store top N alignments per symbol
 * 5. Generate reverse mapping (concept → implementing symbols)
 *
 * OVERLAY STRUCTURE:
 * .open_cognition/overlays/strategic_coherence/coherence.yaml
 *
 * USE CASES:
 * - "Which functions are most aligned with mission?"
 * - "Which code has drifted from strategic intent?"
 * - "What implements 'verifiable AI' concept?"
 * - "Show me coherence report for this PR"
 */
export class StrategicCoherenceManager {
  private overlayPath: string;
  private missionManager: MissionConceptsManager;
  private vectorStore: LanceVectorStore;

  constructor(
    private pgcRoot: string,
    workbenchUrl?: string
  ) {
    this.overlayPath = path.join(pgcRoot, 'overlays', 'strategic_coherence');
    this.missionManager = new MissionConceptsManager(pgcRoot, workbenchUrl);
    this.vectorStore = new LanceVectorStore(pgcRoot);
  }

  /**
   * Compute cosine similarity between two 768-dimensional vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error(
        `Vector dimension mismatch: ${vecA.length} vs ${vecB.length}`
      );
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0; // Avoid division by zero
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Compute strategic coherence overlay
   *
   * @param missionDocHash - Hash of mission document (e.g., VISION.md)
   * @param topN - Number of top alignments to store per symbol (default: 5)
   * @param alignmentThreshold - Minimum similarity score to consider (default: 0.5)
   */
  async computeCoherence(
    missionDocHash: string,
    topN: number = 5,
    alignmentThreshold: number = 0.5
  ): Promise<StrategicCoherenceOverlay> {
    // 1. Load mission concepts (from O₃)
    const missionOverlay = await this.missionManager.retrieve(missionDocHash);

    if (!missionOverlay) {
      throw new Error(
        `Mission concepts overlay not found for hash: ${missionDocHash}`
      );
    }

    const missionConcepts = missionOverlay.extracted_concepts;

    // Validate embeddings exist
    const conceptsWithEmbeddings = missionConcepts.filter(
      (c) => c.embedding && c.embedding.length === 768
    );

    if (conceptsWithEmbeddings.length === 0) {
      throw new Error('No mission concepts with embeddings found');
    }

    // 2. Load SEMANTIC patterns (the shadow) from O₁ vector store
    // We use semantic embeddings (docstring + type) for mission alignment, not structural embeddings
    const vectorRecords = await this.vectorStore.getAllVectors();

    if (vectorRecords.length === 0) {
      throw new Error('No structural patterns found in vector store');
    }

    // Filter for semantic vectors (the shadow projection)
    const semanticVectors = vectorRecords.filter(
      (v) =>
        v.metadata &&
        typeof v.metadata === 'object' &&
        'type' in v.metadata &&
        v.metadata.type === 'semantic'
    );

    if (semanticVectors.length === 0) {
      console.warn(
        '[StrategicCoherence] No semantic embeddings found. Falling back to structural embeddings.'
      );
    }

    // Use semantic vectors if available, otherwise fall back to structural
    const vectorsForCoherence =
      semanticVectors.length > 0 ? semanticVectors : vectorRecords;

    // 3. Compute alignments for each symbol
    const symbolCoherenceList: SymbolCoherence[] = [];
    const conceptImplementationMap = new Map<string, ConceptImplementation>();

    // Initialize concept implementation map
    for (const concept of conceptsWithEmbeddings) {
      conceptImplementationMap.set(concept.text, {
        conceptText: concept.text,
        conceptSection: concept.section,
        implementingSymbols: [],
      });
    }

    for (const vectorRecord of vectorsForCoherence) {
      const symbolEmbedding = vectorRecord.embedding;

      if (!symbolEmbedding || symbolEmbedding.length !== 768) {
        continue; // Skip symbols without valid embeddings
      }

      const alignments: ConceptAlignment[] = [];

      // Compute similarity with each mission concept
      for (const concept of conceptsWithEmbeddings) {
        const similarity = this.cosineSimilarity(
          symbolEmbedding,
          concept.embedding!
        );

        if (similarity >= alignmentThreshold) {
          alignments.push({
            conceptText: concept.text,
            conceptSection: concept.section,
            alignmentScore: similarity,
            sectionHash: concept.sectionHash,
          });
        }
      }

      // Sort by alignment score (descending) and take top N
      alignments.sort((a, b) => b.alignmentScore - a.alignmentScore);
      const topAlignments = alignments.slice(0, topN);

      if (topAlignments.length > 0) {
        const overallCoherence =
          topAlignments.reduce((sum, a) => sum + a.alignmentScore, 0) /
          topAlignments.length;

        const symbolName = vectorRecord.symbol as string;
        const filePath = (vectorRecord.filePath as string) || 'unknown';
        const symbolHash =
          (vectorRecord.structuralHash as string) ||
          (vectorRecord.lineage_hash as string) ||
          'unknown';

        symbolCoherenceList.push({
          symbolName,
          filePath,
          symbolHash,
          topAlignments,
          overallCoherence,
        });

        // Update reverse mapping (concept → symbols)
        for (const alignment of topAlignments) {
          const conceptImpl = conceptImplementationMap.get(
            alignment.conceptText
          );
          if (conceptImpl) {
            conceptImpl.implementingSymbols.push({
              symbolName,
              filePath,
              alignmentScore: alignment.alignmentScore,
            });
          }
        }
      }
    }

    // 4. Compute overall metrics
    const highAlignmentThreshold = 0.7;
    const alignedSymbols = symbolCoherenceList.filter(
      (s) => s.overallCoherence >= highAlignmentThreshold
    );
    const driftedSymbols = symbolCoherenceList.filter(
      (s) => s.overallCoherence < highAlignmentThreshold
    );

    const averageCoherence =
      symbolCoherenceList.length > 0
        ? symbolCoherenceList.reduce((sum, s) => sum + s.overallCoherence, 0) /
          symbolCoherenceList.length
        : 0;

    // Sort concept implementations by number of implementing symbols (descending)
    const conceptImplementations = Array.from(
      conceptImplementationMap.values()
    );
    conceptImplementations.forEach((impl) => {
      impl.implementingSymbols.sort(
        (a, b) => b.alignmentScore - a.alignmentScore
      );
    });

    const overlay: StrategicCoherenceOverlay = {
      generated_at: new Date().toISOString(),
      mission_document_hashes: [missionDocHash], // Wrap single doc in array for consistency
      mission_concepts_count: conceptsWithEmbeddings.length,
      symbol_coherence: symbolCoherenceList,
      concept_implementations: conceptImplementations,
      overall_metrics: {
        average_coherence: averageCoherence,
        high_alignment_threshold: highAlignmentThreshold,
        aligned_symbols_count: alignedSymbols.length,
        drifted_symbols_count: driftedSymbols.length,
        total_symbols: symbolCoherenceList.length,
      },
    };

    return overlay;
  }

  /**
   * Compute strategic coherence from multiple mission documents
   * Aggregates all mission concepts from all documents into a single coherence analysis
   *
   * @param missionDocHashes - Array of mission document hashes to aggregate
   * @param topN - Number of top alignments to return per symbol (default: 5)
   * @param alignmentThreshold - Minimum similarity score to consider (default: 0.5)
   */
  async computeCoherenceFromMultipleDocs(
    missionDocHashes: string[],
    topN: number = 5,
    alignmentThreshold: number = 0.5
  ): Promise<StrategicCoherenceOverlay> {
    // 1. Load and aggregate mission concepts from all documents
    const allMissionConcepts: MissionConcept[] = [];
    const missionDocumentHashes: string[] = [];

    for (const docHash of missionDocHashes) {
      const missionOverlay = await this.missionManager.retrieve(docHash);

      if (!missionOverlay) {
        console.warn(
          `Warning: Mission concepts overlay not found for hash: ${docHash}`
        );
        continue;
      }

      missionDocumentHashes.push(docHash);
      allMissionConcepts.push(...missionOverlay.extracted_concepts);
    }

    if (allMissionConcepts.length === 0) {
      throw new Error(
        'No mission concepts found in any of the provided documents'
      );
    }

    // Validate embeddings exist
    const conceptsWithEmbeddings = allMissionConcepts.filter(
      (c) => c.embedding && c.embedding.length === 768
    );

    if (conceptsWithEmbeddings.length === 0) {
      throw new Error('No mission concepts with embeddings found');
    }

    // 2. Load structural patterns (from O₁ vector store)
    const vectorRecords = await this.vectorStore.getAllVectors();

    if (vectorRecords.length === 0) {
      throw new Error('No structural patterns found in vector store');
    }

    // 3. Compute alignments for each symbol
    const symbolCoherenceList: SymbolCoherence[] = [];
    const conceptImplementationMap = new Map<string, ConceptImplementation>();

    // Initialize concept implementation map
    for (const concept of conceptsWithEmbeddings) {
      const key = `${concept.text}::${concept.section}`; // Unique key per concept
      conceptImplementationMap.set(key, {
        conceptText: concept.text,
        conceptSection: concept.section,
        implementingSymbols: [],
      });
    }

    for (const vectorRecord of vectorRecords) {
      const symbolEmbedding = vectorRecord.embedding;

      if (!symbolEmbedding || symbolEmbedding.length !== 768) {
        continue; // Skip symbols without valid embeddings
      }

      const alignments: ConceptAlignment[] = [];

      // Compute similarity with each mission concept from ALL documents
      for (const concept of conceptsWithEmbeddings) {
        const similarity = this.cosineSimilarity(
          symbolEmbedding,
          concept.embedding!
        );

        if (similarity >= alignmentThreshold) {
          alignments.push({
            conceptText: concept.text,
            conceptSection: concept.section,
            alignmentScore: similarity,
            sectionHash: concept.sectionHash,
          });
        }
      }

      // Sort by alignment score (descending) and take top N
      alignments.sort((a, b) => b.alignmentScore - a.alignmentScore);
      const topAlignments = alignments.slice(0, topN);

      if (topAlignments.length > 0) {
        const overallCoherence =
          topAlignments.reduce((sum, a) => sum + a.alignmentScore, 0) /
          topAlignments.length;

        const symbolName = vectorRecord.symbol as string;
        const filePath = (vectorRecord.filePath as string) || 'unknown';
        const symbolHash =
          (vectorRecord.structuralHash as string) ||
          (vectorRecord.lineage_hash as string) ||
          'unknown';

        symbolCoherenceList.push({
          symbolName,
          filePath,
          symbolHash,
          topAlignments,
          overallCoherence,
        });

        // Update reverse mapping (concept → symbols)
        for (const alignment of topAlignments) {
          const key = `${alignment.conceptText}::${alignment.conceptSection}`;
          const conceptImpl = conceptImplementationMap.get(key);
          if (conceptImpl) {
            conceptImpl.implementingSymbols.push({
              symbolName,
              filePath,
              alignmentScore: alignment.alignmentScore,
            });
          }
        }
      }
    }

    // 4. Compute overall metrics
    const alignedSymbols = symbolCoherenceList.filter(
      (s) => s.overallCoherence >= 0.7
    );
    const driftedSymbols = symbolCoherenceList.filter(
      (s) => s.overallCoherence < 0.7
    );

    const avgCoherence =
      symbolCoherenceList.length > 0
        ? symbolCoherenceList.reduce((sum, s) => sum + s.overallCoherence, 0) /
          symbolCoherenceList.length
        : 0;

    // 5. Build overlay
    const overlay: StrategicCoherenceOverlay = {
      generated_at: new Date().toISOString(),
      mission_document_hashes: missionDocumentHashes,
      mission_concepts_count: conceptsWithEmbeddings.length,
      symbol_coherence: symbolCoherenceList,
      concept_implementations: Array.from(conceptImplementationMap.values()),
      overall_metrics: {
        average_coherence: avgCoherence,
        aligned_symbols_count: alignedSymbols.length,
        drifted_symbols_count: driftedSymbols.length,
        total_symbols: symbolCoherenceList.length,
        high_alignment_threshold: 0.7,
      },
    };

    return overlay;
  }

  /**
   * Store strategic coherence overlay
   */
  async store(overlay: StrategicCoherenceOverlay): Promise<void> {
    await fs.ensureDir(this.overlayPath);

    const filePath = path.join(this.overlayPath, 'coherence.yaml');

    const yamlContent = YAML.stringify(overlay);
    await fs.writeFile(filePath, yamlContent, 'utf-8');
  }

  /**
   * Retrieve strategic coherence overlay
   */
  async retrieve(): Promise<StrategicCoherenceOverlay | null> {
    const filePath = path.join(this.overlayPath, 'coherence.yaml');

    if (!(await fs.pathExists(filePath))) {
      return null;
    }

    const yamlContent = await fs.readFile(filePath, 'utf-8');
    return YAML.parse(yamlContent) as StrategicCoherenceOverlay;
  }

  /**
   * Get symbols most aligned with mission (high coherence)
   */
  async getAlignedSymbols(
    minCoherence: number = 0.7
  ): Promise<SymbolCoherence[]> {
    const overlay = await this.retrieve();

    if (!overlay) {
      return [];
    }

    return overlay.symbol_coherence
      .filter((s) => s.overallCoherence >= minCoherence)
      .sort((a, b) => b.overallCoherence - a.overallCoherence);
  }

  /**
   * Get symbols that have drifted from mission (low coherence)
   */
  async getDriftedSymbols(
    maxCoherence: number = 0.5
  ): Promise<SymbolCoherence[]> {
    const overlay = await this.retrieve();

    if (!overlay) {
      return [];
    }

    return overlay.symbol_coherence
      .filter((s) => s.overallCoherence <= maxCoherence)
      .sort((a, b) => b.overallCoherence - a.overallCoherence); // Sort descending (highest first)
  }

  /**
   * Get symbols implementing a specific mission concept
   */
  async getConceptImplementations(
    conceptText: string
  ): Promise<ConceptImplementation | null> {
    const overlay = await this.retrieve();

    if (!overlay) {
      return null;
    }

    return (
      overlay.concept_implementations.find(
        (impl) => impl.conceptText.toLowerCase() === conceptText.toLowerCase()
      ) || null
    );
  }
}
