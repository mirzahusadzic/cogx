import workerpool from 'workerpool';
import { PGCManager } from '../../pgc/manager.js';
import {
  StructuralData,
  StructuralPatternMetadata,
  StructuralPatternMetadataSchema,
  ClassData,
  FunctionData,
  InterfaceData,
} from '../../types/structural.js';
import {
  PatternJobPacket,
  PatternResultPacket,
  StructuralSymbolType,
  LineageQueryResult,
  Dependency,
} from './types.js';
import { IndexData } from '../../types/index.js';

// This class encapsulates the logic a worker can perform.
class WorkerLogic {
  constructor(private pgc: PGCManager) {}

  private _formatAsLineageJSON(
    lineageResult: LineageQueryResult,
    targetSymbol: string
  ): object {
    // Find the specific symbol we're looking for in the initial context
    // Don't just take the first symbol of any type!
    const initialStructure = lineageResult.initialContext[0];
    const rootSymbol =
      initialStructure?.classes?.find((c) => c.name === targetSymbol)?.name ||
      initialStructure?.functions?.find((f) => f.name === targetSymbol)?.name ||
      initialStructure?.interfaces?.find((i) => i.name === targetSymbol)
        ?.name ||
      '';

    // Deduplicate dependencies by symbol name (keep the one with smallest depth)
    const depMap = new Map<
      string,
      { type: string; relationship: string; depth: number }
    >();

    for (const dep of lineageResult.dependencies) {
      const depSymbol =
        dep.structuralData.classes?.[0]?.name ||
        dep.structuralData.functions?.[0]?.name ||
        dep.structuralData.interfaces?.[0]?.name ||
        '';

      if (depSymbol) {
        const existing = depMap.get(depSymbol);
        if (!existing || dep.depth < existing.depth) {
          depMap.set(depSymbol, {
            type: depSymbol,
            relationship: 'uses',
            depth: dep.depth,
          });
        }
      }
    }

    const lineage = Array.from(depMap.values());

    return { symbol: rootSymbol, lineage: lineage };
  }

  private _determineMaxDepth(
    structuralData: StructuralData,
    filePath: string
  ): number {
    const MAX_OVERALL_DEPTH = 5;
    let baseDepth = 1;
    if (
      structuralData.classes?.some(
        (c: ClassData) => (c.methods?.length || 0) > 0
      ) ||
      structuralData.functions?.some(
        (f: FunctionData) => (f.params?.length || 0) > 0
      ) ||
      structuralData.interfaces?.some(
        (i: InterfaceData) => (i.properties?.length || 0) > 0
      )
    ) {
      baseDepth = 2;
    }

    const srcIndex = filePath.indexOf('src/');
    let calculatedDepth = baseDepth;

    if (srcIndex !== -1) {
      const relativePath = filePath.substring(srcIndex + 4);
      const pathSegments = relativePath.split('/').filter(Boolean);
      calculatedDepth = Math.max(
        1,
        MAX_OVERALL_DEPTH - pathSegments.length + 1
      );
    }
    return Math.max(baseDepth, calculatedDepth);
  }

