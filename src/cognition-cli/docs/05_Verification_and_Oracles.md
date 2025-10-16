# 05 - Verification and Oracles: Ensuring PGC Integrity

A cornerstone of the CogX blueprint is the principle of verifiability. The `cognition-cli` implements this through the `StructuralOracle`, a critical component responsible for ensuring the integrity and coherence of the Grounded Context Pool (PGC). This document details how the `StructuralOracle` operates to maintain a trustworthy knowledge graph.

## StructuralOracle: The Guardian of Coherence

The `StructuralOracle` (`src/core/oracles/structural-oracle.ts`) performs a series of rigorous checks across the PGC's components (`ObjectStore`, `TransformLog`, `Index`, `ReverseDeps`) to detect any inconsistencies or missing data. Its primary method, `verify()`, returns a `VerificationResult` indicating success or listing detected issues.

### Verification Process

The `verify()` method executes a multi-faceted validation process:

1. **Validate Index Entries against ObjectStore:**
   - **Purpose:** Ensures that all entries in the `Index` (which map file paths to content and structural hashes) correctly point to existing objects in the `ObjectStore`.
   - **Mechanism:** The Oracle iterates through every `.json` file in the `index/` directory. For each `indexData` entry, it verifies that both the `content_hash` and `structural_hash` refer to actual, existing objects within the `ObjectStore`. If a referenced object is missing, an error is reported.

2. **Validate TransformLog Entries against ObjectStore:**
   - **Purpose:** Confirms that every transformation recorded in the `TransformLog` correctly references existing input and output objects in the `ObjectStore`.
   - **Mechanism:** The Oracle scans all `manifest.json` files within the `transforms/` directories. For each `TransformData` entry, it checks that all `inputs` and `outputs` hashes listed in the manifest correspond to existing objects in the `ObjectStore`. This guarantees the auditable trail is unbroken and refers to valid data.

3. **Validate ReverseDeps Entries against ObjectStore and TransformLog:**
   - **Purpose:** Verifies the integrity of the reverse dependency mappings, ensuring that all referenced objects and transformations exist.
   - **Mechanism:** The Oracle examines the sharded files within the `reverse_deps/` directory. For each reverse dependency entry, it first reconstructs the full `objectHash` and confirms its existence in the `ObjectStore`. Subsequently, it reads the `transformId`s associated with that object and verifies that each `transformId` corresponds to an existing `manifest.json` in the `transforms/` directory.

### Code Reference

```typescript
// src/core/oracles/structural-oracle.ts
import { PGCManager } from '../pgc-manager.js';
import { VerificationResult } from '../../types/verification.js';
import path from 'path';
import fs from 'fs-extra';

export class StructuralOracle {
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
        const manifestPath = path.join(transformsPath, dir, 'manifest.json');
        if (await fs.pathExists(manifestPath)) {
          const transformData = await fs.readJSON(manifestPath);
          for (const hash of transformData.inputs) {
            if (!(await this.pgcManager.objectStore.exists(hash))) {
              messages.push(
                `Transform ${dir} references non-existent input hash: ${hash}`
              );
              success = false;
            }
          }
          for (const hash of transformData.outputs) {
            if (!(await this.pgcManager.objectStore.exists(hash))) {
              messages.push(
                `Transform ${dir} references non-existent output hash: ${hash}`
              );
              success = false;
            }
          }
        } else {
          messages.push(`Transform directory ${dir} is missing manifest.json`);
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
                'manifest.json'
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
```
