# Utility & State Consolidation Spec

## 1. Overview

The current architecture suffers from "Utility Soup" (442 disconnected symbols) and "Split-Brain State Management" between the UI and Daemon. This spec defines the transition from procedural utilities and leaked TUI logic into domain-driven services and explicit state machines.

## 2. Refactoring Objectives

- **Consolidate Utility Soup**: Group 400+ disconnected procedural symbols into four primary domain services.
- **Formalize State Transitions**: Replace implicit session states with explicit, verifiable state machines.
- **TUI/Daemon Synchronization**: Unify UI state management to prevent race conditions during high-volume message events.
- **Decouple Core Engine**: Extract graph-walking, symbol queries, and token estimation from the Sigma engine into a specialized query service.
- **Maintain Stability**: Ensure zero breaking changes via a "Service-first, Wrapper-second" migration strategy.

## 3. Technical Debt (Current State)

- **Procedural Clusters**: 442 symbols identified in `patterns.json` are spread across `src/utils/`, `src/commands/`, and `src/core/algebra/` without formal ownership.
- **Leaked UI Logic**: TUI rendering logic is embedded in hooks (`src/tui/hooks/rendering/ToolFormatter.ts`) and command handlers.
- **Implicit State**: Session management in `src/sigma/session-state.ts` relies on fragmented boolean flags rather than a state machine.

## 4. Proposed Architecture (Detailed)

### A. Core Services

1. **TerminalFormatterService**
   - **Folder**: `src/core/services/terminal-formatter/`
   - **Scope**: ANSI manipulation (colors, styles), Markdown rendering to ANSI, JSON/Table formatting for CLI, and specialized string cleaning (e.g., `stripSigmaMarkers`).
   - **Key Patterns**: `hexToAnsi`, `formatTable`, `renderMarkdown`, `cleanIpcOutput`.

2. **EnvironmentService**
   - **Folder**: `src/core/services/environment/`
   - **Scope**: Centralized environment variable access, directory resolution (Sigma, PGC, Workbench), shell detection, and repository root discovery.
   - **Key Patterns**: `resolveSigmaDir`, `isWorkbench`, `getShellType`, `getRepoRoot`.

3. **SystemDiagnosticsService**
   - **Folder**: `src/core/services/diagnostics/`
   - **Scope**: Unified error formatting, verbose/debug logging state management, noise suppression for tool executors, and Progress Protocol emission.
   - **Key Patterns**: `suppressNoise`, `emitProgress`, `formatDiagnosticError`, `setDebugLevel`.

4. **LatticeQueryService**
   - **Folder**: `src/core/services/lattice-query/`
   - **Scope**: Cross-session and conversation queries, semantic similarity searches, symbol resolution across lattices, and graph-walking logic.
   - **Key Patterns**: `queryLattice`, `findSimilarNodes`, `resolveSymbol`, `walkDependencyGraph`.

### B. State Machines

1. **SessionStateMachine**
   - **Folder**: `src/core/state/session/`
   - **Scope**: Formalizes session lifecycle: `INITIALIZING` -> `ACTIVE` -> `TASK_PROCESSING` -> `PRUNING` -> `PERSISTING` -> `TERMINATED`.
   - **Responsibilities**: Manages task validation, log archiving, and rolling memory eviction logic.

2. **TUISyncStateMachine**
   - **Folder**: `src/core/state/tui-sync/`
   - **Scope**: Orchestrates synchronization between background agents and the TUI.
   - **Responsibilities**: Manages overlay scores, message queues, and onboarding wizard state transitions to ensure UI consistency during high-volume event streams.

## 5. Implementation Phases

### Phase 1: Service Extraction & Core Utilities (100% DONE)

- [x] Implement `TerminalFormatterService`, `EnvironmentService`, and `SystemDiagnosticsService` as singletons.
- [x] Migrate major utility files (`home-dir.ts`, `terminal-capabilities.ts`, `string-utils.ts`, `debug-logger.ts`).
- [x] Migrate remaining complex rendering logic from `src/utils/formatter.ts` (e.g., `createBox`, `tableRow`, `cleanText`) and `src/utils/error-formatter.ts` to their respective services.
- [x] Replace original utility implementations with `@deprecated` wrappers (mostly removed now).

### Phase 2: Lattice & Engine Decoupling (100% DONE)

- [x] Implement `LatticeQueryService`.
- [x] Migrate graph-walking and token estimation logic from `src/sigma/reconstructor.ts`.
- [x] Remove `src/sigma/reconstructor.ts` entirely.

### Phase 3: State Machine Implementation (IN PROGRESS)

- [x] Implement `SessionStateMachine` in `src/core/state/session/` to formalize the session lifecycle (INITIALIZING, ACTIVE, TASK_PROCESSING, etc.).
- [x] Refactor legacy `src/sigma/session-state.ts` as a proxy to the new Core State system, maintaining full backward compatibility.
- [x] Integrate session state transitions and task validation into `tool-executors.ts`.
- [x] Implement atomic disk persistence and legacy format migration in `SessionPersistence.ts`, with zero `any` usage.
- [ ] Implement `TUISyncStateMachine` in `src/core/state/tui-sync/`.

### Phase 4: Command & Hook Refactoring (PENDING)

- [ ] Update TUI hooks (`src/tui/hooks/`) to subscribe to `TUISyncStateMachine`.
- [ ] Update `AgentContext` and sugar commands to use new Core Services.

### Phase 5: Verification & Cleanup (IN PROGRESS)

- [ ] Run E2E tests for UI/Daemon synchronization.
- [x] Remove deprecated wrappers once all internal references are updated.

## 6. Refactoring Strategy & Safety

1. **Atomic Implementation**: One service/state machine per PR.
2. **JSDoc Preservation**: All JSDoc from `patterns.json` must be moved to the new service methods.
3. **No-Breaking Changes**: Use deprecated wrappers in `src/utils/` to maintain compatibility during migration.
4. **Self-Sufficient Loops**: Every change must pass `npm run build`, `npm run lint:changed`, and relevant tests.

## 7. Success Criteria

- [x] **Zero Procedural Soup**: Core infrastructure is DONE. 100% of patterns migrated to Core Services. Legacy wrappers removed.
- [x] **Type Safety**: All migrated code uses strict typing; zero `any` usage.
- [ ] **State Integrity**: Session lifecycle transitions are managed exclusively by the `SessionStateMachine`. (PENDING Phase 3)
- [ ] **UI/Daemon Synchronization**: TUI displays reflect current state without race conditions during event bursts. (PENDING Phase 3/4)
- [x] **Backward Compatibility**: Most deprecated wrappers are already removed as internal references were updated.
- [x] **Architectural Health**: Full build and E2E test suite pass without regressions.
