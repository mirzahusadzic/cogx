# 04 - Miners & Executors: The Intelligence Layer

This document describes the heart of the `cognition-cli`'s intelligence: the "Miners" and "Executors." These are the components responsible for the difficult and crucial work of transforming raw, unstructured source code into the verifiable, structured knowledge that forms the PGC.

Think of them as a team of specialized miners, each with different tools and expertise, all tasked with extracting the valuable "ore" (the structural data) from the mountain of your codebase.

## The `StructuralMiner`: The Foreman of the Operation

The `StructuralMiner` is the orchestrator and the "foreman" of the entire extraction process. When the `genesis` command is run, it is the `StructuralMiner` that takes charge of each `SourceFile` and deploys its team of specialized extractors in a specific, strategic order to ensure the highest possible quality of knowledge.

### The Mining Strategy: A Hierarchy of Trust

The `StructuralMiner` employs a robust, three-layer "waterfall" strategy. It always attempts the most reliable and deterministic method first, only falling back to more heuristic, AI-driven methods if necessary. This guarantees that the PGC is built on a foundation of maximum truth.

#### **Layer 1: The Reliable Craftsman (Deterministic AST Parsers)**

This is the preferred, highest-fidelity method. It uses traditional, deterministic Abstract Syntax Tree (AST) parsers to read the code's structure with 100% accuracy.

- **Mechanism:** For TypeScript/JavaScript, it uses a native parser built directly into the CLI. For other supported languages like Python, it delegates the task via the `WorkbenchClient` to the external `eGemma` server, which performs the same high-fidelity AST parsing.
- **Fidelity:** **1.0 (Cryptographic Truth)**

#### **Layer 2: The Smart Interpreter (Specialized Language Model)**

If a dedicated AST parser is unavailable for a language, the `SLMExtractor` is called.

- **Mechanism:** It sends the code to the `eGemma` workbench, which uses a specialized, fine-tuned Language Model (SLM) trained specifically to read code and output its structure in a reliable JSON format.
- **Fidelity:** **0.85 (High Confidence)**

#### **Layer 3: The Creative Improviser (LLM Supervisor)**

If all else fails, the `LLMSupervisor` is the final fallback.

- **Mechanism:** It tasks a powerful, general-purpose Large Language Model (LLM) on the `eGemma` workbench to analyze the unknown code and dynamically generate a parsing strategy. (Note: This layer is currently a placeholder for future sandboxed execution).
- **Fidelity:** **0.70 (Educated Guess)**

## The `WorkbenchClient`: The Gateway to External Intelligence

The `WorkbenchClient` is the CLI's dedicated executor for communicating with the external `eGemma` server. It is the secure gateway that allows the `StructuralMiner` to access the powerful, off-the-shelf language processing and AI inference capabilities needed for Layers 2 and 3, as well as for remote AST parsing.

## The "Why" Behind the Layers: A Commitment to Verifiability

This complex, multi-layered mining strategy is a direct reflection of the CogX core philosophy. A simpler system might just use an LLM for everything, but this would create a knowledge graph built on a foundation of high-confidence guesses.

By prioritizing deterministic, verifiable methods and clearly labeling the `fidelity` of every single piece of knowledge it creates, the `cognition-cli` ensures that the resulting PGC is not just a useful tool, but a **trustworthy and auditable source of architectural truth.**
