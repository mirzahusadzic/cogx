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

export class PGCManager {
  public readonly pgcRoot: string;
  public readonly projectRoot: string;
  public readonly index: Index;
  public readonly objectStore: ObjectStore;
  public readonly transformLog: TransformLog;
  public readonly reverseDeps: ReverseDeps;
  public readonly overlays: Overlays;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.pgcRoot = path.join(projectRoot, '.open_cognition');
    this.index = new Index(this.pgcRoot);
    this.objectStore = new ObjectStore(this.pgcRoot);
    this.transformLog = new TransformLog(this.pgcRoot);
    this.reverseDeps = new ReverseDeps(this.pgcRoot);
    this.overlays = new Overlays(this.pgcRoot);
  }

  // This method is COPIED from query.ts to be reused by the overlay command
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
   * THE GEM: The Time-Traveling Archaeologist.
   * This method performs the true, grounded, reverse traversal to build a symbol's lineage.
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
