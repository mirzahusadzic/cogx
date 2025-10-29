# Multi-Overlay Architecture: Separated Knowledge Layers

> _Each document type serves a different cognitive purpose and deserves its own overlay._

**Status**: Implemented (Foundation)
**Last Updated**: October 29, 2025

---

## The Problem: Conflated Knowledge Types

Previously, all markdown documents were ingested into a single `MissionConcepts` overlay (O₃). This conflated different types of knowledge:

- **Strategic documents** (VISION.md) → Mission alignment
- **Operational documents** (OPERATIONAL_LATTICE.md) → Workflow guidance
- **Mathematical documents** (future Echo proofs) → Formal properties
- **Security documents** (future SECURITY.md) → Threat models

**This mixing violated the separation principle that makes the PGC architecture powerful.**

---

## The Solution: Document-Type-Specific Overlays

### The Complete Overlay Taxonomy

```text
O₁ (Structure)     → Code artifacts (AST, dependencies, symbols)
O₂ (Security)      → Threat models, mitigations, constraints [FOUNDATIONAL]
O₃ (Lineage)       → Dependency graph, blast radius, call chains
O₄ (Mission)       → Strategic vision, purpose, goals, principles
O₅ (Operational)   → Workflow patterns, quest structure, sacred sequences
O₆ (Mathematical)  → Theorems, proofs, lemmas, formal properties
O₇ (Coherence)     → Cross-layer alignment scoring
```

**Key Change**: O₂ (Security) moved to foundational position - it's checked before mission alignment and can be inherited from dependencies.

---

## Architecture Components

### 1. Document Classifier

**Location**: `src/core/analyzers/document-classifier.ts`

Analyzes markdown documents using multiple signals:

1. **Filename patterns** (high confidence)
2. **Frontmatter metadata** (explicit type declaration - highest confidence)
3. **Section structure** (pattern matching on headings)
4. **Content patterns** (keyword density analysis)

**Classification Result**:

```typescript
{
  type: DocumentType;     // strategic | operational | mathematical | security
  confidence: number;     // 0-1
  reasoning: string[];    // Explainable classification
}
```

### 2. Extractor Registry

**Location**: `src/core/analyzers/document-extractor.ts`

Routes documents to appropriate extractors based on type:

```typescript
interface DocumentExtractor<T extends ExtractedKnowledge> {
  extract(doc: MarkdownDocument): T[];
  supports(docType: DocumentType): boolean;
  getOverlayLayer(): string;
}
```

### 3. Overlay-Specific Extractors

#### StrategyExtractor (O₄ Mission)

**Targets**: VISION.md, MISSION.md, strategic architecture docs
**Patterns**:

- Blockquotes (distilled essence)
- Bold value propositions
- Vision statements
- Principle declarations

#### WorkflowExtractor (O₅ Operational)

**Targets**: OPERATIONAL_LATTICE.md, workflow guides
**Patterns**:

- Quest structures (What/Why/Success)
- Sacred sequences (F.L.T.B, invariant steps)
- Depth rules (Depth 0-3 guidance)
- Workflow patterns (blocking, rebalancing)
- Terminology (Quest, Oracle, Scribe, AQS)
- Formulas (AQS calculation)

#### SecurityExtractor (O₂ Security)

**Targets**: SECURITY.md, THREAT_MODEL.md, vulnerability docs
**Patterns**:

- Threat models (attack scenarios)
- Attack vectors (exploit methods)
- Mitigations (countermeasures)
- Security boundaries (trust zones)
- Vulnerabilities (CVEs, known issues)

**PORTABILITY**: This layer can be exported/imported via `.cogx` files for security knowledge reuse across dependencies.

#### ProofExtractor (O₆ Mathematical)

**Targets**: Future Echo documents, formal proofs
**Patterns**:

- Theorems (formal statements)
- Lemmas (supporting propositions)
- Axioms (foundational truths)
- Proofs (derivations)
- Mathematical identities

---

## Storage Structure

```text
.open_cognition/
  overlays/
    mission_concepts/           # O₄ (Strategic)
      mission_concepts.lance

    operational_patterns/       # O₅ (Workflow)
      workflow_patterns.lance
      quest_structures.json
      sacred_sequences.json

    security_guidelines/        # O₂ (Security)
      threat_models.lance
      attack_vectors.json
      mitigations.json

    mathematical_proofs/        # O₆ (Formal)
      theorems.lance
      proofs.json
```

---

## Usage Example

### Document Classification

```typescript
import { DocumentClassifier } from './core/analyzers/document-classifier.js';
import { MarkdownParser } from './core/parsers/markdown-parser.js';

const classifier = new DocumentClassifier();
const parser = new MarkdownParser();

const doc = await parser.parse(
  'docs/overlays/O5_operational/OPERATIONAL_LATTICE.md'
);
const result = classifier.classify(
  doc,
  'docs/overlays/O5_operational/OPERATIONAL_LATTICE.md'
);

// Result:
// {
//   type: 'operational',
//   confidence: 0.9,
//   reasoning: ['Filename contains operational keywords', ...]
// }
```

