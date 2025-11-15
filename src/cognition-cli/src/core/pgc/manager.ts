import path from 'path';
import { Index } from './index.js';
import { ObjectStore } from './object-store.js';
import { TransformLog } from './transform-log.js';
import { ReverseDeps } from './reverse-deps.js';
import { Overlays } from './overlays.js';
import { IndexData } from '../types/index.js';
import {
  StructuralData,
  ClassData,
  FunctionData,
  InterfaceData,
} from '../types/structural.js';
import { LineageQueryResult, Dependency } from '../overlays/lineage/manager.js';
import { EmbedResponse } from '../types/workbench.js';

/**
 * Provenance-Grounded Computation (PGC) Manager
 *
 * Central coordinator for the PGC system - a content-addressable, provenance-tracked
 * computation framework that ensures all derived data is traceable to its source.
 *
 * ARCHITECTURE:
 * The PGC maintains a complete DAG (Directed Acyclic Graph) of transformations:
 * - Source files → Structural extraction → Code patterns (O₁)
 * - Documents → Concept extraction → Overlays (O₂, O₄, O₅, O₆)
 * - Patterns + Concepts → Strategic coherence (O₇)
 *
 * COMPONENTS:
 * - Index: Fast symbol lookup (name → structural_hash)
 * - ObjectStore: Content-addressable storage (hash → content)
 * - TransformLog: Transformation provenance (transform_id → inputs/outputs)
 * - ReverseDeps: Dependency graph (output_hash → transform_ids that used it)
 * - Overlays: Pattern metadata and embeddings storage
 *
 * GROUNDED CONTEXT POOL (PGC Root):
 * All data lives in .open_cognition/:
 * - objects/: Content-addressable blobs (git-style sharding)
 * - index.jsonl: Symbol → hash mapping
 * - transform.jsonl: Transform provenance log
 * - reverse_deps.jsonl: Dependency graph edges
 * - overlays/: Pattern metadata by overlay type
 * - lance/: Vector embeddings (LanceDB)
 *
 * PROVENANCE:
 * Every piece of derived data has a complete provenance chain:
 * 1. Source file (hash, path, timestamp)
 * 2. Transform that processed it (id, method, timestamp)
 * 3. Output artifacts (hashes, types)
 * 4. Dependencies (what used this output)
 *
 * DESIGN RATIONALE:
 * - Content-addressable: Automatic deduplication, cache invalidation
 * - Provenance tracking: Reproducibility, debugging, incremental updates
 * - Overlay architecture: Separation of concerns (structure vs semantics)
 * - Embedding-first: Enables semantic search across all overlays
 *
 * @example
 * // Initialize PGC for a project
 * const pgc = new PGCManager('/path/to/project');
 *
 * // Query structural patterns
 * const results = await pgc.index.search('MyClass', pgc.objectStore);
 *
 * // Get lineage for a symbol (reverse dependency traversal)
 * const lineage = await pgc.getLineageForSymbol('MyClass', { maxDepth: 3 });
 *
 * @example
 * // Setup embedding service integration
 * const workbench = new WorkbenchClient('http://localhost:8000');
 * const embeddingService = new EmbeddingService(workbench.getBaseUrl());
 * pgc.setEmbeddingRequestHandler(async (params) => {
 *   return embeddingService.getEmbedding(params.signature, params.dimensions);
 * });
 */
export class PGCManager {
  public readonly pgcRoot: string;
  public readonly projectRoot: string;
  public readonly index: Index;
  public readonly objectStore: ObjectStore;
  public readonly transformLog: TransformLog;
  public readonly reverseDeps: ReverseDeps;
  public readonly overlays: Overlays;

  // Add embedding request handler property
  private embeddingRequestHandler?: (params: {
    signature: string;
    dimensions: number;
  }) => Promise<EmbedResponse>;

