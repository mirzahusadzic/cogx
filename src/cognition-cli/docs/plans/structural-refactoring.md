# Refactoring Plan: Structural Similarity Harmonization

This plan outlines the steps to refactor key areas of the Cognition Σ repository identified through structural similarity analysis.

## 1. CLI Sugar Command Consolidation [COMPLETED]

**Status**: COMPLETED (March 18, 2026)

**Goal**: Reduce duplication in `src/commands/sugar/` and ensure consistent command behavior.

### High-Similarity Groups (0.85 - 0.95 similarity)

- **Phase 1 (Core)**: `proofs`, `security`, `workflow` (src/commands/sugar/)
- **Phase 2 (Coherence & Concepts)**: `coherence`, `concepts`, `security-coherence` (src/commands/)
- **Phase 3 (Secondary Candidates)**: `overlay list`, `patterns list`, `status`

### Implementation Results

1. **Infrastructure**: Created `src/commands/sugar/types.ts`, `src/commands/sugar/utils.ts`, and `src/commands/sugar/factory.ts`.
2. **Utilities**: Enhanced `displayItemList` with score bars, automated metadata detection, and standardized table formatting. Added shared `resolvePgcRoot` utility.
3. **Refactor**:
   - Migrated all sugar commands to use the metadata-driven `createSugarCommand` factory.
   - Unified `coherence.ts` and `sugar/coherence.ts`, reducing ~100 lines of manual display logic.
   - Moved and refactored `concepts.ts` to `sugar/concepts.ts`, standardizing its 5+ subcommands.
   - Refactored `security-coherence.ts` to use the factory with a `customHandler` for specialized reporting.
   - (Planned) Migrate `overlay list`, `patterns list`, and `status` to use the shared utilities.
4. **Harmonization**: Standardized JSON output, spinners, and workspace resolution across 15+ CLI commands.

### Impact

- **~1,500 lines of code reduction** (Net project-wide).
- ~75% code reduction in the refactored files.
- Unified CLI UX and simplified command creation.

---

## 2. Overlay Metadata & Schema Harmonization [COMPLETED]

**Status**: COMPLETED (March 19, 2026)

**Goal**: Standardize the data structures for all PGC overlays.

### High-Similarity Group (0.81 similarity)

- `MathematicalProofsOverlay` (src/core/overlays/mathematical-proofs/metadata.ts)
- `OperationalPatternsOverlay` (src/core/overlays/operational-patterns/metadata.ts)
- `MissionConceptsOverlay` (src/core/overlays/mission-concepts/metadata.ts)
- `SecurityMetadata` (src/core/overlays/security-guidelines/metadata.ts)

### Implementation Results

1. **Core Infrastructure**: Updated `src/core/overlays/base-types.ts` with `IBaseOverlayFinding`, `IBaseOverlayMetadata`, and the generic `IBaseOverlayFindings<T, K>` type for standardized YAML document structures.
2. **Metadata Migration**: Migrated `MathematicalMetadata`, `OperationalMetadata`, `MissionConcept`, and `SecurityMetadata` to use the standard `type` field, replacing legacy domain-specific fields like `statementType`, `patternType`, and `securityType`.
3. **Analyzer Harmonization**: Updated `ExtractedKnowledge` and all specific extractors (`ProofExtractor`, `StrategyExtractor`, `SecurityExtractor`, `WorkflowExtractor`) to use the unified `type` field and `IBaseOverlayFinding` interface.
4. **Manager Alignment**: Updated `MathematicalProofsManager`, `OperationalPatternsManager`, and `SecurityGuidelinesManager` to support the standardized metadata while maintaining backward compatibility for legacy fields during the transition.
5. **Validation**: Fixed build errors in `PRAnalyzer` and sugar commands (`security.ts`) that were using old field names. Verified with `npm run build` and targeted tests.

### Impact

- **~180 lines of code reduction** (Net project-wide).
- Consistent data access patterns across all 7 overlays.
- Simplified schema for PGC documents, making it easier to add new domain overlays.
- Improved type safety for cross-overlay queries and projections.

---

## 3. LLM Provider Base Logic Consolidation

