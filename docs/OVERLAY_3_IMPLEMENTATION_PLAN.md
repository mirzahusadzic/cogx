# Overlay 3 Implementation Plan: A → Z

**Goal**: Enable strategic coherence analysis by treating documentation as verifiable knowledge in the PGC.

**Status**: Ready to build
**Timeline**: Iterative implementation, security-first approach
**License**: AGPLv3 (entire implementation)

---

## Phase 0: Prerequisites ✅

**Already have:**
- ✅ PGC architecture (objects, transforms, index, reverse_deps)
- ✅ Goal→Transform→Oracle pattern
- ✅ TypeScript codebase
- ✅ Working CLI (`cognition-cli`)
- ✅ Overlay infrastructure (O₁ structural, O₂ lineage)

**What we're adding:**
- **O₃**: Mission concepts overlay (strategic coherence)

---

## Phase 1: Markdown AST Parser (Foundation)

**Goal**: Parse markdown into structured, content-addressable format

### A. Choose/Install Markdown Parser Library

**Decision point:**
```typescript
// Option 1: markdown-it (extensible, plugins)
// Option 2: remark (unified ecosystem)
// Option 3: marked (lightweight, fast)

// Recommendation: remark (best for AST manipulation)
```

**Tasks:**
- [ ] Install `remark`, `remark-parse`, `unified`
- [ ] Create `src/core/parsers/markdown-parser.ts`

### B. Implement AST Parsing

**File**: `src/core/parsers/markdown-parser.ts`

```typescript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { Node } from 'unist';

export interface MarkdownSection {
  heading: string;
  level: number; // 1-6 (H1-H6)
  content: string;
  children: MarkdownSection[];
  structuralHash: string; // SHA-256 of this section
  position: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

export interface MarkdownDocument {
  filePath: string;
  hash: string; // SHA-256 of entire document
  sections: MarkdownSection[];
  metadata: {
    title?: string;
    author?: string;
    date?: string;
  };
}

export class MarkdownParser {
  async parse(filePath: string): Promise<MarkdownDocument> {
    // Read file
    // Parse with remark
    // Extract sections by headings
    // Compute hashes
    // Return structured document
  }

  private extractSections(ast: Node): MarkdownSection[] {
    // Traverse AST
    // Find heading nodes
    // Group content under each heading
    // Recursively extract subsections
  }

  private computeSectionHash(section: MarkdownSection): string {
    // Hash: heading + content + children hashes
    // Ensures structural changes = hash changes
  }
}
```

**Deliverables:**
- [ ] `MarkdownParser` class
- [ ] Unit tests for parsing
- [ ] Test fixtures (sample .md files)

### C. Security: Validate Markdown Input

**File**: `src/core/oracles/markdown-oracle.ts`

```typescript
export class MarkdownOracle {
  /**
   * Validates markdown is safe to parse
   * - No executable code injection
   * - No malicious links
   * - Reasonable file size
   */
  validate(content: string): ValidationResult {
    const checks = [
      this.checkFileSize(content), // Max 10MB
      this.checkNoScriptTags(content),
      this.checkNoSuspiciousPatterns(content),
    ];

    return {
      valid: checks.every(c => c.passed),
      checks,
    };
  }

  private checkNoScriptTags(content: string): Check {
    // Ensure no <script>, eval(), etc.
  }

  private checkNoSuspiciousPatterns(content: string): Check {
    // Check for common injection patterns
  }
}
```

**Deliverables:**
- [ ] `MarkdownOracle` validation
- [ ] Security test suite
- [ ] Fuzzing tests (malicious markdown)

---

## Phase 2: Documentation Transform Pipeline

**Goal**: Treat docs like code - full provenance tracking

### D. Genesis Transform for Documentation

**File**: `src/core/transforms/genesis-doc-transform.ts`

