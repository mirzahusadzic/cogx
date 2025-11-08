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
 * 6. Add lancedb_metadata to YAML for retrieval provenance
 * 7. Migrate mission_integrity versions to LanceDB
 *
 * YAML PROVENANCE (v2 format):
 * - format_version: 2 (indicates embeddings stored in LanceDB)
 * - lancedb_metadata: Metadata for retrieving embeddings from LanceDB
 *   - storage_path: Relative path to LanceDB directory
 *   - overlay_type: Overlay type ID (O2, O4, O5, O6, mission_integrity)
 *   - document_hash: Document hash for exact retrieval
 *   - migrated_at: ISO timestamp of migration
 *   - concepts_count: Number of concepts with embeddings
 *
 * SUPPORTED OVERLAYS:
 * - O2: Security Guidelines (security_guidelines/)
 * - O4: Mission Concepts (mission_concepts/)
 * - O5: Operational Patterns (operational_patterns/)
 * - O6: Mathematical Proofs (mathematical_proofs/)
 * - Mission Integrity: Version history (mission_integrity/versions.json)
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

            // Update overlay with stripped concepts and LanceDB provenance
            const updatedOverlay = {
              ...overlay,
              format_version: 2, // Mark as v2 format (embeddings in LanceDB)
              lancedb_metadata: {
                storage_path: '.open_cognition/lance/documents.lancedb',
                overlay_type: overlayType,
                document_hash: overlay.document_hash,
                migrated_at: new Date().toISOString(),
                concepts_count: validConcepts.length,
              },
            };

            // Update the concepts array based on overlay type
            if (overlayName === 'mission_concepts') {
              updatedOverlay.extracted_concepts = conceptsWithoutEmbeddings;
            } else if (overlayName === 'security_guidelines') {
              updatedOverlay.extracted_knowledge = conceptsWithoutEmbeddings;
            } else if (overlayName === 'operational_patterns') {
              updatedOverlay.extracted_patterns = conceptsWithoutEmbeddings;
            } else if (overlayName === 'mathematical_proofs') {
              // Handle both field names
              if (overlay.extracted_statements) {
                updatedOverlay.extracted_statements = conceptsWithoutEmbeddings;
              } else {
                updatedOverlay.knowledge = conceptsWithoutEmbeddings;
              }
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

    // Migrate mission_integrity versions
    s.start('Migrating mission integrity versions...');
    const missionIntegrityPath = path.join(pgcRoot, 'mission_integrity');
    const versionsPath = path.join(missionIntegrityPath, 'versions.json');

    let missionVersionsCount = 0;
    let missionConceptsCount = 0;

    if (await fs.pathExists(versionsPath)) {
      try {
        const versionsData = await fs.readFile(versionsPath, 'utf-8');
        const versions = JSON.parse(versionsData) as Array<{
          version: number;
          hash: string;
          timestamp: string;
          author?: string;
          commitHash?: string;
          semanticFingerprint: string;
          conceptEmbeddings: number[][];
          conceptTexts: string[];
        }>;

        // Store each version's concepts in LanceDB
        for (const version of versions) {
          // Skip if already migrated (no conceptEmbeddings field)
          if (
            !version.conceptEmbeddings ||
            version.conceptEmbeddings.length === 0
          ) {
            continue;
          }

          const concepts = version.conceptEmbeddings.map((embedding, idx) => ({
            text: version.conceptTexts[idx] || `Concept ${idx}`,
            section: 'mission',
            sectionHash: version.hash,
            type: 'mission_concept',
            weight: 1.0,
            occurrences: 1,
            embedding,
          }));

          await lanceStore.storeConceptsBatch(
            'mission_integrity',
            version.hash,
            `mission_version_${version.version}`,
            `mission_integrity:v${version.version}:${version.timestamp}`,
            concepts
          );

          missionVersionsCount++;
          missionConceptsCount += concepts.length;
        }

        // Check if any versions were migrated
        if (missionVersionsCount === 0) {
          s.stop(
            chalk.dim(
              '○ mission_integrity: No embeddings found (already migrated)'
            )
          );
        } else {
          s.stop(
            chalk.green(
              `✓ mission_integrity: ${missionVersionsCount} versions, ${missionConceptsCount} concepts`
            )
          );
        }

        // Create v2 versions.json without embeddings
        if (!options.keepEmbeddings && missionVersionsCount > 0) {
          const strippedVersions = versions.map((v) => ({
            version: v.version,
            hash: v.hash,
            timestamp: v.timestamp,
            author: v.author,
            commitHash: v.commitHash,
            semanticFingerprint: v.semanticFingerprint,
            conceptTexts: v.conceptTexts,
            // Remove conceptEmbeddings, add provenance
            lancedb_metadata: {
              storage_path: '.open_cognition/lance/documents.lancedb',
              overlay_type: 'mission_integrity',
              document_hash: v.hash,
              concepts_count: v.conceptEmbeddings.length,
            },
          }));

          await fs.writeFile(
            versionsPath,
            JSON.stringify(strippedVersions, null, 2),
            'utf-8'
          );
        }
      } catch (error) {
        s.stop(chalk.yellow('⚠ Failed to migrate mission_integrity'));
        log.warn(
          chalk.yellow(
            `  Warning: Could not migrate mission_integrity: ${(error as Error).message}`
          )
        );
      }
    } else {
      s.stop(chalk.dim('○ mission_integrity: No versions found'));
    }

    await lanceStore.close();

    // Migrate Sigma lattice files (strip embeddings from lattice.json)
    s.start('Migrating Sigma lattice files...');
    let latticeFilesCount = 0;
    let latticeSizeBefore = 0;
    let latticeSizeAfter = 0;

    try {
      const { migrateLatticeToV2 } = await import(
        '../sigma/migrate-lattice-to-v2.js'
      );
      const latticeResult = await migrateLatticeToV2(options.projectRoot, {
        dryRun: options.dryRun,
        verbose: false,
        backup: true,
      });

      latticeFilesCount = latticeResult.successfulMigrations;
      latticeSizeBefore = latticeResult.totalSizeBefore;
      latticeSizeAfter = latticeResult.totalSizeAfter;

      if (latticeFilesCount > 0) {
        const reductionPct = Math.round(
          (1 - latticeSizeAfter / latticeSizeBefore) * 100
        );
        s.stop(
          chalk.green(
            `✓ Sigma lattice: ${latticeFilesCount} files migrated (${reductionPct}% size reduction)`
          )
        );
      } else {
        s.stop(chalk.dim('○ Sigma lattice: No files to migrate'));
      }
    } catch (error) {
      s.stop(chalk.yellow('⚠ Sigma lattice migration skipped'));
      log.warn(
        chalk.yellow(
          `  Note: Could not migrate Sigma lattice: ${(error as Error).message}`
        )
      );
    }

    // Compact LanceDB to remove version bloat
    s.start('Compacting Sigma LanceDB...');
    let lanceReduction = 0;

    try {
      const { compactConversationLanceDB } = await import(
        '../sigma/compact-lancedb.js'
      );
      const compactionResult = await compactConversationLanceDB(
        options.projectRoot,
        {
          dryRun: options.dryRun,
          verbose: false,
        }
      );

      lanceReduction = compactionResult.reduction.percentage;

      if (compactionResult.reduction.bytes > 1024 * 1024) {
        const formatBytes = (bytes: number) => {
          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
          return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
        };
        s.stop(
          chalk.green(
            `✓ LanceDB compacted: ${formatBytes(compactionResult.before.dataSize)} → ${formatBytes(compactionResult.after.dataSize)} (${lanceReduction}% reduction)`
          )
        );
      } else {
        s.stop(chalk.dim('○ LanceDB: No compaction needed'));
      }
    } catch (error) {
      s.stop(chalk.dim('○ LanceDB compaction skipped'));
      if (options.dryRun === false) {
        log.warn(
          chalk.dim(
            `  Note: Could not compact LanceDB: ${(error as Error).message}`
          )
        );
      }
    }

    // Summary
    console.log('');
    log.info(chalk.bold('Migration Summary:'));
    migrationResults.forEach((result) => {
      log.info(
        `  ${chalk.cyan(result.overlay)}: ${result.documents} documents, ${result.concepts} concepts`
      );
    });
    if (missionVersionsCount > 0) {
      log.info(
        `  ${chalk.cyan('mission_integrity')}: ${missionVersionsCount} versions, ${missionConceptsCount} concepts`
      );
    }
    // Show sigma_lattice in same style as overlays
    if (latticeFilesCount > 0) {
      const formatBytes = (bytes: number) => {
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
      };
      log.info(
        `  ${chalk.cyan('sigma_lattice')}: ${latticeFilesCount} files, ${formatBytes(latticeSizeBefore)} → ${formatBytes(latticeSizeAfter)}`
      );
    }
    log.info('');
    const totalWithMission = totalConcepts + missionConceptsCount;
    log.info(
      `  ${chalk.bold('Total:')} ${totalDocuments} documents + ${missionVersionsCount} versions + ${latticeFilesCount} lattice files, ${totalWithMission} concepts`
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
          `✓ Migration complete! ${totalWithMission} concepts migrated to LanceDB.`
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
  extracted_knowledge?: Array<MissionConcept & { type?: string }>;
  extracted_patterns?: Array<MissionConcept & { type?: string }>;
  knowledge?: Array<MissionConcept & { type?: string }>;
  extracted_statements?: Array<
    MissionConcept & { type?: string; statementType?: string }
  >;
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
    return overlay.extracted_knowledge || [];
  } else if (overlayName === 'operational_patterns') {
    return overlay.extracted_patterns || [];
  } else if (overlayName === 'mathematical_proofs') {
    // Try both 'knowledge' and 'extracted_statements' fields
    return overlay.extracted_statements || overlay.knowledge || [];
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
