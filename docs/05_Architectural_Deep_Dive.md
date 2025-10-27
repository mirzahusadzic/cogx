# Architectural Deep Dive

## The Evolution of the Oracle

The `Goal` is the intent. The `Transform` is the action. But it is the **Oracle (O)** that gives the system its integrity. Without a robust, multi-layered, and ever-evolving validation mechanism, the Grounded Context Pool (PGC) would be nothing more than a well-organized collection of high-confidence hallucinations. The Oracle is the system's immune system, its conscience, and its connection to verifiable truth.

### **Level 1: The Foundational Guardians - The Multi-Layered Oracle System**

- **The Tool Oracle (OTools):** The system's "mechanic." Validates the technical correctness of low-level operations (e.g., "Is this valid JSON?").
- **The Grounding Oracle (OGrounding):** The system's "fact-checker." Verifies that information is true to its source (SR).
- **The Goal-Specific Oracle (OG):** The system's "quality inspector." Evaluates if the output successfully achieved its `Goal`.
- **The Structural Oracle (OStructure):** The system's "librarian." Guards the integrity and coherence of the knowledge graph's physical structure and semantic paths.

### **Level 2: The Performance Auditors - Measuring the Quality of Intelligence**

- **The Context Quality Oracle (OContext):** The "Whisperer's Coach." Measures the **Field of View (FoV)** of the provided context (COGP), analyzing its **Span** (vertical depth) and **Context Angle** (horizontal breadth).
- **The Context Utilization Oracle (OOmega):** The "Reasoning Analyst." Measures how well the agent _used_ the provided context, calculating the **Context Utilization Score (Omega)**.

### **Level 3: The Final Evolution - The Stateful, Learning Guardians**

The oracles evolve into "Letta agents," specialized, long-running agents based on **MemGPT** principles. Each Letta agent maintains its own persistent memory, allowing it to learn from every validation it performs. For example, the **OSecurityAudit** Letta Agent builds a persistent threat model, learning the project's specific "weak spots" over time.

## The `cognition-script` Meta-Language

Orchestration is not defined in a rigid, declarative format. Instead, it's defined in `cognition-script`, a procedural, high-level scripting language embedded directly within `COGX.md` files.

A failure to use a procedural language was a critical early lesson. A purely declarative YAML structure was attempted and failed catastrophically due to its inability to express recursion, complex conditional logic, and its poor readability.

### The "Living Language"

The most powerful concept is that `cognition-script` is a **"living language."** The `cognition-cli` interpreter is a _meta-interpreter_. It bootstraps its ability to understand the script by reading two artifacts stored within the knowledge base itself:

1. **The Language Specification (Lambda):** A formal grammar for `cognition-script`.
2. **The Referential Implementation (Iref):** A working example of an interpreter for that grammar.

This means the language can be extended, modified, or completely replaced by updating these two files. The system can be tasked with evolving its own language.

### Example `cognition-script` Workflow

The following script demonstrates a complete, end-to-end query workflow. Note the use of the `@` prefix for the `PERSONA` path. This is the standard notation for referencing a knowledge element by its semantic path within the `.open_cognition/index/` directory.

```cognition-script
# This function defines the complete query-to-workflow.
FUNCTION answer_complex_query(user_query)
    # Step 1: Deconstruct the query to understand its intent and entities.
    LOG "Deconstructing query to identify intent and entities..."
    $query_analysis = EXECUTE NODE deconstruct_query WITH
        INPUT_QUERY = $user_query
        PERSONA = @/personas/query_analyst.yaml
        -> $query_analysis_gke

    # Step 2: Discover all relevant context candidates via graph traversal.
    LOG "Discovering all relevant context candidates via graph traversal..."
    $context_candidates = EXECUTE NODE context_discovery WITH
        QUERY_ANALYSIS = $query_analysis.content
        -> $candidate_list_gke

    # Step 3: Select and compose the final context from the candidates.
    LOG "Composing Optimal Grounded Prompt Context (C_OGP)..."
    $final_context = EXECUTE NODE compose_optimal_context WITH
        INPUT_CANDIDATES = $candidate_list_gke.content
        QUERY_ANALYSIS = $query_analysis.content
        TOKEN_BUDGET = 16000
        -> $final_context_gke

    # Step 4: Make the final LLM call with the perfect context to get the answer.
    LOG "Generating final answer..."
    $final_answer = EXECUTE NODE generate_final_answer WITH
        INPUT_QUERY = $user_query
        OPTIMAL_CONTEXT = $final_context.content
        PERSONA = $query_analysis.content.persona
        -> $final_answer_gke

    # Step 5: Validate that the answer was well-grounded in the provided context.
    LOG "Validating context utilization of the final answer..."
    VALIDATE CONTEXT_UTILIZATION OF $final_answer WITH
        SOURCE_CONTEXT = $final_context.content
        -> $omega_score

    LOG "Query processing complete. Final answer generated with Omega Score: $omega_score"
END_FUNCTION

# Execute the entire workflow.
$the_query = "How do I add a 'read:profile' scope to the auth system, and what is the risk to our testing overlay?"
CALL answer_complex_query($the_query)
```

