# 02 - Core Infrastructure: The Grounded Context Pool (PGC)

The heart of the `cognition-cli` is the Grounded Context Pool (PGC), a content-addressable "digital brain" that stores and manages all extracted knowledge about a codebase. The PGC is designed for verifiability, immutability, and efficient retrieval of structural data. It resides within the `.open_cognition` directory at the project root and is managed by the `PGCManager`.

## PGCManager: The Orchestrator of Knowledge

The `PGCManager` (`src/core/pgc-manager.ts`) serves as the central entry point for interacting with the PGC. It is responsible for initializing and providing access to all core PGC components, ensuring a unified interface for knowledge management.

```typescript
export class PGCManager {
  public objectStore: ObjectStore;
  public transformLog: TransformLog;
  public index: Index;
  public reverseDeps: ReverseDeps;
  public pgcRoot: string;

  constructor(projectRoot: string) {
    this.pgcRoot = path.join(projectRoot, '.open_cognition');
    this.objectStore = new ObjectStore(this.pgcRoot);
    this.transformLog = new TransformLog(this.pgcRoot);
    this.index = new Index(this.pgcRoot);
    this.reverseDeps = new ReverseDeps(this.pgcRoot);
  }
}
```

The `PGCManager` constructs the `pgcRoot` by appending `.open_cognition` to the provided `projectRoot`, establishing the dedicated location for the PGC.

## Core Components of the PGC

The PGC is composed of four interconnected pillars, each serving a distinct role in maintaining data integrity and accessibility:

### 1. ObjectStore: The Immutable Memory

The `ObjectStore` (`src/core/object-store.ts`) is a content-addressable storage system, inspired by Git. It stores all unique pieces of knowledge, including raw file content and extracted `StructuralData`.

- **Mechanism:** When a file or structural data is processed, its content is hashed (e.g., SHA-256). This hash serves as its unique identifier. If an object with that hash already exists, it's not re-stored, ensuring data deduplication and immutability. New objects are written to a location derived from their hash within the `objects/` directory (e.g., `objects/<first-two-chars-of-hash>/<full-hash>`).
- **Data Types:** Raw file content, JSON representations of ASTs, and other structural metadata.
- **Code Reference:**

  ```typescript
  // src/core/object-store.ts
  import crypto from 'node:crypto';
  import fs from 'fs-extra';
  import path from 'path';

  export class ObjectStore {
    constructor(private rootPath: string) {}

    /**
     * Store content in content-addressable storage
     * Returns the hash of the stored object
     */
    async store(content: string | Buffer): Promise<string> {
      const hash = this.computeHash(content);
      const objectPath = this.getObjectPath(hash);

      // Only write if it doesn't exist (deduplication)
      if (!(await fs.pathExists(objectPath))) {
        await fs.ensureDir(path.dirname(objectPath));
        await fs.writeFile(objectPath, content);
      }

      return hash;
    }

    /**
     * Retrieve content by hash
     */
    async retrieve(hash: string): Promise<Buffer> {
      const objectPath = this.getObjectPath(hash);
      return await fs.readFile(objectPath);
    }

    /**
     * Check if object exists
     */
    async exists(hash: string): Promise<boolean> {
      return await fs.pathExists(this.getObjectPath(hash));
    }

    private computeHash(content: string | Buffer): string {
      return crypto.createHash('sha256').update(content).digest('hex');
    }

    private getObjectPath(hash: string): string {
      // Git-style sharding: first 2 chars as directory
      const dir = hash.slice(0, 2);
      const file = hash.slice(2);
      return path.join(this.rootPath, 'objects', dir, file);
    }
  }
  ```

### 2. TransformLog: The Auditable Thought Process

The `TransformLog` (`src/core/transform-log.ts`) is an immutable, append-only log of all operations that modify the knowledge graph. It provides a complete audit trail of how the graph evolved, enabling verifiability and reproducibility.

