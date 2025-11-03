/**
 * Migration Script: YAML to LanceDB
 *
 * Imports existing YAML conversation files into LanceDB for fast semantic search.
 * Preserves all metadata including embeddings, alignment scores, and sigma metrics.
 */

import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';
import { ConversationLanceStore } from './conversation-lance-store.js';

export interface YAMLConversationOverlay {
  session_id: string;
  turns: Array<{
    turn_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    embedding: number[];
    project_alignment_score: number;
    novelty: number;
    importance: number;
  }>;
  generated_at: string;
}

export interface MigrationResult {
  totalFiles: number;
  totalTurns: number;
  successfulTurns: number;
  failedTurns: number;
  errors: Array<{ file: string; turn: string; error: string }>;
  byOverlay: {
    [key: string]: number;
  };
}

/**
 * Migrate all YAML conversation files to LanceDB.
 */
export async function migrateYAMLToLanceDB(
  sigmaRoot: string,
  options: {
    overlays?: string[]; // Specific overlays to migrate, default: all (O1-O7)
    dryRun?: boolean; // If true, don't actually write to LanceDB
    verbose?: boolean; // Log progress
  } = {}
): Promise<MigrationResult> {
  const overlays = options.overlays || [
    'conversation-structural',
    'conversation-security',
    'conversation-lineage',
    'conversation-mission',
    'conversation-operational',
    'conversation-mathematical',
    'conversation-coherence',
  ];
  const dryRun = options.dryRun || false;
  const verbose = options.verbose || false;

  const result: MigrationResult = {
    totalFiles: 0,
    totalTurns: 0,
    successfulTurns: 0,
    failedTurns: 0,
    errors: [],
    byOverlay: {},
  };

  // Initialize LanceDB store
  let lanceStore: ConversationLanceStore | null = null;
  if (!dryRun) {
    lanceStore = new ConversationLanceStore(sigmaRoot);
    await lanceStore.initialize('conversation_turns');
    if (verbose) {
      console.log('✓ LanceDB store initialized');
    }
  }

  // Map overlay names to overlay IDs
  const overlayIdMap: { [key: string]: string } = {
    'conversation-structural': 'O1',
    'conversation-security': 'O2',
    'conversation-lineage': 'O3',
    'conversation-mission': 'O4',
    'conversation-operational': 'O5',
    'conversation-mathematical': 'O6',
    'conversation-coherence': 'O7',
  };

  // Process each overlay directory
  for (const overlay of overlays) {
    const overlayPath = path.join(sigmaRoot, 'overlays', overlay);
    const overlayId = overlayIdMap[overlay] || 'O1';

    if (!(await fs.pathExists(overlayPath))) {
      if (verbose) {
        console.log(`⊘ Skipping ${overlay} - directory not found`);
      }
      continue;
    }

    result.byOverlay[overlay] = 0;

    if (verbose) {
      console.log(`\n📂 Processing ${overlay}...`);
    }

    // Read all YAML files in overlay directory
    const files = await fs.readdir(overlayPath);
    const yamlFiles = files.filter((f) => f.endsWith('.yaml'));

    result.totalFiles += yamlFiles.length;

    for (const file of yamlFiles) {
      const sessionId = file.replace('.yaml', '');
      const filePath = path.join(overlayPath, file);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const yamlData = YAML.parse(content) as YAMLConversationOverlay;

        if (!yamlData.turns || yamlData.turns.length === 0) {
          if (verbose) {
            console.log(`  ⊘ ${file}: No turns found`);
          }
          continue;
        }

        if (verbose) {
          console.log(`  📄 ${file}: ${yamlData.turns.length} turns`);
        }

        result.totalTurns += yamlData.turns.length;

        // Import each turn
        for (const turn of yamlData.turns) {
          try {
            // Validate embedding
            if (!turn.embedding || turn.embedding.length !== 768) {
              throw new Error(
                `Invalid embedding: length ${turn.embedding?.length || 0}`
              );
            }

            // Create alignment scores based on overlay
            // For migration, we set the current overlay score high and others to the project_alignment_score
            const alignmentScores = {
              alignment_O1: turn.project_alignment_score,
              alignment_O2: turn.project_alignment_score,
              alignment_O3: turn.project_alignment_score,
              alignment_O4: turn.project_alignment_score,
              alignment_O5: turn.project_alignment_score,
              alignment_O6: turn.project_alignment_score,
              alignment_O7: turn.project_alignment_score,
            };

            // Set the specific overlay higher
            const overlayKey =
              `alignment_${overlayId}` as keyof typeof alignmentScores;
            alignmentScores[overlayKey] = Math.max(
              turn.project_alignment_score,
              8.0
            );

            // Extract semantic tags from content
            const semanticTags = extractSemanticTags(turn.content);

            // Extract references
            const references = extractReferences(turn.content);

            if (!dryRun && lanceStore) {
              await lanceStore.storeTurn(
                sessionId,
                turn.turn_id,
                turn.role,
                turn.content,
                turn.embedding,
                {
                  novelty: turn.novelty,
                  importance: turn.importance,
                  is_paradigm_shift: turn.novelty > 0.8,
                  ...alignmentScores,
                  semantic_tags: semanticTags,
                  references: references,
                }
              );
            }

            result.successfulTurns++;
            result.byOverlay[overlay]++;
          } catch (turnError) {
            result.failedTurns++;
            result.errors.push({
              file,
              turn: turn.turn_id,
              error: (turnError as Error).message,
            });

            if (verbose) {
              console.log(
                `    ✗ ${turn.turn_id}: ${(turnError as Error).message}`
              );
            }
          }
        }
      } catch (fileError) {
        result.errors.push({
          file,
          turn: 'N/A',
          error: (fileError as Error).message,
        });

        if (verbose) {
          console.log(`  ✗ ${file}: ${(fileError as Error).message}`);
        }
      }
    }
  }

  if (verbose) {
    console.log('\n' + '='.repeat(50));
    console.log('Migration Summary:');
    console.log('='.repeat(50));
    console.log(`Total files processed: ${result.totalFiles}`);
    console.log(`Total turns found: ${result.totalTurns}`);
    console.log(`Successfully migrated: ${result.successfulTurns}`);
    console.log(`Failed: ${result.failedTurns}`);
    console.log('\nBy Overlay:');
    for (const [overlay, count] of Object.entries(result.byOverlay)) {
      console.log(`  ${overlay}: ${count} turns`);
    }

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.slice(0, 10).forEach((err) => {
        console.log(`  ${err.file} / ${err.turn}: ${err.error}`);
      });
      if (result.errors.length > 10) {
        console.log(`  ... and ${result.errors.length - 10} more errors`);
      }
    }
  }

  // Close LanceDB connection
  if (lanceStore) {
    await lanceStore.close();
  }

  return result;
}

