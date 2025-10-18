# Cognition CLI

<div align="center" style="margin-top: 20px; margin-bottom: 20px;">
<img src="./docs/assets/cognition-cli-logo.png" alt="Cognition CLI Logo" width="512"/>
</div>

The Cognition Command-Line Interface (`cognition-cli`) is the primary tool for interacting with the Cognition project's core functionalities. It enables developers to manage and process their codebase to create a verifiable, content-addressable data structure representing the project's knowledge graph.

## Features

- **Initialize Project (`init` command):** Sets up the necessary `.open_cognition` directory structure within your project. This directory serves as the local knowledge base for your codebase, storing structural metadata, object hashes, and transformation logs.

### Usage

```bash
cognition-cli init
```

This command creates the `.open_cognition` directory and its subdirectories (`objects`, `transforms`, `index`, `reverse_deps`, `overlays`), along with a `metadata.json` file and a `.gitignore` entry to prevent committing generated artifacts.

- **Generate Genesis (`genesis` command):** Populates the `.open_cognition` directory by extracting structural metadata from your project's source code. This process involves parsing files, hashing their content, logging transformations, and performing a structural verification of the generated knowledge graph to ensure its integrity and coherence.

### Genesis Command Usage

```bash
cognition-cli genesis <path-to-source-code>
```

Replace `<path-to-source-code>` with the directory containing the source files you wish to process. The `genesis` command will recursively scan the specified path, extract relevant information, and store it in the `.open_cognition` directory.

- **Query Knowledge Graph (`query` command):** Explores the structural knowledge graph stored in the PGC. You can search for symbols (classes, functions, interfaces) and traverse their dependencies.

### Query Command Usage

```bash
cognition-cli query <symbol-name> [--depth <depth>]
```

- `<symbol-name>`: The name of the symbol you want to query (e.g., `StructuralMiner`, `extractStructure`).
- `--depth`: (Optional) The depth of dependency traversal. Defaults to `0` (only direct results). Use `1` for first-level dependencies, `2` for second-level, and so on.

- **Audit Transformations (`audit` command):** Verifies the integrity and coherence of the Grounded Context Pool (PGC) by auditing the transformation history of files.

### Audit Command Usage

```bash
cognition-cli audit <file-path> [--limit <number>]
```

- `<file-path>`: The path to the file whose transformation history you want to audit.
- `--limit`: (Optional) The maximum number of transformation history entries to display. Defaults to `5`.

## Project Goal

The overarching goal of the Cognition CLI is to facilitate the creation of a robust, verifiable, and well-tested implementation of the CogX blueprint. By transforming raw source code into a structured, queryable knowledge graph, we aim to enable advanced code analysis, automated reasoning, and intelligent software development workflows.

## Content Addressable Knowledge Graph

The `cognition-cli` implements a Content Addressable Knowledge Graph (CAKG) based on the principles outlined in the CogX blueprint. This system ensures that all extracted structural data is verifiable, immutable, and efficiently stored.

### Core Infrastructure

The CAKG is built upon several key components, each designed for specific roles in maintaining data integrity and accessibility:

- **ObjectStore:** A content-addressable storage system, inspired by Git. It stores all extracted structural data and file contents. Each object is hashed (e.g., SHA-256), and this hash serves as its unique identifier. This ensures data deduplication and immutability; any change to an object results in a new hash and a new object.
  - **Algorithm:** When a file or structural data is processed, its content is hashed. If an object with that hash already exists in the store, it's not re-stored. Otherwise, the new object is written to a location derived from its hash.
  - **Data Types:** Raw file content, JSON representations of ASTs, and other structural metadata.

- **TransformLog:** An immutable, append-only log of all operations that modify the knowledge graph. This provides a complete audit trail of how the graph evolved, enabling verifiability and reproducibility. Log entries are now stored as YAML manifests.
  - **Algorithm:** Each transformation (e.g., file parsing, structural extraction) is recorded as an entry in the log, including metadata about the transformation, such as the goal, input/output object hashes, the method used, and the fidelity of the transformation.
  - **Data Types:** `TransformData` objects, containing metadata about transformations.

