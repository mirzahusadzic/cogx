import { intro, outro, spinner, log } from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';
import { DocumentLanceStore } from '../core/pgc/document-lance-store.js';
import { MissionConcept } from '../core/analyzers/concept-extractor.js';

interface MigrateOptions {
  projectRoot: string;
  overlays?: string[]; // Specific overlays to migrate, or all if not specified
  dryRun?: boolean;
  keepEmbeddings?: boolean; // Keep embeddings in YAML (default: false)
}

/**
 * Migrate YAML overlay embeddings to LanceDB.
 *
 * MIGRATION STRATEGY:
 * 1. Read existing YAML overlays from .open_cognition/overlays/
 * 2. Extract concepts with embeddings
 * 3. Store in LanceDB (.open_cognition/lance/documents.lancedb)
 * 4. Strip embeddings from YAML (convert to v2 format)
 * 5. Keep YAML files for provenance (metadata only)
 *
 * SUPPORTED OVERLAYS:
 * - O2: Security Guidelines (security_guidelines/)
 * - O4: Mission Concepts (mission_concepts/)
 * - O5: Operational Patterns (operational_patterns/)
 * - O6: Mathematical Proofs (mathematical_proofs/)
 */
export async function migrateToLanceCommand(options: MigrateOptions) {
  intro(chalk.bold('Migrate Overlay Embeddings to LanceDB'));

  const pgcRoot = path.join(options.projectRoot, '.open_cognition');
  const overlaysPath = path.join(pgcRoot, 'overlays');

  // Check if PGC exists
  if (!(await fs.pathExists(pgcRoot))) {
    log.error('No .open_cognition found. Run "cognition-cli init" first.');
    process.exit(1);
  }

  // Check if overlays directory exists
  if (!(await fs.pathExists(overlaysPath))) {
    log.warn('No overlays directory found. Nothing to migrate.');
    outro(chalk.yellow('No overlays to migrate'));
    return;
  }

  const s = spinner();

  try {
    // Determine which overlays to migrate
    const availableOverlays = [
      'mission_concepts',
      'security_guidelines',
      'operational_patterns',
      'mathematical_proofs',
    ];
    const overlaysToMigrate = options.overlays || availableOverlays;

    log.info(`Migrating overlays: ${overlaysToMigrate.join(', ')}`);
    console.log('');

    // Initialize LanceDB store
    s.start('Initializing LanceDB store...');
    const lanceStore = new DocumentLanceStore(pgcRoot);
    await lanceStore.initialize();
    s.stop('LanceDB store initialized');

    let totalConcepts = 0;
    let totalDocuments = 0;
    const migrationResults: Array<{
      overlay: string;
      documents: number;
      concepts: number;
    }> = [];

    // Migrate each overlay
    for (const overlayName of overlaysToMigrate) {
      const overlayPath = path.join(overlaysPath, overlayName);

      if (!(await fs.pathExists(overlayPath))) {
        log.warn(`Overlay ${overlayName} not found, skipping`);
        continue;
      }

      s.start(`Migrating ${overlayName}...`);

      const overlayType = overlayNameToType(overlayName);
      const yamlFiles = (await fs.readdir(overlayPath)).filter((f) =>
        f.endsWith('.yaml')
      );

      let documentsCount = 0;
      let conceptsCount = 0;

      for (const yamlFile of yamlFiles) {
        const yamlPath = path.join(overlayPath, yamlFile);

        try {
          const yamlContent = await fs.readFile(yamlPath, 'utf-8');
          const overlay = YAML.parse(yamlContent);

          // Extract concepts based on overlay type
          const concepts = extractConceptsFromOverlay(overlay, overlayName);

          if (concepts.length === 0) {
            continue; // Skip empty overlays
          }

          // Filter concepts with valid embeddings
          const validConcepts = concepts.filter(
            (c) => c.embedding && c.embedding.length === 768
          );

          if (validConcepts.length === 0) {
            log.warn(chalk.dim(`  ${yamlFile}: No valid embeddings found`));
            continue;
          }

          if (options.dryRun) {
            log.info(
              chalk.dim(
                `  [DRY RUN] Would migrate ${validConcepts.length} concepts from ${yamlFile}`
              )
            );
            conceptsCount += validConcepts.length;
            documentsCount++;
            continue;
          }

          // Store concepts in LanceDB
          await lanceStore.storeConceptsBatch(
            overlayType,
            overlay.document_hash,
            overlay.document_path || yamlFile.replace('.yaml', ''),
            overlay.transform_id,
            validConcepts.map((c) => ({
              text: c.text,
              section: c.section || 'unknown',
              sectionHash: c.sectionHash || overlay.document_hash,
              type: c.type || getDefaultConceptType(overlayName),
              weight: c.weight || 1.0,
              occurrences: c.occurrences || 1,
              embedding: c.embedding!,
            }))
          );

          conceptsCount += validConcepts.length;
          documentsCount++;

          // Strip embeddings from YAML to save disk space (unless --keep-embeddings)
          if (!options.keepEmbeddings) {
            const conceptsWithoutEmbeddings = concepts.map((c) => {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { embedding, ...conceptWithoutEmbedding } = c;
              return conceptWithoutEmbedding;
            });

            // Update overlay with stripped concepts
            const updatedOverlay = {
              ...overlay,
              format_version: 2, // Mark as v2 format (embeddings in LanceDB)
            };

            // Update the concepts array based on overlay type
            if (overlayName === 'mission_concepts') {
              updatedOverlay.extracted_concepts = conceptsWithoutEmbeddings;
            } else if (overlayName === 'security_guidelines') {
              updatedOverlay.guidelines = conceptsWithoutEmbeddings;
            } else if (overlayName === 'operational_patterns') {
              updatedOverlay.patterns = conceptsWithoutEmbeddings;
            } else if (overlayName === 'mathematical_proofs') {
              updatedOverlay.knowledge = conceptsWithoutEmbeddings;
            }

            // Write back to YAML without embeddings
            await fs.writeFile(
              yamlPath,
              YAML.stringify(updatedOverlay),
              'utf-8'
            );
          }
        } catch (error) {
          log.error(
            chalk.red(
              `  Failed to migrate ${yamlFile}: ${(error as Error).message}`
            )
          );
        }
      }

      s.stop(
        chalk.green(
          `✓ ${overlayName}: ${documentsCount} documents, ${conceptsCount} concepts`
        )
      );

      totalDocuments += documentsCount;
      totalConcepts += conceptsCount;
      migrationResults.push({
        overlay: overlayName,
        documents: documentsCount,
        concepts: conceptsCount,
      });
    }

    await lanceStore.close();

    // Summary
    console.log('');
    log.info(chalk.bold('Migration Summary:'));
    migrationResults.forEach((result) => {
      log.info(
        `  ${chalk.cyan(result.overlay)}: ${result.documents} documents, ${result.concepts} concepts`
      );
    });
    log.info('');
    log.info(
      `  ${chalk.bold('Total:')} ${totalDocuments} documents, ${totalConcepts} concepts`
    );

    if (options.dryRun) {
      outro(
        chalk.yellow(
          '✓ Dry run complete - no changes made. Run without --dry-run to migrate.'
        )
      );
    } else {
      outro(
        chalk.green(
          `✓ Migration complete! ${totalConcepts} concepts migrated to LanceDB.`
        )
      );
      log.info('');
      if (options.keepEmbeddings) {
        log.info(
          chalk.dim('Note: Embeddings kept in YAML files (--keep-embeddings).')
        );
      } else {
        log.info(
          chalk.dim(
            'Note: Embeddings stripped from YAML files to save disk space.'
          )
        );
        log.info(
          chalk.dim('      YAML files now contain metadata only (v2 format).')
        );
      }
      log.info(
        chalk.dim('LanceDB location: .open_cognition/lance/documents.lancedb')
      );
    }
  } catch (error) {
    log.error(chalk.red((error as Error).message));
    throw error;
  }
}

