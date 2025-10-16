# 03 - Commands: Interacting with the Cognition CLI

The `cognition-cli` provides a set of commands to manage and interact with the Grounded Context Pool and extract structural information from your codebase. This document details the primary commands available.

## 1. `init` Command: Initializing the PGC

The `init` command (`src/commands/init.ts`) sets up the necessary directory structure for the Grounded Context Pool (`.open_cognition`) within your project. This command prepares your repository to store the extracted knowledge graph.

### `init` Command Usage

Replace `<path-to-project>` with the root directory of your project where you want to initialize the PGC. If omitted, it typically defaults to the current working directory.

### `init` Command Functionality

The `init` command performs the following actions:

- **Creates PGC Root:** Establishes the `.open_cognition` directory at the specified project path.
- **Creates Core Directories:** Within `.open_cognition`, it creates the foundational directories for the PGC:
  - `objects/`: Stores content-addressable objects (raw file content, structural data).
  - `transforms/`: Stores the auditable log of transformations.
  - `index/`: Stores the semantic path-to-hash mappings.
  - `reverse_deps/`: Stores reverse dependency information.
  - `overlays/`: (Future use for overlays or temporary data).
- **Generates `metadata.json`:** Creates a `metadata.json` file within `.open_cognition` to track the PGC's version, initialization timestamp, and current status.
- **Creates `.gitignore`:** Adds a `.gitignore` file within `.open_cognition` to prevent committing generated artifacts, particularly the `objects/` directory.

### `init` Command Code Reference

```typescript
// src/commands/init.ts
import fs from 'fs-extra';
import path from 'path';
import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';

export async function initCommand(options: { path: string }) {
  intro(chalk.bold('Initializing Grounded Context Pool'));

  const s = spinner();
  s.start('Creating PGC directory structure');

  const pgcRoot = path.join(options.path, '.open_cognition');

  try {
    // Create the four pillars and overlays
    await fs.ensureDir(path.join(pgcRoot, 'objects'));
    await fs.ensureDir(path.join(pgcRoot, 'transforms'));
    await fs.ensureDir(path.join(pgcRoot, 'index'));
    await fs.ensureDir(path.join(pgcRoot, 'reverse_deps'));
    await fs.ensureDir(path.join(pgcRoot, 'overlays'));

    // Create system metadata
    const metadata = {
      version: '0.1.0',
      initialized_at: new Date().toISOString(),
      status: 'empty',
    };
    await fs.writeJSON(path.join(pgcRoot, 'metadata.json'), metadata, {
      spaces: 2,
    });

    // Create .gitignore for PGC
    await fs.writeFile(
      path.join(pgcRoot, '.gitignore'),
      '# Ignore large object store\nobjects/\n# Keep structure\n!.gitkeep\n'
    );

    s.stop('PGC initialized successfully');

    outro(
      chalk.green(
        `✓ Created ${chalk.bold('.open_cognition/')} at ${options.path}`
      )
    );
  } catch (error) {
    s.stop('Initialization failed');
    throw error;
  }
}
```

## 2. `genesis` Command: Building the Verifiable Skeleton

The `genesis` command (`src/commands/genesis.ts`) populates the `.open_cognition` directory by extracting structural metadata from your project's source code. This process involves parsing files, hashing their content, logging transformations, and performing a structural verification of the generated knowledge graph to ensure its integrity and coherence.

### `genesis` Command Usage

```bash
cognition-cli genesis <path-to-source-code> --projectRoot <path-to-project-root>
```

- Replace `<path-to-source-code>` with the directory containing the source files you wish to process.
- `--projectRoot` specifies the root of your project, which is used to determine relative paths for files and the location of the `.open_cognition` directory.

### `genesis` Command Functionality

The `genesis` command orchestrates the "Bottom-Up Aggregation" phase, which includes:

- **File Discovery:** Identifies relevant source files within the specified `<path-to-source-code>`.
- **Structural Extraction:** Utilizes the `StructuralMiner` to extract detailed `StructuralData` from each source file using a multi-layered approach (native AST, remote AST via `eGemma`, SLM, LLM).
- **Content Addressable Storage:** Stores both the raw file content and the extracted `StructuralData` in the `ObjectStore`, ensuring immutability and deduplication.
- **Transformation Logging:** Records every extraction event in the `TransformLog`, providing an auditable history.
- **Index Mapping:** Updates the `Index` to map file paths to their corresponding content and structural hashes.
- **Reverse Dependency Tracking:** Begins building reverse dependency information in `ReverseDeps`.
- **Structural Verification:** After processing all files, the `StructuralOracle` verifies the structural coherence of the entire PGC.

### `genesis` Command Code Reference

```typescript
// src/commands/genesis.ts
import { intro, outro, spinner, log } from '@clack/prompts';
import chalk from 'chalk';
import { PGCManager } from '../core/pgc-manager.js';
import { StructuralMiner } from '../miners/structural-miner.js';
import { WorkbenchClient } from '../executors/workbench-client.js';
import { GenesisOrchestrator } from '../orchestrators/genesis-orchestrator.js';
import { StructuralOracle } from '../core/oracles/structural-oracle.js';

interface GenesisOptions {
  source: string;
  workbench: string;
  projectRoot: string;
}

export async function genesisCommand(options: GenesisOptions) {
  intro(chalk.bold('Genesis: Building the Verifiable Skeleton'));

  const s = spinner();

  try {
    // Initialize core components
    s.start('Initializing PGC and workbench connection');
    const pgc = new PGCManager(options.projectRoot);
    const workbench = new WorkbenchClient(options.workbench);
    const structuralOracle = new StructuralOracle(pgc);

    // Verify workbench is alive
    await workbench.health();
    s.stop('Connected to egemma workbench');

    // Initialize structural miner with three-layer pipeline
    const miner = new StructuralMiner(workbench);

    // Create genesis orchestrator
    const orchestrator = new GenesisOrchestrator(
      pgc,
      miner,
      workbench,
      structuralOracle,
      options.projectRoot
    );

    // Phase I: Bottom-Up Aggregation
    log.info('Phase I: Structural Mining (Bottom-Up)');
    await orchestrator.executeBottomUpAggregation(options.source);

    outro(chalk.green('✓ Genesis complete - Verifiable skeleton constructed'));
  } catch (error) {
    s.stop('Genesis failed');
    log.error(chalk.red((error as Error).message));
    throw error;
  }
}
```
