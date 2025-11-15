/**
 * Overlay Integrity Oracle for Grounded Context Pool (PGC)
 *
 * Validates the integrity of the overlay layer, ensuring that:
 * 1. Overlay manifests are complete and accurate
 * 2. Metadata references valid objects in the object store
 * 3. Vector embeddings are synchronized with manifests
 * 4. No orphaned or stale data exists
 *
 * DESIGN PHILOSOPHY:
 * The Oracle is the "immune system" of the PGC. It detects corruption,
 * inconsistencies, and synchronization issues before they cause problems.
 *
 * VALIDATION LAYERS:
 * - Structural Integrity: All metadata references exist in object store
 * - Referential Integrity: sourceHash and dataHash are valid
 * - Manifest Completeness: Manifest matches vector DB contents
 * - Synchronization: No drift between manifest and vector embeddings
 *
 * WHEN TO RUN:
 * - After overlay generation (automatic)
 * - Before critical operations (defensive)
 * - During debugging (diagnostic)
 * - In CI/CD pipelines (quality gate)
 *
 * @example
 * // Validate structural patterns overlay
 * const oracle = new OverlayOracle(pgcManager);
 * const result = await oracle.verifyStructuralPatternsOverlay();
 * if (!result.success) {
 *   console.error('Overlay validation failed:', result.messages);
 *   process.exit(1);
 * }
 *
 * @example
 * // Check manifest completeness
 * const completeness = await oracle.verifyManifestCompleteness();
 * if (!completeness.success) {
 *   console.warn('Manifest out of sync with vector DB');
 *   await regenerateOverlay();
 * }
 */

import { PGCManager } from '../manager.js';
import { VerificationResult } from '../../types/verification.js';
import {
  StructuralPatternMetadataSchema,
  StructuralPatternMetadata,
} from '../../types/structural.js';
import chalk from 'chalk';
import path from 'path';

/**
 * Validates overlay layer integrity including structural and lineage pattern metadata.
 *
 * The OverlayOracle ensures that the overlay layer remains consistent with
 * the underlying object store and vector database.
 */
export class OverlayOracle {
  /**
   * Create a new overlay integrity validator
   *
   * @param pgcManager - PGC manager instance for accessing overlays and object store
   */
  constructor(private pgcManager: PGCManager) {}

  /**
   * Verify structural patterns overlay integrity
   *
   * VALIDATION CHECKS:
   * 1. Manifest exists and is readable
   * 2. Each manifest entry has corresponding metadata in overlay
   * 3. symbolStructuralDataHash references exist in object store
   * 4. sourceHash references exist in object store
   *
   * ALGORITHM:
   * - Load structural_patterns manifest
   * - For each symbol in manifest:
   *   - Retrieve metadata from overlay
   *   - Verify symbolStructuralDataHash exists
   *   - Verify validation.sourceHash exists
   *
   * @returns Verification result with success status and diagnostic messages
   *
   * @example
   * // Run validation before overlay query
   * const result = await oracle.verifyStructuralPatternsOverlay();
   * if (!result.success) {
   *   throw new Error(`Overlay corrupted: ${result.messages.join(', ')}`);
   * }
   *
   * @example
   * // Diagnostic check during debugging
   * const result = await oracle.verifyStructuralPatternsOverlay();
   * console.log('Validation messages:', result.messages);
   */
  async verifyStructuralPatternsOverlay(): Promise<VerificationResult> {
    const messages: string[] = [];
    let success = true;

    // Use new getManifest() method instead of get()
    const structuralPatternsManifest =
      await this.pgcManager.overlays.getManifest('structural_patterns');

    // Log the manifest path for debugging (dimmed to reduce noise)
    const manifestPath = path.join(
      this.pgcManager.pgcRoot,
      'overlays',
      'structural_patterns',
      'manifest.json'
    );
    const msg = `[OverlayOracle] Attempting to read manifest from: ${manifestPath}`;
    console.log(chalk?.dim ? chalk.dim(msg) : msg);

    if (
      structuralPatternsManifest &&
      Object.keys(structuralPatternsManifest).length > 0
    ) {
      for (const [symbolName, manifestEntry] of Object.entries(
        structuralPatternsManifest
      )) {
        // Parse manifest entry (handles both old string and new object formats)
        const relativeFilePath =
          typeof manifestEntry === 'string'
            ? manifestEntry
            : manifestEntry.filePath || '';
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
   * Verify manifest completeness against vector database
   *
   * CRITICAL INVARIANT:
   * The manifest is the source of truth, but it must remain synchronized
   * with the vector DB. This check catches drift between the two stores.
   *
   * VALIDATION CHECKS:
   * 1. Every vector in DB has corresponding manifest entry
   * 2. Every manifest entry has corresponding vector in DB
   * 3. Symbol names match exactly
   *
   * FAILURE MODES:
   * - Missing from Manifest: Patterns exist in vector DB but not indexed
   * - Orphaned in Manifest: Manifest entries with no vector data
   *
   * ALGORITHM:
   * 1. Load manifest symbols (Set M)
   * 2. Load vector DB symbols (Set V)
   * 3. Find V - M (vectors missing from manifest)
   * 4. Find M - V (orphaned manifest entries)
   * 5. Report discrepancies
   *
   * @returns Verification result with detailed synchronization status
   *
   * @example
   * // Detect manifest drift after generation
   * const result = await oracle.verifyManifestCompleteness();
   * if (!result.success) {
   *   console.log('Regenerating overlay to fix sync issues...');
   *   await overlayGenerator.generate('structural_patterns', { force: true });
   * }
   *
   * @example
   * // CI/CD quality gate
   * const result = await oracle.verifyManifestCompleteness();
   * if (!result.success) {
   *   console.error('❌ Overlay integrity check failed');
   *   process.exit(1);
   * }
   */
  async verifyManifestCompleteness(): Promise<VerificationResult> {
    const messages: string[] = [];
    let success = true;
    let vectorDB:
      | InstanceType<
          typeof import('../../overlays/vector-db/lance-store.js').LanceVectorStore
        >
      | undefined;

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
      vectorDB = new LanceVectorStore(this.pgcManager.pgcRoot);
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
    } finally {
      // Ensure vectorDB is properly closed to avoid NAPI reference leaks
      if (vectorDB) {
        await vectorDB.close();
      }
    }

    return { success, messages };
  }
}
