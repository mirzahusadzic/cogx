# Refactoring Plan: Structural Similarity Harmonization

This plan outlines the steps to refactor key areas of the Cognition Σ repository identified through structural similarity analysis.

## 1. CLI Sugar Command Consolidation [COMPLETED]

**Status**: COMPLETED (March 18, 2026)

**Goal**: Reduce duplication in `src/commands/sugar/` and ensure consistent command behavior.

### High-Similarity Group (0.90 similarity)

- `proofsTheoremsCommand`, `proofsLemmasCommand` (src/commands/sugar/proofs.ts)
- `securityAttacksCommand`, `securityCVEsCommand` (src/commands/sugar/security.ts)
- `workflowCommand` (src/commands/sugar/workflow.ts)

### Implementation Results

1. **Infrastructure**: Created `src/commands/sugar/types.ts`, `src/commands/sugar/utils.ts`, and `src/commands/sugar/factory.ts`.
2. **Refactor**: Migrated `proofs.ts`, `security.ts`, and `workflow.ts` to use the new factory.
3. **Consolidation**: Reduced boilerplate by moving shared display logic (spinners, JSON output, list formatting) into `utils.ts`.

### Impact

- **~900 lines of code reduction** (Net project-wide).
- ~70% code reduction in the refactored files.
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

## 4. LanceDB Store Infrastructure

**Goal**: Consolidate redundant logic for managing LanceDB tables and sessions.

### High-Similarity Group (0.84 - 0.88 similarity)

- `AbstractLanceStore` (src/core/overlays/vector-db/abstract-lance-store.ts)
- `DocumentLanceStore` (src/core/pgc/document-lance-store.ts)
- `ConversationLanceStore` (src/sigma/conversation-lance-store.ts)
- `LanceVectorStore` (src/core/overlays/vector-db/lance-store.ts)

### Implementation Steps

1. **Enhance Abstract Class**: Move common PGC root resolution and table initialization logic from subclasses to `AbstractLanceStore`.
2. **Standardize Query Methods**: Create shared base methods for `search`, `add`, and `delete` operations that use the underlying table.
3. **Refactor Subclasses**: Update specialized stores to focus only on their unique record schemas and mapping logic.
4. **Validation**: Run `npm run test` focusing on LanceDB integration tests.

### Expected Impact

- ~180 lines of code reduction.
- Guaranteed consistency in how LanceDB tables are handled across the project and conversation lattices.

---

## 5. Registry Pattern Standardization

**Goal**: Create a reusable base for registry-like services to ensure consistent item management.

### High-Similarity Group (0.77 - 0.87 similarity)

- `OverlayRegistry` (src/core/algebra/overlay-registry.ts)
- `ConversationOverlayRegistry` (src/sigma/conversation-registry.ts)
- `ProviderRegistry` (src/llm/core/provider-registry.ts)
- `ExtractorRegistry` (src/core/analyzers/document-extractor.ts)

### Implementation Steps

1. **Create Base Registry**: Implement `src/core/common/base-registry.ts` with generic `register`, `get`, `list`, and `has` methods.
2. **Refactor Registries**: Update the identified registries to extend the base class.
3. **Harmonize Error Handling**: Use a standard `RegistryError` for missing or duplicate items.
4. **Validation**: Run `npm run build` and ensure all registries are correctly instantiated.

### Expected Impact

- ~150 lines of code reduction.
- Uniform interface for all plugin/extension points in the system.

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

**Goal**: Create a standard interface for interactive TUI panels.

### High-Similarity Group (0.80 - 0.85 similarity)

- `SigmaInfoPanelProps` (src/tui/components/info-panel.tsx)
- `LatticeViewProps` (src/tui/components/lattice-view.tsx)
- `CommandBarProps` (src/tui/components/command-bar.tsx)

### Implementation Steps

1. **Define IBaseComponentProps**: Create a shared interface for common TUI properties (width, height, focused, theme).
2. **Standardize Event Handlers**: Use consistent naming for interaction callbacks (onSelect, onClose, onAction).
3. **Apply Base Props**: Update functional and class components to extend the base property interface.
4. **Validation**: Run `npm run build` and check for visual regressions in the TUI.

### Expected Impact

- ~120 lines of code reduction.
- Easier creation of new TUI panels and more predictable component behavior.

---

## 📊 Summary

- **Total estimated code reduction**: ~1,120 lines (Increased from ~800)
- **Total estimated effort**: 16-22 hours
- **Primary benefit**: Comprehensive DRY compliance and architectural consistency across commands, overlays, stores, registries, analyzers, and UI components.
