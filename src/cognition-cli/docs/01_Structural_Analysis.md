# 01 - Structural Analysis: Mapping the Codebase

This document details Phase 1 of the `cognition-cli`'s "Dogfooding Strategy": mapping the raw structure of TypeScript and Python code into a verifiable, content-addressable knowledge graph. This process forms the "immutable bedrock" for all future reasoning within the CogX system.

## The Genesis Process: Bottom-Up Aggregation

The `genesis` command orchestrates the structural analysis, employing a multi-layered approach to extract and store code metadata.

### 1. File Discovery and Language Detection

- **Process:** The orchestrator recursively scans the specified source path, identifying files based on their extensions (`.ts`, `.js`, `.py`, `.java`, `.rs`, `.go`). Common irrelevant directories (`node_modules`, `.git`, `__pycache__`, `.open_cognition`) are excluded.
- **Output:** Each relevant file is represented as a `SourceFile` object, containing its path, relative path, name, detected language, and raw content. While files of these types are discovered, their subsequent structural extraction fidelity depends on the availability of dedicated parsers in the `StructuralMiner`.

### 2. Multi-Layered Structural Extraction

The `StructuralMiner` employs a hierarchical strategy to extract `StructuralData` from each `SourceFile`, prioritizing accuracy and determinism.

#### Layer 1: Deterministic AST Parsers (High Fidelity)

- **Native AST Parsing (TypeScript):**
  - **Mechanism:** Uses the `typescript` library to parse TypeScript code into an Abstract Syntax Tree (AST) directly within `cognition-cli`.
  - **Output:** Detailed `StructuralData` including imports, classes (with base classes, interfaces, methods, decorators), functions (with parameters, return types, async status, decorators), and exports. Docstrings are also extracted.
  - **Fidelity:** 1.0 (highest confidence).
- **Remote AST Parsing (Python via `eGemma`):**
  - **Mechanism:** For Python, the parsing task is delegated to an external `eGemma` server (accessed via `WorkbenchClient`). `eGemma` performs the AST parsing and returns similar `StructuralData`.
  - **Fidelity:** 1.0 (highest confidence).
- **Other Languages (e.g., JavaScript, Java, Rust, Go):** While files with these extensions are discovered, they currently do not have dedicated AST parsers configured in Layer 1. Their structural extraction will proceed to Layer 2 (SLM Extraction) or Layer 3 (LLM Supervised Extraction), resulting in potentially lower fidelity.

#### Layer 2: Specialized Language Model (SLM) Extraction (Medium Fidelity)

- **Mechanism:** If AST parsing fails, `SLMExtractor` attempts to extract structural information using specialized language models.
- **Fidelity:** 0.85 (moderate confidence).

#### Layer 3: LLM Supervised Extraction (Lower Fidelity)

- **Mechanism:** As a last resort, the `LLMSupervisor` uses a Large Language Model to dynamically generate and execute parsing logic for the file.
- **Fidelity:** 0.7 (lowest confidence).

### 3. Content Addressable Storage and Auditable Transformations

All extracted structural data is meticulously stored and tracked to ensure verifiability and immutability.

- **ObjectStore:** Both the raw `SourceFile` content and the extracted `StructuralData` (JSON representation) are hashed (e.g., SHA-256) and stored. The hash serves as a unique, content-addressable identifier, preventing duplication and guaranteeing immutability.
- **TransformLog:** Every structural extraction is recorded as an entry in an immutable, append-only log. This log details the transformation's goal, input/output hashes, extraction method, and fidelity, providing a complete audit trail.
- **Index:** This component provides a semantic path-to-hash mapping, allowing human-readable file paths to be resolved to their corresponding `StructuralData` hashes in the `ObjectStore`. It now includes advanced search capabilities:
  - **Symbol Canonicalization:** A `canonicalizeSymbol` helper standardizes search terms (e.g., PascalCase, snake_case) into a consistent kebab-case, ensuring reliable matching.
  - **Refined Search Logic:** The search mechanism intelligently matches canonicalized symbols against components of canonicalized file paths. It splits the file path into parts, removes file extensions, and checks for inclusion of the canonicalized symbol within these parts.
  - **Zod Validation:** All `IndexData` entries are validated using Zod, ensuring data integrity and adherence to the defined schema.
- **ReverseDeps:** This component tracks dependencies between structural elements, mapping dependent objects to the hashes of objects they depend on, and vice-versa.

### 4. Structural Verification

- **StructuralOracle:** After all files are processed, the `StructuralOracle` performs a verification step to ensure the coherence and integrity of the generated Grounded Context Pool (PGC). Any inconsistencies are flagged, reinforcing the "auditable graph" principle.

## Data Structures for Structural Representation

The `cognition-cli` uses well-defined TypeScript interfaces to represent the extracted structural data:

- **`SourceFile`**: Represents the raw input file.
- **`ParameterData`**: Details function parameters (name, type, optional, default).
- **`FunctionData`**: Describes functions (name, docstring, parameters, return type, async status, decorators).
- **`ClassData`**: Represents classes (name, docstring, base classes, implemented interfaces, methods, decorators).
- **`PropertyData`**: Details properties within interfaces (name, type, optional).
- **`InterfaceData`**: Describes interfaces (name, docstring, properties).
- **`StructuralData`**: The comprehensive output for each file, encapsulating its language, file-level docstring, imports, lists of `ClassData`, `FunctionData`, and `InterfaceData`, exports, dependencies, the `extraction_method`, and `fidelity` score.

This structured representation, combined with content-addressable storage and auditable transformations, forms the "immutable bedrock" of the CogX project, enabling advanced code analysis and reasoning.
