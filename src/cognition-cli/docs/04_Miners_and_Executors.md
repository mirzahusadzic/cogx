# 04 - Miners and Executors: Extracting and Processing Knowledge

This document details the components responsible for extracting structural information from source code and interacting with external services within the `cognition-cli`. These "Miners" and "Executors" form the intelligence layer that transforms raw code into verifiable `StructuralData`.

## 1. StructuralMiner: The Multi-Layered Extraction Engine

The `StructuralMiner` (`src/miners/structural-miner.ts`) is the core component that orchestrates the extraction of structural data from source files. It employs a robust, multi-layered approach to ensure high fidelity and resilience, prioritizing deterministic methods before falling back to AI-driven techniques.

### Extraction Layers

The `extractStructure` method attempts to extract structural data using the following hierarchy:

#### Layer 1: Deterministic AST Parsers (High Fidelity)

- **Native AST Parsing (TypeScript):**
  - **Output:** Detailed `StructuralData` including imports, classes (with base classes, interfaces, methods, decorators), functions (with parameters, return types, async status, decorators), exports, and now also **interfaces (with properties)**. Docstrings are also extracted.
  - **Fidelity:** 1.0 (highest confidence).
- **Remote AST Parsing (Python via `eGemma`):**
  - **Mechanism:** For languages like Python, which do not have a native parser implemented directly in `cognition-cli`, the `StructuralMiner` delegates the parsing task to the `WorkbenchClient`'s `parseAST` method. This sends the code to the external `eGemma` server for AST generation.
  - **Fidelity:** 1.0 (highest confidence).
- **Other Languages (e.g., JavaScript, Java, Rust, Go):** Files with these extensions are discovered by the `GenesisOrchestrator`, but currently lack dedicated AST parsers in Layer 1. Their structural extraction will proceed to Layer 2 or Layer 3.

#### Layer 2: Specialized Language Model (SLM) Extraction (Medium Fidelity)

- **Mechanism:** If Layer 1 AST parsing fails or is unavailable, the `SLMExtractor` (`src/miners/slm-extractor.ts`) is engaged. It utilizes the `WorkbenchClient` to send the source file content to `eGemma`'s `/summarize` endpoint, instructing it to act as a `structure_extractor` persona. The `eGemma` server then uses a specialized language model to infer and return structural data in JSON format. The `StructuralData` returned now includes support for `interfaces`.
- **Fidelity:** 0.85 (moderate confidence).

#### Layer 3: LLM Supervised Extraction (Lower Fidelity)

- **Mechanism:** As a final fallback, if both Layer 1 and Layer 2 fail, the `LLMSupervisor` (`src/miners/llm-supervisor.ts`) is invoked. It uses the `WorkbenchClient` to send the source file to `eGemma`'s `/summarize` endpoint with a `parser_generator` persona and a goal to "Generate a tree-sitter query to extract structure." Currently, this layer is a placeholder for future implementation where the generated parsing logic would be executed in a sandbox. The `StructuralData` returned now includes support for `interfaces`.
- **Fidelity:** 0.7 (lowest confidence).

## 2. ASTParserRegistry: Managing Language Parsers

The `ASTParserRegistry` (`src/miners/ast-parsers/index.ts`) acts as a central repository for different AST parsers, mapping programming languages to their respective parsing implementations.

## 3. TypeScriptParser: Native TypeScript AST Extraction

The `TypeScriptParser` (`src/miners/ast-parsers/typescript-parser.ts`) is responsible for natively parsing TypeScript source code into `StructuralData`.

## 4. SLMExtractor: Specialized Language Model Extraction

The `SLMExtractor` (`src/miners/slm-extractor.ts`) provides a fallback mechanism for structural extraction using Specialized Language Models (SLMs) hosted on the `eGemma` workbench.

## 5. LLMSupervisor: Large Language Model Orchestration

The `LLMSupervisor` (`src/miners/llm-supervisor.ts`) acts as the final fallback in the structural extraction pipeline. It leverages Large Language Models (LLMs) via the `eGemma` workbench to generate parsing logic when other methods fail.

## 6. WorkbenchClient: Interfacing with eGemma

The `WorkbenchClient` (`src/executors/workbench-client.ts`) is the dedicated client for communicating with the external `eGemma` server. `eGemma` provides advanced language processing capabilities, including remote AST parsing and specialized/large language model inference.
