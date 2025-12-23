/**
 * Overlay Status Listing Command
 *
 * Lists all available overlay types in the Grounded Context Pool (PGC) and
 * shows their generation status. This provides visibility into which overlays
 * have been generated and how much data each contains.
 *
 * OVERLAY REFERENCE (O₁-O₇):
 * - O₁ structural_patterns: Code symbol embeddings
 * - O₂ security_guidelines: Security knowledge base
 * - O₃ lineage_patterns: Dependency graph embeddings
 * - O₄ mission_concepts: Mission document concept embeddings
 * - O₅ operational_patterns: Workflow and quest patterns
 * - O₆ mathematical_proofs: Mathematical statement embeddings
 * - O₇ strategic_coherence: Code-to-mission alignment metrics
 *
 * STATUS REPORTING:
 * For each overlay, the command shows:
 * - Name and description
 * - Generation status: "not generated" | "X patterns" | "X documents"
 * - Detailed counts (manifest entries, vector embeddings, YAML files)
 * - Alignment metrics for O₇ (aligned vs drifted symbols)
 *
 * DESIGN RATIONALE:
 * 1. Visibility: Quick overview of PGC state
 * 2. Debugging: Identify missing or incomplete overlays
 * 3. Validation: Verify generation succeeded
 * 4. Planning: See which overlays need regeneration
 *
 * IMPLEMENTATION DETAILS:
 * - Checks manifest.json for O₁/O₃ (pattern overlays)
 * - Checks LanceDB vector stores for embedding counts
 * - Scans YAML files for O₂/O₄/O₅/O₆ (document overlays)
 * - Parses coherence.yaml for O₇ (coherence overlay)
 * - Reports mismatches between manifest and embeddings
 *
 * @example
 * // List all overlays with status
 * $ cognition-cli overlay list
 * // Shows:
 * // structural_patterns
 * //   O₁: Code symbol embeddings
 * //   Status: 234 patterns
 * //
 * // security_guidelines
 * //   O₂: Security threats, attack vectors, mitigations
 * //   Status: 3 security document(s)
 * //
 * // strategic_coherence
 * //   O₇: Code-to-mission alignment
 * //   Status: 234 symbols (198 aligned, 36 drifted)
 *
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { LanceVectorStore } from '../../core/overlays/vector-db/lance-store.js';
import chalk from 'chalk';
import { WorkspaceManager } from '../../core/workspace-manager.js';

/**
 * Represents metadata for an available overlay type
 *
 * Each overlay has a name, description, and flag indicating whether
 * it can be generated via the `overlay generate` command.
 */
interface OverlayInfo {
  name: string;
  description: string;
  generateSupported: boolean;
}

const OVERLAY_TYPES: OverlayInfo[] = [
  {
    name: 'structural_patterns',
    description:
      'O₁: Code symbol embeddings (functions, classes, interfaces, etc.)',
    generateSupported: true,
  },
  {
    name: 'security_guidelines',
    description:
      'O₂: Security threats, attack vectors, mitigations, and constraints',
    generateSupported: true,
  },
  {
    name: 'lineage_patterns',
    description:
      'O₃: Dependency relationship embeddings (imports, calls, etc.)',
    generateSupported: true,
  },
  {
    name: 'mission_concepts',
    description:
      'O₄: Mission document concept embeddings (from VISION.md, etc.)',
    generateSupported: true,
  },
  {
    name: 'operational_patterns',
    description:
      'O₅: Workflow patterns, quest structures, sacred sequences, depth rules',
    generateSupported: true,
  },
  {
    name: 'mathematical_proofs',
    description: 'O₆: Theorems, lemmas, axioms, proofs, and identities',
    generateSupported: true,
  },
  {
    name: 'strategic_coherence',
    description:
      'O₇: Semantic alignment between mission concepts and code symbols',
    generateSupported: true,
  },
];

/**
 * Factory function for creating a fresh list command instance.
 * Used by tests to ensure mocks are properly applied.
 *
 * Scans the .open_cognition/overlays directory to determine which
 * overlays have been generated and provides detailed status information
 * for each overlay type.
 */
