import path from 'path';
import fs from 'fs-extra';
import YAML from 'yaml';
import crypto from 'crypto';
import { MissionConceptsManager } from '../mission-concepts/manager.js';
import { LanceVectorStore } from '../vector-db/lance-store.js';
import { PGCManager } from '../../pgc/manager.js';
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
    average_coherence: number; // Simple arithmetic mean
    weighted_coherence: number; // Weighted by architectural importance (name-based)
    lattice_coherence: number; // Lattice-aware Gaussian weighting (synthesis across overlays)
    median_coherence: number; // Median value (50th percentile)
    std_deviation: number; // Standard deviation (statistical spread)
    top_quartile_coherence: number; // 75th percentile (best performers)
    bottom_quartile_coherence: number; // 25th percentile (needs attention)
    high_alignment_threshold: number; // e.g., 0.7
    aligned_symbols_count: number; // Symbols above threshold
    drifted_symbols_count: number; // Symbols below threshold
    total_symbols: number; // Total number of symbols analyzed
  };
}

/**
 * Strategic Coherence Manager (O₇) - LATTICE SYNTHESIS
 *
 * Computes semantic alignment between code (O₁) and mission (O₄) using
 * The Shadow architecture's dual embedding system with lattice-aware
 * Gaussian weighting. This is the SYNTHESIS layer - where all overlays
 * come together to answer: "Does this code serve the mission?"
 *
 * LATTICE POSITION: O₇ (Synthesis/Derived)
 * - Synthesizes: O₁ (code structure) + O₄ (mission concepts)
 * - Uses: O₂ (reverse_deps graph) for centrality weighting
 * - Respects: O₂ (security) - coherence never overrides safety
 *
 * ALGORITHM:
 * 1. Load structural pattern embeddings (code symbols from O₁)
 * 2. Load mission concept embeddings (strategic docs from O₄)
 * 3. For each symbol, compute cosine similarity with all concepts
 * 4. Store top N alignments per symbol
 * 5. Generate reverse mapping (concept → implementing symbols)
 * 6. Compute three coherence metrics:
 *    - Average: Simple arithmetic mean (baseline)
 *    - Weighted: Centrality-based from reverse_deps graph
 *    - Lattice: Gaussian + centrality synthesis (filters noise, amplifies signal)
 *
 * LATTICE-AWARE WEIGHTING (Monument 5.1):
 * The lattice coherence metric synthesizes data across overlays:
 * - O₁ (structure): Semantic embeddings for alignment
 * - O₂ (reverse_deps): Graph centrality (dependency count)
 * - O₄ (mission): Concept embeddings and similarity scores
 * - Gaussian statistics: Z-scores for signal/noise separation
 *
 * Weight formula: w = centrality × gaussian_significance
 * - centrality = log10(dependency_count + 1)  // pure lattice derivation
 * - gaussian_significance = max(0.1, 1.0 + z_score)  // amplify outliers
 * - Filters noise: symbols below μ - σ excluded entirely
 * - NO HARDCODED CONSTANTS: all weights derived from lattice structure
 *
 * USE CASES:
 * - Alignment queries: "Which functions are most aligned with mission?"
 * - Drift detection: "Which code has drifted from strategic intent?"
 * - Impact analysis: "What implements 'verifiable AI' concept?"
 * - PR reviews: "Show me coherence report for this PR"
 * - Quality metrics: "What's the lattice coherence score?"
 *
 * COHERENCE METRICS:
 * 1. average_coherence: Simple mean (baseline)
 * 2. weighted_coherence: Centrality-weighted (important symbols matter more)
 * 3. lattice_coherence: Gaussian-filtered synthesis (noise removed, signal amplified)
 * 4. median_coherence: 50th percentile (robust to outliers)
 * 5. top_quartile_coherence: 75th percentile (best performers)
 * 6. bottom_quartile_coherence: 25th percentile (needs attention)
 *
 * STORAGE:
 * .open_cognition/overlays/strategic_coherence/coherence.yaml
 *
 * @example
 * // Compute coherence for entire codebase
 * const manager = new StrategicCoherenceManager(pgcRoot);
 * const coherence = await manager.computeCoherence(missionDocHash);
 * console.log(`Lattice coherence: ${coherence.overall_metrics.lattice_coherence}`);
 *
 * @example
 * // Find drifted symbols
 * const drifted = await manager.getDriftedSymbols(0.5);
 * console.log(`${drifted.length} symbols need realignment`);
 *
 * @example
 * // What implements a concept?
 * const impl = await manager.getConceptImplementations('verifiable AI');
 * console.log(`${impl?.implementingSymbols.length} symbols implement this`);
 */