### The `cognition-cli`: An Operator's Guide

The `cognition-cli` is the proposed tangible interface for a human collaborator to operate the digital brain. It is the Master Orchestrator (O) made manifest.

#### Key Commands

- `cognition-cli init`: Initializes a new, empty PGC.
- `cognition-cli genesis`: Executes the primary workflow to build the foundational knowledge base from the source repository.
- `cognition-cli query "<question>"`: The primary command for asking questions of the knowledge base.
- `cognition-cli update`: Synchronizes the knowledge base with changes in the source files.
- `cognition-cli groom`: Invokes the Structural Oracle to analyze and automatically refactor the knowledge graph for optimal health and performance.
- `cognition-cli status`: Provides a high-level status of the knowledge base, similar to `git status`.

### The Overlay System: Specialized Knowledge and External Insights

Overlays are a critical feature of the architecture, serving as the system's "sensory organs." They allow for specialized, domain-specific analysis and high-impact external information to be integrated with the core knowledge base without polluting the foundational, objective truth derived from the source code.

#### The Structure of an Overlay

An overlay is a parallel, sparse knowledge graph that resides in its own directory structure (e.g., `.open_cognition/overlays/security/`). Its key characteristics are:

- **Anchored to the Genesis Layer:** Its knowledge elements (GKe) do not form a deep hierarchy of summaries. Instead, their Source Records (SR) and dependency maps point directly to GKes in the main Genesis Layer (summaries of files, components, etc.).
- **Horizontally Connected:** The primary connections within an overlay are to other elements within that same overlay, forming a self-contained chain of reasoning (e.g., a `vulnerability_report` is linked to a `remediation_plan`).
- **Shallow:** Overlays are typically not deeply hierarchical. They are a collection of analyses and conclusions anchored to the deep hierarchy of the Genesis Layer.

This structure, for example `.open_cognition/overlays/security/src/api/auth.py.vulnerability_report.json`, clearly indicates a "security view" of the Genesis object related to `/src/api/auth.py`.

#### Propagation Model 1: The Horizontal Shockwave (Bottom-Up Change)

When a change occurs in the underlying source code, the invalidation propagates from the Genesis Layer outwards to the overlays.

1. **Vertical Ripple:** The Update Function (U) detects a change in a source file (e.g., `/src/api/auth.py`). It invalidates the corresponding summaries, and this invalidation ripples _upwards_ through the Genesis Layer hierarchy (`auth.py.summary` -> `/src/api.summary` -> `src.summary`).
2. **Horizontal Shockwave:** The Update Function then consults the `reverse_deps/` index for the now-invalidated Genesis objects. It finds that a `risk_assessment.json` in the Security Overlay depends on the `authentication_component.summary`.
3. **Overlay Invalidation:** The system marks the `risk_assessment.json` as `Invalidated`. The dependency is one-way; the change in the Genesis Layer invalidates the overlay, but a change within an overlay does not invalidate the Genesis Layer.

This ensures that all dependent, analytical "views" (the overlays) are marked as stale when the foundational truth (the code) changes.

#### Propagation Model 2: The Upward Bias Cascade (Top-Down Insight)

This second model handles the critical scenario of high-impact, external information, such as a news article about a security vulnerability.

1. **External Insight Ingestion:** A new GKe is created, not from code, but from an external source (e.g., a CVE announcement). This is placed in a dedicated overlay, like `overlays/external_insights/cve-2025-12345.md`.
2. **Anchor Discovery:** A specialized agent analyzes this new insight to find where it "docks" into the existing knowledge graph. It identifies that the CVE for "SuperAuth v2.1" is relevant to the `authentication_component`.
3. **The Upward Cascade:** This is where the overlay propagates its influence _inwards and upwards_.
   - **Step A (Overlay Invalidation):** The `authentication_component.risk_assessment.json` in the Security Overlay is immediately invalidated.
   - **Step B (Anchor Invalidation):** Crucially, the `authentication_component.summary` in the _Genesis Layer_ is also marked `Invalidated`. Its summary, while correct about the code, is now semantically misleading in the face of this new external reality.
   - **Step C (Bias Cascade):** This invalidation now triggers a standard upward ripple through the Genesis Layer, marking parent summaries and eventually the top-level repository summary as `Invalidated`.