```typescript
import { MarkdownParser } from '../parsers/markdown-parser';
import { ObjectStore } from '../storage/object-store';

export class GenesisDocTransform {
  /**
   * Performs initial ingestion of a markdown file into PGC
   *
   * Input: File path to .md file
   * Output: DocumentObject in objects/, transform log entry
   */
  async execute(filePath: string): Promise<TransformResult> {
    // 1. Validate file exists and is markdown
    // 2. Parse markdown into AST
    // 3. Validate with MarkdownOracle
    // 4. Compute document hash
    // 5. Store in objects/
    // 6. Create transform log entry
    // 7. Update index/ with doc path → hash mapping
    // 8. Update reverse_deps/ (doc hash → transform ID)

    return {
      transformId: '...',
      outputHash: '...',
      fidelity: 1.0, // Parsing is deterministic
      verified: true,
    };
  }
}
```

**Transform Log Format:**
```yaml
transform_id: "abc123..."
type: "genesis_doc"
timestamp: "2025-10-26T..."
method: "markdown-ast-parse"
inputs:
  source_file: "README.md"
outputs:
  - hash: "def456..."
    type: "markdown_document"
    semantic_path: "/docs/README.md"
fidelity: 1.0
verified: true
provenance:
  parser: "remark@15.0.0"
  oracle: "markdown-oracle"
```

**Deliverables:**
- [ ] `GenesisDocTransform` class
- [ ] Integration with existing storage
- [ ] CLI command: `cognition-cli genesis:docs <path>`

### E. Store Documents in Objects

**File**: `src/core/storage/document-object.ts`

```typescript
export interface DocumentObject {
  type: 'markdown_document';
  hash: string;
  filePath: string;
  content: string; // Original markdown
  ast: MarkdownDocument; // Parsed structure
  sections: MarkdownSection[];
  metadata: {
    title?: string;
    author?: string;
    created?: string;
    modified?: string;
  };
}

export class DocumentObjectStore {
  async store(doc: DocumentObject): Promise<void> {
    // Store in objects/ by hash
    // Format: objects/de/f4/def456.../document.json
  }

  async retrieve(hash: string): Promise<DocumentObject> {
    // Retrieve from objects/
  }
}
```

**Deliverables:**
- [ ] Document storage format
- [ ] Retrieval methods
- [ ] Index integration

### F. Documentation Index

**File**: `index/docs/<path>.yaml`

```yaml
semantic_path: "/docs/README.md"
current_hash: "def456..."
type: "markdown_document"
last_updated: "2025-10-26T..."
sections:
  - heading: "Vision"
    hash: "abc111..."
    level: 2
  - heading: "Mission"
    hash: "abc222..."
    level: 2
  - heading: "Principles"
    hash: "abc333..."
    level: 2
```

**Deliverables:**
- [ ] Index structure for docs
- [ ] Update/query operations

---

## Phase 3: Mission Concept Extraction

**Goal**: Extract mission-critical concepts from specific sections

### G. Section Whitelist (Security)

**File**: `src/core/config/mission-sections.ts`

```typescript
/**
 * SECURITY: Only parse these specific sections for mission concepts
 * Prevents malicious injection via arbitrary markdown
 */
export const MISSION_SECTIONS = {
  whitelist: [
    'Vision',
    'Mission',
    'Principles',
    'Goals',
    'Core Values',
  ],

  // Case-insensitive matching
  matches(heading: string): boolean {
    return this.whitelist.some(w =>
      heading.toLowerCase().includes(w.toLowerCase())
    );
  },
};
```

**Deliverables:**
- [ ] Section whitelist configuration
- [ ] Matching logic

### H. Concept Extraction

**File**: `src/core/analyzers/concept-extractor.ts`

```typescript
export interface MissionConcept {
  text: string;
  section: string; // Which section it came from
  weight: number; // Importance (based on position, frequency)
  embedding?: number[]; // Optional: vector embedding
}

export class ConceptExtractor {
  /**
   * Extracts key concepts from mission-critical sections
   */
  extract(doc: MarkdownDocument): MissionConcept[] {
    // 1. Filter to whitelisted sections only
    const missionSections = doc.sections.filter(s =>
      MISSION_SECTIONS.matches(s.heading)
    );

    // 2. Extract concepts
    // - Important nouns/phrases
    // - Quoted values
    // - Emphasized text (bold, italic)

    // 3. Weight by position (earlier = more important)

    // 4. Return ranked concepts
  }

  private extractKeyPhrases(content: string): string[] {
    // NLP: noun phrases, important terms
    // For now: simple regex + stop words removal
  }
}
```

