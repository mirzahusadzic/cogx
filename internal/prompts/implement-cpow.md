# Task: Implement cPOW (Cognitive Proof of Work) System

## Context

You are implementing the cPOW Operational Loop for Cognition Σ - a complete system that transforms user intent into validated work with cryptographic computational receipts.

Working Directory: ~/src/cogx/src/cognition-cli
What is cPOW?

Cognitive Proof of Work (cPOW) is an immutable computational receipt that proves:

    Work was performed (Quest execution)
    Oracle validated quality (eGemma validation)
    Wisdom extracted (high AQS → CoMP patterns)
    Provenance tracked (commit hash, lineage)

Unlike traditional PoW (mining), cPOW proves cognitive value creation through the G→T→O feedback loop.
The Specification

You have a complete working specification in:

    docs/manual/part-5-cpow-loop/20-cpow-reference.md (2265 lines - formal spec)
    docs/architecture/CPOW_OPERATIONAL_LOOP.md (1054 lines - architecture)

These documents contain:

    Formal mathematical foundations
    8-phase operational loop specification
    Complete API reference with TypeScript interfaces
    Implementation guide with examples
    Validation and security considerations

Your Mission

Implement the cPOW system following the specification, making it production-ready.
Phase 1: Deep Specification Understanding (60 min)
Explore the Specification

Your mission: Understand the cPOW system deeply - not just surface-level.

    Read the specification documents:
        Start with CPOW_OPERATIONAL_LOOP.md (architecture overview)
        Deep dive into 20-cpow-reference.md (formal spec)
        Understand the mathematical foundations
        Study the API reference
        Review the implementation examples

    Map the 8 phases:
        Phase 1: Quest Initialization (G)
        Phase 2: G→T→O Feedback Loop
        Phase 3: Four-Layered Trust Boundary (F.L.T.B)
        Phase 4: Commit
        Phase 5: PGC Update
        Phase 6: cPOW Generation
        Phase 7: AQS Computation
        Phase 8: Wisdom Distillation (CoMP)

    Understand the data flow:
        Input: User intent
        Output: cPOW receipt + (optionally) CoMP wisdom
        Storage: Where does everything go?
        Verification: How are cPOWs verified?

    Identify key concepts:
        Quest: Unit of work with intent + transforms
        Transform: Atomic code modification (create/modify/delete/refactor)
        Oracle: External validator (eGemma) evaluating quality
        cPOW: Immutable receipt with computational cost
        AQS: Agentic Quality Score (0-1 scale)
        CoMP: Cognitive Micro-Tuning Payload (distilled wisdom)
        F.L.T.B: Four-Layered Trust Boundary (validation gates)

Deliverable: Architecture summary - what you understand about cPOW.
Phase 2: Existing Codebase Exploration (45 min)
Find What Already Exists

Your mission: Discover what's already implemented vs. what needs to be built.

    Quest system:
        Is there a src/core/quest/ directory?
        Are there Quest-related types or interfaces?
        Is there any Quest management code?

    Oracle integration:
        How does the system currently interact with eGemma/workbench?
        Are there Oracle-related APIs?
        Is there validation infrastructure?

    cPOW storage:
        Where are overlays stored? (.open_cognition/pgc/overlays/)
        Is there existing cPOW metadata in overlays?
        Is there a cPOW storage structure?

    Transform system:
        How are file changes currently tracked?
        Is there a transform abstraction?
        Is there a git integration?

    Related systems:
        Coherence calculation (for AQS)
        Overlay generation (for PGC updates)
        Genesis commands (for ingestion)

Deliverable: Gap analysis - what exists vs. what needs to be built.
Phase 3: Architecture Design (60 min)
Design the Implementation

Your mission: Create a clean architecture that implements the spec.
3.1 Module Structure

Design the module boundaries:

