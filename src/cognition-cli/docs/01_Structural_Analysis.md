# 01 - Structural Analysis: Forging the Verifiable Skeleton

This document details the first and most critical phase of the `cognition-cli`: transforming raw, unstructured source code into a verifiable, content-addressable knowledge graph. This process, known as **Genesis**, forges the **immutable bedrock** upon which all future AI reasoning and analysis will be built.

The goal of this phase is not to understand _why_ the code works, but to establish, with cryptographic certainty, _what_ objectively exists and _how_ it is structurally connected.

## The Genesis Process

The `cognition-cli genesis` command orchestrates this foundational analysis. It employs a multi-layered, hierarchical strategy to extract structural metadata, prioritizing accuracy and determinism above all else.

### 1. File Discovery

The orchestrator begins by mapping the territory. It recursively scans the specified source path, identifying all relevant source files (`.ts`, `.js`, `.py`, etc.) while intelligently excluding noise (`node_modules`, `.git`, `__pycache__`). Each discovered file becomes a `SourceFile` object, the first, raw `GKe` in our system.

### 2. The Structural Mining Strategy

To extract `StructuralData` (the classes, functions, imports, etc.) from each `SourceFile`, the `StructuralMiner` uses a "waterfall" strategy. It attempts the most reliable method first and only falls back to less certain methods if the higher-fidelity approach fails.

This tiered approach ensures that the resulting knowledge graph is as truthful and deterministic as possible.

| Layer | Method                               | Mechanism                                                                                                                                        | Fidelity | Status                                               |
| :---- | :----------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :--------------------------------------------------- |
| **1** | **Deterministic AST Parsers**        | **Direct Abstract Syntax Tree (AST) parsing.** Uses the native `typescript` library for TS/JS files and the external `eGemma` server for Python. | **1.0**  | **Highest Confidence.** The verifiable ground truth. |
| **2** | **Specialized Language Model (SLM)** | If AST parsing is unavailable or fails, a specialized, fine-tuned SLM attempts to extract the key structural elements.                           | **0.85** | **Moderate Confidence.** A powerful fallback.        |
| **3** | **LLM Supervisor**                   | As a last resort, a generalist LLM is tasked with dynamically generating and executing a script to parse the file.                               | **0.70** | **Lowest Confidence.** A heuristic of last resort.   |

### 3. Building the Grounded Context Pool (PGC)

As each file is mined, its knowledge is meticulously integrated into the PGC, ensuring every piece of information is immutable, auditable, and interconnected.

- **Object Store:** Both the raw file content and the extracted `StructuralData` are hashed (SHA-256). This hash becomes the object's unique, content-addressable ID. This guarantees that data is never duplicated and can never be altered without creating a new, distinct object.

- **Transform Log:** Every single extraction—whether it was a high-fidelity AST parse or a low-fidelity LLM guess—is recorded as a permanent, immutable "receipt" in the `transforms/` log. This entry details the goal, the input/output hashes, the method used, and the final `fidelity` score, providing a complete and transparent audit trail.

- **Index:** This is the PGC's "Table of Contents." It maps the human-readable file path (e.g., `src/core/pgc/manager.ts`) to the content hash of its `StructuralData` in the Object Store, enabling fast lookups.

- **Reverse Deps:** As the system discovers dependencies (e.g., an `import` statement), it populates the `reverse_deps/` index. This is the PGC's high-speed nervous system, allowing for instantaneous lookups of "what depends on this?"—a critical function for later analysis.

### 4. Final Verification: The Structural Oracle

After the mining process is complete, the `StructuralOracle` performs a final verification run. It sweeps through the entire generated PGC, checking for broken links, incoherent dependencies, and structural anomalies. This ensures that the "verifiable skeleton" is not just a collection of data, but a coherent and logically sound whole.

## The Anatomy of a `StructuralData` Object

The final output for each source file is a rich `StructuralData` object, a `GKe` that serves as its complete structural fingerprint.

- **Core Metadata:** `language`, `file_docstring`, `extraction_method`, and the final `fidelity` score.
- **Connections:** Lists of `imports` and `exports`.
- **Structural Elements:** Comprehensive lists of every `ClassData`, `FunctionData`, and `InterfaceData` element found in the file, each with its own detailed metadata:
  - **`ClassData`:** Includes base classes, implemented interfaces, methods, and decorators.
  - **`FunctionData`:** Includes parameters (with types), return types, and async status.
  - **`InterfaceData`:** Includes a list of all its properties with their types.

This rich, structured, and verifiably-grounded representation of the codebase is the essential foundation upon which all the more advanced reasoning of the CogX ecosystem is built.
