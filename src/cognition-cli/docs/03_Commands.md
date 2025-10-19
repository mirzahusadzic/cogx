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

## 5. `overlay` Command: Manage and Generate Analytical Overlays

The `overlay` command (`src/commands/overlay.ts`) allows you to manage and generate various analytical overlays on top of your Grounded Context Pool. These overlays provide specialized views or data derived from the core PGC.

### `overlay generate` Command: Generate a Specific Overlay

The `generate` subcommand is used to create or update a specific type of overlay.

#### `overlay generate` Command Usage

```bash
cognition-cli overlay generate <type> --projectRoot <path-to-project-root>
```

- `<type>`: The type of overlay to generate. Currently, only `structural_patterns` is supported.
- `--projectRoot`: (Optional) The root directory of the project. Defaults to the current working directory.

#### `overlay generate` Command Functionality

The `overlay generate` command performs the following actions:

- **Overlay Type Validation:** Checks if the specified `<type>` is supported.
- **Orchestration:** For `structural_patterns`, it initializes the `OverlayOrchestrator`, which then:
  - Discovers files in the project's index.
  - Identifies primary symbols within each file.
  - Generates structural signatures and infers architectural roles for these symbols.
  - Stores these patterns, along with their vector embeddings, in a LanceDB vector store.
  - Updates the PGC overlays with metadata about the generated patterns.
  - Generates a manifest of the processed patterns.

## 6. `patterns` Command: Managing and Querying Structural Patterns

The `patterns` command (`src/commands/patterns.ts`) provides functionality for working with structural patterns extracted from your codebase. This includes finding similar patterns based on their structural signatures.

### `patterns find-similar` Command Usage

```bash
cognition-cli patterns find-similar <symbol> --top-k <number> [--json]
```

- `<symbol>`: The name of the symbol (e.g., a class, function, or interface) for which you want to find similar structural patterns.
- `--top-k`: (Optional) The number of top similar patterns to return. Defaults to `10`.
- `--json`: (Optional) When present, the command will output the raw JSON results instead of the human-readable formatted output.

### `patterns find-similar` Command Functionality

The `patterns find-similar` command performs the following:

- **Vector Database Initialization:** Initializes the local LanceDB vector store, which holds the vector embeddings of structural patterns.
- **Workbench Client Initialization:** Connects to the `eGemma` workbench to potentially generate embeddings or leverage its capabilities for similarity search.
- **Similarity Search:** Uses the `StructuralPatternsManager` to query the vector database for patterns structurally similar to the provided `<symbol>`. The search is based on the vector embeddings of the structural signatures.
- **Rich Output Formatting:** By default, results are displayed with rich formatting, including color-coded symbols, architectural roles, similarity bars, and explanations. The `--json` flag can be used to get raw JSON output.

#### Example Output

```bash
✅ Opened existing LanceDB table: structural_patterns

🔍 Patterns similar to StructuralMiner:

1. SLMExtractor [component]
   ██████████████████ 91.4%
   Shared patterns: uses:SummarizeRequest:3.00, uses:WorkbenchClient:1.00, uses:SourceFile:1.00

2. LLMSupervisor [component]
   ██████████████████ 88.2%
   Shared patterns: uses:SummarizeRequest:3.00, uses:WorkbenchClient:1.00, uses:SourceFile:1.00

3. GenesisOrchestrator [component]
   ████████████████ 81.3%
   Shared patterns: uses:SummarizeRequest:3.00, uses:StructuralMiner:1.00, uses:WorkbenchClient:1.00

4. WorkbenchClient [component]
   ███████████████ 76.1%
   Shared patterns: uses:SummarizeRequest:3.00, uses:WorkbenchClient:1.00

5. StructuralPatternsManager [component]
   ██████████████ 72.2%
   Shared patterns: uses:SummarizeRequest:3.00, uses:WorkbenchClient:1.00

6. SourceFile [component]
   ██████████████ 69.3%
   Shared patterns: uses:SourceFile:1.00, uses:ASTParserRegistry:1.00

7. JavaScriptParser [component]
   █████████████ 68.1%
   Shared patterns: uses:SourceFile:1.00, uses:ASTParserRegistry:1.00

8. TypeScriptParser [component]
   █████████████ 66.1%
   Shared patterns: uses:SourceFile:1.00, uses:ASTParserRegistry:1.00

9. ASTParserRegistry [component]
   █████████████ 63.4%
   Shared patterns:

10. StructuralOracle [component]
   ████████████ 59.7%
   Shared patterns:
```

### `patterns analyze` Command Usage

```bash
cognition-cli patterns analyze
```

### `patterns analyze` Command Functionality

The `patterns analyze` command performs the following:

- **Vector Database Initialization:** Initializes the local LanceDB vector store.
- **Retrieve All Patterns:** Fetches all stored structural patterns from the vector database.
- **Architectural Role Distribution:** Groups patterns by their inferred architectural role (e.g., 'orchestrator', 'data_access', 'service') and counts the occurrences of each role.

#### `patterns analyze` Example Output

```bash
✅ Opened existing LanceDB table: structural_patterns

📊 Architectural Pattern Distribution:

component       ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 25
```

### `patterns compare` Command Usage

```bash
cognition-cli patterns compare <symbol1> <symbol2>
```

- `<symbol1>`: The first symbol to compare.
- `<symbol2>`: The second symbol to compare.

### `patterns compare` Command Functionality

The `patterns compare` command performs the following:

- **Lineage Retrieval:** Retrieves the dependency lineage for both `<symbol1>` and `<symbol2>` up to a specified depth (currently 3).
- **Dependency Comparison:** Identifies shared dependencies, as well as dependencies unique to each symbol.
- **Formatted Output:** Displays a clear comparison of shared and unique dependencies, highlighting the structural similarities and differences between the two symbols.

#### `patterns compare` Example Output

```bash
🔗 Comparing StructuralMiner vs StructuralPatternsManager:

Shared dependencies:
  ● WorkbenchClient
  ● SummarizeRequest
  ● EmbedRequest
  ● ASTParseRequest

Unique to StructuralMiner:
  ● SourceFile
  ● Language

Unique to StructuralPatternsManager:
  ● PGCManager
  ● LanceVectorStore
  ● StructuralData
  ● QueryOptions
  ● QueryResult
```
