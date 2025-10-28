import { PGCManager } from '../manager.js';
import { VerificationResult } from '../../types/verification.js';
import { z } from 'zod';
import {
  StructuralPatternMetadataSchema,
  StructuralPatternMetadata,
} from '../../types/structural.js';
import chalk from 'chalk';
import path from 'path';

/**
 * Validates overlay layer integrity including structural and lineage pattern metadata.
 */
export class OverlayOracle {
  constructor(private pgcManager: PGCManager) {}

  async verifyStructuralPatternsOverlay(): Promise<VerificationResult> {
    const messages: string[] = [];
    let success = true;

    const structuralPatternsManifest = await this.pgcManager.overlays.get(
      'structural_patterns',
      'manifest',
      z.record(z.string())
    );

    // Log the manifest path for debugging (dimmed to reduce noise)
    const manifestPath = path.join(
      this.pgcManager.pgcRoot,
      'overlays',
      'structural_patterns',
      'manifest.json'
    );
    const msg = `[OverlayOracle] Attempting to read manifest from: ${manifestPath}`;
    console.log(chalk?.dim ? chalk.dim(msg) : msg);

    if (structuralPatternsManifest) {
      for (const [symbolName, relativeFilePath] of Object.entries(
        structuralPatternsManifest
      )) {
        const overlayKey = `${relativeFilePath}#${symbolName}`;
        const metadata: StructuralPatternMetadata | undefined | null =
          await this.pgcManager.overlays.get(
            'structural_patterns',
            overlayKey,
            StructuralPatternMetadataSchema
          );

        if (!metadata) {
          messages.push(
            chalk.red(
              `Structural pattern metadata missing for ${overlayKey} in structural_patterns overlay.`
            )
          );
          success = false;
          continue;
        }

        if (
          !(await this.pgcManager.objectStore.exists(
            metadata.symbolStructuralDataHash
          ))
        ) {
          messages.push(
            chalk.red(
              `Structural pattern ${overlayKey} references non-existent symbolStructuralDataHash: ${metadata.symbolStructuralDataHash}`
            )
          );
          success = false;
        }

        if (
          !(await this.pgcManager.objectStore.exists(
            metadata.validation.sourceHash
          ))
        ) {
          messages.push(
            chalk.red(
              `Structural pattern ${overlayKey} references non-existent sourceHash: ${metadata.validation.sourceHash}`
            )
          );
          success = false;
        }
      }
    } else {
      messages.push(chalk.red('Structural patterns manifest does not exist.'));
      success = false;
    }

    return { success, messages };
  }

  /**
   * CRITICAL: Verify manifest completeness against vector DB
   * Manifest is the source of truth, but it must be in sync with vector DB
   * This catches the case where patterns are generated but manifest isn't updated
   */
  async verifyManifestCompleteness(): Promise<VerificationResult> {
    const messages: string[] = [];
    let success = true;

    try {
      // Load manifest
      const manifest = await this.pgcManager.overlays.getManifest(
        'structural_patterns'
      );
      const manifestSymbols = new Set(Object.keys(manifest || {}));

      // Load vector DB to see what patterns actually exist
      const { LanceVectorStore } = await import(
        '../../overlays/vector-db/lance-store.js'
      );
      const vectorDB = new LanceVectorStore(this.pgcManager.pgcRoot);
      await vectorDB.initialize('structural_patterns');
      const allVectors = await vectorDB.getAllVectors();
      const vectorSymbols = new Set(
        allVectors.map((v: { symbol: unknown }) => v.symbol as string)
      );

      // Find patterns in vector DB but missing from manifest
      const missingFromManifest: string[] = [];
      for (const symbol of vectorSymbols) {
        if (!manifestSymbols.has(symbol as string)) {
          missingFromManifest.push(symbol as string);
        }
      }

      // Find manifest entries with no corresponding vector
      const orphanedInManifest: string[] = [];
      for (const symbol of manifestSymbols) {
        if (!vectorSymbols.has(symbol as string)) {
          orphanedInManifest.push(symbol as string);
        }
      }

      // Report findings
      if (missingFromManifest.length > 0) {
        messages.push(
          chalk.red(
            `\n❌ MANIFEST INCOMPLETE: ${missingFromManifest.length} patterns exist in vector DB but are missing from manifest`
          )
        );
        messages.push(
          chalk.dim(
            `   First 10 missing: ${missingFromManifest.slice(0, 10).join(', ')}`
          )
        );
        messages.push(
          chalk.yellow(
            `   🔧 Fix: Run 'cognition-cli overlay generate structural_patterns --force'`
          )
        );
        success = false;
      }

      if (orphanedInManifest.length > 0) {
        messages.push(
          chalk.yellow(
            `\n⚠️  ORPHANED MANIFEST ENTRIES: ${orphanedInManifest.length} entries in manifest have no vector DB entry`
          )
        );
        messages.push(
          chalk.dim(`   Orphaned: ${orphanedInManifest.join(', ')}`)
        );
        messages.push(
          chalk.dim(
            `   This may indicate stale data from branch switches or incomplete generation`
          )
        );
      }

      if (success) {
        messages.push(
          chalk.green(
            `✅ Manifest complete: ${manifestSymbols.size} entries match ${vectorSymbols.size} vectors`
          )
        );
      }
    } catch (error) {
      messages.push(
        chalk.red(
          `Error during manifest completeness check: ${(error as Error).message}`
        )
      );
      success = false;
    }

    return { success, messages };
  }
}