src/core/
├── quest/
│ ├── types.ts # Quest, Transform, Oracle interfaces
│ ├── quest-init.ts # Phase 1: Quest initialization
│ ├── transform.ts # Transform generation & application
│ ├── oracle.ts # Phase 2: Oracle integration
│ └── quest-executor.ts # G→T→O loop orchestration
├── cpow/
│ ├── types.ts # cPOW, AQS, CoMP interfaces
│ ├── cpow-generator.ts # Phase 6: cPOW generation
│ ├── aqs-computer.ts # Phase 7: AQS computation
│ ├── wisdom-distiller.ts# Phase 8: CoMP generation
│ └── cpow-verifier.ts # cPOW verification
├── validation/
│ ├── fltb.ts # Phase 3: Four-Layered Trust Boundary
│ ├── validators/ # Individual layer validators
│ └── oracle-client.ts # eGemma API client
└── storage/
├── pgc-updater.ts # Phase 5: PGC updates
├── lineage.ts # Transform chain tracking
└── comp-storage.ts # CoMP storage & retrieval

3.2 API Design

Following the spec, what should the API look like?

// Quest Management
await questInit(options): Promise<Quest>
await generateTransform(options): Promise<Transform>
await applyTransform(transform): Promise<CodebaseState>
await evaluateTransform(options): Promise<OracleResponse>

// Validation
await validateFLTB(options): Promise<FLTBResult>

// cPOW
await generateCPOW(options): Promise<CPOW>
await verifyCPOW(cpow): Promise<VerificationResult>

// AQS & Wisdom
await computeAQS(options): Promise<AQSResult>
await distillWisdom(options): Promise<CoMP>
await queryPatterns(options): Promise<CoMP[]>

// Storage
await updatePGC(options): Promise<void>

3.3 Data Models

Define the TypeScript interfaces from the spec:

    Quest
    Transform
    CodebaseState
    OracleResponse
    CPOW
    AQSResult
    CoMP
    FLTBResult

3.4 Integration Points

How does cPOW integrate with existing systems?

    Overlay generation (add cPOW metadata)
    Git commits (track commit hashes)
    eGemma/workbench (Oracle validation)
    CLI commands (expose Quest execution)

Deliverable: Architecture design document with module structure and API surface.
Phase 4: Implementation Strategy (30 min)
Plan the Build

Your mission: Break implementation into manageable phases.

Phase 0: Foundation (Core types and utilities)

    Define all TypeScript interfaces from spec
    Create basic Quest and cPOW types
    Set up storage structure

Phase 1: Quest System (Quest initialization & management)

    Implement questInit()
    Implement Transform generation
    Implement Transform application
    Add Git integration

Phase 2: Oracle Integration (External validation)

    Build eGemma API client
    Implement evaluateTransform()
    Add Oracle response handling
    Handle timeouts and errors

Phase 3: F.L.T.B Validation (Four-layered trust boundary)

    Layer 1: Syntax validation (lint, build, test)
    Layer 2: Mission alignment (coherence check)
    Layer 3: Security coverage (attack vector scan)
    Layer 4: Pattern compliance (anti-pattern detection)

Phase 4: cPOW Generation (Receipt creation)

    Implement cPOW generation logic
    Add checksum computation (SHA-256)
    Implement cPOW storage
    Build verification system

Phase 5: AQS & Wisdom (Quality scoring and learning)

    Implement AQS computation formula
    Build wisdom distiller (high AQS → CoMP)
    Create CoMP templates
    Add pattern query system

Phase 6: Integration & Testing (Make it work end-to-end)

    Integrate with CLI commands
    Add comprehensive tests
    Test with real Quest execution
    Verify cPOW integrity

Deliverable: Phased implementation roadmap with effort estimates.
Phase 5: Implementation (As Time Allows)
Build the cPOW System

