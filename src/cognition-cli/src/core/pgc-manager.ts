import path from 'path';
import fs from 'fs/promises';

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
  StructuralPatternMetadata,
  StructuralPatternMetadataSchema,
} from '../types/structural.js';

export interface Dependency {
  path: string;
  depth: number;
  structuralData: StructuralData;
}

export interface LineageQueryResult {
  dependencies: Dependency[];
  initialContext: StructuralData[];
}

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

  private async _findOverlaySymbolsInPath(
    symbolName: string,
    searchPath: string
  ): Promise<IndexData[]> {
    const results: IndexData[] = [];
    try {
      const files = await fs.readdir(searchPath);
      for (const file of files) {
        if (path.extname(file) === '.json') {
          const filePath = path.join(searchPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content) as StructuralData;

          const isMatch =
            data.classes?.some((c) => c.name === symbolName) ||
            data.functions?.some((f) => f.name === symbolName) ||
            data.interfaces?.some((i) => i.name === symbolName);

          if (isMatch) {
            const structural_hash = this.objectStore.computeHash(content);
            const originalPath = file.split('#')[0];

            // Construct the overlayKey to retrieve metadata
            const overlayKey = `${originalPath}#${symbolName}`;
            const metadata = await this.overlays.get(
              'structural_patterns',
              overlayKey,
              StructuralPatternMetadataSchema
            );

            let contentHash = '';
            if (
              metadata &&
              metadata.validation &&
              metadata.validation.sourceHash
            ) {
              contentHash = metadata.validation.sourceHash;
            }

            results.push({
              path: originalPath,
              symbol: symbolName,
              structural_hash,
              content_hash: contentHash,
              status: 'Valid',
              history: [],
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error searching overlay symbols in ${searchPath}:`, error);
    }
    return results;
  }

  private async _getStructuralPatternsInPath(
    targetFilePath: string
  ): Promise<StructuralPatternMetadata[]> {
    const structuralPatterns: StructuralPatternMetadata[] = [];
    const overlayStructuralPatternsPath = path.join(
      this.pgcRoot,
      'overlays',
      'structural_patterns'
    );

    // Determine the relative path of the target file within the project
    const relativeTargetFilePath = path.relative(
      this.projectRoot,
      targetFilePath
    );

    const targetFileDir = path.dirname(relativeTargetFilePath);

    // Function to recursively read JSON files in a directory
    const readJsonFiles = async (currentDirPath: string) => {
      try {
        const entries = await fs.readdir(currentDirPath, {
          withFileTypes: true,
        });
        for (const entry of entries) {
          const fullPath = path.join(currentDirPath, entry.name);
          if (entry.isDirectory()) {
            await readJsonFiles(fullPath); // Recurse into subdirectories
          } else if (entry.isFile() && entry.name.endsWith('.json')) {
            // Extract the original file path from the JSON file name
            // e.g., src/types/workbench.ts#SummarizeRequest.json -> src/types/workbench.ts
            const originalFilePath = entry.name.split('#')[0];
            const relativeOriginalFilePath = path.relative(
              overlayStructuralPatternsPath,
              path.join(currentDirPath, originalFilePath)
            );

            // Check if the original file path is within the target file's directory or is the target file itself
            if (
              relativeOriginalFilePath.startsWith(targetFileDir) ||
              relativeOriginalFilePath === relativeTargetFilePath
            ) {
              try {
                const content = await fs.readFile(fullPath, 'utf-8');
                const data = JSON.parse(content) as StructuralPatternMetadata;
                structuralPatterns.push(data);
              } catch (parseError) {
                console.error(
                  `Error parsing structural pattern file ${fullPath}:`,
                  parseError
                );
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${currentDirPath}:`, error);
      }
    };

    // Start reading from the overlay structural patterns root
    await readJsonFiles(overlayStructuralPatternsPath);
    return structuralPatterns;
  }

  public async getLineageForStructuralPatterns(
    initialStructuralData: StructuralData,
    maxDepth: number,
    searchPath: string,
    filePath: string
  ): Promise<LineageQueryResult> {
    const initialSymbol =
      initialStructuralData.classes?.[0]?.name ||
      initialStructuralData.functions?.[0]?.name ||
      initialStructuralData.interfaces?.[0]?.name ||
      '';

    const initialIndexDataList: IndexData[] = [];
    const initialContext: StructuralData[] = [];
    initialContext.push(initialStructuralData);

    const symbolToStructuralDataMap = new Map<string, StructuralData>();
    if (initialSymbol) {
      symbolToStructuralDataMap.set(initialSymbol, initialStructuralData);
    }

    // Prepopulate initialContext with structural patterns from the overlay based on filePath
    const overlayPatterns = await this._getStructuralPatternsInPath(filePath);
    for (const pattern of overlayPatterns) {
      const structuralDataBuffer = await this.objectStore.retrieve(
        pattern.symbolStructuralDataHash
      );
      if (structuralDataBuffer) {
        const structuralData = JSON.parse(
          structuralDataBuffer.toString()
        ) as StructuralData;
        symbolToStructuralDataMap.set(pattern.symbol, structuralData);
      }

      // Create a dummy IndexData for overlay patterns
      initialIndexDataList.push({
        path: pattern.anchor, // Use the filePath of the current context
        symbol: pattern.symbol,
        structural_hash: pattern.symbolStructuralDataHash,
        content_hash: '', // No direct content hash for overlay patterns
        status: 'Valid',
        history: [],
      });
    }

    const dependencies: Dependency[] = [];
    const processedSymbols = new Set<string>([initialSymbol]);

    let currentResults = [...initialIndexDataList];

    if (maxDepth > 0 && currentResults.length > 0) {
      for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
        if (currentResults.length === 0) break;

        const newDependenciesForNextLevel: IndexData[] = [];
        const dependencySymbolToLineage = new Map<string, string>();

        for (const result of currentResults) {
          const transformHash = await this.reverseDeps.getTransformIds(
            result.structural_hash
          );

          if (!transformHash || transformHash.length === 0) {
            continue;
          }

          const transformData = await this.transformLog.getTransformData(
            transformHash[0]
          );

          if (!(transformData && transformData.outputs.length > 0)) {
            continue;
          }

          const structuralDataBuffer = await this.objectStore.retrieve(
            transformData.outputs[0].hash
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

          let structuralData: StructuralData | undefined;
          let bestResult: IndexData | null = null;

          if (symbolToStructuralDataMap.has(depSymbol)) {
            structuralData = symbolToStructuralDataMap.get(depSymbol);
            // Create a dummy bestResult for consistency
            bestResult = {
              path: parentLineage,
              symbol: depSymbol,
              structural_hash: this.objectStore.computeHash(
                JSON.stringify(structuralData!)
              ),
              content_hash: '',
              status: 'Valid',
              history: [],
            };
          }

          if (structuralData && bestResult) {
            dependencies.push({
              path: `${parentLineage} -> ${depSymbol}`,
              depth: currentDepth,
              structuralData: structuralData,
            });
            bestResult.path = `${parentLineage} -> ${depSymbol}`;
            newDependenciesForNextLevel.push(bestResult);
          }
        }
        currentResults = newDependenciesForNextLevel;
      }
    }

    return { dependencies, initialContext };
  }
}