- **Index:** A semantic path to hash mapping. This allows human-readable file paths to be resolved to their corresponding content-addressable hashes in the ObjectStore. It acts as the system's 'Table of Contents,' enabling the retrieval of specific knowledge elements based on their logical location within the project structure, thereby forming a crucial part of context assembly. It now includes advanced search capabilities with symbol canonicalization and Zod validation.
  - **Algorithm:** When a file is processed, its canonical path is mapped to the hash of its extracted structural data. This index is updated atomically. Advanced search logic allows matching of canonicalized symbols against components of canonicalized file paths.
  - **Data Types:** Key-value pairs where keys are file paths and values are `IndexData` objects (containing content and structural hashes, status, and history).

- **ReverseDeps (Reverse Dependencies):** An efficient mechanism for O(1) reverse lookups, allowing quick identification of all entities that depend on a given object. This component is vital for understanding the relationships between different pieces of knowledge and for efficiently building a comprehensive context by tracing dependencies across the graph.
  - **Algorithm:** As structural data is extracted (e.g., imports, function calls), dependencies are recorded. The ReverseDeps component stores mappings from a dependent object's hash to the hashes of objects it depends on, and vice-versa.

  - **Data Types:** Graph-like structures mapping object hashes to lists of dependent/dependency hashes.

### Data Types and Verifiability

The system extensively uses TypeScript for type safety, ensuring that all data structures conform to predefined schemas. Key data types include:

- `SourceFile`: Represents a source code file, including its path, content hash, and language.
- `StructuralData`: The extracted Abstract Syntax Tree (AST) or other structural representations of code, now including `InterfaceData` and `PropertyData`.
- `PropertyData`: Details properties within interfaces.
- `InterfaceData`: Describes interfaces.
- `GKe` (Graph Knowledge Element): A generic type for elements within the knowledge graph.
- `GoalData`: Defines the objective, criteria, and minimum fidelity for a transformation.
- `TransformInput`, `TransformOutput`: Structured types for inputs and outputs of transformations, including path and hash.
- `VerificationResult`: Details the status and any messages from a verification process.
- `TransformData`: Data associated with entries in the TransformLog.
- `IndexData`: Data stored in the Index.
- `Language`: Enumeration of supported programming languages.

The combination of content-addressable storage, immutable logs, and explicit dependency tracking ensures that the entire knowledge graph is verifiable. Any discrepancy in content or transformation can be detected by re-hashing objects or replaying the transform log.

## Documentation

- [01 - Structural Analysis: Mapping the Codebase](./docs/01_Structural_Analysis.md)

## Build and Run

To build and run the `cognition-cli`, follow these steps:

1. **Navigate to the CLI directory:**

   ```bash
   cd src/cognition-cli
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Build the project:**

   ```bash
   npm run build
   ```

   This compiles the TypeScript code into JavaScript, placing the output in the `dist` directory.

After building, you can run the CLI in several ways:

- **Using `npm start` (recommended for built version):**

  ```bash
  npm start -- <command> [args]
  # Example: npm start -- init
  # Example: npm start -- genesis .
  # Example: npm start -- query StructuralMiner
  # Example: npm start -- audit src/miners/structural-miner.ts
  ```

- **Directly using the compiled executable:**

  ```bash
  node dist/cli.js <command> [args]
  # Example: node dist/cli.js init
  # Example: node dist/cli.js genesis .
  # Example: node dist/cli.js query StructuralMiner
  # Example: node dist/cli.js audit src/miners/structural-miner.ts
  ```

- **In development mode (without building, using `tsx`):**

  ```bash
  npm run dev -- <command> [args]
  # Example: npm run dev -- init
  # Example: npm run dev -- genesis .
  # Example: npm run dev -- query StructuralMiner
  # Example: npm run dev -- audit src/miners/structural-miner.ts
  ```

  This uses `tsx` to run the TypeScript files directly and watches for changes.

## Dependencies

For processing non-native TypeScript files and other languages not natively supported by the CLI's AST parsers, the `genesis` command relies on the `eGemma` server. `eGemma` provides advanced parsing capabilities and must be running and accessible at `http://localhost:8000` for full functionality. You can find more information about `eGemma` at [https://github.com/mirzahusadzic/egemma](https://github.com/mirzahusadzic/egemma).