### Knowledge Extraction

```typescript
import { WorkflowExtractor } from './core/analyzers/workflow-extractor.js';

const extractor = new WorkflowExtractor();
const patterns = extractor.extract(doc);

// Returns OperationalKnowledge[] with:
// - patternType: quest_structure | sacred_sequence | depth_rule | terminology
// - text: the extracted pattern
// - metadata: steps, formulas, examples
```

### Using the Registry

```typescript
import { createDefaultExtractorRegistry } from './core/analyzers/index.js';

const registry = createDefaultExtractorRegistry();
const extractor = registry.getExtractor(DocumentType.OPERATIONAL);

const knowledge = extractor.extract(doc);
```

---

## Security Layer Portability (O₂)

### The Reusability Vision

O₂ (Security) enables **security knowledge inheritance** across the dependency graph:

```bash
# Express.js maintainer exports security knowledge
cd express/
cognition-cli export cogx --include O2 --commit abc123
→ express-v4.18.2.cogx (includes threat models, mitigations)

# Your project imports express + security knowledge
cd your-app/
cognition-cli import dependency express-v4.18.2.cogx
→ Now you have express's security layer!

# Query combined security knowledge
cognition-cli security query "Safe input handling in express?"
→ Returns: express O₂ + your project O₂
```

### Security Composition

Projects inherit security knowledge from all dependencies:

```text
Your Project O₂
  ├── Your threat models
  ├── Your security patterns
  └── Imported from dependencies:
      ├── express → O₂ (CVEs, safe patterns)
      ├── pg → O₂ (SQL injection mitigations)
      └── jsonwebtoken → O₂ (token validation)
```

---

## Test Results

**Test**: OPERATIONAL_LATTICE.md classification and extraction

```text
Type: operational
Confidence: 90%+
Reasoning:
  - Filename contains operational keywords
  - Section structure matches operational patterns

Extracted 37 patterns:
  ✓ Quest structures (What/Why/Success)
  ✓ Depth rules (Depth 0-3)
  ✓ Sacred sequences (F.L.T.B)
  ✓ Workflow patterns (oracle/scribe rhythm)
  ✓ Terminology definitions (Quest, AQS, CoMP)
```

---

## Future Extensions

### O₈ (API Specifications)

- Contracts, schemas
- Endpoint documentation
- Request/response patterns

### O₉ (Test Strategies)

- Test patterns
- Coverage requirements
- Verification approaches

### O₁₀ (Performance Models)

- Complexity analysis
- Optimization patterns
- Performance constraints

---

## Design Principles

1. **Separation of Concerns**: Each document type → dedicated overlay
2. **Explainable Classification**: Every classification includes reasoning
3. **Extensibility**: Adding new overlay types is trivial (register new extractor)
4. **Portability**: Security (O₂) can be exported/imported across projects
5. **Backward Compatibility**: Existing ConceptExtractor still works for O₄

---

## Integration Roadmap

### Phase 1: Foundation (COMPLETE)

- ✅ DocumentClassifier implementation
- ✅ ExtractorRegistry system
- ✅ Four extractors (Strategy, Workflow, Security, Proof)
- ✅ Test validation

### Phase 2: Genesis Integration (NEXT)

- Modify `GenesisDocTransform` to route by document type
- Create overlay managers for O₅, O₂, O₆
- Update `genesis:docs` command to classify documents

### Phase 3: Query Layer

- Cross-overlay projection queries
- `cognition-cli workflow query "how to handle depth?"`
- `cognition-cli security query "threat models for input?"`

### Phase 4: Portability (.cogx Export/Import)

- Security layer export
- Dependency security inheritance
- Composite security queries

---

## Technical Notes

### Why O₂ is Foundational

Security was moved lower in the stack (O₂ instead of O₇) because:

- **Foundational**: Security constraints must be checked before mission alignment
- **Universal**: Every layer above needs security context
- **Portable**: Can be inherited from dependencies
- **Priority**: Security violations should block operations early

### Extractor Pattern Matching

Each extractor targets document-specific markdown patterns:

| Overlay           | Key Patterns                                      |
| ----------------- | ------------------------------------------------- |
| O₄ (Mission)      | Blockquotes, bold propositions, vision statements |
| O₅ (Operational)  | Quest structure, sequences, depth rules, formulas |
| O₂ (Security)     | Threat models, CVEs, mitigations, boundaries      |
| O₆ (Mathematical) | Theorems, proofs, axioms, identities              |

---

## Conclusion

The multi-overlay architecture transforms the PGC from a monolithic "mission concepts" system into a **layered cognitive substrate** where each document type contributes knowledge to its appropriate domain.

This enables:

- **Cleaner separation** of strategic, operational, security, and formal knowledge
- **Portable security** via `.cogx` dependency inheritance
- **Scalable growth** - adding O₈, O₉, O₁₀ is trivial
- **Precise queries** - "how to work?" vs "what to build?" vs "what's secure?"

The system is ready for Echo (O₆), ready for security inheritance (O₂), and ready for the operational guidance layer (O₅) to activate.

**The lattice has grown its soul.**
