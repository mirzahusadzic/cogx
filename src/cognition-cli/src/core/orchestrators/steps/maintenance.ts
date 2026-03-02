import { BaseStep } from './base.js';
import type { PipelineContext, StepResult } from '../types.js';
import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';

export interface MaintenanceOptions {
  gc?: boolean;
  verify?: boolean;
}

/**
 * Step to perform PGC maintenance including garbage collection and verification.
 */
export class MaintenanceStep extends BaseStep {
  name = 'Maintenance';

  constructor(
    private readonly options: MaintenanceOptions = { gc: true, verify: true }
  ) {
    super();
  }

  async execute(context: PipelineContext): Promise<StepResult> {
    const processedFiles = context.processedFiles;

    if (this.options.gc) {
      this.log('Running PGC Garbage Collection');
      await this.runGarbageCollection(context, processedFiles);
    }

    if (this.options.verify) {
      this.log('Running PGC Verification');
      const verificationResult = await context.genesisOracle.verify();
      if (!verificationResult.success) {
        return this.failure(
          'PGC Verification failed',
          new Error(verificationResult.messages.join('\n'))
        );
      }
      this.log('PGC Verification complete. PGC is structurally coherent.');
    }

    return this.success();
  }

  private async runGarbageCollection(
    context: PipelineContext,
    processedFiles: string[]
  ) {
    const overlayReferencedHashes =
      await this.getOverlayReferencedHashes(context);

    // Phase 1: Clean up stale index entries
    const allIndexedData = await context.pgc.index.getAllData();
    const staleFilePaths = allIndexedData
      .filter((data) => !processedFiles.includes(data.path))
      .map((data) => data.path);

    let staleEntries = 0;
    for (const staleFile of staleFilePaths) {
      const indexData = await context.pgc.index.get(staleFile);
      if (indexData) {
        // Only delete hashes that are NOT referenced by overlays
        if (!overlayReferencedHashes.has(indexData.content_hash)) {
          await context.pgc.objectStore.delete(indexData.content_hash);
        }
        if (!overlayReferencedHashes.has(indexData.structural_hash)) {
          await context.pgc.objectStore.delete(indexData.structural_hash);
        }

        // Clean up transform history
        for (const transformId of indexData.history) {
          await context.pgc.transformLog.delete(transformId);
          await context.pgc.reverseDeps.delete(
            indexData.content_hash,
            transformId
          );
          await context.pgc.reverseDeps.delete(
            indexData.structural_hash,
            transformId
          );
        }
      }
      await context.pgc.index.remove(staleFile);
      staleEntries++;
    }
    if (staleEntries > 0)
      this.log(`Removed ${staleEntries} stale index entries.`);

    // Phase 2: Clean up docs
    const removedDocs = await this.garbageCollectDocs(
      context,
      overlayReferencedHashes
    );
    if (removedDocs > 0)
      this.log(`Removed ${removedDocs} stale document index entries.`);

    // Phase 3: Clean up structural overlays
    const removedOverlays =
      await this.garbageCollectStructuralOverlays(context);
    if (removedOverlays > 0)
      this.log(
        `Removed ${removedOverlays} orphaned structural overlay entries.`
      );

    // Phase 4: Clean up orphans
    const removedOrphans = await context.docsOracle.cleanupOrphanedObjects();
    if (removedOrphans > 0)
      this.log(`Removed ${removedOrphans} orphaned document objects.`);

    // Phase 5: Clean up empty directories
    await context.pgc.objectStore.removeEmptyShardedDirectories();
    await context.pgc.reverseDeps.removeEmptyShardedDirectories();
    this.log('Cleaned up empty sharded directories.');
  }

  private async getOverlayReferencedHashes(
    context: PipelineContext
  ): Promise<Set<string>> {
    const referencedHashes = new Set<string>();
    const directScanOverlays = [
      'security_guidelines',
      'operational_patterns',
      'mathematical_proofs',
    ];
    const manifestOverlays = [
      'structural_patterns',
      'lineage_patterns',
      'mission_concepts',
      'strategic_coherence',
    ];

    for (const overlayType of directScanOverlays) {
      const overlayDir = path.join(
        context.pgc.pgcRoot,
        'overlays',
        overlayType
      );
      if (!(await fs.pathExists(overlayDir))) continue;

      const files = await fs.readdir(overlayDir);
      for (const file of files) {
        if (!file.endsWith('.yaml')) continue;
        try {
          const content = await fs.readFile(
            path.join(overlayDir, file),
            'utf-8'
          );
          const overlayData = YAML.parse(content);
          const docHash = overlayData.document_hash || overlayData.documentHash;
          if (docHash) referencedHashes.add(docHash);
        } catch {
          /* ignore */
        }
      }
    }

    for (const overlayType of manifestOverlays) {
      try {
        const manifest = await context.pgc.overlays.getManifest(overlayType);
        for (const entry of Object.values(manifest)) {
          const m = context.pgc.overlays.parseManifestEntry(entry) as Record<
            string,
            unknown
          >;
          if (typeof m.documentHash === 'string')
            referencedHashes.add(m.documentHash);
          if (typeof m.structuralHash === 'string')
            referencedHashes.add(m.structuralHash);
          if (typeof m.symbolStructuralDataHash === 'string')
            referencedHashes.add(m.symbolStructuralDataHash);
        }
      } catch {
        /* ignore */
      }
    }

    return referencedHashes;
  }

  private async garbageCollectDocs(
    context: PipelineContext,
    overlayReferencedHashes: Set<string>
  ): Promise<number> {
    const docs = await context.docsOracle.listDocuments();
    const staleHashes = new Set<string>();
    for (const doc of docs) {
      const objectExists = await context.pgc.objectStore.exists(doc.objectHash);
      const isReferenced =
        overlayReferencedHashes.has(doc.objectHash) ||
        overlayReferencedHashes.has(doc.contentHash);
      if (!objectExists || !isReferenced) {
        staleHashes.add(doc.objectHash);
      }
    }
    return context.docsOracle.removeStaleEntries(staleHashes);
  }

  private async garbageCollectStructuralOverlays(
    context: PipelineContext
  ): Promise<number> {
    let cleanedCount = 0;
    const overlayDirs = [
      'structural_patterns',
      'security_guidelines',
      'lineage_patterns',
      'mission_concepts',
      'operational_patterns',
      'mathematical_proofs',
      'strategic_coherence',
    ];

    const findOverlayFiles = async (dir: string): Promise<string[]> => {
      const files: string[] = [];
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory())
          files.push(...(await findOverlayFiles(fullPath)));
        else if (entry.name.endsWith('.json') || entry.name.endsWith('.yaml'))
          files.push(fullPath);
      }
      return files;
    };

    for (const overlayDir of overlayDirs) {
      const overlayRoot = path.join(
        context.pgc.pgcRoot,
        'overlays',
        overlayDir
      );
      if (!(await fs.pathExists(overlayRoot))) continue;

      const overlayFiles = await findOverlayFiles(overlayRoot);
      for (const overlayFile of overlayFiles) {
        try {
          const content = await fs.readFile(overlayFile, 'utf-8');
          const overlayData = overlayFile.endsWith('.json')
            ? JSON.parse(content)
            : YAML.parse(content);

          const sourceHash =
            overlayData.validation?.sourceHash ||
            overlayData.symbolStructuralDataHash;
          if (sourceHash) {
            const exists = await context.pgc.objectStore.exists(sourceHash);
            if (!exists) {
              await fs.remove(overlayFile);
              cleanedCount++;
            }
          }
        } catch {
          /* ignore */
        }
      }
    }
    return cleanedCount;
  }
}
