# Error Handling & Recovery Audit for cognition-cli

## Context

I need a comprehensive error handling audit for the cognition-cli TypeScript codebase. This is a CLI tool with file I/O, network operations, LanceDB storage, and a React-based TUI.

Architecture Overview:

    Seven overlays with vector storage (LanceDB)
    File operations (PGC content-addressable storage)
    Network operations (optional workbench API)
    TUI with React/Ink
    Async worker pools for parsing/embedding
    Session management with compression

Your Task

Perform an exhaustive audit of error handling patterns and identify fragile code paths. Generate a prioritized remediation plan.
Phase 1: Critical Issues (P0)
1.1 Unhandled Promise Rejections

What to find:

    Async functions without try-catch blocks
    .then() chains without .catch()
    Async event handlers in TUI without error boundaries
    Promises passed to setTimeout/setInterval without error handling
    Worker pool operations without error handlers

Example patterns to search for:

// BAD: No error handling
async function loadData() {
const data = await fs.readFile(path);
return data;
}

// BAD: Then without catch
fetchData().then(process);

// GOOD: Proper handling
async function loadData() {
try {
const data = await fs.readFile(path);
return data;
} catch (error) {
logger.error('Failed to load data', { path, error });
throw new DataLoadError(`Cannot load ${path}`, { cause: error });
}
}

