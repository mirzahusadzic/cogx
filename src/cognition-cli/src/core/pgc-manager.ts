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

export interface Dependency {
  path: string;
  depth: number;
  structuralData: StructuralData;
}

export class PGCManager {
  public readonly pgcRoot: string;
  public readonly index: Index;
  public readonly objectStore: ObjectStore;
  public readonly transformLog: TransformLog;
  public readonly reverseDeps: ReverseDeps;
  public readonly overlays: Overlays;

  constructor(projectRoot: string) {
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

  // This method is COPIED and adapted from query.ts
  async getLineageForSymbol(
    symbol: string,
    options: { maxDepth: number }
  ): Promise<{ dependencies: Dependency[]; initialContext: StructuralData[] }> {
    const entities = [symbol];

    const initialContextResults: IndexData[] = [];
    for (const entity of entities) {
      const result = await this.findBestResultForSymbol(
        entity,
        'initial entity search'
      );
      if (result) {
        initialContextResults.push(result);
      }
    }

    const initialContextBuffers = await Promise.all(
      initialContextResults.map((r) =>
        this.objectStore.retrieve(r.structural_hash)
      )
    );
    const initialContext = initialContextBuffers
      .filter((b) => b)
      .map((b) => JSON.parse(b!.toString()));

    const dependencies: Dependency[] = [];
    let currentResults = [...initialContextResults];
    const maxDepth = options.maxDepth;

    if (maxDepth > 0 && currentResults.length > 0) {
      const processedSymbols = new Set<string>(entities);

      for (const result of currentResults) {
        const buffer = await this.objectStore.retrieve(result.structural_hash);
        if (buffer) {
          const data = JSON.parse(buffer.toString()) as StructuralData;
          result.path =
            data.classes?.[0]?.name ||
            data.functions?.[0]?.name ||
            data.interfaces?.[0]?.name ||
            symbol;
        }
      }

      for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
        if (currentResults.length === 0) break;

        const newDependenciesForNextLevel: IndexData[] = [];
        const dependencySymbolToLineage = new Map<string, string>();

        for (const result of currentResults) {
          const structuralDataBuffer = await this.objectStore.retrieve(
            result.structural_hash
          );
          if (structuralDataBuffer) {
            const structuralData = JSON.parse(
              structuralDataBuffer.toString()
            ) as StructuralData;
            const parentLineage = result.path!;

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

            structuralData.classes?.forEach((c: ClassData) => {
              const classLineage = parentLineage.endsWith(c.name)
                ? parentLineage
                : `${parentLineage} -> ${c.name}`;
              c.base_classes?.forEach((s) =>
                dependencySymbolToLineage.set(s, classLineage)
              );
              c.implements_interfaces?.forEach((s) =>
                dependencySymbolToLineage.set(s, classLineage)
              );
              c.methods?.forEach((m) => {
                const methodLineage = `${classLineage} -> ${m.name}`;
                m.params?.forEach((p) => processType(p.type, methodLineage));
              });
            });

            structuralData.functions?.forEach((f: FunctionData) => {
              const funcLineage = parentLineage.endsWith(f.name)
                ? parentLineage
                : `${parentLineage} -> ${f.name}`;
              f.params?.forEach((p) => processType(p.type, funcLineage));
            });

            structuralData.interfaces?.forEach((i: InterfaceData) => {
              const interfaceLineage = parentLineage.endsWith(i.name)
                ? parentLineage
                : `${parentLineage} -> ${i.name}`;
              i.properties?.forEach((p) =>
                processType(p.type, interfaceLineage)
              );
            });
          }
        }

        for (const [
          depSymbol,
          parentLineage,
        ] of dependencySymbolToLineage.entries()) {
          if (processedSymbols.has(depSymbol)) {
            continue;
          }
          processedSymbols.add(depSymbol);

          const bestResult = await this.findBestResultForSymbol(
            depSymbol,
            `dependency search at depth ${currentDepth}`
          );
          if (bestResult) {
            const structuralDataBuffer = await this.objectStore.retrieve(
              bestResult.structural_hash
            );
            if (structuralDataBuffer) {
              const structuralData = JSON.parse(
                structuralDataBuffer.toString()
              ) as StructuralData;
              dependencies.push({
                path: `${parentLineage} -> ${depSymbol}`,
                depth: currentDepth,
                structuralData: structuralData,
              });
              bestResult.path = `${parentLineage} -> ${depSymbol}`;
              newDependenciesForNextLevel.push(bestResult);
            }
          }
        }
        currentResults = newDependenciesForNextLevel;
      }
    }

    return { dependencies, initialContext };
  }
}
