import path from 'path';
import { PGCManager } from '../core/pgc-manager.js';
import { LanceVectorStore } from '../lib/patterns/vector-db/lance-vector-store.js';
import { WorkbenchClient } from '../executors/workbench-client.js';
import { StructuralPatternsManager } from '../core/structural-patterns-manager.js';
import { z } from 'zod';

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

  public static async create(
    projectRoot: string
  ): Promise<OverlayOrchestrator> {
    const vectorDB = new LanceVectorStore(projectRoot);
    await vectorDB.initialize();
    return new OverlayOrchestrator(projectRoot, vectorDB);
  }

  public async run(): Promise<void> {
    const allFiles = await this.pgc.index.getAllData();

    console.log(`[Overlay] Verifying work for ${allFiles.length} files...`);
    let processedCount = 0;
    let skippedCount = 0;

    for (const indexData of allFiles) {
      const filePath = indexData.path;
      // Use the filename (without extension) as the primary symbol for lookup
      const symbol = path.parse(filePath).name;

      const existingOverlay = await this.pgc.overlays.get(
        'structural_patterns',
        filePath,
        PatternMetadataSchema
      );

      const currentSourceHash = indexData.content_hash;

      if (
        existingOverlay &&
        existingOverlay.validation?.sourceHash === currentSourceHash
      ) {
        skippedCount++;
        continue;
      }

      console.log(`[Overlay] Mining lineage for: ${symbol}`);
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
      const symbol = path.parse(filePath).name;
      manifest[symbol] = filePath;
    }
    await this.pgc.overlays.update('structural_patterns', 'manifest', manifest);
    console.log('[Overlay] Manifest generated.');
  }
}
