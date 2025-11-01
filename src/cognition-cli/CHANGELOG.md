# Changelog

All notable changes to the CogX Cognition CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.8.0] - 2025-11-01

### 🎉 Self-Cognition - "The Lattice Explains Itself"

This release achieves **Block 4 (Self-Cognition)** - the system can now query and explain its own knowledge. The new `ask` command enables natural language queries across the entire knowledge lattice with semantic synthesis and provenance tracking. **15 commits** spanning semantic Q&A, frontmatter validation, enhanced extraction, quest logging, and documentation.

### Major Features

#### 1. Semantic Q&A System - `cognition-cli ask`

The flagship feature enabling true self-cognition through natural language queries:

- **Natural language queries** across the entire knowledge lattice
  - Example: `cognition-cli ask "what is cPOW used for?"`
  - Cross-overlay synthesis (queries O₁-O₇ simultaneously)
  - 2-3 second response times
- **Semantic matching with confidence scores**
  - Each source shows match percentage (e.g., "71.8% match")
  - Results ranked by semantic relevance
  - Pulls from multiple overlays for comprehensive answers
- **Synthesized answers with provenance**
  - AI-generated answer combining all relevant sources
  - Source citations with overlay tags (O₄, O₅, O₁, etc.)
  - Complete transparency of knowledge lineage
- **Multi-overlay semantic search**
  - Automatically searches across all relevant overlays
  - Cross-layer synthesis (Chapter 11 - O₇ Coherence in action)
  - Intelligent source selection and ranking

**Implementation:**
- `src/commands/ask.ts` - New command entry point
- Enhanced `QueryService` with semantic Q&A capabilities
- Integration with existing overlay infrastructure
- Reuses semantic embeddings from PGC

#### 2. 100% Classification Confidence

YAML frontmatter infrastructure for authoritative document metadata:

- **Frontmatter-based classification**
  - Parser extracts YAML frontmatter using js-yaml
  - Frontmatter treated as authoritative (1.0 confidence)
  - Overrides ML-based classification when present
- **All 15 manual documents validated**
  - Each doc has explicit `type` and `overlay` metadata
  - 100% classification confidence across entire manual
  - Validation enforces 75% threshold
- **Validation infrastructure**
  - `test-manual-classification.ts` validator
  - Ensures all manual docs meet quality threshold
  - Prevents regression in document classification

**Example frontmatter:**
```yaml
---
type: architectural
overlay: O4_Mission
---
```

#### 3. Enhanced Document Extraction

Generalized extraction system for comprehensive documentation capture:

- **WorkflowExtractor generalized**
  - Now handles all documentation types (not just workflows)
  - Section heading-based extraction
  - Captures explanatory content ("What is X?" sections)
- **"What is X?" extraction fixed**
  - Properly extracts definition sections
  - Preserves context from section headings
  - Better semantic chunking
- **Force re-ingestion support**
  - `genesis:docs --force` flag added
  - Allows document updates without PGC reset
  - Useful for iterative documentation improvements

#### 4. Quest Operations Logging (Block 2 - Lops)

Infrastructure for transparency logging and quest execution tracking:

- **Transparency logging system**
  - Logs all quest operations to `.open_cognition/logs/`
  - Tracks command execution, duration, and outcomes
  - Foundation for cPOW lineage tracking
- **Quest execution provenance**
  - Links operations to specific quests
  - Enables audit trail for cognitive work
  - Supports Block 2 (Lops) requirements

#### 5. Sacred Pause Formalization

Documentation of the three Oracle Meeting Points:

- **Oracle Meeting Points documented**
  - Three-phase decision framework
  - Depth-based quality gates
  - Formalized pause criteria
- **Integration with quest mechanics**
  - Links to F.L.T.B validation
  - PGC coherence checks
  - Security mandate verification

### Added

#### Commands

- `ask "<question>"` - Query knowledge lattice in natural language
  - Cross-overlay semantic search
  - Synthesized answers with source citations
  - Confidence scoring and ranking

#### Features

- **YAML frontmatter parsing** in MarkdownParser
- **Frontmatter-authoritative classification** in DocumentClassifier
- **Generic WorkflowExtractor** for all documentation types
- **Force flag** for `genesis:docs` command (`--force`)
- **Increased token limits** (8192) for large document ingestion
- **Enhanced semantic shadows** in query results
- **Section heading extraction** for better context capture

### Changed

- **Token limits increased** from 4096 to 8192 for Anthropic API calls
- **Semantic shadow inclusion** in query results (previously excluded)
- **WorkflowExtractor** made generic (renamed conceptually to handle all docs)

### Fixed