export const createListCommand = () =>
  new Command('list')
    .description('List available overlay types and their status.')
    .action(async () => {
      const workspaceManager = new WorkspaceManager();
      // Overlay commands use current working directory - PGC discovery walks up to find .open_cognition
      const projectRoot = workspaceManager.resolvePgcRoot(process.cwd());

      if (!projectRoot) {
        console.error(
          chalk.red(
            '\n✗ No .open_cognition workspace found. Run "cognition-cli init" to create one.\n'
          )
        );
        process.exit(1);
        return; // Prevent further execution when process.exit is mocked in tests
      }

      const pgcRoot = path.join(projectRoot, '.open_cognition');
      const overlaysPath = path.join(pgcRoot, 'overlays');

      console.log('\nAvailable Overlay Types:\n');

      // Initialize vector store once
      const vectorStore = new LanceVectorStore(pgcRoot);

      for (const overlay of OVERLAY_TYPES) {
        const overlayDir = path.join(overlaysPath, overlay.name);
        const manifestPath = path.join(overlayDir, 'manifest.json');

        let status = 'not generated';
        let manifestCount = 0;
        let vectorCount = 0;

        // Check manifest
        if (await fs.pathExists(manifestPath)) {
          try {
            const manifest = await fs.readJSON(manifestPath);
            manifestCount = Object.keys(manifest).length;
          } catch {
            status = 'error reading manifest';
          }
        }

        // Check vector DB for pattern overlays
        if (
          overlay.name === 'structural_patterns' ||
          overlay.name === 'lineage_patterns'
        ) {
          try {
            await vectorStore.initialize(overlay.name);
            const vectors = await vectorStore.getAllVectors();
            vectorCount = vectors.length;
          } catch {
            // Vector DB doesn't exist or error reading
            vectorCount = 0;
          }
        }

        // Check strategic coherence overlay
        if (overlay.name === 'strategic_coherence') {
          const coherencePath = path.join(overlayDir, 'coherence.yaml');
          if (await fs.pathExists(coherencePath)) {
            try {
              const yaml = await import('yaml');
              const content = await fs.readFile(coherencePath, 'utf-8');
              const coherence = yaml.parse(content);
              const symbolCount = coherence.symbol_coherence?.length || 0;
              const aligned =
                coherence.overall_metrics?.aligned_symbols_count || 0;
              const drifted =
                coherence.overall_metrics?.drifted_symbols_count || 0;
              status = `${symbolCount} symbols analyzed (${chalk.green(aligned + ' aligned')}, ${chalk.yellow(drifted + ' drifted')})`;
            } catch {
              status = 'error reading overlay';
            }
          } else {
            status = 'not generated';
          }
        }

        // Check YAML-based overlays (mission, security, operational, mathematical)
        if (
          overlay.name === 'mission_concepts' ||
          overlay.name === 'security_guidelines' ||
          overlay.name === 'operational_patterns' ||
          overlay.name === 'mathematical_proofs'
        ) {
          if (await fs.pathExists(overlayDir)) {
            try {
              const files = await fs.readdir(overlayDir);
              const yamlFiles = files.filter((f) => f.endsWith('.yaml'));
              if (yamlFiles.length > 0) {
                if (overlay.name === 'mission_concepts') {
                  status = `${yamlFiles.length} document(s) processed`;
                } else if (overlay.name === 'security_guidelines') {
                  status = `${yamlFiles.length} security document(s)`;
                } else if (overlay.name === 'operational_patterns') {
                  status = `${yamlFiles.length} operational document(s)`;
                } else if (overlay.name === 'mathematical_proofs') {
                  status = `${yamlFiles.length} proof document(s)`;
                }
              } else {
                status = 'not generated';
              }
            } catch {
              status = 'error reading overlays';
            }
          } else {
            status = 'not generated';
          }
        }

        // Determine status for structural/lineage patterns
        if (
          overlay.name === 'structural_patterns' ||
          overlay.name === 'lineage_patterns'
        ) {
          // Only update status if not already an error state
          if (status.startsWith('error')) {
            // Keep error status
          } else if (manifestCount === 0 && vectorCount === 0) {
            status = 'not generated';
          } else if (manifestCount === vectorCount && manifestCount > 0) {
            status = `${manifestCount} patterns`;
          } else if (manifestCount > 0 || vectorCount > 0) {
            // Mismatch or partial generation
            status = `${chalk.yellow('⚠')} manifest: ${manifestCount}, embeddings: ${vectorCount}`;
          } else if (await fs.pathExists(overlayDir)) {
            status = 'directory exists (no data)';
          }
        }

        const generateNote = overlay.generateSupported
          ? ''
          : ' (use other commands)';

        console.log(`  ${overlay.name}${generateNote}`);
        console.log(`    ${overlay.description}`);
        console.log(`    Status: ${status}\n`);
      }

      await vectorStore.close();

      console.log('Usage (reads from PGC index - run genesis first):');
      console.log('  cognition-cli overlay generate <type>');
      console.log('  cognition-cli overlay generate structural_patterns');
      console.log('  cognition-cli overlay generate security_guidelines');
      console.log('  cognition-cli overlay generate lineage_patterns');
      console.log('  cognition-cli overlay generate mission_concepts');
      console.log('  cognition-cli overlay generate operational_patterns');
      console.log('  cognition-cli overlay generate mathematical_proofs');
      console.log('  cognition-cli overlay generate strategic_coherence\n');
    });

/**
 * Singleton instance for CLI use.
 * Tests should use createListCommand() factory instead.
 */
export const listCommand = createListCommand();
