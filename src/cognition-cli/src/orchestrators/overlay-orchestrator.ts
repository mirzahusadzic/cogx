import path from 'path';
import { PGCManager } from '../core/pgc-manager.js';
import { LanceVectorStore } from '../lib/patterns/vector-db/lance-vector-store.js';
import { WorkbenchClient } from '../executors/workbench-client.js';
import { StructuralPatternsManager } from '../core/structural-patterns-manager.js';
import { z } from 'zod';
import {
  ClassData,
  FunctionData,
  InterfaceData,
  StructuralData,
} from '../types/structural.js';

// Define a Zod schema for the metadata to ensure type safety when reading from disk
const PatternMetadataSchema = z.object({
  symbol: z.string(),
  anchor: z.string(),
  lineageHash: z.string(),
  embeddingHash: z.string(),
  structuralSignature: z.string(),
  computedAt: z.string(),
  validation: z.object({
    sourceHash: z.string(),
    embeddingModelVersion: z.string(),
  }),
});

export class OverlayOrchestrator {
  private pgc: PGCManager;
  private vectorDB: LanceVectorStore;
  private workbench: WorkbenchClient;
  private patternManager: StructuralPatternsManager;

  private constructor(
    private projectRoot: string,
    vectorDB: LanceVectorStore
  ) {
    this.pgc = new PGCManager(projectRoot);
    this.vectorDB = vectorDB;
    this.workbench = new WorkbenchClient(
      process.env.WORKBENCH_URL || 'http://localhost:8000'
    );
    this.patternManager = new StructuralPatternsManager(
      this.pgc,
      this.vectorDB,
      this.workbench
    );
  }

  private findPrimarySymbol(
    data: StructuralData,
    filePath: string
  ): string | null {
    // Strategy 1: Exported class that matches filename (highest confidence)
    const fileName = path.parse(filePath).name;
    const pascalFileName = fileName
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');

    // Strategy 1 (Python-specific): Class or function that matches filename
    if (data.language === 'python') {
      const matchingPythonClass = data.classes?.find(
        (c: ClassData) => c.name === pascalFileName
      );
      if (matchingPythonClass) return matchingPythonClass.name;

      const matchingPythonFunction = data.functions?.find(
        (f: FunctionData) => f.name === fileName
      );
      if (matchingPythonFunction) return matchingPythonFunction.name;

      // Fallback for Python: First defined class or function
      if (data.classes && data.classes.length > 0) return data.classes[0].name;
      if (data.functions && data.functions.length > 0)
        return data.functions[0].name;
    }

    // Strategy 2: Exported class that matches filename (highest confidence)
    const matchingClass = data.classes?.find(
      (c: ClassData) =>
        data.exports?.includes(c.name) && c.name === pascalFileName
    );
    if (matchingClass) return matchingClass.name;

    // Strategy 3: First exported class (common convention)
    const firstExportedClass = data.classes?.find((c: ClassData) =>
      data.exports?.includes(c.name)
    );
    if (firstExportedClass) return firstExportedClass.name;

    // Strategy 4: Default export function
    const defaultExport = data.exports?.find((e: string) =>
      e.startsWith('default:')
    );
    if (defaultExport) {
      const exportedFunc = data.functions?.find((f: FunctionData) =>
        data.exports?.includes(f.name)
      );
      if (exportedFunc) return exportedFunc.name;
    }

    // Strategy 5: First exported interface
    const firstExportedInterface = data.interfaces?.find((i: InterfaceData) =>
      data.exports?.includes(i.name)
    );
    if (firstExportedInterface) return firstExportedInterface.name;

    // No clear primary symbol
    return null;
  }

  public static async create(
    projectRoot: string
  ): Promise<OverlayOrchestrator> {
    const pgc = new PGCManager(projectRoot);
    const vectorDB = new LanceVectorStore(pgc.pgcRoot);
    await vectorDB.initialize();
    return new OverlayOrchestrator(projectRoot, vectorDB);
  }