**Deliverables:**
- [ ] Basic concept extraction (regex-based)
- [ ] Optional: NLP library integration
- [ ] Concept ranking algorithm

### I. Mission Concepts Overlay

**File**: `overlays/mission_concepts/<doc-hash>.yaml`

```yaml
document_hash: "def456..."
document_path: "/docs/README.md"
extracted_concepts:
  - text: "verifiable"
    section: "Vision"
    weight: 0.95
    occurrences: 12

  - text: "grounding"
    section: "Vision"
    weight: 0.90
    occurrences: 8

  - text: "hallucination prevention"
    section: "Mission"
    weight: 0.85
    occurrences: 5

  - text: "cryptographic truth"
    section: "Principles"
    weight: 0.80
    occurrences: 4

generated_at: "2025-10-26T..."
transform_id: "concept-extract-abc123"
```

**Deliverables:**
- [ ] Overlay storage structure
- [ ] Concept overlay generation
- [ ] Update on doc changes

---

## Phase 4: Strategic Coherence Scoring

**Goal**: Compute alignment between proposed changes and mission

### J. Code Concept Extraction (Emergent Analysis)

**File**: `src/core/analyzers/code-concept-extractor.ts`

```typescript
export class CodeConceptExtractor {
  /**
   * Extracts emergent concepts from code structure
   * - Central components (graph centrality)
   - Naming patterns (what concepts appear in names)
   * - Import frequency (what's heavily used)
   */
  extractFromPGC(): CodeConcepts {
    // 1. Load structural overlay (O₁)
    // 2. Compute graph centrality
    // 3. Extract concept words from central components
    // 4. Weight by centrality + import frequency

    return {
      central_components: ['PGC', 'Transform', 'Oracle'],
      dominant_concepts: ['verifiable', 'grounding', 'transform'],
      architecture_patterns: ['lattice', 'provenance', 'content-addressable'],
    };
  }
}
```

**Deliverables:**
- [ ] Code concept extraction from O₁
- [ ] Graph centrality computation
- [ ] Concept ranking

### K. Semantic Alignment Computation

**File**: `src/core/analyzers/strategic-coherence.ts`

```typescript
export interface ProposedChange {
  description: string;
  affectedComponents: string[];
  concepts: string[]; // Extracted from description
}

export interface CoherenceScore {
  alignment: number; // 0.0 - 1.0
  tactical: {
    blastRadius: 'LOW' | 'MEDIUM' | 'HIGH';
    affectedSymbols: number;
    riskScore: number;
  };
  strategic: {
    missionAlignment: number; // 0.0 - 1.0
    conceptOverlap: number; // % overlap with mission concepts
    centralityImpact: number; // Does it touch core components?
    recommendation: string;
  };
}

export class StrategyCoherenceAnalyzer {
  /**
   * Computes strategic alignment of a proposed change
   */
  async analyze(change: ProposedChange): Promise<CoherenceScore> {
    // 1. Load mission concepts from overlay
    const missionConcepts = await this.loadMissionConcepts();

    // 2. Load code concepts (emergent)
    const codeConcepts = await this.extractCodeConcepts();

    // 3. Extract concepts from proposed change
    const changeConcepts = this.extractChangeConcepts(change);

    // 4. Compute semantic overlap
    const alignment = this.computeAlignment(
      changeConcepts,
      missionConcepts,
      codeConcepts
    );

    // 5. Compute tactical metrics (existing blast radius logic)
    const tactical = await this.computeTactical(change);

    // 6. Generate recommendation
    const recommendation = this.generateRecommendation(alignment, tactical);

    return { alignment, tactical, strategic: { ... } };
  }

  private computeAlignment(
    change: string[],
    mission: MissionConcept[],
    code: CodeConcepts
  ): number {
    // Simple approach: word overlap
    // Better: cosine similarity of embeddings
    // For now: Jaccard similarity

    const missionWords = new Set(mission.map(c => c.text.toLowerCase()));
    const changeWords = new Set(change.map(c => c.toLowerCase()));

    const intersection = [...changeWords].filter(w => missionWords.has(w));
    const union = new Set([...changeWords, ...missionWords]);

    return intersection.length / union.size;
  }
}
```