Your mission: Implement following the specification and your design.
Guidelines

    Follow the spec precisely:
        API signatures should match the spec
        Data structures should match the spec
        Formulas (AQS, cPOW magnitude) should match the spec

    Use existing patterns:
        Study how overlays are currently generated
        Follow existing TypeScript conventions
        Reuse existing utilities (SHA-256, file I/O, etc.)

    Error handling:
        Oracle timeouts (spec mentions this)
        F.L.T.B failures (retry logic)
        Coherence drift (validation failures)
        Transform application errors

    TypeScript best practices:
        Strict typing (no any)
        Proper async/await error handling
        Clean interfaces exported from modules

    Storage considerations:
        Where do cPOWs live? (.open_cognition/pgc/cpow/)
        How are CoMPs stored? (.open_cognition/docs/comps/)
        How is lineage tracked? (.open_cognition/pgc/lineage.json)

What to Build First

Start with Phase 0 + Phase 1 (Foundation + Quest System):

    Core types
    Quest initialization
    Transform system
    Basic storage

This gives a working Quest system before adding cPOW generation.
Phase 6: Testing & Validation (45 min)
Verify the Implementation

Your mission: Test that cPOW works as specified.
Unit Tests

Test each component:

    Quest initialization
    Transform generation
    Oracle response handling
    cPOW generation
    AQS computation
    Wisdom distillation

Integration Tests

Test end-to-end flows:

    Simple Quest:
        Initialize quest ("Add a hello world function")
        Generate 1-2 transforms
        Mock Oracle responses
        Generate cPOW
        Verify cPOW integrity

    High-AQS Quest:
        Execute quest with high quality (few steps, no corrections, optimizations)
        Compute AQS > 0.7
        Trigger wisdom distillation
        Verify CoMP generated
        Verify CoMP queryable

    F.L.T.B Validation:
        Test all 4 layers
        Simulate failures
        Verify correction tracking

Verification Tests

Verify cPOW properties:

    Immutability: cPOW doesn't change after generation
    Uniqueness: No two Quests produce identical cPOWs
    Verifiability: verifyCPOW() correctly validates checksums, Oracle signatures, transform chain

Deliverable: Test suite with unit + integration + verification tests.
Phase 7: Documentation & Handoff (30 min)
Document What You Built

Create: docs/architecture/audits/CPOW_IMPLEMENTATION_REPORT.md

Include:

    Implementation Summary
        What was implemented
        What matches the spec
        Any deviations from the spec (with rationale)

    Architecture
        Module structure
        Key design decisions
        Integration points
        Data flow diagrams

    API Reference
        All public functions
        Example usage
        Error handling

    Storage Format
        cPOW file format
        CoMP file format
        Lineage tracking format

    Testing Summary
        Test coverage
        Integration test scenarios
        Verification test results

    Known Limitations
        What's not yet implemented
        Edge cases not handled
        Performance considerations

    Next Steps
        Remaining work (if any)
        Recommended improvements
        Integration with TUI (future work)

Success Criteria

✅ Specification deeply understood (not just skimmed)
✅ Gap analysis complete (know what exists vs. what to build)
✅ Architecture designed (clean module structure)
✅ Core types implemented (Quest, Transform, cPOW, AQS, CoMP)
✅ At least Quest System working (Phase 0 + Phase 1)
✅ Tests written (unit + integration)
✅ Documentation complete (implementation report)
✅ cPOW can be generated (even if simplified)
✅ cPOW can be verified (checksum validation works)
Your Mission

Put yourself in the shoes of a user executing their first Quest:

You type: cognition quest "Implement rate limiting for auth endpoint"

What happens?

    Quest initialized - Intent parsed, baseline captured, success criteria defined
    G→T→O loop - Transforms generated, applied, validated by Oracle
    F.L.T.B - All validation layers pass (syntax, alignment, security, patterns)
    Commit - Changes committed to git
    cPOW generated - Immutable receipt created with computational cost
    AQS computed - Quality score calculated (efficiency × accuracy × adaptability)
    Wisdom distilled - If AQS > 0.7, CoMP created and stored
    Understanding crystallized - Knowledge becomes queryable for future Quests

Right now, this doesn't exist yet.

Your job is to make it real. Build the system that proves work was done, validates quality, and distills wisdom.

Don't just implement code. Build trust. Build provenance. Build evolution.
