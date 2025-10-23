import { PGCManager } from '../manager.js';
import { VerificationResult } from '../../types/verification.js';
import { z } from 'zod';
import {
  StructuralPatternMetadataSchema,
  StructuralPatternMetadata,
} from '../../types/structural.js';
import chalk from 'chalk';
import path from 'path';

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
}
