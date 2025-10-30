# Phase 2: Genesis Integration - Implementation Plan

> **Goal**: Complete the multi-overlay architecture by implementing document-type-aware routing in the genesis flow.

**Status**: Ready to implement
**Priority**: HIGH - Foundation for all future overlay work
**Estimated Effort**: 2-3 hours

---

## Current State Analysis

### ✅ What's Already Implemented

1. **Document Classification** (`src/core/analyzers/document-classifier.ts`)
   - Classifies markdown documents into types: `strategic`, `operational`, `mathematical`, `security`
   - Uses filename patterns, frontmatter, section structure, and content patterns
   - Returns confidence score and reasoning

2. **Extractor Registry** (`src/core/analyzers/document-extractor.ts`)
   - Routes documents to appropriate extractors based on type
   - Supports: StrategyExtractor, WorkflowExtractor, SecurityExtractor, ProofExtractor

3. **Overlay Managers** (all exist in `src/core/overlays/`)
   - ✅ `MissionConceptsManager` (O₄ - strategic documents)
   - ✅ `OperationalPatternsManager` (O₅ - workflow documents)
   - ✅ `SecurityGuidelinesManager` (O₂ - security documents)
   - ✅ `MathematicalProofsManager` (O₆ - formal proofs)
   - ✅ `StrategicCoherenceManager` (O₇ - alignment scoring)
   - ✅ `LineagePatternsManager` (O₃ - dependency tracking)

4. **GenesisDocTransform** (`src/core/transforms/genesis-doc-transform.ts`)
   - ✅ Classifies documents at line 102
   - ✅ Stores `documentType` in metadata at line 163
   - ❌ **DOES NOT** route to different overlay managers based on type
   - Currently only uses `MissionConceptsManager` for ALL documents

### ❌ What's Missing (Phase 2 Gaps)

1. **Document-Type Routing in GenesisDocTransform**
   - Need to route classified documents to appropriate overlay managers
   - Need to handle multiple overlays per document (e.g., security + mission)

2. **Overlay Manager Integration**
   - Import and instantiate O₂, O₅, O₆ managers in GenesisDocTransform
   - Call appropriate manager based on classification result

3. **Genesis Command Updates**
   - Ensure `genesis:docs` command properly triggers routing
   - Add logging to show which overlays are being generated

---

## Phase 2 Implementation Tasks

### Task 2.1: Add Overlay Manager Routing to GenesisDocTransform ⭐

**File**: `src/core/transforms/genesis-doc-transform.ts`

**Changes Needed**:

1. **Import overlay managers** (at top of file):

```typescript
import { OperationalPatternsManager } from '../overlays/operational-patterns/manager.js';
import { SecurityGuidelinesManager } from '../overlays/security-guidelines/manager.js';
import { MathematicalProofsManager } from '../overlays/mathematical-proofs/manager.js';
```

2. **Add manager instances to constructor**:

```typescript
private missionManager: MissionConceptsManager;
private operationalManager: OperationalPatternsManager;
private securityManager: SecurityGuidelinesManager;
private mathManager: MathematicalProofsManager;

constructor(private pgcRoot: string, workbenchUrl?: string) {
  // ... existing initialization ...
  this.missionManager = new MissionConceptsManager(pgcRoot, workbenchUrl);
  this.operationalManager = new OperationalPatternsManager(pgcRoot, workbenchUrl);
  this.securityManager = new SecurityGuidelinesManager(pgcRoot, workbenchUrl);
  this.mathManager = new MathematicalProofsManager(pgcRoot, workbenchUrl);
}
```

3. **Add routing method after line 205** (after execute() method):

