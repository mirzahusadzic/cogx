import path from 'path';
import { PGCManager } from '../core/pgc-manager.js';
import { LanceVectorStore } from '../lib/patterns/vector-db/lance-vector-store.js';
import { WorkbenchClient } from '../executors/workbench-client.js';
import { StructuralPatternsManager } from '../core/structural-patterns-manager.js';
import { LineagePatternsManager } from '../core/lineage-patterns-manager.js';
import { IndexData } from '../types/index.js';
import {
  ClassData,
  FunctionData,
  InterfaceData,
  StructuralData,
} from '../types/structural.js';
import {
  LineagePatternMetadata,
  LineagePatternMetadataSchema,
} from '../types/lineage.js';
import {
  StructuralPatternMetadata,
  StructuralPatternMetadataSchema,
} from '../types/structural.js';

export class OverlayOrchestrator {
  private pgc: PGCManager;
  private workbench: WorkbenchClient;
  private structuralPatternManager: StructuralPatternsManager;
  private lineagePatternManager: LineagePatternsManager;

  private constructor(
    private projectRoot: string,
    private vectorDB: LanceVectorStore
  ) {
    this.pgc = new PGCManager(projectRoot);
    this.workbench = new WorkbenchClient(
      process.env.WORKBENCH_URL || 'http://localhost:8000'
    );
    this.structuralPatternManager = new StructuralPatternsManager(
      this.pgc,
      this.vectorDB,
      this.workbench
    );
    this.lineagePatternManager = new LineagePatternsManager(
      this.pgc,
      this.vectorDB,
      this.workbench
    );
  }

  private findPrimarySymbol(
    data: StructuralData,
    filePath: string
  ): string | null {
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

    const firstExportedClass = data.classes?.find((c: ClassData) =>
      data.exports?.includes(c.name)
    );
    if (firstExportedClass) return firstExportedClass.name;

    const defaultExport = data.exports?.find((e: string) =>
      e.startsWith('default:')
    );
    if (defaultExport) {
      const exportedFunc = data.functions?.find((f: FunctionData) =>
        data.exports?.includes(f.name)
      );
      if (exportedFunc) return exportedFunc.name;
    }

    const firstExportedInterface = data.interfaces?.find((i: InterfaceData) =>
      data.exports?.includes(i.name)
    );
    if (firstExportedInterface) return firstExportedInterface.name;

    return null;
  }

  public static async create(
    projectRoot: string
  ): Promise<OverlayOrchestrator> {
    const pgc = new PGCManager(projectRoot);
    const vectorDB = new LanceVectorStore(pgc.pgcRoot);
    return new OverlayOrchestrator(projectRoot, vectorDB);
  }

    public async run(

      overlayType: 'structural_patterns' | 'lineage_patterns'

    ): Promise<void> {

      if (overlayType === 'lineage_patterns') {

        console.log('[Overlay] Generating lineage patterns from manifest...');

        await this.lineagePatternManager.generateLineageForAllPatterns();

      } else {

        await this.vectorDB.initialize(overlayType);

        const allFiles = await this.pgc.index.getAllData();

  

        console.log(`[Overlay] Verifying work for ${allFiles.length} files...`);

        let processedCount = 0;

        let skippedCount = 0;

        const BATCH_SIZE = 50;

  

        for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {

          const batch = allFiles.slice(i, i + BATCH_SIZE);

          console.log(

            `[Overlay] Processing batch ${

              i / BATCH_SIZE + 1

            }/${Math.ceil(allFiles.length / BATCH_SIZE)}`

          );

  

          const processSymbol = async (indexData: IndexData) => {

            const filePath = indexData.path;

  

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

              overlayType,

              symbol,

              StructuralPatternMetadataSchema

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

              `[Overlay] Mining pattern for: ${symbol} (from ${filePath})`

            );

  

            try {

              await this.structuralPatternManager.generateAndStorePattern(

                symbol,

                structuralData,

                filePath,

                currentSourceHash

              );

              processedCount++;

            } catch (error) {

              console.error(

                `[Overlay] FAILED to process ${symbol} in ${filePath}: ${

                  error instanceof Error ? error.message : String(error)

                }`

              );

            }

          };

  

          await Promise.all(batch.map(processSymbol));

        }

  

        console.log(`\n[Overlay] Processing complete.`);

        console.log(`- Processed ${processedCount} new/updated files.`);

        console.log(`- Skipped ${skippedCount} up-to-date files.`);

  

        await this.generateManifest(

          allFiles.map((f) => f.path),

          overlayType

        );

      }

    }

  private async generateManifest(
    filePaths: string[],
    overlayType: 'structural_patterns' | 'lineage_patterns'
  ): Promise<void> {
    console.log('[Overlay] Generating pattern manifest...');
    const manifest: Record<string, string> = {};

    for (const filePath of filePaths) {
      const indexData = await this.pgc.index.get(filePath);
      if (!indexData || !indexData.structuralData) continue;

      const symbol = this.findPrimarySymbol(indexData.structuralData, filePath);
      if (symbol) {
        manifest[symbol] = filePath;
      }
    }

    await this.pgc.overlays.update(overlayType, 'manifest', manifest);
    console.log('[Overlay] Manifest generated.');
  }
}
