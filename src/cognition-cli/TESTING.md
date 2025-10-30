# Testing Guide

## Test Status

✅ **18 test files passing**
✅ **85 tests passing** (1 skipped)
⚠️ 1 unhandled error (worker message issue - not critical)

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test src/core/pgc/manager.test.ts

# Watch mode
npm run test:watch
```

## What Can Be Tested Without eGemma

The following components can be tested without a running eGemma workbench:

### ✅ **Core PGC Layer**

- **Object Store** (`src/core/pgc/object-store.test.ts`) - Content-addressed storage
- **Reverse Dependencies** (`src/core/pgc/reverse-deps.test.ts`) - Dependency graph tracking
- **PGC Manager** (`src/core/pgc/manager.test.ts`) - Main PGC API
- **Overlay Oracle** (`src/core/pgc/oracles/overlay.test.ts`) - Validation logic

### ✅ **AST Parsing**

- **TypeScript Parser** (`src/core/orchestrators/miners/ast-parsers/typescript.test.ts`)
- **JavaScript Parser** (`src/core/orchestrators/miners/ast-parsers/javascript.test.ts`)

### ✅ **Document Processing**

- **Markdown Parser** (`src/core/parsers/markdown-parser.test.ts`)
- **Concept Extractor** (`src/core/analyzers/concept-extractor.test.ts`)
- **Genesis Doc Transform** (`src/core/transforms/genesis-doc-transform.test.ts`)

### ✅ **Orchestration**

- **Genesis** (`src/core/orchestrators/genesis.test.ts`)
- **Genesis GC** (`src/core/orchestrators/genesis.gc.test.ts`)
- **Overlay** (`src/core/orchestrators/overlay.test.ts`)

### ✅ **Overlays**

- **Structural Patterns** (`src/core/overlays/structural/patterns.test.ts`)
- **Lineage Worker** (`src/core/overlays/lineage/worker.test.ts`)
- **Interface Lineage** (`src/core/overlays/lineage/interface-lineage.test.ts`)
- **Strategic Coherence** (`src/core/overlays/strategic-coherence/manager.test.ts`)

### ✅ **Services**

- **Embedding Service** (`src/core/services/embedding.test.ts`) - Mocked embeddings

### ✅ **Commands**

- **Audit** (`src/commands/audit.test.ts`)

## What Requires eGemma

The following features require a running eGemma workbench instance:

### ⚠️ **Embedding Generation**

- Actual embedding calls (tests use mocks)
- Vector similarity with real embeddings

### ⚠️ **Overlay Generation**

- `structural_patterns` - Requires workbench for embeddings
- `security_guidelines` - Requires workbench for classification
- `lineage_patterns` - Requires workbench for embeddings
- `mission_concepts` - Requires workbench for concept embeddings
- `operational_patterns` - Requires workbench for pattern embeddings
- `mathematical_proofs` - Requires workbench for proof embeddings
- `strategic_coherence` - Requires workbench for alignment analysis

### ⚠️ **Lattice Queries**

- Real queries against populated overlays
- Semantic similarity operations with real embeddings

## Integration Testing (With eGemma)

When eGemma workbench is available, test the full stack:

### 1. Setup Test Project

```bash
# Initialize PGC
cognition-cli init

# Run genesis
cognition-cli genesis src

# Ingest docs
cognition-cli genesis:docs VISION.md
```

### 2. Generate All Overlays

```bash
# Use wizard for complete setup
cognition-cli wizard

# Or generate individually
cognition-cli overlay generate structural_patterns
cognition-cli overlay generate security_guidelines
cognition-cli overlay generate lineage_patterns
cognition-cli overlay generate mission_concepts
cognition-cli overlay generate operational_patterns
cognition-cli overlay generate mathematical_proofs
cognition-cli overlay generate strategic_coherence
```

### 3. Test Lattice Queries

```bash
# Simple queries
cognition-cli lattice "O1"
cognition-cli lattice "O1[function]"

# Set operations
cognition-cli lattice "O1 - O2"  # Coverage gaps
cognition-cli lattice "O1 + O2"  # Union
cognition-cli lattice "O1 & O2"  # Intersection

# Semantic operations
cognition-cli lattice "O2 ~ O4"  # Security aligned with mission
cognition-cli lattice "O5[workflow] ~ O4"  # Workflow alignment

# Complex queries
cognition-cli lattice "(O1 - O2) + O3"
cognition-cli lattice "O2[attacks] ~ O4[principles]"
```

### 4. Test Sugar Commands

```bash
# Security
cognition-cli security attacks
cognition-cli security coverage-gaps
cognition-cli security boundaries

# Workflow
cognition-cli workflow patterns
cognition-cli workflow quests --secure
cognition-cli workflow depth-rules

# Proofs
cognition-cli proofs theorems
cognition-cli proofs lemmas
cognition-cli proofs aligned

# Coherence
cognition-cli coherence report
cognition-cli coherence aligned
cognition-cli coherence drifted
```

## Test Coverage

Current test coverage focuses on:

- ✅ Core data structures and algorithms
- ✅ AST parsing and code analysis
- ✅ Document parsing and transformation
- ✅ PGC integrity and provenance
- ⚠️ **Limited**: Lattice algebra operations (internal functions)
- ⚠️ **Limited**: Overlay algebra adapters (require eGemma for real data)
- ❌ **Missing**: End-to-end query execution tests
- ❌ **Missing**: Sugar command unit tests

## Adding New Tests

### Unit Tests (No eGemma Required)

Create tests for pure functions and data structures:

```typescript
// src/core/YOUR_MODULE/YOUR_FILE.test.ts
import { describe, it, expect } from 'vitest';
import { yourFunction } from './YOUR_FILE.js';

describe('YourModule', () => {
  it('should do something', () => {
    const result = yourFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Integration Tests (Require eGemma)

For integration tests, mock the eGemma workbench:

```typescript
import { vi, beforeEach } from 'vitest';

beforeEach(() => {
  // Mock embedding service
  vi.mock('../services/embedding.js', () => ({
    getEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  }));
});
```

## CI/CD Considerations

For automated testing without eGemma:

1. ✅ Unit tests run automatically
2. ⚠️ Integration tests require eGemma instance
3. 💡 Consider mock eGemma server for CI

## Known Issues

### Worker Pool Error

```
Error: Unexpected message on Worker: 'ready'
```

This is a tinypool issue with Vitest and doesn't affect functionality. Can be safely ignored.

### Embedding Service

```
WORKBENCH_API_KEY not set. This is required for production.
```

This warning appears in tests but is expected when mocking embeddings.

## Future Testing

Planned test additions:

- [ ] Lattice algebra operation tests (if functions are exported)
- [ ] Overlay adapter unit tests (with mocked data)
- [ ] Sugar command translation tests
- [ ] Query parser comprehensive tests
- [ ] End-to-end workflow tests (with eGemma)
- [ ] Performance benchmarks
- [ ] Stress tests for large codebases