```typescript
/**
 * Route document to appropriate overlay managers based on classification
 *
 * MULTI-OVERLAY ROUTING:
 * - strategic → O₄ (Mission Concepts)
 * - operational → O₅ (Operational Patterns)
 * - security → O₂ (Security Guidelines)
 * - mathematical → O₆ (Mathematical Proofs)
 *
 * Some documents may trigger multiple overlays (e.g., security + mission)
 */
private async routeToOverlays(
  classification: { type: DocumentType; confidence: number },
  ast: MarkdownDocument,
  filePath: string,
  contentHash: string,
  objectHash: string
): Promise<void> {
  const relativePath = relative(this.projectRoot, filePath);

  console.log(
    chalk.dim(`  [Routing] Generating overlays for ${classification.type} document...`)
  );

  try {
    switch (classification.type) {
      case DocumentType.STRATEGIC:
        // Route to O₄ Mission Concepts
        await this.generateMissionOverlay(ast, contentHash, objectHash, relativePath);
        break;

      case DocumentType.OPERATIONAL:
        // Route to O₅ Operational Patterns
        await this.generateOperationalOverlay(ast, contentHash, objectHash, relativePath);
        break;

      case DocumentType.SECURITY:
        // Route to O₂ Security Guidelines
        await this.generateSecurityOverlay(ast, contentHash, objectHash, relativePath);
        break;

      case DocumentType.MATHEMATICAL:
        // Route to O₆ Mathematical Proofs
        await this.generateMathematicalOverlay(ast, contentHash, objectHash, relativePath);
        break;

      default:
        console.log(chalk.yellow(`  [Warning] Unknown document type: ${classification.type}`));
    }
  } catch (error) {
    console.error(chalk.red(`  [Error] Failed to generate overlay: ${error instanceof Error ? error.message : 'Unknown error'}`));
    throw error;
  }
}

/**
 * Generate O₄ Mission Concepts overlay
 */
private async generateMissionOverlay(
  ast: MarkdownDocument,
  contentHash: string,
  objectHash: string,
  filePath: string
): Promise<void> {
  // Extract mission concepts using ConceptExtractor
  const extractor = new ConceptExtractor();
  const concepts = extractor.extract(ast);

  console.log(chalk.dim(`    ✓ O₄ Mission: Extracted ${concepts.length} concepts`));

  // Store in mission overlay (existing implementation)
  // TODO: Call missionManager.store() with appropriate format
}

/**
 * Generate O₅ Operational Patterns overlay
 */
private async generateOperationalOverlay(
  ast: MarkdownDocument,
  contentHash: string,
  objectHash: string,
  filePath: string
): Promise<void> {
  // Extract operational patterns using WorkflowExtractor
  const { WorkflowExtractor } = await import('../analyzers/workflow-extractor.js');
  const extractor = new WorkflowExtractor();
  const patterns = extractor.extract(ast);

  console.log(chalk.dim(`    ✓ O₅ Operational: Extracted ${patterns.length} patterns`));

  // Store in operational overlay
  // TODO: Call operationalManager.store() with appropriate format
}

/**
 * Generate O₂ Security Guidelines overlay
 */
private async generateSecurityOverlay(
  ast: MarkdownDocument,
  contentHash: string,
  objectHash: string,
  filePath: string
): Promise<void> {
  // Extract security guidelines using SecurityExtractor
  const { SecurityExtractor } = await import('../analyzers/security-extractor.js');
  const extractor = new SecurityExtractor();
  const guidelines = extractor.extract(ast);

  console.log(chalk.dim(`    ✓ O₂ Security: Extracted ${guidelines.length} guidelines`));

  // Store in security overlay
  // TODO: Call securityManager.store() with appropriate format
}

/**
 * Generate O₆ Mathematical Proofs overlay
 */
private async generateMathematicalOverlay(
  ast: MarkdownDocument,
  contentHash: string,
  objectHash: string,
  filePath: string
): Promise<void> {
  // Extract mathematical proofs using ProofExtractor
  const { ProofExtractor } = await import('../analyzers/proof-extractor.js');
  const extractor = new ProofExtractor();
  const knowledge = extractor.extract(ast);

  console.log(chalk.dim(`    ✓ O₆ Mathematical: Extracted ${knowledge.length} statements`));

  // Store in mathematical overlay
  // TODO: Call mathManager.store() with appropriate format
}
```

4. **Call routing in execute() method**:

Add after line 198 (after `recordMissionVersion`):

```typescript
// 14. Route to appropriate overlay managers based on document type
await this.routeToOverlays(classification, ast, filePath, hash, objectHash);
```

---

### Task 2.2: Verify Overlay Manager Store Methods ✅

**Check**: All overlay managers need a `store()` method that accepts extracted knowledge

**Files to verify**:

- `src/core/overlays/operational-patterns/manager.ts` - has `store()`?
- `src/core/overlays/security-guidelines/manager.ts` - has `store()`?
- `src/core/overlays/mathematical-proofs/manager.ts` - has `store()`?

**Action**: If missing, implement `store()` methods following MissionConceptsManager pattern

---

### Task 2.3: Update genesis:docs Command

**File**: `src/commands/genesis.ts` (or wherever genesis:docs is defined)

**Changes**:

- Ensure command passes `workbenchUrl` to GenesisDocTransform constructor
- Add logging to show overlay generation progress
- Display summary of which overlays were generated

---

### Task 2.4: Integration Testing

**Test Cases**:

1. **Strategic Document** (VISION.md)
   - Should generate O₄ Mission Concepts overlay
   - Verify `.open_cognition/overlays/mission_concepts/` has data

2. **Operational Document** (OPERATIONAL_LATTICE.md)
   - Should generate O₅ Operational Patterns overlay
   - Verify `.open_cognition/overlays/operational_patterns/` has data

3. **Security Document** (SECURITY.md)
   - Should generate O₂ Security Guidelines overlay
   - Verify `.open_cognition/overlays/security_guidelines/` has data

4. **Mathematical Document** (future ECHO_PROOFS.md)
   - Should generate O₆ Mathematical Proofs overlay
   - Verify `.open_cognition/overlays/mathematical_proofs/` has data

5. **Classification Accuracy**
   - Verify classifier correctly identifies each document type
   - Check confidence scores are reasonable (>0.7)

---

## Success Criteria

### Phase 2 Complete When

- [x] GenesisDocTransform routes documents to correct overlay managers
- [x] All 4 document types (strategic, operational, security, mathematical) generate appropriate overlays
- [x] `genesis:docs` command works with all document types
- [x] Overlay data is correctly stored in PGC structure
- [x] Tests pass for all document types

---

## Next Phase Preview

### Phase 3: Query Layer (Future)

Once Phase 2 is complete, we can build:

- Cross-overlay queries
- `cognition-cli workflow query "how to handle depth?"`
- `cognition-cli security query "threat models for input?"`
- `cognition-cli proofs query "theorems about coherence?"`

### Phase 4: Portability (Future)

After query layer:

- `.cogx` file format specification
- Export/import commands
- Dependency security inheritance
- Ecosystem seeding (React, TypeScript, etc.)

---

## Implementation Order

1. **Start**: Task 2.1 (Routing) - Core functionality
2. **Verify**: Task 2.2 (Store methods) - Prerequisites
3. **Test**: Task 2.4 (Integration) - Validate each overlay type
4. **Polish**: Task 2.3 (Command updates) - User experience

---

## Notes

- Classification is already working (line 102 in GenesisDocTransform)
- All overlay managers exist - just need to wire them up
- This is mostly plumbing, not complex logic
- Once routing works, phases 3 & 4 become straightforward

---

**Ready to implement? Start with Task 2.1 - add the routing logic to GenesisDocTransform.**
