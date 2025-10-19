# Cognition CLI

<div align="center" style="margin-top: 20px; margin-bottom: 20px;">
<img src="./docs/assets/cognition-cli-logo.png" alt="Cognition CLI Logo" width="512"/>
</div>

> **Research Focus**: Enhancing LLM Code Understanding Through Structured Knowledge Graphs

The Cognition Command-Line Interface (`cognition-cli`) implements the **Programmable Graph of Code (PGC)** - a verifiable, content-addressable knowledge graph system for codebases. This research explores how structured knowledge graphs can overcome current limitations in AI-based code understanding.

## Research Significance

This implementation addresses fundamental challenges in AI-code interaction:

- **Verifiable Context Sampling**: Grounded code reasoning beyond token windows
- **Dependency-Aware Analysis**: Structural understanding of code relationships
- **Architectural Pattern Recognition**: Content-addressable storage for system-level insights
- **Reduced Hallucination**: Immutable, verifiable knowledge graphs for accurate AI reasoning

## Features

The `cognition-cli` provides a set of commands to manage and interact with the Grounded Context Pool and extract structural information from your codebase. This document details the primary commands available.

### Usage

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

## 3. `query` Command: Exploring the Knowledge Graph

The `query` command (`src/commands/query.ts`) allows you to explore the structural knowledge graph that has been extracted and stored in the PGC. You can search for symbols (classes, functions, interfaces) and traverse their dependencies.

### `query` Command Usage

```bash
cognition-cli query <symbol-name> --projectRoot <path-to-project-root> [--depth <depth>] [--lineage]
```

- `<symbol-name>`: The name of the symbol you want to query (e.g., `StructuralMiner`, `extractStructure`).
- `--projectRoot`: Specifies the root of your project, used to locate the `.open_cognition` directory.
- `--depth`: (Optional) The depth of dependency traversal. Defaults to `0` (only direct results). Use `1` for first-level dependencies, `2` for second-level, and so on.
- `--lineage`: (Optional) When present, the command will output the full lineage of dependencies, showing the path from the queried symbol to its deepest dependencies.

### `query` Command Functionality

The `query` command performs the following:

- **Entity Extraction:** Identifies potential symbols from your query string (e.g., PascalCase or camelCase terms).
- **Contextual Search Logging:** Provides detailed logging for search operations, indicating the context (e.g., "initial entity search", "dependency search at depth X") to clarify the purpose of each search.
- **Index Lookup:** Uses the PGC `Index` to find files whose paths or components match the canonicalized symbol name.
- **Structural Data Retrieval:** Retrieves the associated `StructuralData` from the `ObjectStore` for matching files.
- **Dependency Traversal:** If a `--depth` greater than 0 is specified, it recursively traverses the dependencies (base classes, interfaces, parameter types) of the found symbols, providing a broader context. When `--lineage` is used, the output will include the full dependency path.

## 4. `audit` Command: Verifying PGC Integrity

The `audit` command (`src/commands/audit.ts`) allows you to verify the integrity and coherence of the Grounded Context Pool (PGC). It checks the transformation history of files and ensures that all referenced objects and transformations exist.

### `audit` Command Usage

```bash
cognition-cli audit <file-path> --projectRoot <path-to-project-root> [--limit <number>]
```

- `<file-path>`: The path to the file whose transformation history you want to audit.
- `--projectRoot`: Specifies the root of your project, used to locate the `.open_cognition` directory.
- `--limit`: (Optional) The maximum number of transformation history entries to display. Defaults to `5`.

### `audit` Command Functionality

- **Transformation History Review:** Displays the transformation history for a given file, showing details of each transformation (goal, fidelity, verification result, inputs, outputs).
- **PGC Coherence Check:** Verifies that all content hashes, structural hashes, and transform IDs referenced in the file's history exist within the PGC.

## Research Applications

The PGC architecture enables novel approaches to:

- **Enhanced LLM Code Understanding**: Providing structural context for more accurate AI analysis
- **Verifiable AI Code Assistance**: Grounding AI responses in actual code dependencies
- **Architectural Reasoning**: Enabling AI systems to reason about code at system level
- **Continuous Learning**: Tracking code evolution patterns for AI improvement

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

## Research Collaboration

This project is positioned for research into AI-code interaction patterns and enhanced LLM reasoning capabilities. The PGC architecture provides the foundational infrastructure for exploring:

- How structured knowledge graphs improve LLM code reasoning accuracy
- The impact of verifiable context sampling on AI code analysis
- Architectural patterns that emerge from systematic code evolution tracking
- Enhanced dependency-aware code generation and refactoring

## Documentation

- [00 - Introduction to Cognition CLI](./docs/00_Introduction.md)
- [01 - Structural Analysis: Mapping the Codebase](./docs/01_Structural_Analysis.md)
- [02 - Core Infrastructure: The Grounded Context Pool (PGC)](./docs/02_Core_Infrastructure.md)
- [03 - Commands: Interacting with the Cognition CLI](./docs/03_Commands.md)
- [04 - Miners and Executors: Extracting and Processing Knowledge](./docs/04_Miners_and_Executors.md)
- [05 - Verification and Oracles: Ensuring PGC Integrity](./docs/05_Verification_and_Oracles.md)
- [06 - Testing and Deployment](./docs/06_Testing_and_Deployment.md)

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

For processing non-native TypeScript files and other languages not natively supported by the CLI's AST parsers, the `genesis` command relies on the `eGemma` server.

**eGemma Integration:**

- Provides advanced parsing capabilities for multiple languages
- Must be running and accessible at `http://localhost:8000` for full functionality
- Project repository: [https://github.com/mirzahusadzic/egemma](https://github.com/mirzahusadzic/egemma)
