# Refactoring Candidates Analysis

This document identifies code patterns in the Cognition Σ repository that share high structural similarity and suggest concrete refactorings based on their architectural roles.

## 🔍 Refactoring Candidates Found

### 1. Agent Management Hooks (0.91 similarity) [COMPLETED]

- **Status:** COMPLETED
- **Symbols:**
  - `useAgentHandlers` (`src/tui/hooks/useAgent/use-agent-handlers.ts`)
  - `useAgent` (`src/tui/hooks/useAgent/index.ts`)
  - `useAgentServices` (`src/tui/hooks/useAgent/use-agent-services.ts`)
  - `useAgentMessaging` (`src/tui/hooks/useAgent/use-agent-messaging.ts`)
  - `useAgentSync` (`src/tui/hooks/useAgent/use-agent-sync.ts`)

- **Shared Patterns:**
  - All hooks accept `options` and `state` as arguments.
  - Significant property drilling of `AgentOptions` and `AgentState`.
  - Repetitive return patterns for common handlers and side effects.

- **💡 Refactoring Suggestion:**
  - **Extract Context:** Create `AgentContext` to provide options and state to all sub-hooks. [DONE]
  - **Implement Context Hook:** Replace property drilling with a simple `useAgentContext()` call within sub-hooks. [DONE]
  - **Potential code reduction:** ~120 lines (~25% of hook logic).
  - **Effort:** Medium (2-3 hours).

### 2. LLM Agent Providers (0.83 similarity) [COMPLETED]

- **Status:** COMPLETED
- **Symbols:**
  - `GeminiAgentProvider` (`src/llm/providers/gemini/agent-provider.ts`)
  - `MinimaxAgentProvider` (`src/llm/providers/minimax/agent-provider.ts`)
  - `OpenAIAgentProvider` (`src/llm/providers/openai/agent-provider.ts`)
  - `ClaudeProvider` (`src/llm/providers/claude/agent-provider.ts`)

- **Shared Patterns:**
  - All implement the `AgentProvider` interface.
  - Redundant logic for handling tool calls, message buffers, and history orchestration.
  - Similar error handling and retry mechanisms.

- **💡 Refactoring Suggestion:**
  - **Create Base Class:** Develop `BaseLLMProvider` to encapsulate tool handling and state management. [DONE]
  - **Template Method Pattern:** Define abstract methods for provider-specific API interactions (e.g., `_generateContent`). [DONE]
  - **Potential code reduction:** ~250 lines (~30% of provider logic).
  - **Effort:** Medium-High (4-5 hours).

### 3. Orchestrators (0.81 similarity) [COMPLETED]

- **Status:** COMPLETED
- **Symbols:**
  - `GenesisOrchestrator` (`src/core/orchestrators/genesis.ts`)
  - `OverlayOrchestrator` (`src/core/orchestrators/overlay.ts`)
  - `UpdateOrchestrator` (`src/core/orchestrators/update.ts`)

- **Shared Patterns:**
  - All extend `BaseOrchestrator` and implement `IOrchestrator`.
  - Follow a consistent "fetch -> process -> update" lifecycle.
  - Identical logging and error propagation patterns.

- **💡 Refactoring Suggestion:**
  - **Composition over Inheritance:** Shift towards a "Pipeline" architecture for data extraction. [DONE]
  - **Generic Pipeline:** Implement a `GenericOrchestrator` that accepts interchangeable `DataFetcher` and `ResultProcessor` strategies. [DONE]
  - **Potential code reduction:** ~150 lines (~20% of orchestrator logic).
  - **Effort:** Medium (3-4 hours).

## 📊 Summary

- **Total opportunities found:** 3 groups (12 symbols)
- **Estimated total code reduction:** ~520 lines
- **Total estimated effort:** 9-12 hours
- **Primary benefit:** Improved DRY compliance, reduced boilerplate for new providers, and cleaner state management in TUI hooks.

