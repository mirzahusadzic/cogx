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

    const matchingClass = data.classes?.find(
      (c: ClassData) =>
        data.exports?.includes(c.name) && c.name === pascalFileName
    );
    if (matchingClass) return matchingClass.name;

    // Strategy 2: First exported class (common convention)
    const firstExportedClass = data.classes?.find((c: ClassData) =>
      data.exports?.includes(c.name)
    );
    if (firstExportedClass) return firstExportedClass.name;

    // Strategy 3: Default export function
    const defaultExport = data.exports?.find((e: string) =>
      e.startsWith('default:')
    );
    if (defaultExport) {
      const exportedFunc = data.functions?.find((f: FunctionData) =>
        data.exports?.includes(f.name)
      );
      if (exportedFunc) return exportedFunc.name;
    }

    // Strategy 4: First exported interface
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

          const symbol = this.findPrimarySymbol(structuralData, filePath);
          if (!symbol) {
            console.warn(
              `[Overlay] No primary symbol found in ${filePath}, skipping.`
            );
            skippedCount++;
            return;
          }

          const existingOverlay = await this.pgc.overlays.get(
            'structural_patterns',
            symbol, // Use symbol, not filePath
            PatternMetadataSchema
          );

          const currentSourceHash = indexData.content_hash;

          if (
            existingOverlay &&
            existingOverlay.validation?.sourceHash === currentSourceHash
          ) {
            skippedCount++;
            return;
          }

          console.log(
            `[Overlay] Mining lineage for: ${symbol} (from ${filePath})`
          );
          try {
            await this.patternManager.generateAndStorePattern(
              symbol,
              filePath,
              currentSourceHash
            );
            processedCount++;
          } catch (error) {
            console.error(`[Overlay] FAILED to process ${symbol}:`, error);
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
      // We need to re-read the structural data to get the symbol
      const indexData = await this.pgc.index.get(filePath);
      if (!indexData || !indexData.structuralData) continue;

      const symbol = this.findPrimarySymbol(indexData.structuralData, filePath);
      if (symbol) {
        manifest[symbol] = filePath;
      }
    }
    await this.pgc.overlays.update('structural_patterns', 'manifest', manifest);
    console.log('[Overlay] Manifest generated.');
  }
}
