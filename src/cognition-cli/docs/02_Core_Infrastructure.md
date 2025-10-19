# 02 - Core Infrastructure: The Grounded Context Pool (PGC)

The heart of the `cognition-cli` is the Grounded Context Pool (PGC), a content-addressable "digital brain" that stores and manages all extracted knowledge about a codebase. The PGC is designed for verifiability, immutability, and efficient retrieval of structural data. It resides within the `.open_cognition` directory at the project root and is managed by the `PGCManager`.

## PGCManager: The Orchestrator of Knowledge

The `PGCManager` (`src/core/pgc-manager.ts`) serves as the central entry point for interacting with the PGC. It is responsible for initializing and providing access to all core PGC components, ensuring a unified interface for knowledge management.

The `PGCManager` constructs the `pgcRoot` by appending `.open_cognition` to the provided `projectRoot`, establishing the dedicated location for the PGC.

## Core Components of the PGC

The PGC is composed of four interconnected pillars, each serving a distinct role in maintaining data integrity and accessibility:

### 1. ObjectStore: The Immutable Memory

The `ObjectStore` (`src/core/object-store.ts`) is a content-addressable storage system, inspired by Git. It stores all unique pieces of knowledge, including raw file content and extracted `StructuralData`.

- **Mechanism:** When a file or structural data is processed, its content is hashed (e.g., SHA-256). This hash serves as its unique identifier. If an object with that hash already exists, it's not re-stored, ensuring data deduplication and immutability. New objects are written to a location derived from their hash within the `objects/` directory (e.g., `objects/<first-two-chars-of-hash>/<full-hash>`).
- **Data Types:** Raw file content, JSON representations of ASTs, and other structural metadata.

### 2. TransformLog: The Auditable Thought Process

The `TransformLog` (`src/core/transform-log.ts`) is an immutable, append-only log of all operations that modify the knowledge graph. It provides a complete audit trail of how the graph evolved, enabling verifiability and reproducibility.

- **Mechanism:** Each transformation (e.g., file parsing, structural extraction) is recorded as an entry in the log. This entry includes metadata about the transformation, such as the goal, input object hashes, output object hashes, the method used, and the fidelity of the transformation. These log entries are now stored as YAML manifests within the `transforms/` directory.
- **Data Types:** `TransformData` objects, containing metadata about transformations.

### 3. Index: The Conscious Mind

The `Index` (`src/core/index.ts`) is a semantic path-to-hash mapping. It links human-readable file paths to their corresponding content-addressable hashes in the `ObjectStore`. It acts as the system's "Table of Contents," enabling the retrieval of specific knowledge elements based on their logical location within the project structure.

- **Mechanism:** When a file is processed, its canonical path is mapped to the hashes of its raw content and extracted structural data. This index is updated atomically, ensuring that the system's understanding of the codebase is always current. The index data is stored within the `index/` directory.
- **Data Types:** Key-value pairs where keys are file paths and values are `IndexData` objects (containing content and structural hashes, status, and history).

### 4. ReverseDeps: The Reflexive Nervous System

The `ReverseDeps` (`src/core/reverse-deps.ts`) component provides an efficient mechanism for O(1) reverse lookups. It allows for quick identification of all entities that depend on a given object, which is vital for understanding relationships and efficiently building context.

- **Mechanism:** As structural data is extracted (e.g., imports, function calls), dependencies are recorded. The `ReverseDeps` component stores mappings from a dependent object's hash to the hashes of objects it depends on, and vice-versa. This data is sharded and stored within the `reverse_deps/` directory.
- **Data Types:** Graph-like structures mapping object hashes to lists of dependent/dependency hashes.

### 5. LanceVectorStore: The Semantic Search Engine

The `LanceVectorStore` (`src/lib/patterns/vector-db/lance-vector-store.ts`) is responsible for storing and querying vector embeddings of structural patterns. It enables semantic search capabilities within the PGC, allowing for the discovery of similar code structures based on their embedded representations.

- **Mechanism:** It uses LanceDB to store vector embeddings along with associated metadata (e.g., symbol, structural signature, architectural role). It provides methods for storing new vectors, performing similarity searches, and retrieving individual vectors.
- **Data Types:** `VectorRecord` objects, containing an ID, embedding (array of numbers), and metadata about the structural pattern.

### 6. StructuralOracle: The Verifier of Coherence

The `StructuralOracle` (`src/core/oracles/structural-oracle.ts`) plays a crucial role in maintaining the integrity and coherence of the PGC. It performs a series of checks to ensure that all references within the PGC are valid and consistent.

- **Mechanism:** The oracle verifies that all input and output hashes referenced in `TransformLog` entries actually exist in the `ObjectStore`. It also checks for the existence of `manifest.yaml` files for each transformation. This process ensures that the PGC remains a verifiable and auditable knowledge graph.
- **Data Types:** `VerificationResult` objects, indicating success or failure and providing detailed messages for any inconsistencies.