**Goal**: Move common provider logic into the base class to reduce duplication.

### High-Similarity Group (0.80 similarity)

- `ClaudeProvider`, `OpenAIAgentProvider`, `MinimaxAgentProvider`

### Implementation Steps

1. **Enhance BaseAgentProvider**: Add common message conversion and token usage estimation methods to `BaseAgentProvider`.
2. **Standardize Usage Extraction**: Implement a default `extractUsage` method in the base class.
3. **Update Providers**: Refactor individual providers to call super methods for common tasks.
4. **Validation**: Run `npm run build` and targeted provider tests.

### Expected Impact

- ~100 lines of code reduction.
- Simpler implementation of new agent providers.

---

## 4. LanceDB Store Infrastructure [COMPLETED]

**Status**: COMPLETED (March 18, 2026)

**Goal**: Consolidate redundant logic for managing LanceDB tables and sessions.

### High-Similarity Group (0.84 - 0.88 similarity)

- `AbstractLanceStore` (src/core/common/lance-store.ts - now `BaseLanceStore`)
- `DocumentLanceStore` (src/core/pgc/document-lance-store.ts)
- `ConversationLanceStore` (src/sigma/conversation-lance-store.ts)
- `LanceVectorStore` (src/core/overlays/vector-db/lance-store.ts)

### Implementation Results

1. **Infrastructure**: Created generic `BaseLanceStore<T>` in `src/core/common/lance-store.ts` with thread-safe initialization, standardized CRUD, and built-in retry logic.
2. **Refactor**: Migrated `LanceVectorStore`, `ConversationLanceStore`, and `DocumentLanceStore` to the new foundation.
3. **Harmonization**: Standardized `initialize()`, `getSchema()`, and `createDummyRecord()` patterns. Added automatic initialization in `ensureInitialized()`.
4. **Validation**: Verified with 53 unit tests across 4 major store suites. Deleted obsolete `AbstractLanceStore`.

### Impact

- **~340 lines of code reduction** (Net project-wide).
- Guaranteed consistency in how LanceDB tables are handled across the project and conversation lattices.
- Robust, thread-safe initialization prevents race conditions in multi-agent environments.

---

## 5. Registry Pattern Standardization [COMPLETED]

**Status**: COMPLETED (March 18, 2026)

**Goal**: Create a reusable base for registry-like services to ensure consistent item management.

### High-Similarity Group (0.77 - 0.87 similarity)

- `OverlayRegistry` (src/core/algebra/overlay-registry.ts)
- `ConversationOverlayRegistry` (src/sigma/conversation-registry.ts)
- `ProviderRegistry` (src/llm/core/provider-registry.ts)
- `AgentRegistry` (src/ipc/AgentRegistry.ts)
- `ASTParserRegistry` (src/core/orchestrators/miners/ast-parsers/index.ts)
- `ExtractorRegistry` (src/core/analyzers/document-extractor.ts)

### Implementation Results

1. **Infrastructure**: Created `src/core/common/registry.ts` with `BaseRegistry<T>`, `AsyncBaseRegistry<T>`, and `RegistryError`.
2. **Refactor**: Migrated all 6 identified registries to extend these base classes.
3. **Harmonization**: Standardized `get()`, `register()`, `list()`, and `has()` across the system. Added `tryGet()` for safe lookups and unified error messages.
4. **Validation**: Verified with 63 unit tests across 3 major registry suites.

### Impact

- **~500 lines of code reduction** (Net project-wide).
- Unified interface for all plugin/extension points in the system.
- Improved error reporting with "available items" context.

---

## 6. Document Extractor Hierarchy [COMPLETED]

**Status**: COMPLETED (March 19, 2026)

**Goal**: Consolidate repetitive logic for markdown processing and pattern extraction.

### High-Similarity Group (0.81 - 0.83 similarity)

- `ProofExtractor` (src/core/analyzers/proof-extractor.ts)
- `SecurityExtractor` (src/core/analyzers/security-extractor.ts)
- `WorkflowExtractor` (src/core/analyzers/workflow-extractor.ts)
- `ConceptExtractor` (src/core/analyzers/concept-extractor.ts)
- `StrategyExtractor` (src/core/analyzers/strategy-extractor.ts)

