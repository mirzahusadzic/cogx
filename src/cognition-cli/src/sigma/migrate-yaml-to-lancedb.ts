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
import { systemLog, debugError } from '../utils/debug-logger.js';

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
 * Migrate all YAML conversation files to LanceDB for fast semantic search
 *
 * Imports existing YAML conversation overlay files into LanceDB to enable
 * fast vector similarity search. This migration preserves all metadata
 * including embeddings, alignment scores, and sigma metrics while enabling
 * millisecond-scale semantic queries.
 *
 * Before migration:
 * - YAML files with embeddings stored as arrays
 * - Slow linear search through all turns
 * - No efficient semantic similarity queries
 *
 * After migration:
 * - LanceDB vector database with indexed embeddings
 * - Fast ANN (Approximate Nearest Neighbor) search
 * - Millisecond semantic queries across all conversations
 *
 * Migration process:
 * 1. Initialize LanceDB store at .sigma/conversations.lancedb
 * 2. For each overlay (O1-O7):
 *    a. Read all YAML files in overlay directory
 *    b. Parse conversation turns with embeddings
 *    c. Map overlay to alignment scores
 *    d. Store in LanceDB with full metadata
 *
 * Overlay mapping:
 * - conversation-structural → O1
 * - conversation-security → O2
 * - conversation-lineage → O3
 * - conversation-mission → O4
 * - conversation-operational → O5
 * - conversation-mathematical → O6
 * - conversation-coherence → O7
 *
 * @param sigmaRoot - Path to .sigma directory containing overlay YAML files
 * @param options - Migration options
 * @param options.overlays - Specific overlays to migrate (default: all 7)
 * @param options.dryRun - If true, parse files without writing to LanceDB
 * @param options.verbose - If true, log detailed progress information
 * @returns Promise resolving to migration result with statistics
 *
 * @example
 * // Migrate all overlays to LanceDB
 * const result = await migrateYAMLToLanceDB('.sigma', {
 *   verbose: true
 * });
 * console.log(`Migrated ${result.successfulTurns} turns from ${result.totalFiles} files`);
 * console.log(`By overlay: ${JSON.stringify(result.byOverlay)}`);
 *
 * @example
 * // Dry run specific overlays
 * const result = await migrateYAMLToLanceDB('.sigma', {
 *   overlays: ['conversation-structural', 'conversation-security'],
 *   dryRun: true,
 *   verbose: true
 * });
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
      systemLog('sigma', 'LanceDB store initialized');
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
        systemLog(
          'sigma',
          `Skipping ${overlay} - directory not found`,
          {},
          'warn'
        );
      }
      continue;
    }

    result.byOverlay[overlay] = 0;

    if (verbose) {
      systemLog('sigma', `Processing ${overlay}...`);
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
            systemLog('sigma', `File ${file}: No turns found`, {}, 'warn');
          }
          continue;
        }

        if (verbose) {
          systemLog('sigma', `File ${file}: ${yamlData.turns.length} turns`);
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
              systemLog(
                'sigma',
                `Turn ${turn.turn_id}: ${(turnError as Error).message}`,
                {},
                'error'
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
          systemLog(
            'sigma',
            `File ${file}: ${(fileError as Error).message}`,
            {},
            'error'
          );
        }
      }
    }
  }

  if (verbose) {
    systemLog('sigma', '\n' + '='.repeat(50));
    systemLog('sigma', 'Migration Summary:');
    systemLog('sigma', '='.repeat(50));
    systemLog('sigma', `Total files processed: ${result.totalFiles}`);
    systemLog('sigma', `Total turns found: ${result.totalTurns}`);
    systemLog('sigma', `Successfully migrated: ${result.successfulTurns}`);
    systemLog('sigma', `Failed: ${result.failedTurns}`);
    systemLog('sigma', '\nBy Overlay:');
    for (const [overlay, count] of Object.entries(result.byOverlay)) {
      systemLog('sigma', `  ${overlay}: ${count} turns`);
    }

    if (result.errors.length > 0) {
      systemLog('sigma', '\nErrors:', {}, 'error');
      result.errors.slice(0, 10).forEach((err) => {
        systemLog(
          'sigma',
          `  ${err.file} / ${err.turn}: ${err.error}`,
          {},
          'error'
        );
      });
      if (result.errors.length > 10) {
        systemLog(
          'sigma',
          `  ... and ${result.errors.length - 10} more errors`,
          {},
          'error'
        );
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
 * Extract semantic tags from conversation turn content
 *
 * Identifies keywords, entities, and technical terms for indexing and
 * categorization. Tags enable fast filtering during context reconstruction.
 *
 * Extraction patterns:
 * - File references: *.ts, *.tsx, *.js, *.jsx, *.py, *.md, *.json
 * - NPM packages: @scope/package
 * - Technical terms: PascalCase or camelCase identifiers
 * - Technical keywords: words longer than 4 characters
 *
 * @param content - Turn content to extract tags from
 * @returns Array of unique semantic tags (max 15, deduplicated)
 * @private
 *
 * @example
 * const tags = extractSemanticTags('Update AuthService in auth.ts using @types/node');
 * // Returns: ['auth.ts', '@types/node', 'AuthService', 'update', 'using', ...]
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
 * Extract references to other conversation turns
 *
 * Identifies patterns in content that reference other turns, enabling
 * lattice edge construction for semantic relationships.
 *
 * Detection pattern: "turn-123" or "turn_123" format
 *
 * @param content - Turn content to extract references from
 * @returns Array of unique turn reference IDs
 * @private
 *
 * @example
 * const refs = extractReferences('As discussed in turn-42 and turn_50...');
 * // Returns: ['turn-42', 'turn_50']
 */
function extractReferences(content: string): string[] {
  const turnPattern = /turn[-_]\d+/gi;
  const matches = content.match(turnPattern);
  return matches ? [...new Set(matches)] : [];
}

/**
 * CLI-friendly migration function with progress reporting
 *
 * Wrapper around migrateYAMLToLanceDB with user-friendly console output
 * and formatted progress reporting. Suitable for command-line tools.
 *
 * Features:
 * - Progress indicators for each overlay
 * - Summary statistics with counts by overlay
 * - Error reporting with details
 * - Exit codes (0 = success, 1 = failure)
 *
 * @param sigmaRoot - Path to .sigma directory
 * @param options - Migration options (dryRun, overlays)
 * @param options.dryRun - If true, parse without writing to LanceDB
 * @param options.overlays - Specific overlays to migrate
 * @returns Promise resolving when migration completes
 *
 * @example
 * // Run from CLI
 * await runMigration('.sigma', { dryRun: false });
 */
export async function runMigration(
  sigmaRoot: string,
  options: {
    dryRun?: boolean;
    overlays?: string[];
  } = {}
): Promise<void> {
  systemLog('sigma', 'Starting YAML to LanceDB migration...');

  if (options.dryRun) {
    systemLog('sigma', 'DRY RUN MODE - No data will be written', {}, 'warn');
  }

  const result = await migrateYAMLToLanceDB(sigmaRoot, {
    ...options,
    verbose: true,
  });

  if (result.failedTurns === 0) {
    systemLog('sigma', 'Migration completed successfully!');
  } else {
    systemLog('sigma', 'Migration completed with errors', {}, 'warn');
    systemLog(
      'sigma',
      `   ${result.successfulTurns} successful, ${result.failedTurns} failed`,
      {},
      'warn'
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
      debugError('Migration failed', err);
      process.exit(1);
    });
}