- **"What is X?" extraction** now properly captures definition sections
- **Semantic shadows** now correctly included in `ask` query results
- **Section heading context** preserved during extraction
- **Large document ingestion** no longer truncated (increased token limit)

### Documentation

- **Chapter 5: CLI Operations** added to reference manual
- **Comprehensive README update** reflecting seven-overlay architecture
- **Sacred Pause formalization** in operational documentation
- **Oracle Meeting Points** documented

### Performance

- **2-3 second query response times** for semantic Q&A
- **Reuses existing embeddings** from PGC (no re-embedding)
- **Efficient cross-overlay search** using optimized vector queries

### Validation

Quest verification metrics for this release:
- **F.L.T.B**: Format ✅ Lint ✅ Test ✅ Build ✅
- **PGC**: All 15 manual documents at 100% classification confidence
- **Tests**: All passing
- **Coherence**: Maintained lattice coherence

---

## [1.7.5] - 2025-10-31

### 🎉 Complete 7-Overlay Lattice System - "The Foundation Manual"

This release represents the **complete implementation** of the 7-overlay cognitive lattice architecture with comprehensive documentation, algebra operations, and security hardening. **35 commits** spanning lattice algebra, multi-overlay routing, complete overlay support, 8 new manual chapters, and security enhancements.

### Major Features

#### 1. Lattice Algebra System

- **ASCII query syntax** for Boolean operations across overlays
  - Set operations: `O1 ∩ O2` (intersection), `O1 ∪ O2` (union), `O1 - O2` (difference)
  - Tag filtering: `O2[critical]`, `O4[mission-alignment]`
  - Concept search: `O4 ~ "verification"` (semantic similarity)
  - Coherence queries: `O7[coherence>0.8]`
- **Complete OverlayAlgebra implementation** for all 7 overlays (O₁-O₇)
- **OverlayRegistry** for dynamic overlay discovery and composition
- **Query parser** with full lattice operation support

#### 2. Phase 2 Multi-Overlay Document Routing

- **Intelligent document classification** using confidence thresholds
  - Strategic documents → O₄ Mission Concepts
  - Security documents → O₂ Security Guidelines
  - Operational documents → O₅ Operational Patterns
  - Mathematical documents → O₆ Mathematical Proofs
- **Automatic overlay generation** based on document type
- **Content-addressable storage** with provenance tracking

#### 3. Complete 7-Overlay System

- **O₁ Structure**: Code artifacts and AST patterns
- **O₂ Security**: Threat models, CVEs, mitigations (NEW: full CLI support)
- **O₃ Lineage**: Dependency tracking and blast radius
- **O₄ Mission**: Strategic concepts and principles
- **O₅ Operational**: Workflow patterns and quests
- **O₆ Mathematical**: Formal proofs and theorems
- **O₇ Coherence**: Cross-layer synthesis and drift detection
- **Sugar commands** for intuitive access to each overlay

#### 4. Foundation Manual (900+ pages)

Eight comprehensive chapters documenting the complete system:

- **Chapter 4.5**: Core Security - protecting the lattice
- **Chapter 5**: O₁ Structure - code artifacts
- **Chapter 6**: Security implementation details
- **Chapter 7**: O₃ Lineage - dependency tracking
- **Chapter 8**: O₄ Mission - strategic concepts
- **Chapter 9**: O₅ Operational - workflow guidance
- **Chapter 10**: O₆ Mathematical - formal properties
- **Chapter 11**: O₇ Coherence - cross-layer synthesis
- **Chapter 20**: cPOW Reference Manual - cryptographic proof of work

#### 5. O₂ Security Layer

- **Security commands**: `security list`, `security query`, `security cves`
- **Lattice algebra integration**: `O2[critical]`, `O2 - O1` (coverage gaps)
- **THREAT_MODEL.md**: 20 real security threats for cognition-cli
  - Mission Document Poisoning (CRITICAL)
  - Command Injection (CRITICAL)
  - PGC Data Tampering (CRITICAL)
  - Path Traversal (HIGH)
  - API Key Exposure (MEDIUM)
- **Security coherence metrics**: Dynamic mission alignment tracking
- **SecurityExtractor**: Multi-field structured threat parsing
- **Dual-use acknowledgment system**: Minimal security bootstrap

#### 6. Performance Optimizations

- **Eliminate double embedding**: Reuse embeddings from mission validation
- **Core bottleneck fixes**: Faster overlay generation
- **Improved wizard performance**: Better progress indicators

#### 7. Enhanced Wizard

- **Generate all 7 overlays** in one command
- **Ingest overlay template docs** from `docs/overlays/`
- **Better UX**: Improved prompts and progress tracking
- **Storage measurements**: Accurate PGC size reporting

