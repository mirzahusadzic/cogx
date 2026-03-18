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

## 2. Overlay Metadata & Schema Harmonization

**Goal**: Standardize the data structures for all PGC overlays.

### High-Similarity Group (0.81 similarity)

- `MathematicalProofsOverlay` (src/core/overlays/mathematical-proofs/metadata.ts)
- `OperationalPatternsOverlay` (src/core/overlays/operational-patterns/metadata.ts)
- `MissionConceptsOverlay` (src/core/overlays/mission-concepts/metadata.ts)

### Implementation Steps

1. **Define Base Interfaces**: Create `src/core/overlays/base-types.ts` with `IBaseOverlayMetadata` and `IBaseOverlayFindings`.
2. **Apply Generics**: Update individual overlay metadata files to extend these base types using generics for domain-specific fields.
3. **Harmonize Validation**: Implement a shared validation utility for metadata blocks.
4. **Validation**: Run `npm run test src/core/overlays/` to ensure no regressions in extraction/parsing.

### Expected Impact

- ~120 lines of code reduction.
- Easier creation of new overlays.

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

## 6. Document Extractor Hierarchy

**Goal**: Consolidate repetitive logic for markdown processing and pattern extraction.

### High-Similarity Group (0.81 - 0.83 similarity)

- `ProofExtractor` (src/core/analyzers/proof-extractor.ts)
- `SecurityExtractor` (src/core/analyzers/security-extractor.ts)
- `WorkflowExtractor` (src/core/analyzers/workflow-extractor.ts)

### Implementation Steps

1. **Extract BaseMarkdownExtractor**: Create a base class that handles file reading, markdown AST parsing (using `remark` or `unified` if applicable), and boilerplate extraction of standard metadata.
2. **Standardize Extractors**: Refactor specific extractors to only focus on their unique regex patterns or extraction rules.
3. **Harmonize Output Schemas**: Ensure all extractors return consistent types defined in `IBaseOverlayFindings`.
4. **Validation**: Run `npm run test` on the analyzer suite.

### Expected Impact

- ~200 lines of code reduction.
- Consistent extraction performance and reliability across different domain types.

---

## 7. TUI Component Prop Standardization

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

### Implementation Steps

1. **Define IBaseTUIProps**: Create `src/tui/types/props.ts` with:
   - `IBaseComponentProps`: `{ focused: boolean; layoutVersion?: string; }`
   - `IBasePanelProps extends IBaseComponentProps`: `{ sigmaStats?: SigmaStats; sessionTokenCount?: SessionTokenCount; width?: number; }`
   - `IBaseModalProps<T> extends IBaseComponentProps`: `{ state: T; onClose?: () => void; }`
2. **Standardize Event Handlers**: Use consistent naming for interaction callbacks (`onSubmit`, `onSelect`, `onAction`).
3. **Apply Base Props**: Update all TUI components to extend these base property interfaces.
4. **Validation**: Run `npm run build` and check for visual regressions in the TUI.

### Expected Impact

- ~250 lines of code reduction.
- Consistent property naming and lifecycle management across all TUI components.
- Improved type safety and easier creation of new interactive panels.

---

## 📊 Summary

- **Total code reduction to date**: ~2,340 lines
- **Remaining tasks**: 4 major refactoring candidate groups.
- **Estimated total future reduction**: ~800-1,000 lines.