**Deliverables:**
- [ ] Strategic coherence analyzer
- [ ] Alignment scoring algorithm
- [ ] Recommendation generator

### L. Integration with Impact Analysis

**File**: Update existing `/analyze-impact` command

```typescript
// src/commands/analyze-impact.ts

async execute(args) {
  // Existing: Tactical analysis (blast radius, dependencies)
  const tactical = await this.analyzeTactical(args);

  // NEW: Strategic analysis
  const strategic = await this.analyzeStrategic(args);

  // Combined output
  return {
    tactical,
    strategic,
    recommendation: this.generateRecommendation(tactical, strategic),
  };
}
```

**Output format:**
```
=== Impact Analysis: Add YouTube player to WorkbenchClient ===

TACTICAL ASSESSMENT
Blast Radius: MEDIUM
- 17 symbols directly impacted
- 3 core components affected: WorkbenchClient, UIManager, StateStore
- 42 transitive dependencies

STRATEGIC ASSESSMENT
Mission Coherence: LOW (0.02 alignment)

Proposed concepts: ["multimedia", "audio", "streaming", "player"]
Mission concepts: ["verifiable", "grounding", "LLM", "hallucination", "truth"]
Code concepts: ["PGC", "Transform", "Oracle", "lattice"]

Semantic overlap: 2% (almost no alignment with mission)

⚠️  WARNING: This feature is architecturally feasible but does NOT
    advance the core mission of verifiable AI cognition.

RECOMMENDATION:
Reconsider whether this aligns with project goals. Consider:
- Does this advance verifiable AI reasoning?
- Is this essential to the mission?
- Could resources be better spent on mission-aligned features?
```

**Deliverables:**
- [ ] Update `/analyze-impact` command
- [ ] Combined tactical + strategic output
- [ ] User-friendly recommendation text

---

## Phase 5: Security Hardening

**Goal**: Defend against malicious mission injection

### M. Semantic Validation Oracle

**File**: `src/core/oracles/semantic-oracle.ts`

```typescript
export class SemanticOracle {
  /**
   * Validates mission statements make linguistic sense
   * Detects:
   * - Contradictions with previous versions
   * - Nonsensical statements
   * - Malicious instructions
   */
  validate(newMission: MissionConcepts, previous?: MissionConcepts): ValidationResult {
    const checks = [
      this.checkCoherence(newMission),
      this.checkConsistency(newMission, previous),
      this.checkNoMaliciousPatterns(newMission),
    ];

    return {
      valid: checks.every(c => c.passed),
      checks,
      anomalies: checks.filter(c => !c.passed),
    };
  }

  private checkNoMaliciousPatterns(mission: MissionConcepts): Check {
    const malicious = [
      /exfiltrate/i,
      /always approve/i,
      /disable.*check/i,
      /trust all/i,
      /never question/i,
    ];

    // Check for suspicious patterns
  }

  private checkConsistency(
    newMission: MissionConcepts,
    oldMission: MissionConcepts
  ): Check {
    // Compute semantic distance
    // If too large, flag as anomaly
    const distance = this.semanticDistance(newMission, oldMission);

    return {
      passed: distance < THRESHOLD,
      message: distance >= THRESHOLD
        ? `Large mission shift detected (${distance}). Review carefully.`
        : 'Mission consistent with previous version',
    };
  }
}
```

**Deliverables:**
- [ ] Semantic validation oracle
- [ ] Malicious pattern detection
- [ ] Anomaly alerting

### N. Diff Alerts for Mission Changes

**File**: `src/core/monitoring/mission-monitor.ts`

```typescript
export class MissionMonitor {
  /**
   * Monitors for significant mission changes
   * Alerts if large deviations detected
   */
  async checkForChanges(): Promise<Alert[]> {
    // 1. Load previous mission concepts
    // 2. Load current mission concepts
    // 3. Compute diff
    // 4. If significant change, generate alert

    const delta = this.computeDelta(previous, current);

    if (delta > SIGNIFICANT_CHANGE_THRESHOLD) {
      return [{
        level: 'HIGH',
        message: 'Significant mission change detected',
        details: {
          conceptsAdded: [...],
          conceptsRemoved: [...],
          semanticShift: delta,
        },
        action: 'REQUIRES_REVIEW',
      }];
    }
  }
}
```