Focus areas:

    src/core/pgc/ - File operations
    src/core/executors/workbench/ - Network operations
    src/tui/hooks/ - Async React hooks
    src/core/overlays/*/patterns.ts - Worker pools

1.2 File I/O Without Error Handling

What to find:

    fs.readFile, fs.writeFile, fs.mkdir without error checks
    File operations without permission error handling
    No fallback when files don't exist
    Path operations without validation (path traversal risks)

Example issues:

// BAD: No error handling
await fs.writeFile(filePath, data);

// BAD: No permission check
const content = await fs.readFile('/root/secret');

// GOOD: Proper handling
try {
await fs.writeFile(filePath, data);
} catch (error) {
if (error.code === 'EACCES') {
throw new PermissionError(`No write access to ${filePath}`);
}
throw error;
}

1.3 Security-Sensitive Errors

What to find:

    Error messages that leak file paths
    Stack traces exposed to users
    API keys or tokens in error messages
    Detailed internal errors shown in CLI output

Example issues:

// BAD: Leaks full path
throw new Error(`Failed to read /home/user/.env`);

// GOOD: Generic message
throw new Error('Failed to read configuration file');

Phase 2: High Priority (P1)
2.1 Missing Retry Logic

What to find:

    Network operations (workbench API) without retry
    LanceDB operations without reconnection logic
    Transient failures not handled (ECONNRESET, ETIMEDOUT)

Focus areas:

    src/core/executors/workbench/client.ts
    src/core/overlays/vector-db/

2.2 Inconsistent Error Patterns

What to find:

    Mix of thrown errors vs returned errors
    Inconsistent error types (Error vs custom classes)
    Errors without context (which file failed? which operation?)
    No error codes or types for programmatic handling

2.3 Resource Cleanup

What to find:

    Open file handles not closed on error
    Worker pools not terminated on failure
    Database connections not closed
    Intervals/timers not cleared on error

Example:

// BAD: File handle leak
const fd = await fs.open(path, 'r');
const data = await fd.read(); // Might throw
await fd.close();

// GOOD: Cleanup guaranteed
const fd = await fs.open(path, 'r');
try {
const data = await fd.read();
return data;
} finally {
await fd.close();
}

Phase 3: Analysis of Existing Error Handling

Review existing error handling patterns and assess:

    Custom error classes: Are they used consistently?
    Error wrapping: Are root causes preserved (use { cause } option)?
    Logging: Are errors logged with sufficient context?
    User experience: Are error messages helpful to users?
    Recovery: Can the system recover or does it crash?

Phase 4: Recommended Patterns

For each category of issue, provide:

    Current problematic pattern (code example)
    Recommended pattern (code example)
    Migration strategy (how to fix existing code)
    Prevention (linting rules, code review checklist)

Output Format

Create: docs/architecture/ERROR_HANDLING_AUDIT.md
Structure

## Error Handling Audit Report

**Date**: {YYYY-MM-DD}
**Scope**: Full codebase
**Risk Assessment**: {Critical/High/Medium/Low}

## Executive Summary

- **Total issues found**: {number}
- **Critical (P0)**: {number}
- **High (P1)**: {number}
- **Medium (P2)**: {number}
- **Estimated remediation effort**: {hours}

## Critical Issues Inventory (P0)

| File                         | Line | Issue Type          | Risk     | Suggested Fix | Effort |
| ---------------------------- | ---- | ------------------- | -------- | ------------- | ------ |
| src/core/pgc/object-store.ts | 142  | Unhandled rejection | Critical | Add try-catch | 30m    |
| ...                          | ...  | ...                 | ...      | ...           | ...    |

{Top 20 critical issues}

## High Priority Issues (P1)

{Similar table format, top 15 issues}

## Recommended Error Handling Patterns

### Pattern 1: File I/O Operations

**Current (problematic)**:

```typescript
async function loadConfig() {
  const data = await fs.readFile(CONFIG_PATH);
  return JSON.parse(data);
}

Recommended:

async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new ConfigNotFoundError(`Config file not found at ${CONFIG_PATH}`);
    }
    if (error instanceof SyntaxError) {
      throw new ConfigParseError('Invalid JSON in config file', { cause: error });
    }
    throw new ConfigLoadError('Failed to load configuration', { cause: error });
  }
}

{Continue with patterns for: Network operations, Database operations, Worker pools, TUI error boundaries, etc.}
Quick Wins (< 2 hours each)

    Add try-catch to all fs operations in src/core/pgc/
        Files: 5
        Estimated effort: 1.5h
        Impact: Prevents file operation crashes

    Wrap workbench API calls in retry logic
        Files: 2
        Estimated effort: 1h
        Impact: Resilience to network failures

{List top 10 quick wins}
Long-term Improvements

    Create custom error hierarchy
        Define base error classes (FileError, NetworkError, ValidationError)
        Effort: 4h
        Impact: Consistent error handling across codebase

    Add error boundary to TUI
        Catch React errors gracefully
        Effort: 2h
        Impact: Prevents TUI crashes

{List 5-8 strategic improvements}
Existing Error Handling Assessment
Strengths

    {What's done well}

Weaknesses

    {What needs improvement}

Inconsistencies

    {Where patterns differ}

Action Plan
Week 1: Critical Fixes (P0)

    Fix unhandled rejections in pgc operations
    Add file I/O error handling
    Remove sensitive data from error messages

Week 2: High Priority (P1)

    Add retry logic to workbench client
    Implement resource cleanup in worker pools
    Standardize error types

Week 3-4: Strategic Improvements

    Create custom error hierarchy
    Add TUI error boundary
    Document error handling patterns

Code Review Checklist

Future PRs should verify:

    All async functions have try-catch
    File operations handle ENOENT, EACCES
    Network operations have retry logic
    Errors include context (file path, operation)
    No sensitive data in error messages
    Resources cleaned up in finally blocks

Appendix: Scanning Methodology

{How you found these issues - grep patterns, manual review, etc.}


## Specific Areas to Audit (Priority Order)

1. **src/core/security/** - Security-critical, must have perfect error handling
2. **src/core/pgc/** - File I/O, data integrity critical
3. **src/core/executors/workbench/** - Network operations
4. **src/tui/hooks/useClaudeAgent.ts** - Complex async flows
5. **src/core/overlays/*/patterns.ts** - Worker pools
6. **src/sigma/compressor.ts** - Compression race conditions
7. **src/tui/hooks/session/** - Session state persistence

## Success Criteria

1. **Comprehensive**: Cover all high-risk areas
2. **Actionable**: Each issue has a suggested fix with effort estimate
3. **Prioritized**: P0/P1/P2 clear and justifiable
4. **Practical**: Quick wins identified for immediate impact
5. **Strategic**: Long-term improvements defined
```