  /**
   * THE GEM: The Time-Traveling Archaeologist.
   * This method performs the true, grounded, reverse traversal to build a symbol's lineage.}
   */
  public async getHistoricLineage(
    startSymbol: {
      filePath: string;
      symbolName: string;
      structuralHash: string;
    },
    options: { maxDepth: number }
  ): Promise<LineageQueryResult> {
    const { maxDepth } = options;

    // LOAD THE MANIFEST ONCE
    const structuralManifest = await this.pgc.overlays.getManifest(
      'structural_patterns'
    );
    if (!structuralManifest) {
      throw new Error(
        'structural_patterns manifest not found. Run structural pattern generation first.'
      );
    }

    const dependencies: Dependency[] = [];
    const initialContext: StructuralData[] = [];
    const processedSymbols = new Set<string>([startSymbol.symbolName]);

    // 1. Use the provided startSymbol to create a synthetic IndexData object.
    const bestInitialResult: IndexData = {
      path: startSymbol.filePath,
      symbol: startSymbol.symbolName,
      structural_hash: startSymbol.structuralHash,
      content_hash: '' /* Placeholder */,
      status: 'Valid',
      history: [],
    };

    const initialDataBuffer = await this.pgc.objectStore.retrieve(
      bestInitialResult.structural_hash
    );
    if (initialDataBuffer) {
      initialContext.push(JSON.parse(initialDataBuffer.toString()));
    }

    let currentLevelResults: IndexData[] = [bestInitialResult];

    for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
      if (currentLevelResults.length === 0) {
        break;
      }

      const dependencySymbolToLineage = new Map<string, string>();
      const nextLevelCandidates: IndexData[] = [];

      for (const result of currentLevelResults) {
        // 2. THE REVERSAL: Find the moment in history this symbol was created.
        const transformIds = await this.pgc.reverseDeps.getTransformIds(
          result.structural_hash
        );
        if (!transformIds || transformIds.length === 0) {
          console.warn(
            `[LineageWorker] No transform IDs for ${result.symbol} (${result.structural_hash}) - symbol may not have PGC history`
          );
          continue;
        }
        const transformId = transformIds[0];

        // 3. THE RECEIPT: Get the manifest from that moment.
        const transformData =
          await this.pgc.transformLog.getTransformData(transformId);
        // We need the input that created the full file structure, which is the source for this symbol.
        if (!transformData || transformData.outputs.length === 0) continue;
        const sourceStructuralHash = transformData.outputs[0].hash;

        // 4. THE PAYLOAD: Retrieve the entire file's structure from that moment.
        const structuralDataBuffer =
          await this.pgc.objectStore.retrieve(sourceStructuralHash);

        if (structuralDataBuffer) {
          // 5. THE EXPANSION: Parse the full context to find all dependencies.
          const structuralData = JSON.parse(
            structuralDataBuffer.toString()
          ) as StructuralData;
          const parentLineage = result.path!; // This will build up: file -> class -> method

          // Helper to process and collect potential dependency types
          const processType = (type: string | undefined, lineage: string) => {
            if (!type) return;

            // Clean up the type string
            // NOTE: This is TypeScript-focused. May need language-specific cleaning for:
            // - Python: List[int], Dict[str, Any], Callable[[int], str], Union[str, None]
            // - Java: List<String>, Map<String, Object>
            // - Rust: Vec<T>, Option<T>, Result<T, E>
            // TODO: Implement language-specific type cleaning when adding Python/Java/Rust support
            const cleanType = type
              .replace(/\[\]/g, '') // Remove array brackets (TS: string[])
              .replace(/<[^>]*>/g, '') // Remove generic parameters (TS: Promise<T>, Python uses [...])
              .replace(/\([^)]*\)/g, '') // Remove function params (FIX: was /([^)]*)/ which matched everything!)
              .replace(/\s+is\s+.*/g, '') // Remove type predicates (TS: x is string)
              .split('|')[0] // Take first union type (TS: string | null)
              .split('&')[0] // Take first intersection type (TS: A & B)
              .trim();

            // Expanded list of built-ins to exclude
            const excludeTypes = new Set([
              // Primitives
              'string',
              'number',
              'boolean',
              'any',
              'void',
              'unknown',
              'null',
              'undefined',
              'never',
              'symbol',
              'bigint',

              // Built-in objects
              'Promise',
              'Array',
              'object',
              'Object',
              'Function',
              'Map',
              'Set',
              'Date',
              'RegExp',
              'Error',
              'Buffer',
              'Blob',
              'FormData',
              'URL',
              'URLSearchParams',

              // Utility types
              'Record',
              'Partial',
              'Required',
              'Readonly',
              'Pick',
              'Omit',
              'Exclude',
              'Extract',
              'NonNullable',
              'ReturnType',
              'InstanceType',
              'Parameters',

              // Common keywords that aren't real types
              'value',
              'reason',
              'result',
              'record',
              'data',
              'response',
              'request',
              'typeof',
              'keyof',
              'infer',

              // Schema/Validation libraries
              'z.ZodType',
              'Schema',
            ]);

            // Only process if:
            // 1. Not in exclude list
            // 2. Starts with uppercase (TypeScript convention for types/interfaces/classes)
            // 3. Doesn't contain special characters suggesting it's not a real symbol
            // 4. Not too short (avoid single letters)
            if (
              !excludeTypes.has(cleanType) &&
              /^[A-Z]/.test(cleanType) &&
              !/[()=>]/.test(cleanType) &&
              cleanType.length > 1 &&
              !cleanType.includes('.') // Avoid namespaced types like z.ZodType
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

      // NOW LOOK UP SYMBOLS IN THE MANIFEST (NO INDEX SEARCH!)
      for (const [depSymbol] of dependencySymbolToLineage.entries()) {
        if (processedSymbols.has(depSymbol)) continue;

        // Check if this symbol exists in the structural_patterns manifest
        const manifestEntry = structuralManifest[depSymbol];

        if (!manifestEntry) {
          continue;
        }

        // Parse manifest entry (handles both old string and new object formats)
        const filePath =
          typeof manifestEntry === 'string'
            ? manifestEntry
            : manifestEntry.filePath || '';

        if (!filePath) {
          continue;
        }

        // Load the structural pattern metadata for this symbol
        const overlayKey = `${filePath}#${depSymbol}`;
        const structuralPatternMeta =
          await this.pgc.overlays.get<StructuralPatternMetadata>(
            'structural_patterns',
            overlayKey,
            StructuralPatternMetadataSchema
          );

        if (!structuralPatternMeta) {
          continue;
        }

        // Create an IndexData-like object for compatibility with existing code
        const candidate: IndexData = {
          path: filePath,
          symbol: depSymbol,
          structural_hash: structuralPatternMeta.symbolStructuralDataHash,
          content_hash: structuralPatternMeta.validation.sourceHash,
          status: 'Valid',
          history: [],
        };

        nextLevelCandidates.push(candidate);
      }

      // Add found dependencies to our results and queue them for the next level.

      for (const candidate of nextLevelCandidates) {
        if (!candidate.symbol) {
          continue;
        }

        if (processedSymbols.has(candidate.symbol)) continue;

        processedSymbols.add(candidate.symbol);

        const dataBuffer = await this.pgc.objectStore.retrieve(
          candidate.structural_hash
        );

        if (dataBuffer) {
          dependencies.push({
            path: dependencySymbolToLineage.get(candidate.symbol)!,
            depth: currentDepth,
            structuralData: JSON.parse(dataBuffer.toString()),
          });
        }
      }
      currentLevelResults = nextLevelCandidates;
    }
    return { dependencies, initialContext };
  }

  /**
   * Mine lineage pattern (expensive traversal work) without embedding
   * Returns the mined data for later embedding in main process
   */
  public async mineLineagePattern(
    symbolName: string,
    symbolType: StructuralSymbolType,
    structuralData: StructuralData,
    filePath: string,
    validationSourceHash: string,
    structuralHash: string
  ): Promise<{
    lineageJson: object;
    signature: string;
    lineageDataHash: string;
    symbolType: StructuralSymbolType;
    validationSourceHash: string;
  }> {
    const maxDepth = this._determineMaxDepth(structuralData, filePath);

    const lineageResult = await this.getHistoricLineage(
      {
        filePath,
        symbolName,
        structuralHash,
      },
      { maxDepth }
    );

    const lineageJson = this._formatAsLineageJSON(lineageResult, symbolName);
    const signature = JSON.stringify(lineageJson, null, 2);
    const lineageDataHash = this.pgc.objectStore.computeHash(signature);

    return {
      lineageJson,
      signature,
      lineageDataHash,
      symbolType,
      validationSourceHash,
    };
  }
}

async function processJob(job: PatternJobPacket): Promise<PatternResultPacket> {
  const { projectRoot, symbolName, filePath, symbolType, force } = job;

  const pgc = new PGCManager(projectRoot);

  try {
    // Check if overlay exists BEFORE mining
    const overlayKey = `${filePath}#${symbolName}`;

    if (!force && (await pgc.overlays.exists('lineage_patterns', overlayKey))) {
      return {
        status: 'skipped',
        message: `Pattern for ${symbolName} already exists.`,
        symbolName,
        filePath,
      };
    }

    // Create worker logic for mining (no vectorDB needed)
    const logic = new WorkerLogic(pgc);

    const structuralPatternMeta =
      await pgc.overlays.get<StructuralPatternMetadata>(
        'structural_patterns',
        `${filePath}#${symbolName}`,
        StructuralPatternMetadataSchema
      );

    if (!structuralPatternMeta) {
      throw new Error(`Structural metadata not found for ${symbolName}.`);
    }

    const structuralDataBuffer = await pgc.objectStore.retrieve(
      structuralPatternMeta.symbolStructuralDataHash
    );

    if (!structuralDataBuffer) {
      throw new Error(`Structural data object not found for ${symbolName}.`);
    }

    const structuralData = JSON.parse(
      structuralDataBuffer.toString()
    ) as StructuralData;

    // Mine the lineage pattern (expensive work)
    const miningResult = await logic.mineLineagePattern(
      symbolName,
      symbolType,
      structuralData,
      filePath,
      structuralPatternMeta.validation.sourceHash,
      structuralPatternMeta.symbolStructuralDataHash
    );

    return {
      status: 'success',
      message: `Successfully mined lineage for ${symbolName}.`,
      symbolName,
      filePath,
      miningResult: {
        ...miningResult,
        structuralHash: structuralPatternMeta.symbolStructuralDataHash,
      },
    };
  } catch (error: unknown) {
    const errorMsg = `Error mining ${symbolName}: ${(error as Error).message}`;
    console.error(`[LineageWorker] ${errorMsg}`);
    return {
      status: 'error',
      message: errorMsg,
      symbolName,
      filePath,
    };
  }
}

// CRITICAL: This is how workerpool expects functions to be registered
workerpool.worker({
  processJob,
});