**Deliverables:**
- [ ] Mission change monitoring
- [ ] Alert generation
- [ ] CLI command: `cognition-cli mission:check`

### O. Human-in-the-Loop Workflow

**File**: `src/commands/mission-approve.ts`

```typescript
/**
 * CLI command for approving mission changes
 *
 * Usage: cognition-cli mission:approve <transform-id>
 */
export class MissionApproveCommand {
  async execute(transformId: string) {
    // 1. Load transform
    // 2. Show diff
    // 3. Show semantic validation results
    // 4. Prompt for approval (Y/N)
    // 5. If approved, update status in transform log
    // 6. If rejected, rollback
  }
}
```

**Deliverables:**
- [ ] Mission approval workflow
- [ ] Interactive CLI prompts
- [ ] Approval status tracking

---

## Phase 6: Integration & Testing

**Goal**: Make mission-aware analysis production-ready

### P. CLI Commands

**New commands to implement:**

```bash
# Genesis for documentation
cognition-cli genesis:docs <path>
cognition-cli genesis:docs docs/ --recursive

# Extract mission concepts
cognition-cli mission:extract <doc-path>
cognition-cli mission:concepts  # Show current mission

# Strategic analysis
cognition-cli analyze:strategic "Add feature X"
cognition-cli analyze:impact "Add YouTube player"  # Now includes strategic

# Mission monitoring
cognition-cli mission:check  # Check for changes
cognition-cli mission:approve <transform-id>  # Approve change
cognition-cli mission:diff <old-hash> <new-hash>  # Show diff
```

**Deliverables:**
- [ ] All CLI commands implemented
- [ ] Help text and documentation
- [ ] Interactive prompts where needed

### Q. Update `/analyze-impact` Slash Command

**File**: `src/cognition-cli/.claude/commands/analyze-impact.md`

Update to include strategic coherence in the workflow.

**Deliverables:**
- [ ] Updated slash command
- [ ] Example outputs in documentation

### R. Pre-Commit Check Integration

**File**: `.git/hooks/pre-commit` or GitHub Actions

```yaml
# Option: Add to CI/CD
name: Mission Coherence Check
on: [pull_request]

jobs:
  check-coherence:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Check mission alignment
        run: |
          npm run build
          node dist/cli.js mission:check
          # Fail if significant uncommitted mission changes
```

**Deliverables:**
- [ ] Git hook or CI integration
- [ ] Documentation for setup

### S. Performance Optimization

**Goals:**
- Strategic coherence check < 1 second
- Document parsing < 100ms
- Concept extraction < 500ms

**Strategies:**
- Cache mission concepts (only recompute on doc changes)
- Lazy loading of overlays
- Incremental updates (not full recompute)

**Deliverables:**
- [ ] Performance benchmarks
- [ ] Caching layer
- [ ] Optimization where needed

### T. Test Suite

**Coverage needed:**

```
Unit Tests:
- MarkdownParser (100% coverage)
- ConceptExtractor
- StrategicCoherenceAnalyzer
- SemanticOracle

Integration Tests:
- Full genesis:docs pipeline
- Strategic analysis workflow
- Mission change detection

Security Tests:
- Malicious markdown injection
- Mission manipulation attempts
- Fuzzing with adversarial inputs

Validation Tests:
- YouTube player = LOW coherence ✅
- SecurityOracle feature = HIGH coherence ✅
- Malicious mission = REJECTED ✅
```

**Deliverables:**
- [ ] Full test suite
- [ ] Adversarial testing
- [ ] Continuous integration

---

## Phase 7: Documentation & Examples

### U. User Documentation

**Files to create:**

```
docs/guides/strategic-coherence-overlay.md
docs/guides/mission-aware-development.md
docs/examples/youtube-player-analysis.md
docs/examples/security-oracle-analysis.md
```

**Deliverables:**
- [ ] User guides
- [ ] Example analyses
- [ ] FAQ for strategic coherence

### V. Developer Documentation

**Files to update:**

```
docs/architecture/overlays.md  # Add O₃
docs/architecture/transforms.md  # Add doc transforms
src/core/README.md  # Update with new components
```