- **Mechanism:** Each transformation (e.g., file parsing, structural extraction) is recorded as an entry in the log. This entry includes metadata about the transformation, such as the goal, input object hashes, output object hashes, the method used, and the fidelity of the transformation. These log entries are stored within the `transforms/` directory.
- **Data Types:** `TransformData` objects, containing metadata about transformations.
- **Code Reference:**

  ```typescript
  // src/core/transform-log.ts
  import fs from 'fs-extra';
  import path from 'path';
  import crypto from 'node:crypto';

  import { TransformData } from '../types/transform.js';

  export class TransformLog {
    private transformsPath: string;

    constructor(pgcRoot: string) {
      this.transformsPath = path.join(pgcRoot, 'transforms');
      fs.ensureDirSync(this.transformsPath); // Ensure the base directory exists
    }

    async record(transform: TransformData): Promise<string> {
      const transformId = this.generateTransformId(transform);

      const logPath = path.join(
        this.transformsPath,
        transformId, // Directory named after transformId
        'manifest.json' // File within that directory
      );

      await fs.ensureDir(path.dirname(logPath)); // Ensure the transformId directory exists
      await fs.writeJSON(logPath, transform, { spaces: 2 }); // Write JSON directly

      return transformId;
    }

    private generateTransformId(transform: TransformData): string {
      const hash = crypto.createHash('sha256');
      hash.update(JSON.stringify(transform));
      return hash.digest('hex');
    }
  }
  ```

### 3. Index: The Conscious Mind

The `Index` (`src/core/index.ts`) is a semantic path-to-hash mapping. It links human-readable file paths to their corresponding content-addressable hashes in the `ObjectStore`. It acts as the system's "Table of Contents," enabling the retrieval of specific knowledge elements based on their logical location within the project structure.

- **Mechanism:** When a file is processed, its canonical path is mapped to the hashes of its raw content and extracted structural data. This index is updated atomically, ensuring that the system's understanding of the codebase is always current. The index data is stored within the `index/` directory.
- **Data Types:** Key-value pairs where keys are file paths and values are `IndexData` objects (containing content and structural hashes, status, and history).
- **Code Reference:**

  ```typescript
  // src/core/index.ts
  import fs from 'fs-extra';
  import path from 'path';

  import { IndexData } from '../types/index.js';

  export class Index {
    private indexPath: string;

    constructor(pgcRoot: string) {
      this.indexPath = path.join(pgcRoot, 'index');
      fs.ensureDirSync(this.indexPath); // Ensure the base directory exists
    }

    async set(filePath: string, data: IndexData): Promise<void> {
      const indexFilePath = path.join(
        this.indexPath,
        filePath.replace(/\//g, '_') + '.json' // Convert path to a valid filename
      );
      await fs.ensureDir(path.dirname(indexFilePath));
      await fs.writeJSON(indexFilePath, data, { spaces: 2 });
    }

    // ... other methods (if any, not shown in this file)
  }
  ```

### 4. ReverseDeps: The Reflexive Nervous System

The `ReverseDeps` (`src/core/reverse-deps.ts`) component provides an efficient mechanism for O(1) reverse lookups. It allows for quick identification of all entities that depend on a given object, which is vital for understanding relationships and efficiently building context.

- **Mechanism:** As structural data is extracted (e.g., imports, function calls), dependencies are recorded. The `ReverseDeps` component stores mappings from a dependent object's hash to the hashes of objects it depends on, and vice-versa. This data is sharded and stored within the `reverse_deps/` directory.
- **Data Types:** Graph-like structures mapping object hashes to lists of dependent/dependency hashes.
- **Code Reference:**

  ```typescript
  // src/core/reverse-deps.ts
  import fs from 'fs-extra';
  import path from 'path';

  export class ReverseDeps {
    constructor(private pgcRoot: string) {}

    async add(objectHash: string, transformId: string): Promise<void> {
      const reverseDepPath = this.getReverseDepPath(objectHash);
      await fs.ensureDir(path.dirname(reverseDepPath));

      const existingDeps: Set<string> = new Set();
      if (await fs.pathExists(reverseDepPath)) {
        const content = await fs.readFile(reverseDepPath, 'utf-8');
        content.split('\n').forEach((dep) => {
          const trimmedDep = dep.trim();
          if (trimmedDep) {
            existingDeps.add(trimmedDep);
          }
        });
      }

      if (!existingDeps.has(transformId)) {
        existingDeps.add(transformId);
        const newContent = Array.from(existingDeps).join('\n') + '\n';
        await fs.writeFile(reverseDepPath, newContent);
      }
    }

    private getReverseDepPath(hash: string): string {
      const dir = hash.slice(0, 2);
      const file = hash.slice(2);
      return path.join(this.pgcRoot, 'reverse_deps', dir, file);
    }
  }
  ```
