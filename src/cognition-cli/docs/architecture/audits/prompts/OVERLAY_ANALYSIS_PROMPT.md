# Deep Overlay Analysis & Workflow Design Prompt

**Purpose**: Comprehensive analysis of Cognition Σ overlay architecture and workflow design

**Status**: ✅ COMPLETED by Claude Code (Sonnet 4.5) on 2025-11-17

**Output**: See `../OVERLAY_ANALYSIS_2025-11-17.md`

**Note**: This prompt kept failing on web Claude (stopped at workflow design #3). Successfully completed in Claude Code with 200K context budget.

---

## Prompt

Deep Overlay Analysis & Workflow Design for Cognition Σ

### Context

You are analyzing Cognition Σ, a verifiable AI-human symbiosis architecture with:

- 67k LOC TypeScript codebase
- Dual-lattice knowledge representation (local + global)
- Seven overlays (O1-O7) for multi-dimensional code analysis
- PGC (Project Generated Content) with SHA-256 content addressing
- Shadow architecture (body + semantic embeddings)
- Intelligent conversation compression (128.8K → 0.4K tokens)
- Current state: Working POC, but overlays are underutilized (~20% of potential)

### The Seven Overlays

**O1 - Structural Overlay**
Purpose: Code organization, module boundaries, architectural patterns
Expected capabilities:

- File/module/function organization
- Architectural pattern detection
- Component boundaries and interfaces
- Code navigation and discovery

**O2 - Security Overlay**
Purpose: Vulnerabilities, attack surface, security patterns
Expected capabilities:

- Vulnerability detection (SQL injection, XSS, etc.)
- Attack surface mapping
- Security pattern identification
- Sensitive data flow tracking
- Blast radius of security issues

**O3 - Lineage Overlay**
Purpose: Dependencies, relationships, blast radius
Expected capabilities:

- Dependency graph (imports, extends, implements, uses)
- Change impact analysis
- Blast radius calculation
- Cross-module relationship mapping
- Transitive dependency tracking

**O4 - Mission Overlay**
Purpose: Intent, goals, alignment with project objectives
Expected capabilities:

- Feature-to-goal mapping
- Purpose drift detection
- Alignment checks
- Gap analysis (goals without implementation)
- Architectural decision rationale

**O5 - Operational Overlay**
Purpose: Runtime behavior, performance, resource usage
Expected capabilities:

- Performance hotspot identification
- Resource usage patterns
- Runtime dependency tracking
- Execution path analysis
- Scalability considerations

**O6 - Mathematical Overlay**
Purpose: Algorithms, complexity, numerical properties
Expected capabilities:

- Algorithm complexity analysis (Big O)
- Numerical stability checks
- Mathematical correctness verification
- Optimization opportunities
- Algorithmic pattern detection

**O7 - Coherence Overlay**
Purpose: Consistency, drift detection, architectural integrity
Expected capabilities:

- Pattern consistency checking
- Architectural drift detection
- Convention adherence
- Cross-module coherence
- Refactoring opportunity identification

### Your Tasks

#### 1. Deep Analysis of Current Implementation

For each overlay (O1-O7):

- Where is it implemented? (file paths, functions, data structures)
- What is it currently doing? (actual functionality)
- What is it NOT doing? (missing capabilities from expected list)
- How is it stored/queried? (database schema, embedding strategy)
- What data does it capture? (actual data points collected)
- How complete is the implementation? (0-100% vs. expected capabilities)

**Deliverable**: Per-overlay implementation assessment with specific gaps identified

#### 2. Cross-Overlay Integration Analysis

Analyze how overlays currently interact:

- Which overlays query each other?
- What cross-overlay workflows exist?
- Where are integration points missing?
- What compound insights are possible but not implemented?
- Example: O2 (Security) should query O3 (Lineage) for security blast radius, but does it?

**Deliverable**: Integration map showing actual vs. ideal overlay interactions

#### 3. Workflow Design: Killer Use Cases

Design 5-7 concrete workflows that fully utilize multiple overlays. Each workflow should:

- Solve a real development problem
- Use at least 3 overlays
- Provide actionable output
- Be implementable as a CLI command

**Template for each workflow**:

- **Workflow**: [Name]
- **Command**: `cognition [command] [args]`
- **Problem**: [What developer pain point does this solve?]
- **Overlays used**: [O1, O3, O7, etc.]
- **Input**: [What data/context is needed?]
- **Processing**: [How do overlays combine to produce insight?]
- **Output**: [What does the developer get? Be specific.]
- **Example**: [Show realistic output]
- **Implementation complexity**: [Low/Medium/High]
- **Value**: [Why is this useful?]

**Example workflows to design**:

- PR Impact Analysis (O1+O2+O3+O4+O7)
- Security Audit Report (O2+O3+O5)
- Refactoring Opportunity Detection (O1+O6+O7)
- Feature-Mission Alignment Check (O1+O4+O7)
- Performance Regression Risk (O3+O5+O6)
- Architectural Drift Report (O1+O4+O7)
- Dependency Health Analysis (O3+O5+O7)

**Deliverable**: Detailed workflow specifications ready for implementation

#### 4. Gap Analysis

Identify what's missing to enable full overlay utilization:

**Data gaps**:

- What information isn't being captured that should be?
- What embeddings are missing?
- What metadata isn't tracked?

**Query gaps**:

- What queries are impossible with current data?
- What overlay combinations can't be performed?
- What insights require additional indexing?

**Tooling gaps**:

- What CLI commands are needed but don't exist?
- What visualizations would help?
- What integrations are missing (IDE, CI/CD, etc.)?

**Architecture gaps**:

- What prevents certain analyses?
- What refactoring would unlock new capabilities?
- What performance bottlenecks limit scale?

**Deliverable**: Prioritized gap list with implementation effort estimates

#### 5. Utilization Roadmap

Create a phased plan to increase overlay utilization from 20% → 80%+:

**Phase 1: Quick Wins (1-2 weeks)**

- Low-hanging fruit workflows
- High value, low complexity
- Prove overlay value

**Phase 2: Core Workflows (3-4 weeks)**

- Implement 3-5 killer workflows
- Cross-overlay integration
- Developer adoption

**Phase 3: Advanced Capabilities (5-8 weeks)**

- Complex multi-overlay analysis
- Visualization and reporting
- Ecosystem integration

**Deliverable**: Phased roadmap with specific tasks, dependencies, and success metrics

#### 6. Concrete Implementation Recommendations

For the top 3 most valuable workflows, provide:

- Detailed pseudocode/algorithm
- Database queries needed
- New data to collect
- CLI command syntax
- Expected output format
- Test cases
- Estimated implementation time

**Deliverable**: Implementation-ready specifications for top 3 workflows

### Output Format

Provide your analysis as a structured markdown document with:

1. **Executive Summary** (1 page)
   - Current state assessment
   - Key gaps identified
   - Top 3 recommendations

2. **Per-Overlay Analysis** (O1-O7)
   - Current state
   - Gaps
   - Recommendations

3. **Workflow Catalog** (5-7 workflows)
   - Full specifications per template above

4. **Gap Analysis**
   - Data/Query/Tooling/Architecture gaps
   - Prioritized with effort estimates

5. **Utilization Roadmap**
   - 3-phase plan
   - Specific tasks and timelines

6. **Implementation Specs** (Top 3 workflows)
   - Ready for development

### Key Questions to Answer

1. What's the single most valuable workflow currently missing?
2. Which overlay has the most wasted potential?
3. What one architectural change would unlock the most value?
4. What prevents overlays from being used together effectively?
5. What would make developers actually use these overlays daily?

### Success Criteria

Your analysis succeeds if:

- ✅ Identifies specific, actionable gaps
- ✅ Designs workflows developers would actually use
- ✅ Provides implementation-ready specifications
- ✅ Creates clear roadmap from 20% → 80% utilization
- ✅ Focuses on practical value over theoretical completeness

---

## Execution Notes

**Attempted**: 3 times on web Claude (claude.ai max pro)
**Result**: Failed at same line each time (Workflow Design #3-4)
**Root Cause**:

- Output length: ~35,000 tokens estimated
- Web Claude limit: ~8,000 output tokens
- Reasoning tokens: ~16,000
- Total budget: ~24,000 tokens (insufficient)

**Solution**: Executed in Claude Code with 200K context budget
**Actual Usage**: 119K tokens (well under 150K compression threshold)
**Duration**: ~30 minutes with 4 parallel exploration agents

**Key Differences**:

- Claude Code: 200K context budget, can run parallel agents
- Web Claude: ~24K total budget, single-threaded
- Result: Analysis 100% complete with all 7 workflows + implementation specs

## Related Documents

- Analysis Output: `../OVERLAY_ANALYSIS_2025-11-17.md`
- Previous Audits: See `../` directory
- Implementation Status: Track via GitHub issues/milestones
