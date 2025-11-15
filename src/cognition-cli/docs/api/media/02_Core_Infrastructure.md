# 02 - Core Infrastructure: The Anatomy of a Digital Brain

The heart of the `cognition-cli` is the **Grounded Context Pool (PGC)**. It is not a database or a simple file cache; it is a content-addressable "digital brain" designed from the ground up for verifiability, immutability, and the efficient navigation of complex knowledge.

All of its components reside within the `.open_cognition` directory at your project's root. The entire system is orchestrated by the **`PGCManager`**, which acts as the conscious, coordinating mind for all of the brain's underlying parts.

## The Four Pillars of the PGC

The PGC is built on four interconnected pillars. Each serves a distinct and vital role, and together they form the fundamental, content-agnostic physics of this new architecture.

| Pillar                  | Directory       | Role & Analogy                                                                                                                                   |
| :---------------------- | :-------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. The ObjectStore**  | `objects/`      | **The Immutable Memory.** A content-addressable store (like Git's) for every unique piece of knowledge (code, ASTs). It cannot be altered.       |
| **2. The TransformLog** | `transforms/`   | **The Auditable Thought Process.** An immutable, append-only log of every single operation, providing a perfect, verifiable history.             |
| **3. The Index**        | `index/`        | **The Conscious Mind.** The brain's "table of contents," linking human-readable file paths to the correct, verified memories in the ObjectStore. |
| **4. The ReverseDeps**  | `reverse_deps/` | **The Reflexive Nervous System.** An instantaneous reverse-lookup index that makes tracing relationships and analyzing impact effortless.        |

## The Brain's Faculties: Specialized Tools for Understanding

While the four pillars provide the core structure, the PGC is brought to life by a set of specialized faculties that enable advanced reasoning and analysis.

### The `LanceVectorStore`: The Engine of Intuition

The `LanceVectorStore` is the PGC's engine for semantic and structural search. It allows the system to move beyond exact matches and find "similar" or "related" concepts.

- **Mechanism:** It uses **LanceDB**, an embedded, high-performance vector database, to store the mathematical "fingerprints" (vector embeddings) of your code's structural patterns. This enables powerful similarity searches to find, for example, all classes that are architecturally similar to your `UserManager`.
- **Analogy:** This is the brain's ability to make intuitive leaps, recognizing that two different concepts "feel" related even if they don't share the same name.

### Overlays: The Lenses of Perception

Overlays are specialized layers of analysis that are "laid over" the core knowledge graph. They provide different, focused views of the codebase without ever altering the foundational truth in the `ObjectStore`.

- **Mechanism:** Each overlay (e.g., `structural_patterns`, `lineage_patterns`, `security_vulnerabilities`) lives in its own directory. Its entries are anchored directly to the core knowledge elements in the main `Index`, creating a rich, multi-dimensional understanding.
- **Example (`structural_patterns`):** This crucial overlay stores the detailed architectural pattern for every single symbol (class, function, etc.) in your project. Each entry is a granular analysis of a symbol's structure and role, serving as the foundation for more advanced overlays like `lineage_patterns`.
- **Analogy:** These are the brain's specialized visual cortices. One can analyze for threats (security), another for relationships (lineage), and another for abstract patterns, all while looking at the same, underlying reality.

### The `StructuralOracle`: The Guardian of Coherence

The `StructuralOracle` is the PGC's immune system. Its sole purpose is to maintain the integrity and logical coherence of the entire "digital brain."

- **Mechanism:** After major operations like the `genesis` process, the `Oracle` runs a series of rigorous checks. It sweeps through the `TransformLog` and verifies that every single input and output hash points to a real, existing memory in the `ObjectStore`. It ensures that the brain's history is complete and its current state is logically sound.
- **Analogy:** This is the brain's ability to self-diagnose and detect when a memory has become corrupted or a line of reasoning is flawed, ensuring the entire system remains trustworthy.

## The Lattice Structure: From Foundation to Insight

The PGC's four pillars form the **bottom layer (⊥)** of what we call The Lattice - a mathematical structure that organizes knowledge through multiple specialized dimensions.

### The Foundation (⊥)

```
ObjectStore ∪ TransformLog ∪ Index ∪ ReverseDeps = Foundation Layer
```

This immutable foundation provides:

- **Content addressability** - Knowledge identified by cryptographic hash
- **Verifiable provenance** - Complete audit trail of all transformations
- **Bidirectional traversal** - Query dependencies in any direction
- **Logical coherence** - Oracle-verified consistency

### The Overlay Layers (O₁-O₇)

Built atop this foundation, specialized overlays provide different analytical perspectives:

- **O₁ Structural Patterns** - Architectural roles and signatures
- **O₂ Security Guidelines** - Vulnerability analysis and safety constraints
- **O₃ Lineage Patterns** - Dependency provenance through time
- **O₄ Mission Concepts** - Strategic documentation alignment
- **O₅ Operational Patterns** - Runtime behavior analysis
- **O₆ Mathematical Proofs** - Formal verification and logical guarantees
- **O₇ Strategic Coherence** - Mission alignment synthesis across all overlays

Each overlay references elements in the foundation layer by their content hashes, creating a multi-dimensional knowledge graph where the same code element can be understood from structural, security, lineage, and mission-alignment perspectives simultaneously.

### The Complete Picture

```
         ⊤ (Top - Synthesized Understanding)
        /|\
       / | \
     O₇ O₆ O₅ O₄ O₃ O₂ O₁ (Specialized Overlays)
      \     |     /
       \    |    /
    Index + ReverseDeps (Navigation)
              |
    ObjectStore + TransformLog (Immutable Truth)
              |
         ⊥ (Bottom - Foundation)
```

This structure enables what we call **lattice queries** - the ability to ask questions that span multiple analytical dimensions. For example: "Show me all classes with high structural similarity to `UserManager` that also have security vulnerabilities and low mission alignment." Such queries traverse multiple overlays while maintaining verifiable provenance back to the source code.

The lattice structure is what transforms the PGC from a simple code database into a comprehensive analytical framework - a "cognitive prosthetic" that extends human architectural reasoning with verifiable, multi-dimensional understanding.
