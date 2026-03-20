import { PGCStoreContext } from './store-context.js';
import { IndexData } from '../types/index.js';
import { StructuralData, ClassData } from '../types/structural.js';
import { LineageQueryResult, Dependency } from '../overlays/lineage/manager.js';

/**
 * PGCQueryService provides read-only access to the PGC data.
 * It is responsible for symbol search, object retrieval, and lineage lookup.
 */
export class PGCQueryService {
  constructor(private context: PGCStoreContext) {}

  /**
   * Search for a symbol in the index.
   *
   * @param symbolName - Name of the symbol to search for
   * @param context - Optional context to narrow the search
   * @returns Array of matching index entries
   */
  public async search(
    symbolName: string,
    context?: string
  ): Promise<IndexData[]> {
    return this.context.index.search(
      symbolName,
      this.context.objectStore,
      context
    );
  }

  /**
   * Get the object store instance.
   */
  public getStore() {
    return this.context.objectStore;
  }

  /**
   * Find the best result for a symbol based on structural fidelity.
   *
   * @param symbolName - Name of the symbol
   * @param context - Optional context
   * @returns The index entry with the highest fidelity, or null
   */
  public async findBestResultForSymbol(
    symbolName: string,
    context?: string
  ): Promise<IndexData | null> {
    const results = await this.search(symbolName, context);
    if (results.length === 0) return null;

    let bestResult: IndexData | null = null;
    let maxFidelity = -1;

    for (const result of results) {
      const buffer = await this.context.objectStore.retrieve(
        result.structural_hash
      );
      if (buffer) {
        try {
          const data = JSON.parse(buffer.toString()) as StructuralData;
          const fidelity = data.fidelity || 0;
          if (fidelity > maxFidelity) {
            maxFidelity = fidelity;
            bestResult = result;
          }
        } catch {
          // Ignore parse errors
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
    const initialIndexResults = await this.context.index.search(symbolName);
    if (initialIndexResults.length === 0) {
      console.warn(
        `[getLineageForSymbol] Initial symbol not found: ${symbolName}`
      );
      return { dependencies, initialContext };
    }
    const bestInitialResult = initialIndexResults[0]; // Heuristic: assume first result is best
    const initialDataBuffer = await this.context.objectStore.retrieve(
      bestInitialResult.structural_hash
    );
    if (initialDataBuffer) {
      try {
        initialContext.push(JSON.parse(initialDataBuffer.toString()));
      } catch {
        // Ignore parse errors
      }
    }

    let currentLevelResults: IndexData[] = [bestInitialResult];

    for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
      if (currentLevelResults.length === 0) break;

      const dependencySymbolToLineage = new Map<string, string>();
      const nextLevelCandidates: IndexData[] = [];

      for (const result of currentLevelResults) {
        // 2. THE REVERSAL: Find the moment in history this symbol was created.
        const transformIds = await this.context.reverseDeps.getTransformIds(
          result.structural_hash
        );
        if (!transformIds || transformIds.length === 0) continue;
        const transformId = transformIds[0];

        // 3. THE RECEIPT: Get the manifest from that moment.
        const transformData =
          await this.context.transformLog.getTransformation(transformId);
        // We need the input that created the full file structure, which is the source for this symbol.
        if (!transformData || transformData.inputs.length === 0) continue;
        const sourceStructuralHash = transformData.inputs[0].hash;

        // 4. THE PAYLOAD: Retrieve the entire file's structure from that moment.
        const structuralDataBuffer =
          await this.context.objectStore.retrieve(sourceStructuralHash);

        if (structuralDataBuffer) {
          try {
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
          } catch {
            // Ignore parse errors
          }
        }
      }

      // Process dependencies found at this level
      for (const [symbol, path] of dependencySymbolToLineage.entries()) {
        if (!processedSymbols.has(symbol)) {
          processedSymbols.add(symbol);
          const depResult = await this.findBestResultForSymbol(symbol);
          if (depResult) {
            const depBuffer = await this.context.objectStore.retrieve(
              depResult.structural_hash
            );
            if (depBuffer) {
              try {
                const structuralData = JSON.parse(
                  depBuffer.toString()
                ) as StructuralData;
                dependencies.push({
                  path,
                  depth: currentDepth,
                  structuralData,
                });
                nextLevelCandidates.push(depResult);
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      }

      currentLevelResults = nextLevelCandidates;
    }

    return { dependencies, initialContext };
  }
}