  public async run(): Promise<void> {
    const allFiles = await this.pgc.index.getAllData();

    console.log(`[Overlay] Verifying work for ${allFiles.length} files...`);
    let processedCount = 0;
    let skippedCount = 0;
    const BATCH_SIZE = 50;
    for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
      const batch = allFiles.slice(i, i + BATCH_SIZE);
      console.log(
        `[Overlay] Processing batch ${i / BATCH_SIZE + 1}/${Math.ceil(allFiles.length / BATCH_SIZE)}`
      );

      await Promise.all(
        batch.map(async (indexData) => {
          const filePath = indexData.path;

          // Skip test files automatically
          if (filePath.includes('.test.') || filePath.includes('.spec.')) {
            skippedCount++;
            return;
          }
          const structuralData = indexData.structuralData;
          if (!structuralData) {
            console.warn(
              `[Overlay] No structural data for ${filePath}, skipping.`
            );
            skippedCount++;
            return;
          }

          const currentSourceHash = indexData.content_hash;

          const processSymbol = async (
            symbolName: string,
            symbolData: ClassData | FunctionData | InterfaceData,
            type: 'class' | 'function' | 'interface'
          ) => {
            // Create a minimal StructuralData object for the individual symbol
            const minimalStructuralData: StructuralData = {
              language: structuralData.language,
              docstring: symbolData.docstring || '',
              imports: [], // Imports are file-level, not symbol-level for this context
              classes: type === 'class' ? [symbolData as ClassData] : [],
              functions:
                type === 'function' ? [symbolData as FunctionData] : [],
              interfaces:
                type === 'interface' ? [symbolData as InterfaceData] : [],
              exports: [], // Exports are file-level
              dependencies: [], // Dependencies are file-level
              extraction_method: structuralData.extraction_method,
              fidelity: structuralData.fidelity,
            };

            const overlayKey = `${filePath}#${symbolName}`;

            const existingOverlay = await this.pgc.overlays.get(
              'structural_patterns',
              overlayKey,
              PatternMetadataSchema
            );

            if (
              existingOverlay &&
              existingOverlay.validation?.sourceHash === currentSourceHash
            ) {
              skippedCount++;
              return;
            }

            console.log(
              `[Overlay] Mining pattern for: ${symbolName} (from ${filePath})`
            );
            try {
              await this.patternManager.generateAndStorePattern(
                symbolName,
                minimalStructuralData,
                filePath,
                currentSourceHash
              );
              processedCount++;
            } catch (error) {
              console.error(
                `[Overlay] FAILED to process ${symbolName} in ${filePath}:`,
                error
              );
            }
          };

          // Process classes
          if (structuralData.classes) {
            await Promise.all(
              structuralData.classes.map((cls) =>
                processSymbol(cls.name, cls, 'class')
              )
            );
          }

          // Process functions
          if (structuralData.functions) {
            await Promise.all(
              structuralData.functions.map((func) =>
                processSymbol(func.name, func, 'function')
              )
            );
          }

          // Process interfaces
          if (structuralData.interfaces) {
            await Promise.all(
              structuralData.interfaces.map((iface) =>
                processSymbol(iface.name, iface, 'interface')
              )
            );
          }
        })
      );
    }

    console.log(`\n[Overlay] Processing complete.`);
    console.log(`- Processed ${processedCount} new/updated files.`);
    console.log(`- Skipped ${skippedCount} up-to-date files.`);

    await this.generateManifest(allFiles.map((f) => f.path));
  }

  private async generateManifest(filePaths: string[]): Promise<void> {
    console.log('[Overlay] Generating pattern manifest...');
    const manifest: Record<string, string> = {};
    for (const filePath of filePaths) {
      const indexData = await this.pgc.index.get(filePath);
      if (!indexData || !indexData.structuralData) continue;

      const structuralData = indexData.structuralData;

      // Add classes to manifest
      if (structuralData.classes) {
        structuralData.classes.forEach((cls) => {
          const overlayKey = `${filePath}#${cls.name}`;
          manifest[overlayKey] = filePath;
        });
      }

      // Add functions to manifest
      if (structuralData.functions) {
        structuralData.functions.forEach((func) => {
          const overlayKey = `${filePath}#${func.name}`;
          manifest[overlayKey] = filePath;
        });
      }

      // Add interfaces to manifest
      if (structuralData.interfaces) {
        structuralData.interfaces.forEach((iface) => {
          const overlayKey = `${filePath}#${iface.name}`;
          manifest[overlayKey] = filePath;
        });
      }
    }
    await this.pgc.overlays.update('structural_patterns', 'manifest', manifest);
    console.log('[Overlay] Manifest generated.');
  }
}