### Implementation Results

1. **Core Infrastructure**: Introduced `BaseMarkdownExtractor<T>` abstract base class in `src/core/analyzers/document-extractor.ts`. Centralized recursive section traversal, position-based weighting (1.0 - 0.6), and normalized deduplication logic.
2. **Extractor Consolidation**:
   - Refactored `ProofExtractor`, `SecurityExtractor`, and `WorkflowExtractor` to extend `BaseMarkdownExtractor`, reducing them to domain-specific extraction logic.
   - Merged `StrategyExtractor` into `ConceptExtractor` to unify O₄ (Mission) extraction.
   - Refactored `ConceptExtractor` to extend the base class and integrated strategic type inference (vision, mission, principle, goal, value).
3. **Type Harmonization**: Updated `ExtractedKnowledge` hierarchy and `MissionConcept` interface to extend `StrategyKnowledge`, ensuring consistent data flow between extractors, managers, and PGC storage.
4. **Integration**: Updated `MissionConceptsManager` and `EmbeddingLoader` to handle standardized metadata and the new required `type` field.
5. **Validation**: Verified with successful `npm run build`, `npm run lint:changed`, and passing unit tests for the updated extractors.

### Impact

- **~450 lines of code reduction** (Net project-wide).
- Unified extraction behavior across all markdown-based overlays.
- Simplified maintenance: Improvements to the base class (like better deduplication or weighting) now benefit all extractors simultaneously.
- Eliminated redundant traversal logic and improved performance through efficient recursive patterns.

---

## 7. TUI Component Prop Standardization [COMPLETED]

**Status**: COMPLETED (March 19, 2026)

**Goal**: Create a standard interface for interactive TUI components and panels.

### High-Similarity Group (0.80 - 0.95 similarity)

- **Panels**:
  - `SigmaInfoPanelProps` (src/tui/components/SigmaInfoPanel.tsx)
  - `SigmaTaskPanelProps` (src/tui/components/SigmaTaskPanel.tsx)
  - `OverlaysBarProps` (src/tui/components/OverlaysBar.tsx)
  - `StatusBarProps` (src/tui/components/StatusBar.tsx)
- **Modals**:
  - `ToolConfirmationModalProps` (src/tui/components/ToolConfirmationModal.tsx)
  - `WizardConfirmationModalProps` (src/tui/components/WizardConfirmationModal.tsx)
  - `CommandDropdownProps` (src/tui/components/CommandDropdown.tsx)
- **Inputs/Interactions**:
  - `InputBoxProps` (src/tui/components/InputBox.tsx)
  - `ClaudePanelAgentProps` (src/tui/components/ClaudePanelAgent.tsx)

### Implementation Results

1. **Infrastructure**: Created `src/tui/types/props.ts` with generic `IBaseComponentProps`, `IBasePanelProps`, and `IBaseModalProps<T>`.
2. **Refactor**:
   - Migrated all panels (`SigmaInfoPanel`, `SigmaTaskPanel`, `OverlaysBar`, `StatusBar`) to extend `IBasePanelProps`.
   - Migrated all modals (`ToolConfirmationModal`, `WizardConfirmationModal`, `CommandDropdown`) to extend `IBaseModalProps<T>`.
   - Standardized interaction components (`InputBox`, `ClaudePanelAgent`, `Siggy`) to use `IBaseComponentProps`.
3. **Harmonization**: Standardized `focused` and `layoutVersion` across the entire TUI. Unified naming for event handlers and callbacks.
4. **Validation**: Verified with `npm run build` and targeted tests. Standardized empty interfaces to type aliases for strict lint compliance.

### Impact

- **~280 lines of code reduction** (Net project-wide).
- Consistent property naming and lifecycle management across all TUI components.
- Improved type safety and easier creation of new interactive panels.

---

## 📊 Summary

- **Total code reduction to date**: ~3,250 lines
- **Remaining tasks**: 1 major refactoring candidate group.
- **Estimated total future reduction**: ~100-200 lines.