---

_Analysis generated on 2026-02-28 using Cognition Σ Pattern Similarity Engine._

---

## Phase 2: Structural Pattern Discovery (March 2, 2026)

Analyzing structural patterns for additional refactoring opportunities using `cognition-cli patterns`...

🔍 **Refactoring Candidates Found:**

1. **Conversation Overlay Managers** (0.86 - 0.90 similarity) [COMPLETED]:
   - `ConversationOperationalManager` (src/sigma/overlays/conversation-operational/manager.ts) - DELETED
   - `ConversationMissionManager` (src/sigma/overlays/conversation-mission/manager.ts) - DELETED
   - `ConversationLineageManager` (src/sigma/overlays/conversation-lineage/manager.ts) - DELETED
   - `ConversationSecurityManager` (src/sigma/overlays/conversation-security/manager.ts) - DELETED
   - `ConversationStructuralManager` (src/sigma/overlays/conversation-structural/manager.ts) - DELETED
   - `ConversationCoherenceManager` (src/sigma/overlays/conversation-coherence/manager.ts) - DELETED
   - `ConversationMathematicalManager` (src/sigma/overlays/conversation-mathematical/manager.ts) - DELETED

   Shared Patterns:
   - All extend `BaseConversationManager`.
   - All implement identical `getOverlayId()`, `getOverlayName()`, and `extractAlignmentScores()` logic.
   - The primary differences are static configuration values (ID, Name, Keywords).
   - High structural similarity indicates significant boilerplate.

   💡 Refactoring Result:
   - **Generic Manager Factory**: Replaced individual classes with a single parameterized `ConversationOverlayManager` that accepts a configuration object.
   - **Data-Driven Approach**: Defined specific attributes (keywords, names, scoring logic) in `src/sigma/overlays/types.ts`.
   - Code reduction: ~800 lines (~70%)
   - Effort: Low-Medium (2-3 hours)
   - Status: Completed (March 2, 2026)

2. **Project Lattice (PGC) Pattern Managers** (0.75 - 0.83 similarity) [COMPLETED]:
   - `StructuralPatternsManager` (src/core/overlays/structural/patterns/manager.ts)
   - `OperationalPatternsManager` (src/core/overlays/operational/patterns/manager.ts)
   - `MissionConceptsManager` (src/core/overlays/mission/concepts/manager.ts)
   - `LineagePatternsManager` (src/core/overlays/lineage/patterns/manager.ts)
   - `SecurityGuidelinesManager` (src/core/overlays/security/guidelines/manager.ts)

   Shared Patterns:
   - Parallel structure to the Conversation Managers but for the project-level knowledge store.
   - Common patterns for querying the lattice and mapping results to domain-specific types.
   - 90% overlapping logic for LanceDB connectivity and semantic search.

   ⚠️ **Risk Level: HIGH** (Previous attempts failed due to subtle metadata differences and CLI regressions).

   💡 **Refactoring Strategy: Interface-Preserving Adapter**
   Instead of a "Big Bang" refactoring, use a phased inheritance-based approach to consolidate logic while preserving identical public interfaces and CLI output.

   🛡️ **Safe Refactoring Plan:**
   - **Phase 1: Golden Master Verification**:
     - Use `scripts/test_cli_golden_master.sh` to capture snapshots of ALL CLI command variations (sugar commands + all arguments, lattice queries).
     - Ensure 100% parity for JSON output before and after any change.
   - **Phase 2: Base Pattern Manager**:
     - Extract `BasePatternManager<T>` to handle common LanceDB operations and semantic search.
     - Keep domain-specific metadata mapping in the base class via generics.
   - **Phase 3: Incremental Migration (One-by-One)**:
     - Migrate `MissionConceptsManager` (O4) first as it is the simplest.
     - Follow with `StructuralPatternsManager` (O1), ensuring AST metadata remains intact.
     - Handle `LineagePatternsManager` (O3) last due to its custom dependency tracking logic.
   - **Phase 4: Registry Stability**:
     - Maintain the existing `OverlayRegistry` mapping (O1-O7) to ensure the Lattice Engine remains unaffected.

   - Potential code reduction: ~600 lines (~50%)
   - Effort: Medium-High (4-6 hours)
   - Status: COMPLETED (March 5, 2026)

   ✅ **Refactoring Achievements (Old vs New Architecture):**
   - **Old Architecture:** Each overlay (O1-O6) had its own monolithic `manager.ts` containing duplicated LanceDB connection logic, vector search, CRUD operations (add, list, delete), and mixed inline schema definitions.
   - **New Architecture:**
     - Extracted a unified `BasePatternManager<T>` that encapsulates all repetitive LanceDB and semantic search logic.
     - Extracted domain-specific metadata shapes into dedicated `metadata.ts` files, cleanly separating data representation from behavioral logic.
     - Individual overlay managers now only contain their specific configuration (Lattice Position, Table Name, etc.) and extend the base class.
   - **Key Improvements:**
     - **DRY Compliance:** Eliminated over 1,600 lines of duplicated boilerplate.
     - **Consistency:** Enforced uniform PGC algebra and strong typing across all overlays via generics (`BasePatternManager<T extends OverlayMetadata>`).
     - **Maintainability:** Fixes to DB interaction or semantic search only need to be applied once in the base class.
     - **Separation of Concerns:** Clear boundary between metadata shapes and operational logic.
     - **LESSON LEARNED (Flash Delegation Risk):** When delegating massive structural refactors to smaller/faster models (like Flash), be highly vigilant regarding _documentation loss_. Flash tends to aggressively prune JSDocs, interface comments, and inline domain documentation when optimizing for DRY compliance or moving code between files. Future refactoring prompts MUST explicitly mandate the preservation of all `/** ... */` comment blocks.