/**
 * Map overlay directory name to overlay type ID
 */
function overlayNameToType(overlayName: string): string {
  const mapping: Record<string, string> = {
    mission_concepts: 'O4',
    security_guidelines: 'O2',
    operational_patterns: 'O5',
    mathematical_proofs: 'O6',
  };
  return mapping[overlayName] || overlayName;
}

interface OverlayDocument {
  extracted_concepts?: Array<MissionConcept & { type?: string }>;
  guidelines?: Array<MissionConcept & { type?: string }>;
  patterns?: Array<MissionConcept & { type?: string }>;
  knowledge?: Array<MissionConcept & { type?: string }>;
}

/**
 * Extract concepts from YAML overlay based on overlay type
 */
function extractConceptsFromOverlay(
  overlay: OverlayDocument,
  overlayName: string
): Array<MissionConcept & { type?: string }> {
  if (overlayName === 'mission_concepts') {
    return overlay.extracted_concepts || [];
  } else if (overlayName === 'security_guidelines') {
    return overlay.guidelines || [];
  } else if (overlayName === 'operational_patterns') {
    return overlay.patterns || [];
  } else if (overlayName === 'mathematical_proofs') {
    return overlay.knowledge || [];
  }

  return [];
}

/**
 * Get default concept type for overlay
 */
function getDefaultConceptType(overlayName: string): string {
  const mapping: Record<string, string> = {
    mission_concepts: 'concept',
    security_guidelines: 'guideline',
    operational_patterns: 'pattern',
    mathematical_proofs: 'theorem',
  };
  return mapping[overlayName] || 'concept';
}