4. **System Re-evaluation:** The system's state is now "Coherent but Unsound." The Orchestrator must trigger a top-down refinement run, injecting the `External_Insight` as high-priority context at every step. This forces the system to generate new summaries (e.g., "WARNING: This component is currently vulnerable...") that reflect the new, combined reality of both the code and the external world.

This dual-propagation model makes the system truly adaptive, allowing it to build a perfect, grounded model of its internal reality while remaining responsive to critical changes in the external world.

### **The Refinement Run: Regenerating Knowledge**

The invalidation process acts as the trigger, but the subsequent "refinement run" is what heals the knowledge graph. This process is not a special command, but a standard application of the system's core `Goal -> Transform -> Oracle` loop, applied iteratively to the invalidated objects.

1. **Goal Definition:** The Orchestrator identifies an `Invalidated` object and defines a Goal (G) to regenerate it to a required Fidelity Factor (Phi).
2. **Transformation:** It executes the Transform (T) using the LLM agent, providing the original source data and other valid dependencies as grounded context.
3. **Verification:** The Oracle (O) verifies the newly generated output against the Goal.

This cycle repeats until all `Invalidated` tags are cleared, ensuring that the system's understanding is once again coherent and sound.

### Roadmap for Oracle Implementation

To progressively build out the robust Oracle system described in the blueprint, we will follow a phased approach, aligning with the overall project roadmap:

#### Phase I: Foundational Structural Verification (`OStructure`)

**Objective:** Implement the initial `Structural Oracle (OStructure)` to verify the integrity and coherence of the Grounded Context Pool (PGC) immediately after its construction via the Genesis process. This ensures the "verifiable skeleton" is structurally sound.

**Milestones:**

1.  **Define `VerificationResult` Type:** Create a standard type to encapsulate the outcome of an oracle's verification, including success status and any messages.
2.  **Implement `StructuralOracle` Class:**
    - Create `src/cognition-cli/src/core/oracles/structural-oracle.ts`.
    - This class will take `PGCManager` as a dependency.
    - Its `verify()` method will perform checks such as:
      - Validating that all `content_hash` and `structural_hash` entries in the `index/` exist in the `objects/` store.
      - Verifying that all `inputs` and `outputs` hashes referenced in `transforms/` manifests exist in the `objects/` store.
      - Confirming that `objectHash` and `transformId` entries in `reverse_deps/` correspond to existing objects and transforms.
3.  **Integrate into `GenesisOrchestrator`:**
    - After the `executeBottomUpAggregation` completes, the `GenesisOrchestrator` will invoke `OStructure.verify()`.
    - The results will be logged, providing immediate feedback on the structural integrity of the newly built PGC.

#### Phase II: Semantic and Goal-Specific Verification (`OGrounding`, `OGoal`, `OContext`, `OOmega`)

**Objective:** Introduce oracles that perform deeper semantic and goal-specific validation, aligning with the "Semantic Core" phase of the overall roadmap.

**Milestones:**

1.  **Implement `OGrounding`:** Verify that generated knowledge elements are factually consistent with their source records.
2.  **Implement `OGoal`:** Evaluate if the output of a transformation successfully achieved its defined `Goal` criteria.
3.  **Implement `OContext` and `OOmega`:** Measure the quality of the context provided to LLMs and how effectively that context was utilized.
4.  **Integrate into `cognition-script` Workflows:** Allow `cognition-script` to explicitly call these oracles as part of transformation pipelines.

#### Phase III: Stateful, Learning Guardians (Letta Agents)

**Objective:** Evolve oracles into persistent, learning "Letta agents" based on MemGPT principles, enabling continuous improvement and specialized, long-running analysis.

**Milestones:**

1.  **Develop MemGPT-based Oracle Framework:** Create a foundation for stateful oracles.
2.  **Implement Specialized Letta Agents:** Examples include `OSecurityAudit` for persistent threat modeling.
3.  **Integrate Learning Loops:** Allow oracles to learn from past verifications and refine their own performance.
