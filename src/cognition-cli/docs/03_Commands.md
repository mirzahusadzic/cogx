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
cognition-cli query <symbol-name> --projectRoot <path-to-project-root> [--depth <depth>]
```

- `<symbol-name>`: The name of the symbol you want to query (e.g., `StructuralMiner`, `extractStructure`).
- `--projectRoot`: Specifies the root of your project, used to locate the `.open_cognition` directory.
- `--depth`: (Optional) The depth of dependency traversal. Defaults to `0` (only direct results). Use `1` for first-level dependencies, `2` for second-level, and so on.

### `query` Command Functionality

The `query` command performs the following:

- **Entity Extraction:** Identifies potential symbols from your query string (e.g., PascalCase or camelCase terms).
- **Index Lookup:** Uses the PGC `Index` to find files whose paths or components match the canonicalized symbol name.
- **Structural Data Retrieval:** Retrieves the associated `StructuralData` from the `ObjectStore` for matching files.
- **Dependency Traversal:** If a `--depth` greater than 0 is specified, it recursively traverses the dependencies (base classes, interfaces, parameter types) of the found symbols, providing a broader context.

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
