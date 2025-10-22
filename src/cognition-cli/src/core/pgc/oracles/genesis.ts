import { PGCManager } from '../manager.js';
import { VerificationResult } from '../../types/verification.js';
import path from 'path';
import fs from 'fs-extra';

import { TransformData } from '../../types/transform.js';
import yaml from 'js-yaml';

export class GenesisOracle {
  // Renamed from StructuralOracle
  constructor(private pgcManager: PGCManager) {}

  async verify(): Promise<VerificationResult> {
    const messages: string[] = [];
    let success = true;

    // 1. Validate Index entries against ObjectStore
    const indexPath = path.join(this.pgcManager.pgcRoot, 'index');
    if (await fs.pathExists(indexPath)) {
      const indexFiles = await fs.readdir(indexPath);
      for (const file of indexFiles) {
        if (file.endsWith('.json')) {
          const fullPath = path.join(indexPath, file);
          const indexData = await fs.readJSON(fullPath);

          if (
            !(await this.pgcManager.objectStore.exists(indexData.content_hash))
          ) {
            messages.push(
              `Index entry ${file} references non-existent content_hash: ${indexData.content_hash}`
            );
            success = false;
          }
          if (
            !(await this.pgcManager.objectStore.exists(
              indexData.structural_hash
            ))
          ) {
            messages.push(
              `Index entry ${file} references non-existent structural_hash: ${indexData.structural_hash}`
            );
            success = false;
          }
        }
      }
    } else {
      messages.push('Index directory does not exist.');
      success = false;
    }

    // 2. Validate TransformLog entries against ObjectStore
    const transformsPath = path.join(this.pgcManager.pgcRoot, 'transforms');
    if (await fs.pathExists(transformsPath)) {
      const transformDirs = await fs.readdir(transformsPath);
      for (const dir of transformDirs) {
        const manifestPath = path.join(transformsPath, dir, 'manifest.yaml');
        if (await fs.pathExists(manifestPath)) {
          const content = await fs.readFile(manifestPath, 'utf-8');
          const transformData = yaml.load(content) as TransformData;
          for (const input of transformData.inputs) {
            if (!(await this.pgcManager.objectStore.exists(input.hash))) {
              messages.push(
                `Transform ${dir} references non-existent input hash: ${input.hash}`
              );
              success = false;
            }
          }
          for (const output of transformData.outputs) {
            if (!(await this.pgcManager.objectStore.exists(output.hash))) {
              messages.push(
                `Transform ${dir} references non-existent output hash: ${output.hash}`
              );
              success = false;
            }
          }
        } else {
          messages.push(`Transform directory ${dir} is missing manifest.yaml`);
          success = false;
        }
      }
    } else {
      messages.push('Transforms directory does not exist.');
      success = false;
    }

    // 3. Validate ReverseDeps entries against ObjectStore and TransformLog
    const reverseDepsPath = path.join(this.pgcManager.pgcRoot, 'reverse_deps');
    if (await fs.pathExists(reverseDepsPath)) {
      const shardedDirs = await fs.readdir(reverseDepsPath);
      for (const shardedDir of shardedDirs) {
        const fullShardedDirPath = path.join(reverseDepsPath, shardedDir);
        if ((await fs.stat(fullShardedDirPath)).isDirectory()) {
          const reverseDepFiles = await fs.readdir(fullShardedDirPath);
          for (const file of reverseDepFiles) {
            const objectHash = shardedDir + file; // Reconstruct full hash
            if (!(await this.pgcManager.objectStore.exists(objectHash))) {
              messages.push(
                `ReverseDep entry for ${objectHash} references non-existent object hash.`
              );
              success = false;
            }

            const fullPath = path.join(fullShardedDirPath, file);
            const content = await fs.readFile(fullPath, 'utf-8');
            const transformIds = content.split('\n').filter(Boolean); // Filter out empty strings

            for (const transformId of transformIds) {
              const transformManifestPath = path.join(
                transformsPath,
                transformId,
                'manifest.yaml'
              );
              if (!(await fs.pathExists(transformManifestPath))) {
                messages.push(
                  `ReverseDep entry for ${objectHash} references non-existent transformId: ${transformId}`
                );
                success = false;
              }
            }
          }
        }
      }
    } else {
      messages.push('ReverseDeps directory does not exist.');
      success = false;
    }

    return { success, messages };
  }
}