### Added

#### Commands

- `lattice <query>` - Execute Boolean algebra operations across overlays
- `overlays` - Show available overlays and their data status
- `security list` - List all security knowledge in O₂ overlay
- `security query <term>` - Search security knowledge by text
- `security cves` - List tracked CVEs
- `security attacks` - Show attack vectors conflicting with mission
- `security coverage-gaps` - Show code without security coverage
- `security boundaries` - Show security boundaries and constraints
- `security coherence` - Show security implementation alignment
- `security mandate` - Display the Dual-Use Technology Mandate
- `workflow patterns` - Show workflow patterns
- `workflow quests` - Show quest structures
- `workflow depth-rules` - Show depth rules
- `proofs theorems` - Show all theorems
- `proofs lemmas` - Show all lemmas
- `proofs list` - Show all mathematical statements
- `proofs aligned` - Show proofs aligned with mission
- `concepts search <term>` - Search mission concepts

#### Features

- **Recursive section processing** in SecurityExtractor for nested markdown
- **Multi-field structured threat parsing** (Threat/Severity/Attack/Impact/Mitigation)
- **Mission alignment headers** on security classes (MissionValidator, etc.)
- **PGC explanation headers** in init/status commands
- **Workbench API key warning** deferred until actual use (no spurious warnings)
- **Comprehensive testing guide** (docs/TESTING.md)
- **Lattice algebra guide** with quest-oriented commands

### Changed

- **VISION.md relocated** to `docs/overlays/O4_mission/` (rightful home)
- **Coherence report** with accurate drift calculation
- **Algebra-based coherence** integrated into main coherence command
- **Wizard PGC exists prompt** improved with clear options

### Fixed

- **SecurityExtractor** now handles nested markdown sections (extracted 0 → 20 guidelines)
- **TypeScript linter errors** resolved across codebase
- **Wizard template docs** ingestion from correct path
- **TOC anchor** for section 10 in Chapter 4.5
- **Metadata rendering** in foundation manual chapters

### Security

- **Minimal dual-use acknowledgment** on first run
- **Mission alignment tracking** for security classes
- **Threat model documentation** with 20 real security threats
- **Transparency logging** for all security operations

### Documentation

- 8 new foundation manual chapters (900+ pages)
- Comprehensive lattice algebra guide
- Complete testing guide
- cPOW reference manual
- Quest-oriented command workflows
- Security mandate documentation

### Performance

- Core bottleneck optimizations
- Eliminated double embedding (validation + overlay generation)
- Faster wizard execution
- Improved progress indicators

---

## [1.6.0] - 2025-10-28

### 🎉 The Shadow + Monument 5.1 - "Lattice-aware Gaussian Weighting"

This release introduces two major innovations building on the defensive publication:

#### Innovation #26: Monument 4.7 - The Shadow

- Dual embedding system for structural and semantic signatures
- Structural embeddings based on AST patterns
- Semantic embeddings based on docstring + type signatures
- Enables both code pattern matching AND mission alignment queries

#### Innovation #27: Monument 5.1 - Lattice-aware Gaussian Weighting

- Pure lattice-based coherence eliminating all hardcoded constants
- Gaussian statistics for signal/noise separation (filters symbols below μ - σ)
- Graph centrality from O₁ reverse_deps (logarithmic scaling)
- Three-tier coherence metrics: Average, Weighted, Lattice

### Added

- **Lattice coherence metric** using pure mathematical derivation
  - Weight formula: `w = centrality × gaussian_significance`
  - `centrality = log10(dependency_count + 1)`
  - `gaussian_significance = max(0.1, 1.0 + z_score)`
  - NO HARDCODED CONSTANTS - all derived from lattice structure
- **Gaussian noise filtering** - excludes symbols below μ - σ (z-score < -1.0)
- **Cross-overlay synthesis** - O₁ (structure) + O₃ (mission) + statistics
- **Debug logging** for centrality calculations with dependency counts
- **Enhanced coherence report** showing all three metrics with deltas

### Fixed

- **Critical bug**: PGCManager initialization in StrategicCoherenceManager
  - Was passing `pgcRoot` instead of `projectRoot`
  - Created incorrect paths (`.open_cognition/.open_cognition/...`)
  - Caused lattice coherence to always return 0%
  - Now correctly passes parent directory via `path.dirname()`

### Results

- **Lattice coherence**: 57.7% (+3.0% from baseline)
- **Gaussian filtering**: Successfully filtering statistical noise
- **Centrality weighting**: Working correctly from reverse_deps
- **Verification**: Debug logs confirm proper dependency lookups

