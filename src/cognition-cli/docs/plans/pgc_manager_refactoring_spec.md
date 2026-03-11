# PGCManager Refactoring Technical Specification

This document provides a detailed technical blueprint for refactoring `src/core/pgc/manager.ts` into a Service/Facade architecture while adhering to the **JSDoc Preservation Rule**.

## 1. Component Mapping

### A. `PGCStoreContext` (Environment/Plumbing)

- **File**: `src/core/pgc/store-context.ts`
- **Responsibilities**: Path resolution, directory initialization, environment checks.
- **State**: `projectRoot`, `pgcRoot`.
- **JSDoc to Move**: The section of the class-level JSDoc describing the `.open_cognition/` directory structure.

### B. `PGCQueryService` (Read-only access)

- **File**: `src/core/pgc/query-service.ts`
- **Responsibilities**: Symbol search, object retrieval, lineage lookup.
- **Delegates to**: `Index`, `ObjectStore`, `Overlays`.
- **Key Methods**: `search`, `getStore`, `getLineageForSymbol`.
- **JSDoc to Move**: Method-level JSDocs for the above methods.

### C. `PGCIndexerService` (Write-heavy updates)

- **File**: `src/core/pgc/indexer-service.ts`
- **Responsibilities**: Updating the index, recording transformations, dependency graph maintenance.
- **Delegates to**: `TransformLog`, `ReverseDeps`, `Index`.
- **Key Methods**: `index`, `recordTransform`, `setEmbeddingRequestHandler`.
- **JSDoc to Move**: Method-level JSDocs for the above methods.

## 2. The Facade Pattern (PGCManager)

- **File**: `src/core/pgc/manager.ts` (Modified)
- **Role**: Maintains the existing API for 33+ components.
- **Structure**:

  ```typescript
  export class PGCManager {
    private queryService: PGCQueryService;
    private indexerService: PGCIndexerService;
    private context: PGCStoreContext;

    // Delegate methods
    public async search(...) { return this.queryService.search(...); }
    public async index(...) { return this.indexerService.index(...); }
    // ... etc
  }
  ```

## 3. JSDoc Preservation Checklist

- [x] **Class-Level Header**: The main `PGCManager` JSDoc (50+ lines) must remain in `manager.ts` but a version focused on "Architecture Overview" should be copied to the new services.
- [x] **Examples**: Ensure the `@example` blocks in the class-level JSDoc are updated to reflect the most common usage patterns (which should still work via the Facade).
- [x] **Method Docs**: When moving `index(...)` to `PGCIndexerService`, the entire `/** ... */` block must be moved with it. A simplified delegation JSDoc should be left in the Facade.

## 4. Migration Verification Sequence

1. **Extraction**: Create new files and move logic.
2. **Facade Update**: Point `PGCManager` methods to new services.
3. **Build & Test**: `npm run build && npm test src/core/pgc/manager.test.ts`.
4. **Blast Radius Check**: Run `npx ts-node src/commands/blast-radius.ts` to ensure no accidental breaks in dependency paths.