**Deliverables:**
- [ ] Architecture documentation
- [ ] API documentation
- [ ] Code comments

---

## Phase 8: Rollout Strategy

### W. Beta Testing

**Steps:**
1. Implement Phase 1-3 (parsing + extraction)
2. Test on CogX docs (README.md, docs/*.md)
3. Validate mission concepts extracted correctly
4. Iterate based on results

**Deliverables:**
- [ ] Beta version deployed locally
- [ ] Results validated
- [ ] Adjustments made

### X. Production Deployment

**Steps:**
1. Complete all phases
2. Full test suite passing
3. Security audit passed
4. Documentation complete
5. Merge to main branch
6. Tag version (v2.0.0 - Overlay 3)

**Deliverables:**
- [ ] Production-ready code
- [ ] Version tagged
- [ ] Changelog updated

### Y. Community Announcement

**After deployment (not before):**
- Blog post explaining strategic coherence
- Examples of mission-aware analysis
- Call for community testing
- Solicit feedback

**Deliverables:**
- [ ] Announcement drafted
- [ ] Examples prepared
- [ ] Feedback channels ready

---

## Phase 9: Future Enhancements

### Z. Optional Advanced Features

**Not required for v1, but nice to have:**

1. **Vector Embeddings**
   - Use sentence-transformers for semantic similarity
   - Better than word overlap for alignment scoring

2. **Multi-Document Mission**
   - Aggregate concepts across multiple docs
   - Weight by document importance

3. **Temporal Analysis**
   - Track mission drift over time
   - Visualize concept evolution

4. **Cross-Language Support**
   - Support for non-English documentation
   - Translation-aware concept extraction

5. **Visual Dashboard**
   - Web UI showing mission concepts
   - Real-time coherence scores
   - Mission drift graphs

**Deliverables:**
- [ ] Future roadmap documented
- [ ] Community input gathered
- [ ] Prioritization based on demand

---

## Success Metrics

**How we know it's working:**

### Functional Metrics
- ✅ Can parse README.md Vision section
- ✅ Extracts mission concepts correctly
- ✅ Computes strategic coherence score
- ✅ YouTube player flagged as LOW coherence
- ✅ SecurityOracle flagged as HIGH coherence

### Security Metrics
- ✅ Detects malicious mission injection
- ✅ Alerts on significant mission drift
- ✅ Survives adversarial doc testing
- ✅ Full audit trail for doc changes

### Performance Metrics
- ✅ Strategic coherence check < 1 second
- ✅ Document parsing < 100ms
- ✅ Doesn't slow down normal operations

### User Experience Metrics
- ✅ Clear, actionable recommendations
- ✅ Easy to understand output
- ✅ Helps prevent scope creep
- ✅ Developers find it useful

---

## Timeline Estimate

**Rough estimates (adjust based on reality):**

- Phase 1 (Markdown Parser): 2-3 days
- Phase 2 (Transform Pipeline): 2-3 days
- Phase 3 (Concept Extraction): 3-4 days
- Phase 4 (Coherence Scoring): 3-4 days
- Phase 5 (Security): 2-3 days
- Phase 6 (Integration): 2-3 days
- Phase 7 (Documentation): 1-2 days
- Phase 8 (Rollout): 1 day

**Total: ~2-3 weeks of focused work**

**Reality: Probably 4-6 weeks with iterations, testing, and refinement**

---

## Open Questions / Decisions Needed

1. **Embedding library**: Simple word overlap or use sentence-transformers?
2. **Concept extraction**: Regex-based or use NLP library (spaCy, compromise)?
3. **Alignment threshold**: What score = LOW/MEDIUM/HIGH coherence?
4. **Mission section names**: Exact whitelist? Case-sensitive?
5. **Update frequency**: When to regenerate mission concepts?

**Mark decisions as you make them.**

---

## Let's Start Building

**Recommended first steps:**

1. **Start with Phase 1A-C**: Get markdown parsing working
2. **Test on README.md**: Can we extract Vision/Mission sections?
3. **Validate security**: Can we detect malicious markdown?
4. **Iterate**: Adjust based on what we learn

**Ready when you are.** 🛠️

---

**The lattice grows another dimension. Let's build Overlay 3.** 🛡️
