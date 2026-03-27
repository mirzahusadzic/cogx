# Service Architecture Refactor Plan (March 2026)

This plan outlines the migration of core business logic from procedural orchestrators and CLI commands into a centralized service layer in `src/core/services`.

## 🎯 Goals

1. **Decoupling**: Separate "thinking" and "doing" logic from CLI command handling (`src/commands`) and high-level orchestrators (`src/core/orchestrators`).
2. **Testability**: Enable deep E2E and unit testing of core features without relying on CLI mocks or full orchestration loops.
3. **Consistency**: Establish a uniform naming and structure convention (e.g., `src/core/services/feature.ts` exports `FeatureService`).
4. **Reusability**: Allow different parts of the system (CLI, Agents, Web UI) to consume the same service logic.

## 🏗️ Phase 1: History & Integrity (High Priority)

Consolidate services related to PGC lineage, temporal history, and log compaction.

- **[COMPLETED]** `RehydrateService`: Moved to `src/core/services/lineage/rehydrate.ts`.
- **[COMPLETED]** `ProvenanceService`: Relocate from `src/core/lineage/provenance-service.ts` to `src/core/services/lineage/provenance.ts`.
- **[COMPLETED]** `TransformCompactor`: Refactor into `TransformCompactionService` in `src/core/services/lineage/compaction.ts`.

## 🧬 Phase 2: PGC Data Layer

Centralize the primary read/write APIs for the Grounded Context Pool.

- **[COMPLETED]** `PGCQueryService`: Relocate from `src/core/pgc/query-service.ts` to `src/core/services/pgc/query.ts`.
- **[COMPLETED]** `PGCIndexerService`: Relocate from `src/core/pgc/indexer-service.ts` to `src/core/services/pgc/indexer.ts`.
- **[COMPLETED]** `LatticeQueryService`: Standardize the existing service in `src/core/services/lattice/`.

## 🚀 Phase 3: Orchestrators as Services

Transform the heavy ingestion and maintenance loops into injectable services.

- **[COMPLETED]** `GenesisService`: Refactor `src/core/orchestrators/genesis.ts` and move to `src/core/services/orchestration/genesis.ts`.
- **[COMPLETED]** `IncrementalUpdateService`: Refactor `src/core/orchestrators/update.ts` and move to `src/core/services/orchestration/update.ts`.
- **[COMPLETED]** `PRAnalysisService`: Refactor `src/core/orchestrators/pr-analyzer.ts` and move to `src/core/services/vcs/pr-analyzer.ts`.

## 🛡️ Phase 4: Security & Validation

Move system auditors and validators to the central service layer.

- **[COMPLETED]** `MissionValidator`: Relocate from `src/core/security/mission-validator.ts` to `src/core/services/security/mission.ts`.
- **[COMPLETED]** `DriftDetector`: Refactor semantic drift logic into `src/core/services/security/drift.ts`.

## 📝 Conventions

1. **Hierarchy**: Group services by their functional domain or Overlay (e.g., `lineage/`, `pgc/`, `security/`, `vcs/`).
2. **Filenames**: Kebab-case, no `-service` suffix (e.g., `rehydrate.ts`, `provenance.ts`).
3. **Class Names**: PascalCase with `Service` suffix (e.g., `RehydrateService`, `ProvenanceService`).
4. **Imports**: Use explicit `.js` extensions as per project ESM standards.
5. **Wrappers**: CLI commands in `src/commands` should be thin wrappers that instantiate (or resolve) the service and call a single `execute()` or `run()` method.