  /**
   * Initialize PGC manager for a project.
   *
   * Creates or opens the .open_cognition directory and initializes
   * all subsystems (index, object store, logs, overlays).
   *
   * @param projectRoot - Path to project root (not .open_cognition itself)
   */
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.pgcRoot = path.join(projectRoot, '.open_cognition');
    this.index = new Index(this.pgcRoot);
    this.objectStore = new ObjectStore(this.pgcRoot);
    this.transformLog = new TransformLog(this.pgcRoot);
    this.reverseDeps = new ReverseDeps(this.pgcRoot);
    this.overlays = new Overlays(this.pgcRoot);
  }

  /**
   * Set embedding request handler for centralized embedding coordination.
   *
   * Pattern managers use this to delegate embedding generation to a
   * centralized service, ensuring rate limiting and fair resource allocation.
   *
   * DESIGN:
   * - Workers call pgc.requestEmbedding()
   * - This handler routes to EmbeddingService
   * - Service queues and rate-limits all requests
   * - No worker directly calls Workbench (prevents rate limit violations)
   *
   * @param handler - Function that generates embeddings via centralized service
   *
   * @example
   * const embeddingService = new EmbeddingService('http://localhost:8000');
   * pgc.setEmbeddingRequestHandler(async (params) => {
   *   return embeddingService.getEmbedding(params.signature, params.dimensions);
   * });
   */
  public setEmbeddingRequestHandler(
    handler: (params: {
      signature: string;
      dimensions: number;
    }) => Promise<EmbedResponse>
  ): void {
    this.embeddingRequestHandler = handler;
  }

  /**
   * Request an embedding via centralized service.
   *
   * Workers use this method to generate embeddings without directly accessing
   * Workbench. The request is routed through the embedding handler which
   * queues and rate-limits all requests.
   *
   * @param params - Embedding request parameters
   * @param params.signature - Text to embed (structural/semantic pattern)
   * @param params.dimensions - Embedding dimensions (768 for eGemma)
   * @returns Promise resolving to embedding response
   * @throws {Error} If embedding handler not configured
   *
   * @example
   * // Worker requesting embedding
   * const response = await pgc.requestEmbedding({
   *   signature: JSON.stringify(structuralPattern),
   *   dimensions: 768
   * });
   * const embedding = response.embedding_768d;
   */
  public async requestEmbedding(params: {
    signature: string;
    dimensions: number;
  }): Promise<EmbedResponse> {
    if (!this.embeddingRequestHandler) {
      throw new Error(
        'Embedding request handler not set. This PGCManager instance cannot service embedding requests. ' +
          'Make sure you are using this PGCManager instance through a PatternManager that sets up the embedding service.'
      );
    }
    return this.embeddingRequestHandler(params);
  }

  /**
   * Check if embedding requests are available.
   *
   * @returns True if embedding handler is configured
   */
  public canRequestEmbeddings(): boolean {
    return this.embeddingRequestHandler !== undefined;
  }

  /**
   * Find best structural match for a symbol by fidelity.
   *
   * When multiple results exist for a symbol (e.g., class with same name
   * in different files), this returns the one with highest fidelity score.
   *
   * ALGORITHM:
   * 1. Search index for symbol
   * 2. For each result, load structural data
   * 3. Compare fidelity scores
   * 4. Return highest-fidelity result
   *
   * @param symbolName - Symbol to find (class, function, interface)
   * @param context - Optional context for disambiguation
   * @returns Best match or null if not found
   * @private
   */
  private async findBestResultForSymbol(
    symbolName: string,
    context?: string
  ): Promise<IndexData | null> {
    const results = await this.index.search(
      symbolName,
      this.objectStore,
      context
    );
    if (results.length === 0) return null;

    let bestResult: IndexData | null = null;
    let maxFidelity = -1;

    for (const result of results) {
      const buffer = await this.objectStore.retrieve(result.structural_hash);
      if (buffer) {
        const data = JSON.parse(buffer.toString()) as StructuralData;
        const fidelity = data.fidelity || 0;
        if (fidelity > maxFidelity) {
          maxFidelity = fidelity;
          bestResult = result;
        }
      }
    }
    return bestResult;
  }

  /**
   * THE GEM: The Time-Traveling Archaeologist
   *
   * Perform provenance-grounded lineage traversal to build a symbol's complete
   * dependency tree by traveling backwards through time via the transform log.
   *
   * ALGORITHM ("The Reversal"):
   * 1. FIND: Locate symbol in index → get structural_hash
   * 2. REVERSE: Find transform that CREATED this hash (via reverseDeps)
   * 3. RECEIPT: Get transform manifest → extract INPUT hash (source file)
   * 4. PAYLOAD: Load source file structure → find all dependencies
   * 5. EXPANSION: For each dependency, repeat steps 1-4 (recursive traversal)
   * 6. Stop at maxDepth or when no more dependencies found
   *
   * DESIGN RATIONALE:
   * Unlike typical dependency trackers that parse imports/requires, this method
   * uses the PGC's transform log to traverse backwards through TIME:
   * - Each symbol has a moment of creation (transform)
   * - That transform has inputs (source files, dependencies)
   * - Those inputs contain the full structural context at that moment
   * - By following this chain, we reconstruct the ACTUAL lineage
   *
   * This approach handles:
   * - Dynamic dependencies (computed at runtime)
   * - Type dependencies (not just import statements)
   * - Historical context (what the code looked like when it was written)
   * - Full provenance chain (complete audit trail)
   *
   * @param symbolName - Symbol to trace (class, function, interface)
   * @param options - Lineage options
   * @param options.maxDepth - Maximum traversal depth (prevents infinite loops)
   * @returns Complete lineage tree with dependencies at each depth level
   *
   * @example
   * // Get 3-level lineage for a class
   * const lineage = await pgc.getLineageForSymbol('StrategicCoherenceManager', {
   *   maxDepth: 3
   * });
   *
   * // Result structure:
   * // {
   * //   initialContext: [StructuralData for StrategicCoherenceManager],
   * //   dependencies: [
   * //     { path: "VISION.md -> MissionConcept", depth: 1, structuralData: {...} },
   * //     { path: "VISION.md -> MissionConcept -> Embedding", depth: 2, structuralData: {...} },
   * //     ...
   * //   ]
   * // }
   *
   * @example
   * // Find all types used by a function
   * const lineage = await pgc.getLineageForSymbol('computeCoherence', {
   *   maxDepth: 2
   * });
   * const types = lineage.dependencies
   *   .filter(d => d.depth === 1)
   *   .map(d => d.structuralData.interfaces?.map(i => i.name))
   *   .flat();
   */
  public async getLineageForSymbol(
    symbolName: string,
    options: { maxDepth: number }
  ): Promise<LineageQueryResult> {
    const { maxDepth } = options;
    const dependencies: Dependency[] = [];
    const initialContext: StructuralData[] = [];
    const processedSymbols = new Set<string>([symbolName]);

    // 1. Find the initial symbol in the index to start the traversal.
    const initialIndexResults = await this.index.search(symbolName);
    if (initialIndexResults.length === 0) {
      console.warn(
        `[getLineageForSymbol] Initial symbol not found: ${symbolName}`
      );
      return { dependencies, initialContext };
    }
    const bestInitialResult = initialIndexResults[0]; // Heuristic: assume first result is best
    const initialDataBuffer = await this.objectStore.retrieve(
      bestInitialResult.structural_hash
    );
    if (initialDataBuffer) {
      initialContext.push(JSON.parse(initialDataBuffer.toString()));
    }

    let currentLevelResults: IndexData[] = [bestInitialResult];

    for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
      if (currentLevelResults.length === 0) break;

      const dependencySymbolToLineage = new Map<string, string>();
      const nextLevelCandidates: IndexData[] = [];

      for (const result of currentLevelResults) {
        // 2. THE REVERSAL: Find the moment in history this symbol was created.
        const transformIds = await this.reverseDeps.getTransformIds(
          result.structural_hash
        );
        if (!transformIds || transformIds.length === 0) continue;
        const transformId = transformIds[0];

        // 3. THE RECEIPT: Get the manifest from that moment.
        const transformData =
          await this.transformLog.getTransformData(transformId);
        // We need the input that created the full file structure, which is the source for this symbol.
        if (!transformData || transformData.inputs.length === 0) continue;
        const sourceStructuralHash = transformData.inputs[0].hash;

        // 4. THE PAYLOAD: Retrieve the entire file's structure from that moment.
        const structuralDataBuffer =
          await this.objectStore.retrieve(sourceStructuralHash);

        if (structuralDataBuffer) {
          // 5. THE EXPANSION: Parse the full context to find all dependencies.
          const structuralData = JSON.parse(
            structuralDataBuffer.toString()
          ) as StructuralData;
          const parentLineage = result.path!; // This will build up: file -> class -> method

          // Helper to process and collect potential dependency types
          const processType = (type: string | undefined, lineage: string) => {
            const cleanType = type?.replace('[]', '').split('|')[0].trim();
            if (
              cleanType &&
              ![
                'string',
                'number',
                'boolean',
                'any',
                'void',
                'unknown',
              ].includes(cleanType)
            ) {
              dependencySymbolToLineage.set(cleanType, lineage);
            }
          };

          // Iterate through all structures in the file to find where our symbol is defined and what it uses
          structuralData.classes?.forEach((c: ClassData) => {
            const classLineage = `${parentLineage} -> ${c.name}`;
            c.base_classes?.forEach((s) =>
              dependencySymbolToLineage.set(s, classLineage)
            );
            c.implements_interfaces?.forEach((s) =>
              dependencySymbolToLineage.set(s, classLineage)
            );
            c.methods?.forEach((m) => {
              const methodLineage = `${classLineage} -> ${m.name}`;
              m.params?.forEach((p) => processType(p.type, methodLineage));
              processType(m.returns, methodLineage);
            });
          });

          structuralData.functions?.forEach((f: FunctionData) => {
            const funcLineage = `${parentLineage} -> ${f.name}`;
            f.params?.forEach((p) => processType(p.type, funcLineage));
            processType(f.returns, funcLineage);
          });

          structuralData.interfaces?.forEach((i: InterfaceData) => {
            const interfaceLineage = `${parentLineage} -> ${i.name}`;
            i.properties?.forEach((p) => processType(p.type, interfaceLineage));
          });
        }
      }

      // Now, find all the newly discovered symbols in the index.
      for (const [depSymbol] of dependencySymbolToLineage.entries()) {
        if (processedSymbols.has(depSymbol)) continue;
        const searchResults = await this.index.search(depSymbol);
        if (searchResults.length > 0) {
          nextLevelCandidates.push(searchResults[0]);
        }
      }

      // Add found dependencies to our results and queue them for the next level.
      for (const candidate of nextLevelCandidates) {
        if (processedSymbols.has(candidate.symbol!)) continue;
        processedSymbols.add(candidate.symbol!);

        const dataBuffer = await this.objectStore.retrieve(
          candidate.structural_hash
        );
        if (dataBuffer) {
          dependencies.push({
            path: dependencySymbolToLineage.get(candidate.symbol!)!,
            depth: currentDepth,
            structuralData: JSON.parse(dataBuffer.toString()),
          });
        }
      }
      currentLevelResults = nextLevelCandidates;
    }

    return { dependencies, initialContext };
  }
}
