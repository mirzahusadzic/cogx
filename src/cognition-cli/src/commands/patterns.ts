/**
 * Pattern Management and Query Commands
 *
 * Provides a comprehensive suite of commands for exploring, analyzing, and comparing
 * structural and lineage patterns stored in the Grounded Context Pool (PGC). These
 * patterns represent semantic embeddings of code symbols with their architectural roles
 * and dependency relationships.
 *
 * PATTERN TYPES:
 * - **Structural Patterns (O₁)**: Code structure and architectural roles
 *   - Stored in structural_patterns overlay
 *   - Contains: symbol name, architectural role, structural signature
 *   - Vector embeddings for semantic similarity search
 *
 * - **Lineage Patterns (O₃)**: Dependency chains and type lineage
 *   - Stored in lineage_patterns overlay
 *   - Contains: symbol name, dependency graph, lineage signature
 *   - Vector embeddings for dependency-aware search
 *
 * COMMANDS:
 * - `patterns find-similar <symbol>`: Find architecturally similar symbols
 * - `patterns analyze`: Show architectural role distribution
 * - `patterns list`: List all patterns with optional filtering
 * - `patterns inspect <symbol>`: Detailed symbol information
 * - `patterns graph <symbol>`: Visualize dependency graph
 * - `patterns compare <symbol1> <symbol2>`: Compare two symbols
 *
 * DESIGN:
 * All commands use the manifest as source of truth (Monument 4.8):
 * 1. Read manifest to determine which patterns should exist
 * 2. Verify corresponding vectors exist in LanceDB
 * 3. Report stale vectors (in manifest but not in vector DB)
 * 4. Suggest regeneration if vectors are missing
 *
 * @example
 * // Find symbols similar to a function
 * cognition-cli patterns find-similar handleUserInput
 * // → Shows top 10 similar symbols with cosine similarity scores
 *
 * @example
 * // Analyze architectural pattern distribution
 * cognition-cli patterns analyze --verbose
 * // → Shows role counts and sample symbols for each role
 *
 * @example
 * // Compare two symbols
 * cognition-cli patterns compare UserManager AuthService
 * // → Shows similarity score and structural differences
 */

import { getVerboseState } from '../utils/verbose.js';
import { Command } from 'commander';
import { PGCManager } from '../core/pgc/manager.js';
import {
  LanceVectorStore,
  VectorRecord,
} from '../core/overlays/vector-db/lance-store.js';
import { WorkbenchClient } from '../core/executors/workbench-client.js';
import { StructuralPatternsManager } from '../core/overlays/structural/patterns.js';
import { LineagePatternsManager } from '../core/overlays/lineage/manager.js';
import { RoleClassifier } from '../core/services/role-classifier.js';
import chalk from 'chalk';
import { z } from 'zod';

import { PatternManager } from '../core/pgc/patterns.js';

/**
 * Adds pattern management and query commands to the CLI program
 *
 * Registers all pattern-related subcommands under the `patterns` command group.
 * Each subcommand operates on structural or lineage patterns stored in the PGC.
 *
 * @param program - Commander program instance to add commands to
 */
