import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { LanceVectorStore } from '../../core/overlays/vector-db/lance-store.js';
import chalk from 'chalk';

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
    name: 'lineage_patterns',
    description:
      'O₂: Dependency relationship embeddings (imports, calls, etc.)',
    generateSupported: true,
  },
  {
    name: 'mission_concepts',
    description:
      'O₃: Mission document concept embeddings (from VISION.md, etc.)',
    generateSupported: true,
  },
  {
    name: 'strategic_coherence',
    description:
      'O₃: Semantic alignment between mission concepts and code symbols',
    generateSupported: false,
  },
];

const listCommand = new Command('list')
  .description('List available overlay types and their status.')
  .option('-p, --project-root <path>', 'The root of the project.', '.')
  .action(async (options) => {
    const pgcRoot = path.join(options.projectRoot, '.open_cognition');
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

      // Determine status
      if (manifestCount === 0 && vectorCount === 0) {
        status = 'not generated';
      } else if (manifestCount === vectorCount && manifestCount > 0) {
        status = `${manifestCount} patterns`;
      } else if (manifestCount > 0 || vectorCount > 0) {
        // Mismatch or partial generation
        status = `${chalk.yellow('⚠')} manifest: ${manifestCount}, embeddings: ${vectorCount}`;
      } else if (await fs.pathExists(overlayDir)) {
        status = 'directory exists (no data)';
      }

      const generateNote = overlay.generateSupported
        ? ''
        : ' (use other commands)';

      console.log(`  ${overlay.name}${generateNote}`);
      console.log(`    ${overlay.description}`);
      console.log(`    Status: ${status}\n`);
    }

    await vectorStore.close();

    console.log('Usage:');
    console.log('  cognition-cli overlay generate <type> [sourcePath]');
    console.log('  cognition-cli overlay generate structural_patterns');
    console.log('  cognition-cli overlay generate lineage_patterns\n');
  });

export { listCommand };