3. **Lance DB Stores** (0.81 - 0.85 similarity):
   - `DocumentLanceStore` (src/core/pgc/document/lance/store.ts)
   - `ConversationLanceStore` (src/sigma/conversation/lance/store.ts)
   - `LanceVectorStore` (src/core/services/embedding.ts - internal symbol)
   - `AbstractLanceStore` (src/core/pgc/store.ts)

   Shared Patterns:
   - Shared methods for initialization, vector search, and schema management.
   - All interact with `lancedb` using similar patterns for table creation and query execution.

   💡 Refactoring Suggestion:
   - **Enhance Abstract Base Class**: Pull more common logic (search, deletion, schema migration) into `AbstractLanceStore`.
   - **Generic `LanceStore<T>`**: Implement a fully generic store that handles the boilerplate of LanceDB interaction for any serializable type.
   - Potential code reduction: ~300 lines (~30%)
   - Effort: Medium (4-5 hours)

4. **Registries** (0.73 - 0.86 similarity):
   - `OverlayRegistry` (src/core/algebra/overlay/registry.ts)
   - `ConversationOverlayRegistry` (src/sigma/conversation/registry.ts)
   - `AgentRegistry` (src/llm/agents/registry.ts)
   - `ProviderRegistry` (src/llm/providers/registry.ts)

   Shared Patterns:
   - Standard `register()`, `get()`, `getAll()`, and `find()` method signatures.
   - Map-based storage with basic existence checks and error handling.

   💡 Refactoring Suggestion:
   - **Generic Registry Utility**: Create a `GenericRegistry<T>` class in `src/utils` or `src/core` to handle standard registration patterns.
   - Potential code reduction: ~150 lines (~40%)
   - Effort: Low (1 hour)

📊 Summary:

- Total opportunities found: 4 groups (22+ symbols)
- Estimated total code reduction: ~1,850 lines
- Total estimated effort: 10-13 hours
- Primary benefit: Drastic reduction in maintenance surface area and improved consistency across conversation and project analysis subsystems.