### Documentation

- Updated README with Innovations #26-27
- Updated Zenodo DOI to 10.5281/zenodo.17466998
- Comprehensive release notes on GitHub
- JSDoc comments for all lattice-aware functions

---

## [1.5.0] - 2025-10-26

### 🎉 O₃/O₄ Implementation Release - "Strategic Intelligence Architecture"

This release represents the completion of the Strategic Intelligence Architecture with full implementation of Overlay 3 (Mission Concepts) and Overlay 4 (Strategic Coherence).

### Added

#### O₃ Layer - Mission Concepts

- **Pattern-based concept extraction** with 6 targeted strategies
  - Blockquotes (distilled essence)
  - Headers (structured concepts)
  - Bold text (emphasis markers)
  - Bullet lists (enumerated concepts)
  - Emoji-prefixed lines (visual markers)
  - Quoted phrases (coined terms)
- **97.6% noise reduction** (1,076 → 26 concepts from VISION.md)
- **768-dimensional embeddings** for semantic analysis
- **Recursive meta-cognition** - system extracted its own methodology
- Multi-document aggregation from strategic documentation

#### O₄ Layer - Strategic Coherence

- **Semantic alignment scoring** between code and mission concepts
- **Vector similarity analysis** using cosine similarity
- **Top-N alignment tracking** per code symbol
- **Bidirectional mapping** (code → concepts, concepts → code)
- **Coherence metrics dashboard** with drift detection

#### Security Architecture

- **Multi-layer mission validation**:
  - Gemini LLM content safety (optional)
  - Pattern-based threat detection (fallback)
  - Semantic drift analysis (embedding-based)
  - Structural integrity validation
- **5-pattern attack detection**:
  - Security weakening
  - Trust erosion
  - Permission creep
  - Ambiguity injection
  - Velocity over safety
- **Immutable audit trail** for mission document versions
- **Advisory mode by default** - warns without blocking
- **Configurable security** with transparent thresholds

#### CLI Commands

**Mission Concepts (`cognition-cli concepts`)**:

- `concepts list` - Show all extracted mission concepts
- `concepts for-section <name>` - Filter concepts by section
- `concepts search <query>` - Semantic search in concepts
- `concepts stats` - Extraction statistics

**Strategic Coherence (`cognition-cli coherence`)**:

- `coherence report` - Overall metrics dashboard
- `coherence aligned` - High-alignment symbols (≥ 70%)
- `coherence drifted` - Low-alignment symbols (< 70%)
- `coherence for-symbol <name>` - Detailed symbol analysis
- `coherence compare <s1> <s2>` - Side-by-side comparison

**Overlay Generation**:

- `overlay generate mission_concepts` - Extract concepts from strategic docs
- `overlay generate strategic_coherence` - Compute code-mission alignment

**Documentation Ingestion**:

- `genesis-docs <path>` - Ingest markdown documentation
- `genesis-docs --recursive` - Recursive directory ingestion

### Changed

- **Lattice architecture** now includes 4 overlay dimensions (O₁-O₄)
- **Multi-document strategic coherence** aggregates concepts from all docs
- **Updated README** with O₃/O₄ lattice graph and data flow patterns
- **Enhanced logging** with spinner indicators and progress tracking

### Fixed

- Vector metadata now includes `filePath` and `structuralHash`
- Invalid vector diagnostics improved (shows symbol instead of full record)
- Single-embedding optimization for mission concept generation
- Positive strategic language in concept extraction

### Documentation

- Comprehensive O₃ documentation with extraction algorithm
- Security architecture threat model and defense layers
- Mission drift attack scenarios and detection
- Claude integration guide with TOC
- DocsOracle integration for concept embedding

### Performance

- **Single embedding pass** for mission concepts (no re-embedding)
- **Cached validation** skips security checks for unchanged documents
- **Parallel lineage mining** with optimized worker pools
- **Rate-limited embedding** service with queue management

### Tested

- 79 passing tests across all overlay layers
- Contract tests for VISION.md ingestion
- Security validation test suite
- Multi-document aggregation tests

---

## [1.0.0-prior-art] - 2025-10-25

Initial tag for prior art baseline before O₃/O₄ implementation.

---

## Release Philosophy

**v1.5.0 represents:**

- ✅ Production-ready Strategic Intelligence Architecture
- ✅ Complete 4-dimensional lattice (O₁-O₄)
- ✅ Full CLI with 10+ commands
- ✅ Multi-layer security with mission drift detection
- ✅ Recursive meta-cognitive capability
- ✅ 20 commits of solid engineering
- ✅ 85 passing tests with no external dependencies

**For Zenodo archival and academic citation.**