/**
 * Extract semantic tags from content.
 */
function extractSemanticTags(content: string): string[] {
  const tags: string[] = [];

  // Extract file references
  const fileMatches = content.match(/\b[\w-]+\.(ts|tsx|js|jsx|py|md|json)\b/g);
  if (fileMatches) {
    tags.push(...fileMatches);
  }

  // Extract npm packages
  const packageMatches = content.match(/@[\w-]+\/[\w-]+/g);
  if (packageMatches) {
    tags.push(...packageMatches);
  }

  // Extract technical terms (camelCase or PascalCase)
  const termMatches = content.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g);
  if (termMatches) {
    tags.push(...termMatches.slice(0, 5));
  }

  // Extract words longer than 4 characters (technical keywords)
  const words = content
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 4 && /^[a-z]+$/.test(word));
  tags.push(...words.slice(0, 5));

  // Remove duplicates and limit to 15 tags
  return [...new Set(tags)].slice(0, 15);
}

/**
 * Extract references to other turns.
 */
function extractReferences(content: string): string[] {
  const turnPattern = /turn[-_]\d+/gi;
  const matches = content.match(turnPattern);
  return matches ? [...new Set(matches)] : [];
}

/**
 * CLI-friendly migration function with progress reporting.
 */
export async function runMigration(
  sigmaRoot: string,
  options: {
    dryRun?: boolean;
    overlays?: string[];
  } = {}
): Promise<void> {
  console.log('🚀 Starting YAML to LanceDB migration...\n');

  if (options.dryRun) {
    console.log('⚠️  DRY RUN MODE - No data will be written\n');
  }

  const result = await migrateYAMLToLanceDB(sigmaRoot, {
    ...options,
    verbose: true,
  });

  if (result.failedTurns === 0) {
    console.log('\n✅ Migration completed successfully!');
  } else {
    console.log('\n⚠️  Migration completed with errors');
    console.log(
      `   ${result.successfulTurns} successful, ${result.failedTurns} failed`
    );
  }
}

// Allow running as a script
if (import.meta.url === `file://${process.argv[1]}`) {
  const sigmaRoot = process.argv[2] || path.join(process.cwd(), '.sigma');
  const dryRun = process.argv.includes('--dry-run');

  runMigration(sigmaRoot, { dryRun })
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