export function addPatternsCommands(program: Command) {
  const patternsCommand = program
    .command('patterns')
    .description('Commands for managing and querying structural patterns.');

  patternsCommand
    .command('find-similar <symbol>')
    .option('-k, --top-k <number>', 'Number of similar patterns', '10')
    .option(
      '--type <type>',
      "The type of patterns to find ('structural' or 'lineage')",
      'structural'
    )
    .option('--json', 'Output raw JSON')
    .action(async (symbol, options, command) => {
      const pgc = new PGCManager(process.cwd());
      const vectorDB = new LanceVectorStore(pgc.pgcRoot);
      const tableName = `${options.type}_patterns`;
      await vectorDB.initialize(tableName);

      const workbench = new WorkbenchClient(process.env.WORKBENCH_URL!);

      const manager: PatternManager =
        options.type === 'structural'
          ? new StructuralPatternsManager(pgc, vectorDB, workbench)
          : new LineagePatternsManager(pgc, vectorDB, workbench);

      const results = await manager.findSimilarPatterns(
        symbol,
        parseInt(options.topK)
      );

      const allOpts = command.optsWithGlobals();
      const useJson = allOpts.json || options.json;

      if (useJson) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(
          chalk.bold(
            `\n🔍 ${
              options.type === 'structural' ? 'Structural' : 'Lineage'
            } patterns similar to ${chalk.cyan(symbol)}:\n`
          )
        );
        results.forEach(
          (
            r: {
              symbol: string;
              filePath: string;
              similarity: number;
              architecturalRole: string;
              explanation: string;
            },
            i: number
          ) => {
            const simBar = '█'.repeat(Math.round(r.similarity * 20));
            console.log(
              `${i + 1}. ${chalk.green(r.symbol)} ` +
                `${chalk.gray(`[${r.architecturalRole}]`)}`
            );
            console.log(`   ${chalk.dim('📁 ' + r.filePath)}`);
            console.log(
              `   ${chalk.yellow(simBar)} ${(r.similarity * 100).toFixed(1)}%`
            );
            console.log(`   ${chalk.dim(r.explanation)}\n`);
          }
        );
      }
    });

  const analyzeCommand = patternsCommand
    .command('analyze')
    .argument('[role]', 'The ID of the architectural role to analyze')
    .description('Analyze architectural patterns across the codebase')
    .option(
      '--type <type>',
      "The type of patterns to analyze ('structural' or 'lineage')",
      'structural'
    )
    .option('-v, --verbose', 'Show detailed information including file paths')
    .option('--json', 'Output as JSON')
    .action(async (role, options, command) => {
      await analyzePatterns({ ...options, role }, command);
    });

  analyzeCommand
    .command('roles')
    .description('List all architectural roles and their descriptions')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const pgc = new PGCManager(process.cwd());
      const classifier = RoleClassifier.loadFromProject(pgc.projectRoot);
      const roleConfig = classifier.getConfig();

      if (options.json) {
        console.log(JSON.stringify(roleConfig.roles, null, 2));
        return;
      }

      console.log(chalk.bold('\nArchitectural Roles:\n'));
      roleConfig.roles.forEach((role) => {
        console.log(`${chalk.cyan(role.id.padEnd(25))} ${role.description}`);
      });
      console.log(
        chalk.dim('\nUse `patterns analyze role <role>` for detailed analysis')
      );
    });

  analyzeCommand
    .command('role <roleId>')
    .description('Detailed analysis of a specific architectural role')
    .option(
      '--type <type>',
      "The type of patterns to analyze ('structural' or 'lineage')",
      'structural'
    )
    .option('--json', 'Output as JSON')
    .action(async (roleId, options, command) => {
      await analyzePatterns({ ...options, role: roleId }, command);
    });

  patternsCommand
    .command('list')
    .description('List all patterns, optionally filtered by role')
    .option('--role <role>', 'Filter by architectural role')
    .option(
      '--type <type>',
      "The type of patterns to list ('structural' or 'lineage')",
      'structural'
    )
    .option('--json', 'Output as JSON')
    .action(async (options, command) => {
      const pgc = new PGCManager(process.cwd());
      const vectorDB = new LanceVectorStore(pgc.pgcRoot);

      const allOpts = command.optsWithGlobals();
      const useJson = allOpts.json || options.json;

      const tableName = `${options.type}_patterns`;
      await vectorDB.initialize(tableName);
      const allVectors: VectorRecord[] = await vectorDB.getAllVectors();

      // Filter out semantic shadow vectors (only show structural body vectors)
      // Semantic vectors have "semantic" in their ID and type='semantic'
      const structuralVectors = allVectors.filter((v) => v.type !== 'semantic');

      // Filter by role if specified
      let filteredVectors = structuralVectors;
      if (options.role) {
        filteredVectors = structuralVectors.filter(
          (v) => v.architectural_role === options.role
        );
      }

      // Helper function to extract file path from vector id
      const getFilePathFromId = (id: string): string => {
        const parts = id.split('_');
        if (parts.length < 3) return 'unknown';
        const pathParts = parts.slice(1, -1);
        let path = pathParts.join('/');
        if (path.endsWith('/ts')) {
          path = path.substring(0, path.length - 3) + '.ts';
        }
        return path || 'unknown';
      };

      if (filteredVectors.length === 0) {
        if (!useJson) {
          if (options.role) {
            console.log(
              chalk.yellow(
                `\nNo patterns found with role: ${chalk.cyan(options.role)}`
              )
            );
          } else {
            console.log(chalk.yellow('\nNo patterns found.'));
          }
        } else {
          console.log(JSON.stringify([], null, 2));
        }
        return;
      }

      if (useJson) {
        const results = filteredVectors.map((v) => ({
          symbol: v.symbol,
          filePath: getFilePathFromId(v.id as string),
          role: v.architectural_role,
        }));
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      const title = options.role
        ? `Patterns with role: ${chalk.cyan(options.role)}`
        : `All ${options.type} patterns`;

      console.log(
        chalk.bold(`\n📋 ${title} (${filteredVectors.length} found):\n`)
      );

      filteredVectors.forEach((v, i) => {
        const symbol = (v.symbol as string) || 'unknown';
        const filePath = getFilePathFromId(v.id as string);
        const role = v.architectural_role as string;

        console.log(`${i + 1}. ${chalk.green(symbol)}`);
        console.log(`   📁 ${chalk.dim(filePath)}`);
        if (!options.role) {
          console.log(`   🏷️  ${chalk.cyan(role)}`);
        }
        console.log('');
      });

      // Show available roles if no filter applied
      if (!options.role) {
        const roles = new Set(
          allVectors.map((v) => v.architectural_role as string)
        );
        console.log(chalk.dim('\n💡 Available roles:'));
        console.log(chalk.dim(`   ${Array.from(roles).sort().join(', ')}`));
        console.log(
          chalk.dim('\n   Use --role <role> to filter by a specific role')
        );
      }
    });

  patternsCommand
    .command('inspect <symbol>')
    .description('Show comprehensive information about a symbol')
    .option('--json', 'Output as JSON')
    .action(async (symbol, options, command) => {
      const pgc = new PGCManager(process.cwd());
      const vectorDB = new LanceVectorStore(pgc.pgcRoot);

      const allOpts = command.optsWithGlobals();
      const useJson = allOpts.json || options.json;

      if (!useJson) {
        console.log(
          chalk.bold(`\n🔍 Inspecting symbol: ${chalk.cyan(symbol)}\n`)
        );
      }

      // Check structural patterns
      const structuralEntry = await pgc.overlays.getManifestEntry(
        'structural_patterns',
        symbol
      );
      const structuralFilePath = structuralEntry?.filePath;

      if (!structuralFilePath) {
        if (!useJson) {
          console.log(
            chalk.red(`❌ Symbol '${symbol}' not found in patterns.`)
          );
          console.log(
            chalk.dim('\n💡 Use `patterns list` to see all available symbols')
          );
        } else {
          console.log(
            JSON.stringify({ error: `Symbol '${symbol}' not found` }, null, 2)
          );
        }
        return;
      }

      if (!useJson) {
        console.log(
          chalk.green(`✅ Found in: ${chalk.dim(structuralFilePath)}\n`)
        );
      }

      const result: Record<string, unknown> = {
        symbol,
        filePath: structuralFilePath,
      };

      // Load structural pattern metadata
      const structuralRawName = symbol.includes('#')
        ? symbol.split('#').pop()!
        : symbol;
      const structuralOverlayKey = `${structuralFilePath}#${structuralRawName}`;
      const structuralMeta = await pgc.overlays.get(
        'structural_patterns',
        structuralOverlayKey,
        z.record(z.unknown())
      );

      if (structuralMeta) {
        const meta = structuralMeta as Record<string, unknown>;
        result.structural = meta;
        if (!useJson) {
          console.log(chalk.bold('📦 Structural Pattern:'));
          console.log(`   Role: ${chalk.cyan(meta.architecturalRole)}`);
          console.log(`   Signature: ${chalk.dim(meta.structuralSignature)}`);
          console.log(`   Computed: ${chalk.dim(meta.computedAt)}`);

          const validation = meta.validation as Record<string, unknown>;
          if (validation) {
            console.log(chalk.bold('\n✅ Validation:'));
            console.log(`   Extraction: ${validation.extractionMethod}`);
            console.log(`   Fidelity: ${validation.fidelity}`);
            console.log(`   Model: ${validation.embeddingModelVersion}`);
          }
        }
      }

      // Load lineage pattern metadata
      const lineageEntry = await pgc.overlays.getManifestEntry(
        'lineage_patterns',
        symbol
      );
      const lineageFilePath = lineageEntry?.filePath;

      if (lineageFilePath) {
        const lineageRawName = symbol.includes('#')
          ? symbol.split('#').pop()!
          : symbol;
        const lineageOverlayKey = `${lineageFilePath}#${lineageRawName}`;
        const lineageMeta = await pgc.overlays.get(
          'lineage_patterns',
          lineageOverlayKey,
          z.record(z.unknown())
        );

        if (lineageMeta) {
          const meta = lineageMeta as Record<string, unknown>;
          result.lineage = meta;
          if (!useJson) {
            console.log(chalk.bold('\n🌳 Lineage Pattern:'));

            try {
              const lineageData = JSON.parse(meta.lineageSignature as string);
              result.lineageData = lineageData;
              if (lineageData.lineage && lineageData.lineage.length > 0) {
                console.log(`   Dependencies (${lineageData.lineage.length}):`);
                lineageData.lineage.forEach(
                  (dep: { type: string; depth: number }) => {
                    const indent = '  '.repeat(dep.depth);
                    console.log(
                      `   ${indent}└─ ${chalk.cyan(dep.type)} ${chalk.dim(`(depth ${dep.depth})`)}`
                    );
                  }
                );
              } else {
                console.log(chalk.dim('   No dependencies found'));
              }
            } catch {
              console.log(chalk.dim('   Could not parse lineage data'));
            }
          } else {
            try {
              result.lineageData = JSON.parse(meta.lineageSignature as string);
            } catch {
              // Ignore parse errors
            }
          }
        }
      } else {
        if (!useJson) {
          console.log(
            chalk.yellow('\n⚠️  No lineage pattern found for this symbol')
          );
          console.log(
            chalk.dim('   Run: cognition-cli overlay generate lineage_patterns')
          );
        }
      }

      // Find similar patterns
      await vectorDB.initialize('structural_patterns');
      const structuralPatternManager = new StructuralPatternsManager(
        pgc,
        vectorDB,
        new WorkbenchClient(process.env.WORKBENCH_URL!)
      );

      try {
        const similar = await structuralPatternManager.findSimilarPatterns(
          symbol,
          5
        );
        result.similar = similar;
        if (similar.length > 0) {
          if (!useJson) {
            console.log(chalk.bold('\n🔗 Similar Patterns:'));
            similar.forEach((s, i) => {
              console.log(
                `   ${i + 1}. ${chalk.green(s.symbol)} ${chalk.dim(`(${(s.similarity * 100).toFixed(1)}%)`)}`
              );
              console.log(`      📁 ${chalk.dim(s.filePath)}`);
            });
          }
        }
      } catch (error) {
        if (!useJson) {
          console.log(chalk.dim('\n💡 Similar patterns search unavailable'));
          console.warn(
            `Similar patterns search error: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      if (useJson) {
        console.log(JSON.stringify(result, null, 2));
      }
    });

  patternsCommand
    .command('graph <symbol>')
    .description('Visualize dependency graph for a symbol')
    .option('--json', 'Output as JSON instead of ASCII tree')
    .option('--max-depth <number>', 'Maximum depth to traverse', '3')
    .action(async (symbol, options, command) => {
      const pgc = new PGCManager(process.cwd());

      const allOpts = command.optsWithGlobals();
      const useJson = allOpts.json || options.json;

      if (!useJson) {
        console.log(
          chalk.bold(`\n🌳 Dependency Graph for: ${chalk.cyan(symbol)}\n`)
        );
      }

      // Check if symbol exists in lineage patterns
      const entry = await pgc.overlays.getManifestEntry(
        'lineage_patterns',
        symbol
      );
      const filePath = entry?.filePath;

      if (!filePath) {
        if (!useJson) {
          console.log(
            chalk.red(`❌ Symbol '${symbol}' not found in lineage patterns.`)
          );
          console.log(
            chalk.dim(
              '\n💡 Run: cognition-cli overlay generate lineage_patterns'
            )
          );
        }
        return;
      }

      // Load lineage pattern
      const rawName = symbol.includes('#') ? symbol.split('#').pop()! : symbol;
      const overlayKey = `${filePath}#${rawName}`;
      const lineageMeta = await pgc.overlays.get(
        'lineage_patterns',
        overlayKey,
        z.record(z.unknown())
      );

      if (!lineageMeta) {
        if (!useJson) {
          console.log(chalk.red(`❌ No lineage data found for '${symbol}'.`));
        }
        return;
      }

      const meta = lineageMeta as Record<string, unknown>;

      try {
        const lineageData = JSON.parse(meta.lineageSignature as string);

        if (useJson) {
          // Output as JSON for external visualization tools
          const graph = {
            symbol: lineageData.symbol,
            nodes: lineageData.lineage.map(
              (dep: { type: string; depth: number }) => ({
                id: dep.type,
                depth: dep.depth,
              })
            ),
            edges: lineageData.lineage.map((dep: { type: string }) => ({
              from: symbol,
              to: dep.type,
            })),
            maxDepth: Math.max(
              ...lineageData.lineage.map((d: { depth: number }) => d.depth),
              1
            ),
          };
          console.log(JSON.stringify(graph, null, 2));
        } else {
          // ASCII tree visualization
          if (!lineageData.lineage || lineageData.lineage.length === 0) {
            console.log(chalk.dim('No dependencies found'));
            return;
          }

          console.log(chalk.green(symbol));

          // Group dependencies by depth
          const byDepth: Record<number, string[]> = {};
          lineageData.lineage.forEach(
            (dep: { type: string; depth: number }) => {
              if (!byDepth[dep.depth]) {
                byDepth[dep.depth] = [];
              }
              byDepth[dep.depth].push(dep.type);
            }
          );

          const maxDepth = parseInt(options.maxDepth);
          const depths = Object.keys(byDepth)
            .map(Number)
            .sort()
            .filter((d) => d <= maxDepth);

          for (const depth of depths) {
            const deps = byDepth[depth];
            const isLast = depth === depths[depths.length - 1];

            deps.forEach((dep, idx) => {
              const isLastInGroup = idx === deps.length - 1;
              const prefix =
                depth === 1 ? '├─' : depth === 2 ? '│ ├─' : '│ │ ├─';
              const lastPrefix =
                depth === 1 ? '└─' : depth === 2 ? '│ └─' : '│ │ └─';

              const connector = isLastInGroup && isLast ? lastPrefix : prefix;
              console.log(
                `${connector} ${chalk.cyan(dep)} ${chalk.dim(`(depth ${depth})`)}`
              );
            });
          }

          if (Object.keys(byDepth).some((d) => Number(d) > maxDepth)) {
            console.log(
              chalk.dim(
                `\n... and deeper dependencies (use --max-depth to see more)`
              )
            );
          }
        }
      } catch (error) {
        console.log(chalk.red('Failed to parse lineage data'));
        console.error(error);
      }
    });

  patternsCommand
    .command('compare <symbol1> <symbol2>')
    .description('Compare the patterns of two symbols')
    .option(
      '--type <type>',
      "The type of patterns to compare ('structural' or 'lineage')",
      'structural'
    )
    .option('--json', 'Output as JSON')
    .action(async (symbol1, symbol2, options, command) => {
      const pgc = new PGCManager(process.cwd());
      const vectorDB = new LanceVectorStore(pgc.pgcRoot);
      const tableName = `${options.type}_patterns`;
      await vectorDB.initialize(tableName);

      const allOpts = command.optsWithGlobals();
      const useJson = allOpts.json || options.json;

      const workbench = new WorkbenchClient(process.env.WORKBENCH_URL!);

      const manager: PatternManager =
        options.type === 'structural'
          ? new StructuralPatternsManager(pgc, vectorDB, workbench)
          : new LineagePatternsManager(pgc, vectorDB, workbench);

      const vector1 = await manager.getVectorForSymbol(symbol1);
      const vector2 = await manager.getVectorForSymbol(symbol2);

      if (!vector1 || !vector2) {
        if (!useJson) {
          console.error(chalk.red('Could not find patterns for both symbols.'));
        } else {
          console.log(
            JSON.stringify(
              { error: 'Could not find patterns for both symbols' },
              null,
              2
            )
          );
        }
        return;
      }

      const similarity = vectorDB.cosineSimilarity(
        vector1.embedding,
        vector2.embedding
      );

      if (useJson) {
        const vectorData1 = vector1 as Record<string, unknown>;
        const vectorData2 = vector2 as Record<string, unknown>;
        const metadata1 = vector1.metadata as Record<string, unknown>;
        const metadata2 = vector2.metadata as Record<string, unknown>;

        console.log(
          JSON.stringify(
            {
              symbol1,
              symbol2,
              type: options.type,
              similarity,
              metadata1: vector1.metadata,
              metadata2: vector2.metadata,
              signature1:
                vectorData1.structural_signature ||
                metadata1.structural_signature ||
                metadata1.lineage_signature,
              signature2:
                vectorData2.structural_signature ||
                metadata2.structural_signature ||
                metadata2.lineage_signature,
            },
            null,
            2
          )
        );
        return;
      }

      console.log(
        chalk.bold(
          `\n⚖️  Comparing ${chalk.cyan(symbol1)} vs ${chalk.green(
            symbol2
          )} (${options.type} patterns):\n`
        )
      );

      // Show file paths
      const metadata1 = vector1.metadata as Record<string, unknown>;
      const metadata2 = vector2.metadata as Record<string, unknown>;
      console.log(
        chalk.dim(
          `📁 ${symbol1}: ${metadata1.anchor || metadata1.file_path || 'unknown'}`
        )
      );
      console.log(
        chalk.dim(
          `📁 ${symbol2}: ${metadata2.anchor || metadata2.file_path || 'unknown'}`
        )
      );

      const simBar = '█'.repeat(Math.round(similarity * 40));
      console.log(
        `\n   Similarity: ${chalk.yellow(simBar)} ${(similarity * 100).toFixed(1)}%`
      );

      const vectorData1 = vector1 as Record<string, unknown>;
      const vectorData2 = vector2 as Record<string, unknown>;

      console.log(chalk.bold(`\nSignature for ${symbol1}:`));
      console.log(
        chalk.dim(
          vectorData1.structural_signature ||
            metadata1.structural_signature ||
            metadata1.lineage_signature ||
            'N/A'
        )
      );
      console.log(chalk.bold(`\nSignature for ${symbol2}:`));
      console.log(
        chalk.dim(
          vectorData2.structural_signature ||
            metadata2.structural_signature ||
            metadata2.lineage_signature ||
            'N/A'
        )
      );
    });
}

/**
 * Shared logic for analyzing architectural patterns
 */
async function analyzePatterns(
  options: {
    type?: string;
    json?: boolean;
    verbose?: boolean;
    role?: string;
  },
  command: Command
) {
  const isVerbose = getVerboseState(options as Record<string, unknown>);
  const pgc = new PGCManager(process.cwd());
  const classifier = RoleClassifier.loadFromProject(pgc.projectRoot);
  const roleConfig = classifier.getConfig();

  const allOpts = command.optsWithGlobals();
  const useJson = allOpts.json || options.json;
  const targetRole = options.role;

  // Monument 4.8: Manifest as Source of Truth
  const manifest = await pgc.overlays.getManifest(`${options.type}_patterns`);

  if (!manifest || Object.keys(manifest).length === 0) {
    if (!useJson) {
      console.log(
        chalk.yellow(`\nNo ${options.type} patterns found in manifest.`)
      );
      console.log(
        chalk.dim(
          `Run: cognition-cli overlay generate ${options.type}_patterns`
        )
      );
    }
    return;
  }

  const vectorDB = new LanceVectorStore(pgc.pgcRoot);
  const tableName = `${options.type}_patterns`;
  await vectorDB.initialize(tableName);

  const roleGroups: Record<
    string,
    Array<{ symbol: string; filePath: string }>
  > = {};
  let totalPatterns = 0;
  let staleVectors = 0;

  const allVectors = await vectorDB.getAllVectors();
  const vectorsByUniqueId = new Map(
    allVectors.map((v) => {
      const path = (v.filePath as string) || '';
      return [path ? `${path}#${v.symbol}` : (v.symbol as string), v];
    })
  );

  const manifestKeys = Object.keys(manifest);
  const uniqueKeys = new Set(manifestKeys.filter((k) => k.includes('#')));

  for (const [key, manifestEntry] of Object.entries(manifest)) {
    const parsed = pgc.overlays.parseManifestEntry(manifestEntry);
    const filePath = parsed.filePath || '';

    // Safeguard: If this is a legacy key (symbol only) and a unique key exists, skip it
    // to avoid doubled counts during the migration phase.
    if (!key.includes('#') && filePath) {
      const uniqueKey = `${filePath}#${key}`;
      if (uniqueKeys.has(uniqueKey)) continue;
    }

    const symbol = (key.includes('#') ? key.split('#').pop() : key) || key;

    // Try lookup by full key first, then fallback to symbol name for legacy manifests
    const vector =
      vectorsByUniqueId.get(key) ||
      vectorsByUniqueId.get(`${filePath}#${symbol}`);

    if (vector) {
      const role = (vector.architectural_role as string) || 'unknown';
      if (!roleGroups[role]) {
        roleGroups[role] = [];
      }
      roleGroups[role].push({ symbol, filePath });
      totalPatterns++;
    } else {
      staleVectors++;
    }
  }

  let filteredRoles = Object.entries(roleGroups);
  if (targetRole) {
    filteredRoles = filteredRoles.filter(([role]) => role === targetRole);
    if (filteredRoles.length === 0) {
      if (!useJson) {
        console.log(chalk.red(`\nUnknown role: ${targetRole}`));
        const availableRoles = Object.keys(roleGroups).sort();
        console.log(chalk.dim(`Available roles: ${availableRoles.join(', ')}`));
      } else {
        console.log(
          JSON.stringify({ error: `Role '${targetRole}' not found` })
        );
      }
      return;
    }
  }

  const sortedRoles = filteredRoles.sort(([, a], [, b]) => b.length - a.length);

  if (useJson) {
    console.log(
      JSON.stringify(
        {
          type: options.type,
          role: targetRole,
          totalPatterns: targetRole ? sortedRoles[0][1].length : totalPatterns,
          roles: sortedRoles.map(([role, symbols]) => {
            const config = roleConfig.roles.find((r) => r.id === role);
            return {
              role,
              description: config?.description,
              count: symbols.length,
              symbols: symbols.map((s) => ({
                symbol: s.symbol,
                filePath: s.filePath,
              })),
            };
          }),
          staleVectors: targetRole ? 0 : staleVectors,
        },
        null,
        2
      )
    );
    return;
  }

  if (targetRole) {
    const [role, symbols] = sortedRoles[0];
    const config = roleConfig.roles.find((r) => r.id === role);
    console.log(chalk.bold(`\nAnalysis for Role: ${chalk.cyan(role)}`));
    if (config?.description) {
      console.log(chalk.dim(`${config.description}\n`));
    }
    console.log(`Total symbols: ${chalk.bold(symbols.length)}`);
    console.log(chalk.bold('\nSymbols:'));
    symbols.forEach(({ symbol, filePath }, i) => {
      console.log(chalk.dim(`  ${i + 1}. ${symbol} - ${filePath}`));
    });
  } else {
    for (const [role, symbols] of sortedRoles) {
      const count = symbols.length;
      const config = roleConfig.roles.find((r) => r.id === role);
      const bar = '▓'.repeat(Math.min(count, 50));
      console.log(
        `\n${chalk.cyan(role.padEnd(20))} ${bar} ${chalk.bold(count)}`
      );
      if (config?.description) {
        console.log(chalk.dim(`  ${config.description}`));
      }

      if (isVerbose) {
        const displayCount = Math.min(5, symbols.length);
        for (let i = 0; i < displayCount; i++) {
          const { symbol, filePath } = symbols[i];
          console.log(chalk.dim(`  ${i + 1}. ${symbol} - ${filePath}`));
        }
        if (symbols.length > 5) {
          console.log(chalk.dim(`  ... and ${symbols.length - 5} more`));
        }
      }
    }

    console.log(chalk.bold('\n📈 Summary:'));
    console.log(`  Total patterns: ${totalPatterns}`);
    console.log(`  Unique roles: ${sortedRoles.length}`);
    console.log(
      `  Most common role: ${chalk.cyan(sortedRoles[0]?.[0])} (${sortedRoles[0]?.[1].length})`
    );

    if (staleVectors > 0) {
      console.log(
        chalk.yellow(
          `  ⚠️  ${staleVectors} patterns in manifest but not in vector DB`
        )
      );
      console.log(
        chalk.dim(
          `     Run: cognition-cli overlay generate ${options.type}_patterns --force`
        )
      );
    }

    if (!isVerbose) {
      console.log(
        chalk.dim('\n💡 Use -v, --verbose to see file paths for each role')
      );
      console.log(
        chalk.dim('💡 Use `patterns analyze role <role>` for full symbol list')
      );
    }
  }
}