export class StrategicCoherenceManager {
  private overlayPath: string;
  private missionManager: MissionConceptsManager;
  private vectorStore: LanceVectorStore;
  private pgcManager: PGCManager;

  constructor(
    private pgcRoot: string,
    workbenchUrl?: string
  ) {
    this.overlayPath = path.join(pgcRoot, 'overlays', 'strategic_coherence');
    this.missionManager = new MissionConceptsManager(pgcRoot, workbenchUrl);
    this.vectorStore = new LanceVectorStore(pgcRoot);
    // PGCManager expects projectRoot, not pgcRoot - it will append .open_cognition internally
    const projectRoot = path.dirname(pgcRoot);
    this.pgcManager = new PGCManager(projectRoot);
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

    // Load embeddings (v1 from YAML or v2 from LanceDB)
    const { EmbeddingLoader } = await import('../../pgc/embedding-loader.js');
    const loader = new EmbeddingLoader();
    const conceptsWithEmbeddings = await loader.loadConceptsWithEmbeddings(
      missionOverlay as unknown as import('../../pgc/embedding-loader.js').OverlayData,
      this.pgcRoot
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

    // Create a temporary in-memory vector store for mission concepts
    // This allows us to use efficient similarity search instead of O(symbols × concepts) loops
    const conceptVectorStore = new LanceVectorStore(this.pgcRoot);
    await conceptVectorStore.initialize('mission_concepts_temp');

    try {
      // Store all mission concepts in the temporary vector store
      for (let i = 0; i < conceptsWithEmbeddings.length; i++) {
        const concept = conceptsWithEmbeddings[i];
        await conceptVectorStore.storeVector(
          `concept_${i}`,
          concept.embedding!,
          {
            symbol: concept.text,
            structural_signature: concept.section,
            semantic_signature: concept.text,
            type: 'mission_concept',
            architectural_role: concept.section,
            computed_at: new Date().toISOString(),
            lineage_hash: concept.sectionHash,
            filePath: 'mission_concept',
            structuralHash: concept.sectionHash,
          }
        );
      }

      // For each symbol, use LanceDB's native similarity search
      for (const vectorRecord of vectorsForCoherence) {
        const symbolEmbedding = vectorRecord.embedding;

        if (!symbolEmbedding || symbolEmbedding.length !== 768) {
          continue; // Skip symbols without valid embeddings
        }

        // Use native LanceDB search with cosine similarity - much faster than manual loops
        const searchResults = await conceptVectorStore.similaritySearch(
          symbolEmbedding,
          topN * 2, // Get extra results to filter by threshold
          undefined, // no filters
          'cosine' // Use cosine similarity natively
        );

        // Convert search results to alignments and filter by threshold
        const alignments: ConceptAlignment[] = searchResults
          .map((result) => {
            const conceptIndex = parseInt(result.id.replace('concept_', ''));
            const concept = conceptsWithEmbeddings[conceptIndex];

            return {
              conceptText: concept.text,
              conceptSection: concept.section,
              alignmentScore: result.similarity, // Already cosine similarity from LanceDB
              sectionHash: concept.sectionHash,
            };
          })
          .filter((alignment) => alignment.alignmentScore >= alignmentThreshold)
          .slice(0, topN); // Take only top N after filtering

        if (alignments.length > 0) {
          const overallCoherence =
            alignments.reduce((sum, a) => sum + a.alignmentScore, 0) /
            alignments.length;

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
            topAlignments: alignments,
            overallCoherence,
          });

          // Update reverse mapping (concept → symbols)
          for (const alignment of alignments) {
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
    } finally {
      // Clean up temporary vector store
      await conceptVectorStore.close();
    }

    // 4. Compute overall metrics
    const highAlignmentThreshold = 0.7;
    const alignedSymbols = symbolCoherenceList.filter(
      (s) => s.overallCoherence >= highAlignmentThreshold
    );
    const driftedSymbols = symbolCoherenceList.filter(
      (s) => s.overallCoherence < highAlignmentThreshold
    );

    // Compute simple average
    const averageCoherence =
      symbolCoherenceList.length > 0
        ? symbolCoherenceList.reduce((sum, s) => sum + s.overallCoherence, 0) /
          symbolCoherenceList.length
        : 0;

    // Compute standard deviation (Gaussian statistics)
    const variance =
      symbolCoherenceList.length > 0
        ? symbolCoherenceList.reduce(
            (sum, s) =>
              sum + Math.pow(s.overallCoherence - averageCoherence, 2),
            0
          ) / symbolCoherenceList.length
        : 0;
    const stdDeviation = Math.sqrt(variance);

    // Compute weighted average (centrality-based)
    const weightedCoherence =
      await this.computeWeightedCoherence(symbolCoherenceList);

    // Compute lattice-aware Gaussian weighting (synthesis across overlays)
    const latticeCoherence = await this.computeLatticeAwareCoherence(
      symbolCoherenceList,
      averageCoherence,
      stdDeviation
    );

    // Compute distribution metrics
    const sortedScores = symbolCoherenceList
      .map((s) => s.overallCoherence)
      .sort((a, b) => a - b);
    const medianCoherence = this.computePercentile(sortedScores, 50);
    const topQuartile = this.computePercentile(sortedScores, 75);
    const bottomQuartile = this.computePercentile(sortedScores, 25);

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
        weighted_coherence: weightedCoherence,
        lattice_coherence: latticeCoherence,
        median_coherence: medianCoherence,
        std_deviation: stdDeviation,
        top_quartile_coherence: topQuartile,
        bottom_quartile_coherence: bottomQuartile,
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

    // Load embeddings helper (v1/v2 compatible)
    const { EmbeddingLoader } = await import('../../pgc/embedding-loader.js');
    const loader = new EmbeddingLoader();

    for (const docHash of missionDocHashes) {
      const missionOverlay = await this.missionManager.retrieve(docHash);

      if (!missionOverlay) {
        console.warn(
          `Warning: Mission concepts overlay not found for hash: ${docHash}`
        );
        continue;
      }

      missionDocumentHashes.push(docHash);

      // Load concepts with embeddings (v1 or v2)
      const conceptsFromDoc = await loader.loadConceptsWithEmbeddings(
        missionOverlay as unknown as import('../../pgc/embedding-loader.js').OverlayData,
        this.pgcRoot
      );
      allMissionConcepts.push(...conceptsFromDoc);
    }

    if (allMissionConcepts.length === 0) {
      throw new Error(
        'No mission concepts with embeddings found in any of the provided documents'
      );
    }

    const conceptsWithEmbeddings = allMissionConcepts;

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

    // Create a temporary in-memory vector store for mission concepts
    // This allows us to use efficient similarity search instead of O(symbols × concepts) loops
    const conceptVectorStore = new LanceVectorStore(this.pgcRoot);
    await conceptVectorStore.initialize('mission_concepts_multi_temp');

    try {
      // Store all mission concepts in the temporary vector store
      for (let i = 0; i < conceptsWithEmbeddings.length; i++) {
        const concept = conceptsWithEmbeddings[i];
        await conceptVectorStore.storeVector(
          `concept_${i}`,
          concept.embedding!,
          {
            symbol: concept.text,
            structural_signature: concept.section,
            semantic_signature: concept.text,
            type: 'mission_concept',
            architectural_role: concept.section,
            computed_at: new Date().toISOString(),
            lineage_hash: concept.sectionHash,
            filePath: 'mission_concept',
            structuralHash: concept.sectionHash,
          }
        );
      }

      // For each symbol, use LanceDB's native similarity search
      for (const vectorRecord of vectorRecords) {
        const symbolEmbedding = vectorRecord.embedding;

        if (!symbolEmbedding || symbolEmbedding.length !== 768) {
          continue; // Skip symbols without valid embeddings
        }

        // Use native LanceDB search with cosine similarity - much faster than manual loops
        const searchResults = await conceptVectorStore.similaritySearch(
          symbolEmbedding,
          topN * 2, // Get extra results to filter by threshold
          undefined, // no filters
          'cosine' // Use cosine similarity natively
        );

        // Convert search results to alignments and filter by threshold
        const alignments: ConceptAlignment[] = searchResults
          .map((result) => {
            const conceptIndex = parseInt(result.id.replace('concept_', ''));
            const concept = conceptsWithEmbeddings[conceptIndex];

            return {
              conceptText: concept.text,
              conceptSection: concept.section,
              alignmentScore: result.similarity, // Already cosine similarity from LanceDB
              sectionHash: concept.sectionHash,
            };
          })
          .filter((alignment) => alignment.alignmentScore >= alignmentThreshold)
          .slice(0, topN); // Take only top N after filtering

        if (alignments.length > 0) {
          const overallCoherence =
            alignments.reduce((sum, a) => sum + a.alignmentScore, 0) /
            alignments.length;

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
            topAlignments: alignments,
            overallCoherence,
          });

          // Update reverse mapping (concept → symbols)
          for (const alignment of alignments) {
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
    } finally {
      // Clean up temporary vector store
      await conceptVectorStore.close();
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

    // Compute standard deviation (Gaussian statistics)
    const variance =
      symbolCoherenceList.length > 0
        ? symbolCoherenceList.reduce(
            (sum, s) => sum + Math.pow(s.overallCoherence - avgCoherence, 2),
            0
          ) / symbolCoherenceList.length
        : 0;
    const stdDeviation = Math.sqrt(variance);

    // Compute weighted and distribution metrics
    const weightedCoherence =
      await this.computeWeightedCoherence(symbolCoherenceList);

    // Compute lattice-aware Gaussian weighting (synthesis across overlays)
    const latticeCoherence = await this.computeLatticeAwareCoherence(
      symbolCoherenceList,
      avgCoherence,
      stdDeviation
    );

    const sortedScores = symbolCoherenceList
      .map((s) => s.overallCoherence)
      .sort((a, b) => a - b);
    const medianCoherence = this.computePercentile(sortedScores, 50);
    const topQuartile = this.computePercentile(sortedScores, 75);
    const bottomQuartile = this.computePercentile(sortedScores, 25);

    // 5. Build overlay
    const overlay: StrategicCoherenceOverlay = {
      generated_at: new Date().toISOString(),
      mission_document_hashes: missionDocumentHashes,
      mission_concepts_count: conceptsWithEmbeddings.length,
      symbol_coherence: symbolCoherenceList,
      concept_implementations: Array.from(conceptImplementationMap.values()),
      overall_metrics: {
        average_coherence: avgCoherence,
        weighted_coherence: weightedCoherence,
        lattice_coherence: latticeCoherence,
        median_coherence: medianCoherence,
        std_deviation: stdDeviation,
        top_quartile_coherence: topQuartile,
        bottom_quartile_coherence: bottomQuartile,
        high_alignment_threshold: 0.7,
        aligned_symbols_count: alignedSymbols.length,
        drifted_symbols_count: driftedSymbols.length,
        total_symbols: symbolCoherenceList.length,
      },
    };

    return overlay;
  }

  /**
   * Store strategic coherence overlay with dependency tracking
   */
  async store(overlay: StrategicCoherenceOverlay): Promise<void> {
    await fs.ensureDir(this.overlayPath);

    const filePath = path.join(this.overlayPath, 'coherence.yaml');

    const yamlContent = YAML.stringify(overlay);
    await fs.writeFile(filePath, yamlContent, 'utf-8');

    // Update manifest with dependency tracking for incremental updates
    await this.updateManifest(overlay);
  }

  /**
   * Update manifest with dependency hashes for incremental updates
   * Tracks which mission concepts and structural patterns were used
   */
  private async updateManifest(
    overlay: StrategicCoherenceOverlay
  ): Promise<void> {
    const manifestPath = path.join(this.overlayPath, 'manifest.json');

    // Compute hash of mission concepts used
    const missionConceptsHash = this.computeHash(
      JSON.stringify(
        overlay.mission_document_hashes.sort() // Sorted for consistent hashing
      )
    );

    // Compute hash of structural patterns count (proxy for structural patterns state)
    const structuralPatternsHash = this.computeHash(
      JSON.stringify({
        symbolCount: overlay.symbol_coherence.length,
        missionConceptsCount: overlay.mission_concepts_count,
      })
    );

    const manifest = {
      dependencies: {
        missionConceptsHash,
        structuralPatternsHash,
        missionDocumentHashes: overlay.mission_document_hashes,
        lastComputed: overlay.generated_at,
      },
      coherenceScore: overlay.overall_metrics.average_coherence,
      symbolCount: overlay.symbol_coherence.length,
      alignedCount: overlay.overall_metrics.aligned_symbols_count,
      driftedCount: overlay.overall_metrics.drifted_symbols_count,
    };

    await fs.writeJSON(manifestPath, manifest, { spaces: 2 });
  }

  /**
   * Compute SHA-256 hash for dependency tracking
   */
  private computeHash(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
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

  /**
   * Compute lattice-aware Gaussian weighted coherence
   * Synthesizes across all overlays: O₁ (structure), O₂ (lineage), O₃ (mission)
   *
   * Weight formula (NO HARDCODED CONSTANTS - pure lattice derivation):
   *   weight = centrality_factor × gaussian_significance
   *
   * Where:
   * - centrality_factor: Graph centrality from reverse_deps (O₁ structure)
   *   Logarithmic scaling: log10(dependency_count + 1)
   *   Range: [0, ~3] for typical codebases
   * - gaussian_significance: Z-score based amplification (statistical filtering)
   *   Amplify positive outliers (high coherence relative to mean)
   *   Suppress noise (symbols near or below mean)
   *
   * Noise filtering: Symbols below μ - σ are filtered out entirely
   */
  private async computeLatticeAwareCoherence(
    symbols: SymbolCoherence[],
    mean: number,
    stdDev: number
  ): Promise<number> {
    if (symbols.length === 0) return 0;
    if (stdDev === 0) return mean; // No variation, return mean

    let weightedSum = 0;
    let totalWeight = 0;
    let filteredCount = 0; // Track how many symbols were filtered as noise

    for (const symbol of symbols) {
      // 1. Compute z-score (Gaussian statistics)
      const zScore = (symbol.overallCoherence - mean) / stdDev;

      // 2. NOISE FILTERING: Filter out symbols below μ - σ (statistical noise)
      if (zScore < -1.0) {
        filteredCount++;
        continue; // Skip this symbol entirely
      }

      // 3. Gaussian significance (amplification based on z-score)
      // Symbols above mean get amplified, symbols near mean stay neutral
      const gaussianSignificance = Math.max(0.1, 1.0 + zScore);

      // 4. Graph centrality (how many symbols depend on this one - from O₁)
      const centralityFactor = await this.getCentralityFactor(
        symbol.symbolHash
      );

      // 5. Combined weight: pure lattice synthesis (NO CONSTANTS)
      const latticeWeight = centralityFactor * gaussianSignificance;

      weightedSum += symbol.overallCoherence * latticeWeight;
      totalWeight += latticeWeight;
    }

    // Log noise filtering for transparency
    if (filteredCount > 0) {
      console.log(
        `[Lattice] Filtered ${filteredCount} symbols as statistical noise (below μ - σ)`
      );
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Get centrality factor from reverse_deps (O₁ graph structure)
   * Pure logarithmic scaling - NO HARDCODED CONSTANTS
   *
   * Returns: log10(dependency_count + 1)
   * - 0 deps = 0.0 (no centrality)
   * - 1 dep = 0.30
   * - 10 deps = 1.04
   * - 100 deps = 2.00
   * - 1000 deps = 3.00
   */
  private async getCentralityFactor(symbolHash: string): Promise<number> {
    try {
      const dependentTransforms =
        await this.pgcManager.reverseDeps.getTransformIds(symbolHash);
      const dependencyCount = dependentTransforms.length;

      // Pure logarithmic scaling derived from lattice structure
      // No arbitrary multipliers or caps
      const centrality = Math.log10(dependencyCount + 1);

      // Debug logging (first 5 symbols only to reduce noise)
      if (dependencyCount > 0) {
        console.log(
          `[Lattice] Symbol ${symbolHash.slice(0, 8)}... has ${dependencyCount} deps → centrality ${centrality.toFixed(3)}`
        );
      }

      return centrality;
    } catch (error) {
      // If reverse_deps not found, no centrality contribution
      console.warn(
        `[Lattice] Failed to get centrality for ${symbolHash.slice(0, 8)}...: ${error instanceof Error ? error.message : 'unknown error'}`
      );
      return 0.0;
    }
  }

  /**
   * Compute weighted coherence score based on graph centrality
   * Simple centrality-based weighting - symbols with more dependents matter more
   *
   * This provides a simpler comparison baseline vs lattice_coherence which includes
   * Gaussian filtering and more sophisticated synthesis.
   */
  private async computeWeightedCoherence(
    symbols: SymbolCoherence[]
  ): Promise<number> {
    if (symbols.length === 0) return 0;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const symbol of symbols) {
      // Weight by centrality only (no Gaussian, no name heuristics)
      const centrality = await this.getCentralityFactor(symbol.symbolHash);
      // Add 1.0 baseline so all symbols have some weight
      const weight = 1.0 + centrality;

      weightedSum += symbol.overallCoherence * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Compute percentile value from sorted scores
   * @param sortedScores - Array of coherence scores sorted ascending
   * @param percentile - Percentile to compute (0-100)
   */
  private computePercentile(
    sortedScores: number[],
    percentile: number
  ): number {
    if (sortedScores.length === 0) return 0;
    if (sortedScores.length === 1) return sortedScores[0];

    const index = (percentile / 100) * (sortedScores.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sortedScores[lower] * (1 - weight) + sortedScores[upper] * weight;
  }
}
