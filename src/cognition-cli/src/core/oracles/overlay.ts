import { PGCManager } from '../pgc-manager.js';
import { VerificationResult } from '../../types/verification.js';
import { z } from 'zod';
import { StructuralPatternMetadataSchema } from '../../types/structural.js';
import chalk from 'chalk';

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

    if (structuralPatternsManifest) {
      for (const [symbolName, relativeFilePath] of Object.entries(
        structuralPatternsManifest
      )) {
        const overlayKey = `${relativeFilePath}#${symbolName}`;
        const metadata = await this.pgcManager.overlays.get(
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
