# Test Coverage Gap Analysis for cognition-cli

## Context

I need a comprehensive test coverage analysis for the cognition-cli TypeScript codebase. This is a CLI tool for analyzing codebases with a seven-overlay architecture (O1-O7), using LanceDB for vector storage and LLM for analysis.

Key Architecture Components:

    Seven overlays: Structure (O1), Security (O2), Lineage (O3), Mission (O4), Operational (O5), Mathematical (O6), Coherence (O7)
    PGC (Project Grounded Context) with content-addressable storage
    Sigma TUI with compression and conversation continuity
    Workbench integration for embeddings and AST parsing
    Quest system for tracking work

Your Task

Perform an exhaustive test coverage analysis across the entire codebase and generate a prioritized test plan.
Phase 1: Identify Test Gaps

For each directory/component, analyze:

    Critical Paths Without Tests
        Find production code with NO corresponding test files
        Identify high-risk functions (file I/O, security, data persistence)
        Flag async operations without error handling tests

    Edge Cases Not Covered
        Existing tests that only cover happy path
        Missing boundary condition tests (empty arrays, null/undefined, large inputs)
        Missing error path tests (network failures, file not found, permission errors)

    Integration Tests Missing
        Components that interact but have no integration tests
        End-to-end workflows not tested (e.g., genesis → overlay generation → query)
        Cross-overlay interactions

    Race Conditions & Concurrency
        Async operations without concurrency tests
        Worker pools without stress tests
        Compression timing issues

Phase 2: Analyze Existing Tests

Review existing test files (in src/\*\*/**tests**/) and assess:

    Test quality (unit vs integration vs e2e)
    Coverage metrics (if available via npm run test:coverage)
    Brittle tests (mocking too much, testing implementation details)
    Slow tests (>1s per test)

Phase 3: Generate Test Plan

Create a prioritized test plan document with this structure:
Critical Priority (P0) - Must Have

    Security-critical paths (authentication, file permissions, CVE tracking)
    Data integrity (PGC hash validation, overlay consistency)
    User-facing bugs (TUI crashes, CLI command failures)

High Priority (P1) - Should Have

    Core workflows (genesis, compression, session resume)
    Error recovery (timeout handling, retry logic)
    Performance-critical paths (embedding generation, similarity search)

Medium Priority (P2) - Nice to Have

    Edge cases in utility functions
    Additional integration tests for cross-component flows
    Stress tests for long-running operations

Low Priority (P3) - Future

    Exhaustive boundary testing
    Fuzz testing for parsers
    UI snapshot tests

Output Format

Generate a markdown document: docs/architecture/TEST_COVERAGE_ANALYSIS.md

Include:

    Executive Summary
        Total test files vs source files ratio
        Critical gaps summary (top 10 untested files)
        Estimated effort to close gaps

    Test Gap Inventory
        Table format: File Path | Risk Level | Test Status | Priority | Estimated Effort
        Group by overlay/component

    Recommended Test Cases
        For each P0/P1 gap, provide:
            Test description
            Code snippet location
            Suggested test structure (with example)
            Expected coverage improvement

    Existing Test Quality Assessment
        Tests that should be refactored
        Brittle/flaky tests
        Slow tests that need optimization

    Action Plan
        Phased approach (Week 1-4 goals)
        Quick wins (low effort, high impact)
        Long-term improvements

Specific Areas to Focus On

High-Risk Components (prioritize these):

    src/core/security/ - Security validation, transparency logging
    src/sigma/compressor.ts - Context compression logic
    src/tui/hooks/useClaudeAgent.ts - TUI state management, compression triggers
    src/core/pgc/ - Content-addressable storage, integrity checks
    src/core/overlays/ - Overlay generation and algebra operations
    src/sigma/overlays/conversation/ - Conversation overlay managers (7 types)

Known Problem Areas (from recent work):

    Compression race conditions (recently fixed - need regression tests)
    Progress bar UI updates (recently fixed - need visual regression tests)
    Session state persistence (recently fixed - need integration tests)
    Cursor positioning in TUI (recently fixed - need E2E tests)

Constraints

    Focus on actionable recommendations with code examples
    Prioritize by risk × likelihood of failure × impact
    Be exhaustive but pragmatic (don't suggest testing every getter/setter)
    Consider maintainability - avoid tests that are harder to maintain than the code
    Time constraint: Complete analysis within your context window limits

Deliverable Checklist

    Executive summary with key metrics
    Complete test gap inventory (table format)
    Top 20 recommended test cases with examples
    Existing test quality assessment
    Phased action plan (4 weeks)
    Quick wins section (< 2 hours each)

Success Criteria

This analysis is successful if:

    I can immediately start writing tests from your recommendations
    Critical security/data-integrity gaps are identified
    Effort estimates are realistic (1h, 2h, 4h, 8h)
    Test examples are copy-paste ready (or nearly so)
    Document is scannable (tables, bullet points, clear structure)
